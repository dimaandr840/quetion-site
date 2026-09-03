package com.devprep.api.service;

import com.devprep.api.domain.Level;
import com.devprep.api.domain.Question;
import com.devprep.api.observability.IntegrationStatusService;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.repository.QuestionSpecifications;
import com.devprep.api.search.MeilisearchService;
import com.devprep.api.search.SearchProperties;
import com.devprep.api.web.dto.QuestionSummaryDto;
import com.devprep.api.web.dto.SearchResponseDto;
import com.devprep.api.web.dto.SearchResponseDto.ProfessionFacetDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Повторяет searchQuestions/countByLevel/professionCountsFor из lib/queries.ts.
 * Основной путь — Meilisearch (опечатки + фасеты), фолбэк — ILIKE по базе.
 *
 * <p>Падение индекса не является ошибкой запроса: поиск обязан ответить 200 в упрощённом
 * режиме. Пятисотка здесь стоит дороже худшего ранжирования: на странице поиска она
 * выглядит как полностью упавший сайт.
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class SearchService {

    private static final Locale RU = Locale.forLanguageTag("ru");

    /** Сколько документов минимум забираем из индекса ради фасетов по всей выдаче. */
    private static final int MAX_HITS = 200;

    public static final String MODE_INDEX = "index";
    public static final String MODE_DATABASE = "database";
    public static final String MODE_FALLBACK = "fallback";
    public static final String MODE_DEEP_PAGE = "deep-page";

    private final QuestionRepository questionRepository;
    private final ProfessionRepository professionRepository;
    private final ContentMapper mapper;
    private final Optional<MeilisearchService> meilisearch;
    private final SearchProperties properties;
    private final IntegrationStatusService status;

    public SearchService(
            QuestionRepository questionRepository,
            ProfessionRepository professionRepository,
            ContentMapper mapper,
            Optional<MeilisearchService> meilisearch,
            SearchProperties properties,
            IntegrationStatusService status) {
        this.questionRepository = questionRepository;
        this.professionRepository = professionRepository;
        this.mapper = mapper;
        this.meilisearch = meilisearch;
        this.properties = properties;
        this.status = status;
    }

    public SearchResponseDto search(String query, Set<Level> levels, Set<String> professionSlugs) {
        return search(query, levels, professionSlugs, 0, properties.getPageSize());
    }

    public SearchResponseDto search(
            String query,
            Set<Level> levels,
            Set<String> professionSlugs,
            int pageParam,
            int sizeParam) {
        String normalized = query == null ? "" : query.trim();
        int size = normalizeSize(sizeParam);
        int page = Math.max(0, pageParam);
        long offset = (long) page * size;

        // Meilisearch отдаёт не больше maxTotalHits документов и за этой границей молча
        // возвращает пустую страницу вместо ошибки. Глубокую пагинацию обслуживает база.
        boolean deepPage = offset + size > properties.getMaxTotalHits();
        boolean indexConfigured = !normalized.isBlank() && meilisearch.isPresent();

        List<Question> hits = null;
        String mode = MODE_DATABASE;
        boolean degraded = false;

        if (indexConfigured && !deepPage) {
            if (indexKnownDown()) {
                degraded = true;
            } else {
                try {
                    int limit =
                            (int)
                                    Math.min(
                                            properties.getMaxTotalHits(),
                                            Math.max(MAX_HITS, offset + size));
                    MeilisearchService.MeiliHits result =
                            meilisearch.get().search(normalized, levels, professionSlugs, limit);
                    hits = orderedBySlug(result.slugs());
                    mode = MODE_INDEX;
                    status.searchUp();
                    status.searchServedFromIndex();
                } catch (RuntimeException e) {
                    log.warn("Meilisearch: поиск не удался, используем базу. {}", e.getMessage());
                    status.searchDown(e.getClass().getSimpleName());
                    degraded = true;
                }
            }
        }

        if (hits == null) {
            hits = fallback(normalized, levels, professionSlugs);
            mode =
                    degraded
                            ? MODE_FALLBACK
                            : (indexConfigured && deepPage ? MODE_DEEP_PAGE : MODE_DATABASE);
            status.searchServedFromFallback();
        }

        // Фасеты считаем по всей выдаче, а не по странице: иначе счётчики фильтров
        // меняются при листании и выглядят сломанными.
        Map<Level, Long> levelCounts = countByLevel(hits);
        List<ProfessionFacetDto> professionCounts = professionCountsFor(hits);

        List<QuestionSummaryDto> items =
                pageOf(hits, offset, size).stream().map(mapper::toSummary).toList();
        return new SearchResponseDto(
                normalized,
                hits.size(),
                page,
                size,
                items,
                levelCounts,
                professionCounts,
                MODE_INDEX.equals(mode),
                mode,
                degraded);
    }

    /**
     * Фоновый пробник уже знает, что индекс лежит — не тратим таймаут на каждый запрос
     * пользователя. Именно ожидание таймаута превращает падение поиска в деградацию всего
     * сайта.
     */
    private boolean indexKnownDown() {
        return status.searchStatus().state() == IntegrationStatusService.State.DOWN;
    }

    private int normalizeSize(int requested) {
        if (requested <= 0) {
            return properties.getPageSize();
        }
        return Math.min(requested, properties.getMaxPageSize());
    }

    private static List<Question> pageOf(List<Question> all, long offset, int size) {
        if (offset >= all.size()) {
            return List.of();
        }
        int from = (int) offset;
        int to = (int) Math.min(all.size(), offset + size);
        return all.subList(from, to);
    }

    /**
     * Фолбэк: фильтры и подстрочный поиск делает база, но порядок и точное совпадение подстроки
     * дополнительно проверяются в памяти — так поведение совпадает с фронтендом
     * (toLocaleLowerCase("ru") + includes).
     */
    private List<Question> fallback(String query, Set<Level> levels, Set<String> professionSlugs) {
        List<Question> candidates =
                questionRepository.findAll(
                        QuestionSpecifications.search(query, levels, professionSlugs));
        String needle = query.toLowerCase(RU);
        return candidates.stream()
                .filter(question -> needle.isBlank() || haystack(question).contains(needle))
                .sorted(Comparator.comparing(Question::getId))
                .toList();
    }

    private String haystack(Question question) {
        List<String> parts = new ArrayList<>();
        parts.add(question.getTitle());
        parts.add(question.getSnippet());
        parts.add(question.getTldr());
        parts.addAll(question.getTags());
        parts.add(mapper.path(question));
        return String.join(" ", parts).toLowerCase(RU);
    }

    private List<Question> orderedBySlug(List<String> slugs) {
        if (slugs.isEmpty()) {
            return List.of();
        }
        Map<String, Question> bySlug = new LinkedHashMap<>();
        questionRepository.findBySlugIn(slugs).forEach(q -> bySlug.put(q.getSlug(), q));
        return slugs.stream().map(bySlug::get).filter(java.util.Objects::nonNull).toList();
    }

    /** Все три уровня присутствуют всегда, включая нулевые — как в countByLevel. */
    private Map<Level, Long> countByLevel(List<Question> questions) {
        Map<Level, Long> counts = new EnumMap<>(Level.class);
        for (Level level : Level.values()) {
            counts.put(level, 0L);
        }
        questions.forEach(question -> counts.merge(question.getLevel(), 1L, Long::sum));
        return counts;
    }

    /** Нулевые профессии отбрасываются — как в professionCountsFor. */
    private List<ProfessionFacetDto> professionCountsFor(List<Question> questions) {
        Map<String, Long> counts = new LinkedHashMap<>();
        questions.forEach(
                question -> counts.merge(question.getProfession().getSlug(), 1L, Long::sum));

        return professionRepository.findAllByOrderBySortOrderAsc().stream()
                .filter(profession -> counts.getOrDefault(profession.getSlug(), 0L) > 0)
                .map(
                        profession ->
                                new ProfessionFacetDto(
                                        profession.getSlug(),
                                        profession.getTitle(),
                                        profession.getEmoji(),
                                        counts.get(profession.getSlug())))
                .toList();
    }
}
