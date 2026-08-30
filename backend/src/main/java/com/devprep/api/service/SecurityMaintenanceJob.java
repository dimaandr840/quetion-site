package com.devprep.api.service;

import com.devprep.api.repository.LoginAttemptRepository;
import com.devprep.api.repository.RefreshTokenRepository;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Чистка служебных таблиц. Без неё {@code refresh_token} и {@code login_attempt} растут неограниченно,
 * а журнал попыток входа — ещё и персональные данные, которые не должны храниться дольше нужного.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SecurityMaintenanceJob {

    /** Отозванные и просроченные токены держим ещё сутки — на случай разбора инцидента. */
    private static final Duration TOKEN_RETENTION = Duration.ofDays(1);

    private static final Duration ATTEMPT_RETENTION = Duration.ofDays(30);

    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void cleanup() {
        Instant now = Instant.now();
        int tokens = refreshTokenRepository.deleteExpiredBefore(now.minus(TOKEN_RETENTION));
        int attempts = loginAttemptRepository.deleteOlderThan(now.minus(ATTEMPT_RETENTION));
        if (tokens > 0 || attempts > 0) {
            log.info("Очистка: удалено {} refresh-токенов и {} записей о входах", tokens, attempts);
        }
    }
}
