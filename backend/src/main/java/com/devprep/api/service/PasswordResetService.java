package com.devprep.api.service;

import com.devprep.api.config.SecurityProperties;
import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.LoginAttempt;
import com.devprep.api.domain.PasswordResetToken;
import com.devprep.api.repository.AppUserRepository;
import com.devprep.api.repository.LoginAttemptRepository;
import com.devprep.api.repository.PasswordResetTokenRepository;
import com.devprep.api.repository.RefreshTokenRepository;
import com.devprep.api.security.AuthCookieService;
import com.devprep.api.web.dto.AuthRequests;
import com.devprep.api.web.dto.AuthResponse;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Самостоятельное восстановление доступа по почте — замена резервных кодов.
 *
 * <p>Главное свойство: адрес, на который уходит код, нигде не раскрывается. Пользователь сам
 * вводит адрес; если он совпал с адресом включённой учётки — письмо отправляется, если нет —
 * не отправляется. Ответ API в обоих случаях побайтово одинаковый и не содержит ни адреса, ни
 * его маски, поэтому форма не превращается ни в справочник почтовых адресов, ни в проверку
 * существования аккаунтов. По той же причине ни адрес, ни код не пишутся в логи.
 *
 * <p>Ограничители злоупотреблений: rate limit по IP (общий с входом), пауза между письмами,
 * один активный код на учётку, лимит попыток ввода и ограниченный срок жизни кода.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final String INVALID_CODE = "Неверный или истекший код восстановления";

    /** Без похожих символов (0/O, 1/I): код переносят глазами из письма. */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AppUserRepository appUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailer mailer;
    private final AuthCookieService cookieService;
    private final SecurityProperties securityProperties;

    /**
     * Шаг 1: запрос кода.
     *
     * <p>Ответ не зависит от того, существует ли учётка: всегда возвращается только срок жизни
     * кода.
     */
    @Transactional
    public AuthResponse.PasswordResetRequestedDto request(String rawEmail, String ip) {
        SecurityProperties.PasswordReset config = securityProperties.getPasswordReset();
        AuthResponse.PasswordResetRequestedDto response =
                new AuthResponse.PasswordResetRequestedDto(
                        Math.max(1, config.getTtl().toMinutes()));

        if (!config.isEnabled()) {
            log.warn("Запрошен сброс пароля, но он отключён настройками");
            return response;
        }

        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);

        String email = normalizeEmail(rawEmail);
        Optional<AppUser> found =
                appUserRepository.findByEmailIgnoreCase(email).filter(AppUser::isEnabled);
        if (found.isEmpty()) {
            // Намеренно молчаливый выход: иначе форма превратится в переборщик адресов.
            log.info("Запрос восстановления для неизвестного или выключенного адреса");
            return response;
        }
        AppUser user = found.get();

        Optional<PasswordResetToken> active =
                passwordResetTokenRepository.findFirstByUserAndUsedAtIsNullOrderByIdDesc(user);
        if (active.isPresent()
                && active.get().getRequestedAt() != null
                && active.get().getRequestedAt().isAfter(now.minus(config.getCooldown()))) {
            log.info("Повторный запрос кода раньше паузы — письмо не отправлено");
            return response;
        }

        // Активный код всегда ровно один: старые теряют силу сразу.
        passwordResetTokenRepository.deleteAllForUser(user);

        String code = generateCode();
        passwordResetTokenRepository.save(
                PasswordResetToken.builder()
                        .user(user)
                        .codeHash(passwordEncoder.encode(normalizeCode(code)))
                        .expiresAt(now.plus(config.getTtl()))
                        .attempts(0)
                        .requestedAt(now)
                        .requestedIp(truncate(ip, 64))
                        .build());

        mailer.send(user.getEmail(), code, config.getTtl());
        return response;
    }

    /**
     * Шаг 2: подтверждение кода и установка нового пароля.
     *
     * <p>Любая неудача возвращает одно и то же сообщение: по тексту ошибки нельзя понять, есть
     * ли такой адрес и был ли по нему заказан код.
     *
     * @return cookie, гасящие все сессии в текущем браузере
     */
    @Transactional
    public List<String> confirm(AuthRequests.PasswordResetConfirm request, String ip) {
        SecurityProperties.PasswordReset config = securityProperties.getPasswordReset();
        if (!config.isEnabled()) {
            throw new BadCredentialsException(INVALID_CODE);
        }

        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);

        String email = normalizeEmail(request.email());
        AppUser user =
                appUserRepository
                        .findByEmailIgnoreCase(email)
                        .filter(AppUser::isEnabled)
                        .orElse(null);
        if (user == null) {
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }

        PasswordResetToken token =
                passwordResetTokenRepository
                        .findFirstByUserAndUsedAtIsNullOrderByIdDesc(user)
                        .orElse(null);
        if (token == null || !token.isUsable(now)) {
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        if (token.getAttempts() >= config.getMaxAttempts()) {
            // Код аннулируется целиком: иначе 8 символов можно добивать бесконечно.
            passwordResetTokenRepository.deleteAllForUser(user);
            recordFailure(email, ip, now);
            log.warn("Исчерпан лимит попыток ввода кода восстановления — код аннулирован");
            throw new BadCredentialsException(INVALID_CODE);
        }
        if (!passwordEncoder.matches(normalizeCode(request.code()), token.getCodeHash())) {
            token.setAttempts(token.getAttempts() + 1);
            passwordResetTokenRepository.save(token);
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }

        token.setUsedAt(now);
        passwordResetTokenRepository.save(token);

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(now);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        if (config.isResetTotp()) {
            // Сценарий «потерял телефон»: без этого человек сменит пароль, но всё равно
            // не войдёт. Новый секрет выдаётся при следующем входе.
            user.setTotpSecret(null);
            user.setTotpEnabled(false);
            user.setTotpLastUsedStep(null);
        }
        appUserRepository.save(user);

        passwordResetTokenRepository.deleteAllForUser(user);
        refreshTokenRepository.revokeAllForUser(user, now);
        log.warn("Пароль сброшен по коду из письма, все сессии отозваны");

        return List.of(cookieService.clearAll());
    }

    private static String generateCode() {
        StringBuilder builder = new StringBuilder(CODE_LENGTH + 1);
        for (int i = 0; i < CODE_LENGTH; i++) {
            if (i == CODE_LENGTH / 2) {
                builder.append('-');
            }
            builder.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return builder.toString();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    /** Код сравнивается без регистра, дефисов и пробелов: его копируют руками. */
    private static String normalizeCode(String code) {
        return code == null ? "" : code.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }

    /**
     * Неудачные попытки пишутся в тот же журнал, что и попытки входа — иначе перебор кодов
     * обходил бы IP-лимит.
     */
    private void recordFailure(String email, String ip, Instant now) {
        loginAttemptRepository.save(
                LoginAttempt.builder()
                        .email(truncate(email, 256))
                        .ipAddress(truncate(ip == null || ip.isBlank() ? "unknown" : ip, 64))
                        .successful(false)
                        .attemptedAt(now)
                        .build());
    }

    private void enforceIpRateLimit(String ip, Instant now) {
        SecurityProperties.RateLimit config = securityProperties.getRateLimit();
        if (!config.isEnabled() || ip == null || ip.isBlank()) {
            return;
        }
        Instant since = now.minus(config.getWindow());
        if (loginAttemptRepository.countFailuresByIpSince(ip, since)
                >= config.getMaxFailuresPerIp()) {
            log.warn("Превышен лимит попыток с IP {} — восстановление отклонено", ip);
            throw new TooManyAttemptsException(config.getWindow());
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
