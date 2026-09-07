package com.devprep.api.service;

import com.devprep.api.domain.Level;
import com.devprep.api.domain.Question;
import com.devprep.api.observability.IntegrationStatusService;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.repository.QuestionSpecifications;
import com.devprep.api.search.MeilisearchService;
import com.devprep.api.search.SearchProperties;
import com.devprep.api.web.dto.SearchResponseDto;
import com.devprep.api.web.dto.SearchResponseDto.ProfessionFacetDto;
import java.text.Collator;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** All facets and filters operate on the same complete candidate set, never a page. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchService {
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

    public SearchResponseDto search(String query, Set<Level> levels, Set<String> professions) {
        return search(query, levels, professions, 0, properties.getPageSize());
    }
    public SearchResponseDto search(String query, Set<Level> levels, Set<String> professions,
            int page, int size) {
        return search(query, levels, professions, page, size, false, "popular");
    }
    public SearchResponseDto search(String query, Set<Level> levels, Set<String> professions,
            int pageParam, int sizeParam, boolean onlyPopular, String sort) {
        String normalized = query == null ? "" : query.trim();
        int size = sizeParam <= 0 ? properties.getPageSize() : Math.min(sizeParam, properties.getMaxPageSize());
        List<Question> candidates = null;
        String mode = MODE_DATABASE;
        boolean degraded = false;
        if (!normalized.isBlank() && meilisearch.isPresent()) {
            if (status.searchStatus().state() == IntegrationStatusService.State.DOWN) {
                degraded = true;
            } else {
                try {
                    int limit = Math.max(1, properties.getMaxTotalHits());
                    var hits = meilisearch.get().search(normalized, Set.of(), Set.of(), limit);
                    // Estimated totals are not exact. A full window MAY be truncated:
                    // fail over for the whole query, not just for later pages.
                    if (hits.total() < limit && hits.slugs().size() < limit) {
                        Map<String, Question> bySlug = new LinkedHashMap<>();
                        questionRepository.findBySlugIn(hits.slugs()).stream()
                                .filter(Question::isPublished).forEach(q -> bySlug.put(q.getSlug(), q));
                        candidates = hits.slugs().stream().map(bySlug::get)
                                .filter(java.util.Objects::nonNull).toList();
                        mode = MODE_INDEX;
                        status.searchServedFromIndex();
                    } else {
                        // Explicitly signal loss of fuzzy search rather than claiming complete index results.
                        degraded = true;
                    }
                    status.searchUp();
                } catch (RuntimeException e) {
                    status.searchDown(e.getClass().getSimpleName());
                    log.warn("Search index unavailable: {}", e.getClass().getSimpleName());
                    degraded = true;
                }
            }
        }
        if (candidates == null) {
            candidates = questionRepository.findAll(QuestionSpecifications.search(normalized, Set.of(), Set.of()));
            mode = degraded ? MODE_FALLBACK : MODE_DATABASE;
            // Normal DB-only operation is not degraded traffic.
            if (degraded) status.searchServedFromFallback();
        }
        final List<Question> all = candidates;
        Map<Level, Long> levelCounts = new EnumMap<>(Level.class);
        for (Level level : Level.values()) levelCounts.put(level, 0L);
        all.stream().filter(q -> matchesProfession(q, professions) && (!onlyPopular || q.isPopular()))
                .forEach(q -> levelCounts.merge(q.getLevel(), 1L, Long::sum));
        Map<String, Long> professionCounts = new LinkedHashMap<>();
        all.stream().filter(q -> matchesLevel(q, levels) && (!onlyPopular || q.isPopular()))
                .forEach(q -> professionCounts.merge(q.getProfession().getSlug(), 1L, Long::sum));
        List<ProfessionFacetDto> facets = professionRepository.findAllByOrderBySortOrderAsc().stream()
                .map(p -> new ProfessionFacetDto(p.getSlug(), p.getTitle(), p.getEmoji(),
                        professionCounts.getOrDefault(p.getSlug(), 0L))).toList();
        long popularCount = all.stream().filter(q -> matchesLevel(q, levels)
                && matchesProfession(q, professions) && q.isPopular()).count();
        List<Question> matched = all.stream().filter(q -> matchesLevel(q, levels)
                        && matchesProfession(q, professions) && (!onlyPopular || q.isPopular()))
                .sorted(order(sort)).toList();
        int lastPage = matched.isEmpty() ? 0 : (matched.size() - 1) / size;
        int page = Math.min(Math.max(0, pageParam), lastPage);
        int from = page * size;
        var items = matched.subList(from, Math.min(matched.size(), from + size))
                .stream().map(mapper::toSummary).toList();
        return new SearchResponseDto(normalized, matched.size(), page, size, items,
                levelCounts, facets, MODE_INDEX.equals(mode), mode, degraded, all.size(), popularCount);
    }
    private static boolean matchesLevel(Question q, Set<Level> levels) {
        return levels.isEmpty() || levels.contains(q.getLevel());
    }
    private static boolean matchesProfession(Question q, Set<String> professions) {
        return professions.isEmpty() || professions.contains(q.getProfession().getSlug());
    }
    private static Comparator<Question> order(String sort) {
        Comparator<Question> tie = Comparator.comparing(Question::getId);
        if ("alpha".equals(sort)) {
            Collator ru = Collator.getInstance(Locale.forLanguageTag("ru"));
            return Comparator.comparing(Question::getTitle, (String a, String b) -> ru.compare(a, b)).thenComparing(tie);
        }
        if ("level".equals(sort)) {
            return Comparator.comparingInt((Question q) -> switch (q.getLevel().name().toLowerCase(Locale.ROOT)) {
                case "junior" -> 0;
                case "middle" -> 1;
                default -> 2;
            }).thenComparing(tie);
        }
        return Comparator.comparing(Question::isPopular).reversed().thenComparing(tie);
    }
}
