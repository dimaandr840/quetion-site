package com.devprep.api.flags;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Рантайм-флаги: таблица в базе + кэш в памяти.
 *
 * <p>Чтение флага стоит чтения поля из volatile-карты, а не запроса в базу: флаги проверяются
 * на горячем пути, и обращение в базу на каждый вызов превратило бы фичефлаги
 * в источник латентности.
 *
 * <p>Если база недоступна, сервис продолжает отдавать последний успешный снимок, а если
 * снимка ещё не было — значения из конфигурации. Флаги не должны быть причиной
 * недоступности сайта.
 */
@Service
public class FeatureFlagService {

    private static final Logger log = LoggerFactory.getLogger(FeatureFlagService.class);

    /** Значение флага в кэше. */
    public record FlagValue(boolean enabled, int rolloutPercentage) {}

    private final FeatureFlagRepository repository;
    private final FeatureFlagProperties properties;

    private volatile Map<String, FlagValue> cache = Map.of();
    private volatile Instant loadedAt = Instant.EPOCH;

    public FeatureFlagService(FeatureFlagRepository repository, FeatureFlagProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void bootstrap() {
        seedDefaults();
        refresh();
    }

    /** Отсутствующие ключи создаются один раз; существующие никогда не перезатираются. */
    public void seedDefaults() {
        properties.getDefaults().forEach((rawKey, value) -> {
            String key = normalize(rawKey);
            try {
                if (repository.existsById(key)) {
                    return;
                }
                FeatureFlag flag = new FeatureFlag();
                flag.setKey(key);
                flag.setEnabled(Boolean.TRUE.equals(value));
                flag.setRolloutPercentage(100);
                flag.setDescription("Создан автоматически из devprep.flags.defaults");
                flag.setUpdatedAt(Instant.now());
                flag.setUpdatedBy("system");
                repository.save(flag);
            }
            catch (RuntimeException ex) {
                log.warn("Не удалось создать флаг {}: {}", key, ex.getClass().getSimpleName());
            }
        });
    }

    @Scheduled(fixedDelayString = "${devprep.flags.cache-ttl:PT15S}")
    public void refresh() {
        try {
            Map<String, FlagValue> loaded = new LinkedHashMap<>();
            for (FeatureFlag flag : repository.findAll()) {
                loaded.put(flag.getKey(), new FlagValue(flag.isEnabled(), flag.getRolloutPercentage()));
            }
            cache = Map.copyOf(loaded);
            loadedAt = Instant.now();
        }
        catch (RuntimeException ex) {
            // Старый снимок лучше пустого: иначе кратковременный сбой базы массово
            // выключит функциональность у всех пользователей сразу.
            log.warn("Не удалось обновить кэш фичефлагов, используем предыдущий снимок: {}",
                    ex.getClass().getSimpleName());
        }
    }

    /**
     * @param discriminator стабильный идентификатор клиента для частичной раскатки;
     *     может быть null — тогда частично раскатанный флаг считается выключенным
     */
    public boolean isEnabled(String rawKey, String discriminator) {
        String key = normalize(rawKey);
        FlagValue value = cache.get(key);
        if (value == null) {
            return Boolean.TRUE.equals(properties.getDefaults().get(key));
        }
        if (!value.enabled() || value.rolloutPercentage() <= 0) {
            return false;
        }
        if (value.rolloutPercentage() >= 100) {
            return true;
        }
        if (discriminator == null || discriminator.isBlank()) {
            return false;
        }
        // Ключ входит в хеш, чтобы один и тот же пользователь не оказывался всегда
        // в первых процентах по всем флагам сразу.
        int bucket = Math.floorMod((key + ":" + discriminator).hashCode(), 100);
        return bucket < value.rolloutPercentage();
    }

    /** Снимок всех известных флагов, разрешённых для конкретного клиента. */
    public Map<String, Boolean> snapshot(String discriminator) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        properties.getDefaults().keySet().forEach(key -> result.put(normalize(key), false));
        cache.keySet().forEach(key -> result.put(key, false));
        result.replaceAll((key, ignored) -> isEnabled(key, discriminator));
        return result;
    }

    public List<FeatureFlag> listAll() {
        List<FeatureFlag> flags = new ArrayList<>(repository.findAll());
        flags.sort((left, right) -> left.getKey().compareTo(right.getKey()));
        return flags;
    }

    /** Упсерт: администратор может создать новый ключ без миграции и деплоя. */
    public FeatureFlag update(
            String rawKey, Boolean enabled, Integer rolloutPercentage, String description, String actor) {
        String key = normalize(rawKey);
        FeatureFlag flag = repository.findById(key).orElseGet(() -> {
            FeatureFlag created = new FeatureFlag();
            created.setKey(key);
            return created;
        });
        if (enabled != null) {
            flag.setEnabled(enabled);
        }
        if (rolloutPercentage != null) {
            flag.setRolloutPercentage(Math.clamp(rolloutPercentage, 0, 100));
        }
        if (description != null) {
            flag.setDescription(description);
        }
        flag.setUpdatedAt(Instant.now());
        flag.setUpdatedBy(actor);
        FeatureFlag saved = repository.save(flag);
        // Обновляем кэш сразу: иначе админ переключает флаг, обновляет страницу
        // и видит старое значение — после чего переключает его ещё раз.
        refresh();
        return saved;
    }

    public Instant lastLoadedAt() {
        return loadedAt;
    }

    public Duration cacheTtl() {
        return properties.getCacheTtl();
    }

    private static String normalize(String key) {
        return key == null ? "" : key.trim().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
