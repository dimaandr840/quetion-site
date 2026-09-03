package com.devprep.api.flags;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Настройки слоя фичефлагов.
 *
 * <p>{@code defaults} — это не дублирование базы, а страховка: если база недоступна или
 * строки ещё не посеяны, приложение должно вести себя предсказуемо, а не выключать
 * всё подряд (включая аутентификацию).
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "devprep.flags")
public class FeatureFlagProperties {

    /** Как часто перечитывать таблицу. Компромисс между скоростью раскатки и нагрузкой. */
    private Duration cacheTtl = Duration.ofSeconds(15);

    /** Значения по умолчанию; при старте отсутствующие ключи создаются в базе. */
    private Map<String, Boolean> defaults = new LinkedHashMap<>();
}
