package com.devprep.api.search;

import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.service.ContentMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

@Slf4j
@Configuration
@ConditionalOnProperty(prefix = "devprep.search", name = "enabled", havingValue = "true")
public class SearchConfiguration {

    /** Реиндексация идёт после импорта сида — см. @Order на SeedImporter. */
    public static final int REINDEX_ORDER = 200;

    @Bean
    public MeilisearchService meilisearchService(
            SearchProperties properties,
            QuestionRepository questionRepository,
            ContentMapper mapper,
            ObjectMapper objectMapper) {
        return new MeilisearchService(properties, questionRepository, mapper, objectMapper);
    }

    @Bean
    @Order(REINDEX_ORDER)
    @ConditionalOnProperty(
            prefix = "devprep.search",
            name = "reindex-on-startup",
            havingValue = "true",
            matchIfMissing = true)
    public ApplicationRunner meilisearchReindexRunner(MeilisearchService meilisearchService) {
        return args -> {
            if (meilisearchService.isHealthy()) {
                meilisearchService.reindexAll();
            } else {
                log.warn("Meilisearch недоступен — поиск будет работать через базу (ILIKE).");
            }
        };
    }
}
