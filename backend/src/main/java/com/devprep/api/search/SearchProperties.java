package com.devprep.api.search;

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
}
