package com.devprep.api.service;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.BackupCode;
import com.devprep.api.repository.BackupCodeRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Резервные коды второго фактора.
 *
 * <p>Зачем: обязательный TOTP без обходного пути превращает потерю телефона в потерю админки —
 * остаётся только аварийная команда на сервере. Коды дают самообслуживание без второго вектора
 * атаки вида «восстановление по почте».
 *
 * <p>Свойства:
 *
 * <ul>
 *   <li>код показывается ровно один раз — в БД уходит только BCrypt-хеш;
 *   <li>код одноразовый: после успешного входа он помечается использованным;
 *   <li>новый набор полностью замещает старый, чтобы не оставалось «забытых» действующих кодов.
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BackupCodeService {

    /** Сколько кодов в наборе. */
    public static final int CODES_PER_SET = 10;

    /** Ниже этого остатка пора выпускать новый набор. */
    public static final long LOW_WATERMARK = 3;

    /** Без похожих символов (0/O, 1/I): код переписывают руками. */
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private static final int GROUPS = 3;
    private static final int GROUP_LENGTH = 4;

    private final BackupCodeRepository backupCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    /**
     * Выпускает новый набор, удаляя все предыдущие коды.
     *
     * @return коды в открытом виде — единственный момент, когда их можно показать
     */
    @Transactional
    public List<String> reissue(AppUser user) {
        backupCodeRepository.deleteByUser(user);
        List<String> plain = new ArrayList<>(CODES_PER_SET);
        List<BackupCode> entities = new ArrayList<>(CODES_PER_SET);
        for (int i = 0; i < CODES_PER_SET; i++) {
            String code = generateCode();
            plain.add(code);
            entities.add(
                    BackupCode.builder()
                            .user(user)
                            .codeHash(passwordEncoder.encode(normalize(code)))
                            .build());
        }
        backupCodeRepository.saveAll(entities);
        log.info("Выпущен новый набор резервных кодов ({}) для {}", CODES_PER_SET, user.getEmail());
        return plain;
    }

    /**
     * Проверяет код и гасит его при совпадении.
     *
     * <p>Перебор по неиспользованным кодам неизбежен: хеш BCrypt содержит собственную соль, так что
     * найти запись по значению нельзя. Кодов всего {@value #CODES_PER_SET}, а сама ручка прикрыта
     * блокировкой учётки и rate limit по IP.
     */
    @Transactional
    public boolean verifyAndConsume(AppUser user, String rawCode) {
        String normalized = normalize(rawCode);
        if (normalized.length() != GROUPS * GROUP_LENGTH) {
            return false;
        }
        for (BackupCode candidate : backupCodeRepository.findByUserAndUsedAtIsNull(user)) {
            if (passwordEncoder.matches(normalized, candidate.getCodeHash())) {
                candidate.setUsedAt(Instant.now());
                backupCodeRepository.save(candidate);
                long left = backupCodeRepository.countByUserAndUsedAtIsNull(user);
                log.warn(
                        "Вход по резервному коду: {}. Осталось кодов: {}", user.getEmail(), left);
                if (left <= LOW_WATERMARK) {
                    log.warn(
                            "Резервные коды {} почти израсходованы — выпустите новый набор",
                            user.getEmail());
                }
                return true;
            }
        }
        return false;
    }

    @Transactional(readOnly = true)
    public long countRemaining(AppUser user) {
        return backupCodeRepository.countByUserAndUsedAtIsNull(user);
    }

    @Transactional(readOnly = true)
    public long countTotal(AppUser user) {
        return backupCodeRepository.countByUser(user);
    }

    /** Формат {@code XXXX-XXXX-XXXX}: читаемо глазами и удобно переносить в менеджер паролей. */
    private String generateCode() {
        StringBuilder out = new StringBuilder(GROUPS * GROUP_LENGTH + GROUPS - 1);
        for (int group = 0; group < GROUPS; group++) {
            if (group > 0) {
                out.append('-');
            }
            for (int i = 0; i < GROUP_LENGTH; i++) {
                out.append(ALPHABET[random.nextInt(ALPHABET.length)]);
            }
        }
        return out.toString();
    }

    /** Сравниваем без разделителей, пробелов и регистра: код вводит человек. */
    public static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
    }
}
