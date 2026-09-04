package com.devprep.api.search;

import java.time.Duration;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "devprep.search")
public class SearchProperties {

    /** Включать ли Meilisearch. При false поиск идёт по базе через ILIKE. */
    private boolean enabled = false;

    private String host = "http://localhost:7700";

    /** Master/search key. Берётся из переменной окружения, дефолта в репозитории нет. */
    private String apiKey;

    private String index = "questions";

    /** Реиндексировать при старте приложения. */
    private boolean reindexOnStartup = true;

    /**
     * Потолок выдачи Meilisearch (его собственный maxTotalHits, по умолчанию 1000).
     *
     * <p>За этой границей индекс молча отдаёт пустую страницу вместо ошибки, поэтому глубокие
     * страницы обслуживает Postgres.
     */
    private int maxTotalHits = 1000;

    /** Размер страницы поиска по умолчанию. */
    private int pageSize = 20;

    /** Потолок размера страницы: защита от {@code ?size=100000} из строки запроса. */
    private int maxPageSize = 50;

    /** Период фоновой проверки живости индекса. */
    private Duration healthCheckInterval = Duration.ofSeconds(30);
}
