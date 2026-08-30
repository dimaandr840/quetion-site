package com.devprep.api.service;

import com.devprep.api.domain.Level;
import com.devprep.api.domain.Question;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.repository.QuestionSpecifications;
import com.devprep.api.search.MeilisearchService;
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
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class SearchService {

    private static final Locale RU = Locale.forLanguageTag("ru");
    private static final int MAX_HITS = 200;

    private final QuestionRepository questionRepository;
    private final ProfessionRepository professionRepository;
    private final ContentMapper mapper;
    private final Optional<MeilisearchService> meilisearch;

    public SearchService(
            QuestionRepository questionRepository,
            ProfessionRepository professionRepository,
            ContentMapper mapper,
            Optional<MeilisearchService> meilisearch) {
        this.questionRepository = questionRepository;
        this.professionRepository = professionRepository;
        this.mapper = mapper;
        this.meilisearch = meilisearch;
    }

    public SearchResponseDto search(String query, Set<Level> levels, Set<String> professionSlugs) {
        String normalized = query == null ? "" : query.trim();

        List<Question> hits = null;
        boolean fromIndex = false;

        if (!normalized.isBlank() && meilisearch.isPresent() && meilisearch.get().isHealthy()) {
            try {
                MeilisearchService.MeiliHits result =
                        meilisearch.get().search(normalized, levels, professionSlugs, MAX_HITS);
                hits = orderedBySlug(result.slugs());
                fromIndex = true;
            } catch (RuntimeException e) {
                log.warn("Meilisearch: поиск не удался, используем базу. {}", e.getMessage());
            }
        }

        if (hits == null) {
            hits = fallback(normalized, levels, professionSlugs);
        }

        List<QuestionSummaryDto> items = hits.stream().map(mapper::toSummary).toList();
        return new SearchResponseDto(
                normalized,
                items.size(),
                items,
                countByLevel(hits),
                professionCountsFor(hits),
                fromIndex);
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
