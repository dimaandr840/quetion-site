package com.devprep.api.config;

import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "devprep.cors")
public class CorsProperties {

    /** Источники фронтенда, которым разрешены запросы к API. */
    private List<String> allowedOrigins = List.of("http://localhost:3000");
}
