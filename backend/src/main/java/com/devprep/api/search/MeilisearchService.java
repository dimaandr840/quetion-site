package com.devprep.api.search;

import com.devprep.api.domain.Level;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.service.AfterCommit;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Slf4j
public class MeilisearchService {
    private final SearchProperties properties;
    private final QuestionRepository questionRepository;
    private final ContentMapper mapper;
    private final ObjectMapper objectMapper;
    private final Client client;
    @Autowired private PlatformTransactionManager transactionManager;

    public MeilisearchService(SearchProperties properties, QuestionRepository questionRepository,
            ContentMapper mapper, ObjectMapper objectMapper) {
        this.properties = properties;
        this.questionRepository = questionRepository;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.client = new Client(new Config(properties.getHost(), properties.getApiKey()));
    }
    public boolean isHealthy() {
        try { return Boolean.TRUE.equals(client.isHealthy()); }
        catch (RuntimeException e) { return false; }
    }
    @Transactional(readOnly = true)
    public void reindexAll() {
        List<QuestionDocument> documents = questionRepository.findByPublishedTrueOrderByIdAsc().stream()
                .map(q -> QuestionDocument.of(q, mapper.path(q))).toList();
        AfterCommit.run(() -> {
            try {
                Index index = client.index(properties.getIndex());
                applySettings(index);
                index.deleteAllDocuments();
                index.addDocuments(objectMapper.writeValueAsString(documents), "id");
            } catch (Exception e) {
                log.error("Search reindex failed: {}", e.getClass().getSimpleName());
            }
        });
    }
    public void indexOne(String slug) { AfterCommit.run(() -> indexCommitted(slug)); }
    private void indexCommitted(String slug) {
        // Read committed state in a fresh transaction, not the completed transaction's persistence context.
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.setReadOnly(true);
        QuestionDocument document = tx.execute(ignored -> questionRepository.findBySlug(slug)
                .filter(com.devprep.api.domain.Question::isPublished)
                .map(q -> QuestionDocument.of(q, mapper.path(q))).orElse(null));
        if (document == null) { deleteCommitted(slug); return; }
        try {
            client.index(properties.getIndex()).addDocuments(objectMapper.writeValueAsString(List.of(document)), "id");
        } catch (Exception e) {
            log.error("Search document update failed: {}", e.getClass().getSimpleName());
        }
    }
    public void deleteOne(String slug) { AfterCommit.run(() -> deleteCommitted(slug)); }
    private void deleteCommitted(String slug) {
        try { client.index(properties.getIndex()).deleteDocument(slug); }
        catch (Exception e) { log.error("Search document delete failed: {}", e.getClass().getSimpleName()); }
    }
    public MeiliHits search(String query, Collection<Level> levels,
            Collection<String> professions, int limit) {
        SearchRequest request = new SearchRequest(query == null ? "" : query).setLimit(limit)
                .setAttributesToRetrieve(new String[] {"slug"})
                .setFacets(new String[] {"level", "industrySlug", "professionSlug", "specializationSlug"});
        List<String> filters = new ArrayList<>();
        if (levels != null && !levels.isEmpty()) filters.add(orFilter("level", levels.stream().map(Level::name).toList()));
        if (professions != null && !professions.isEmpty()) filters.add(orFilter("professionSlug", professions));
        if (!filters.isEmpty()) request.setFilter(filters.toArray(String[]::new));
        SearchResult result = (SearchResult) client.index(properties.getIndex()).search(request);
        return new MeiliHits(result.getHits().stream().map(hit -> String.valueOf(hit.get("slug"))).toList(),
                result.getEstimatedTotalHits());
    }
    private void applySettings(Index index) {
        HashMap<String, Integer> sizes = new HashMap<>();
        sizes.put("oneTypo", 4); sizes.put("twoTypos", 8);
        index.updateSettings(new Settings()
                .setSearchableAttributes(QuestionDocument.searchableAttributes().toArray(String[]::new))
                .setFilterableAttributes(QuestionDocument.filterableAttributes().toArray(String[]::new))
                .setTypoTolerance(new TypoTolerance().setEnabled(true).setMinWordSizeForTypos(sizes)));
    }
    private static String orFilter(String attribute, Collection<String> values) {
        return values.stream().map(v -> attribute + " = \"" + v.replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
                .reduce((a, b) -> a + " OR " + b).orElse("");
    }
    public record MeiliHits(List<String> slugs, long total) {}
}
