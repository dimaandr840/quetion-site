package com.devprep.api.search;

import com.devprep.api.domain.Level;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.service.ContentMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.meilisearch.sdk.Client;
import com.meilisearch.sdk.Config;
import com.meilisearch.sdk.Index;
import com.meilisearch.sdk.SearchRequest;
import com.meilisearch.sdk.model.SearchResult;
import com.meilisearch.sdk.model.Settings;
import com.meilisearch.sdk.model.TypoTolerance;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

/**
 * Индексация и поиск в Meilisearch. Опечатки покрывает встроенная typo tolerance, фасеты —
 * facetDistribution по level и professionSlug.
 */
@Slf4j
public class MeilisearchService {

    private final SearchProperties properties;
    private final QuestionRepository questionRepository;
    private final ContentMapper mapper;
    private final ObjectMapper objectMapper;
    private final Client client;

    public MeilisearchService(
            SearchProperties properties,
            QuestionRepository questionRepository,
            ContentMapper mapper,
            ObjectMapper objectMapper) {
        this.properties = properties;
        this.questionRepository = questionRepository;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.client = new Client(new Config(properties.getHost(), properties.getApiKey()));
    }

    public boolean isHealthy() {
        try {
            return Boolean.TRUE.equals(client.isHealthy());
        } catch (RuntimeException e) {
            log.debug("Meilisearch недоступен: {}", e.getMessage());
            return false;
        }
    }

    @Transactional(readOnly = true)
    public void reindexAll() {
        List<QuestionDocument> documents =
                questionRepository.findByPublishedTrueOrderByIdAsc().stream()
                        .map(q -> QuestionDocument.of(q, mapper.path(q)))
                        .toList();
        try {
            Index index = client.index(properties.getIndex());
            applySettings(index);
            index.deleteAllDocuments();
            index.addDocuments(objectMapper.writeValueAsString(documents), "id");
            log.info("Meilisearch: проиндексировано документов — {}", documents.size());
        } catch (Exception e) {
            log.warn("Meilisearch: индексация не удалась, поиск пойдёт по базе. {}", e.getMessage());
        }
    }

    public void indexOne(String slug) {
        questionRepository
                .findBySlug(slug)
                .ifPresent(
                        question -> {
                            try {
                                client.index(properties.getIndex())
                                        .addDocuments(
                                                objectMapper.writeValueAsString(
                                                        List.of(
                                                                QuestionDocument.of(
                                                                        question,
                                                                        mapper.path(question)))),
                                                "id");
                            } catch (Exception e) {
                                log.warn(
                                        "Meilisearch: не удалось обновить документ {}: {}",
                                        slug,
                                        e.getMessage());
                            }
                        });
    }

    public void deleteOne(String slug) {
        try {
            client.index(properties.getIndex()).deleteDocument(slug);
        } catch (Exception e) {
            log.warn("Meilisearch: не удалось удалить документ {}: {}", slug, e.getMessage());
        }
    }

    /** Возвращает slug-и найденных вопросов в порядке релевантности. */
    public MeiliHits search(
            String query, Collection<Level> levels, Collection<String> professionSlugs, int limit) {
        SearchRequest request =
                new SearchRequest(query == null ? "" : query)
                        .setLimit(limit)
                        .setAttributesToRetrieve(new String[] {"slug"})
                        .setFacets(
                                new String[] {
                                    "level", "industrySlug", "professionSlug", "specializationSlug"
                                });

        List<String> filters = new ArrayList<>();
        if (levels != null && !levels.isEmpty()) {
            filters.add(orFilter("level", levels.stream().map(Level::name).toList()));
        }
        if (professionSlugs != null && !professionSlugs.isEmpty()) {
            filters.add(orFilter("professionSlug", professionSlugs));
        }
        if (!filters.isEmpty()) {
            request.setFilter(filters.toArray(String[]::new));
        }

        SearchResult result = (SearchResult) client.index(properties.getIndex()).search(request);
        List<String> slugs =
                result.getHits().stream().map(hit -> String.valueOf(hit.get("slug"))).toList();
        return new MeiliHits(slugs, result.getEstimatedTotalHits());
    }

    private void applySettings(Index index) {
        HashMap<String, Integer> minWordSize = new HashMap<>();
        minWordSize.put("oneTypo", 4);
        minWordSize.put("twoTypos", 8);

        Settings settings =
                new Settings()
                        .setSearchableAttributes(
                                QuestionDocument.searchableAttributes().toArray(String[]::new))
                        .setFilterableAttributes(
                                QuestionDocument.filterableAttributes().toArray(String[]::new))
                        .setTypoTolerance(
                                new TypoTolerance()
                                        .setEnabled(true)
                                        .setMinWordSizeForTypos(minWordSize));
        index.updateSettings(settings);
    }

    private static String orFilter(String attribute, Collection<String> values) {
        return values.stream()
                .map(v -> attribute + " = \"" + v.replace("\"", "") + "\"")
                .reduce((a, b) -> a + " OR " + b)
                .orElse("");
    }

    public record MeiliHits(List<String> slugs, long total) {}
}
