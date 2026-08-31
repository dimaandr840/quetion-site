package com.devprep.api.service;

import com.devprep.api.repository.QuestionImageRepository;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Уборка объектов-сирот.
 *
 * <p>Загрузка файла и сохранение вопроса — два отдельных запроса, и между ними админ может
 * закрыть окно. Такой объект уже лежит в хранилище, но ни на один вопрос не ссылается; без
 * уборки бакет медленно наполняется мусором, за который в конце концов платят.
 *
 * <p>Сутки отсрочки обязательны: без них задача снесла бы файл, который прямо сейчас висит
 * в открытой форме и ещё не сохранён.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MediaMaintenanceJob {

    private static final Duration ORPHAN_GRACE_PERIOD = Duration.ofDays(1);

    private final MediaService mediaService;
    private final QuestionImageRepository questionImageRepository;

    @Scheduled(cron = "0 40 3 * * *")
    public void cleanupOrphans() {
        if (!mediaService.isEnabled()) {
            return;
        }
        Set<String> referenced = new HashSet<>(questionImageRepository.findAllStorageKeys());
        List<String> orphans =
                mediaService.listKeysOlderThan(ORPHAN_GRACE_PERIOD).stream()
                        .filter(key -> !referenced.contains(key))
                        .toList();
        if (orphans.isEmpty()) {
            return;
        }
        mediaService.deleteQuietly(orphans);
        log.info("Очистка хранилища: удалено {} несвязанных изображений", orphans.size());
    }
}
