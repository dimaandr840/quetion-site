package com.devprep.api.security;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "devprep.jwt")
public class JwtProperties {

    /** HMAC-секрет. Задаётся только через переменную окружения JWT_SECRET, минимум 32 байта. */
    private String secret;

    private String issuer = "devprep";

    private Duration accessTokenTtl = Duration.ofMinutes(15);

    private Duration refreshTokenTtl = Duration.ofDays(30);
}
