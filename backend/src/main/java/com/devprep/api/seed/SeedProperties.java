package com.devprep.api.seed;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "devprep.seed")
public class SeedProperties {

    /** Заливать ли seed/content.json при старте, если база пуста. */
    private boolean enabled = true;
}
