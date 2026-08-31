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
 * Восстановление доступа по почте — замена резервных кодов.
 *
 * <p>Свойства контура:
 *
 * <ul>
 *   <li>адрес получателя никогда не отдаётся наружу: в ответе только маска того адреса, который
 *       ввёл сам пользователь ({@code d****@g*****.com}) — она не добавляет знания о том, какой
 *       адрес привязан к учётке;
 *   <li>ответ на запрос кода одинаков и для существующего, и для несуществующего адреса (202 +
 *       та же маска), поэтому перечислить учётки через эту форму нельзя;
 *   <li>в БД лежит только BCrypt-хеш кода; код одноразовый, живёт {@code ttl} и аннулируется
 *       после {@code max-attempts} неверных вводов;
 *   <li>неудачные попытки пишутся в журнал входов, поэтому на форму действует общий лимит по IP;
 *   <li>успешный сброс отзывает все сессии, а при {@code reset-totp=true} ещё и стирает привязку
 *       аутентификатора — это и закрывает сценарий «потерял телефон», ради которого раньше
 *       существовали резервные коды.
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    /** Единый текст на все причины отказа: подсказывать, что именно не так, нельзя. */
    private static final String INVALID_CODE = "Код недействителен или устарел";

    /** Без похожих друг на друга символов: код диктуют и переписывают руками. */
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private static final int GROUPS = 2;
    private static final int GROUP_LENGTH = 4;

    private final AppUserRepository appUserRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordResetMailer mailer;
    private final PasswordEncoder passwordEncoder;
    private final AuthCookieService cookieService;
    private final SecurityProperties securityProperties;
    private final SecureRandom random = new SecureRandom();

    /**
     * Шаг 1: пользователь вводит адрес, на который должен уйти код. Письмо уходит только если
     * адрес совпал с адресом учётки, но ответ во всех случаях одинаковый.
     */
    @Transactional
    public AuthResponse.PasswordResetRequestedDto request(String rawEmail, String ip) {
        SecurityProperties.PasswordReset config = securityProperties.getPasswordReset();
        String email = normalizeEmail(rawEmail);
        AuthResponse.PasswordResetRequestedDto answer =
                new AuthResponse.PasswordResetRequestedDto(
                        maskEmail(email), Math.max(1, config.getTtl().toMinutes()));

        if (!config.isEnabled()) {
            log.warn("Сброс пароля по почте выключен настройкой — запрос проигнорирован");
            return answer;
        }

        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);

        Optional<AppUser> found =
                appUserRepository.findByEmailIgnoreCase(email).filter(AppUser::isEnabled);
        if (found.isEmpty()) {
            // Ни в ответе, ни в логе не должно остаться следа, по которому можно
            // отличить существующий адрес от несуществующего.
            log.info("Запрос сброса пароля по неизвестному адресу — письмо не отправлено");
            return answer;
        }
        AppUser user = found.get();

        Optional<PasswordResetToken> last =
                tokenRepository.findFirstByUserAndUsedAtIsNullOrderByIdDesc(user);
        if (last.isPresent()
                && last.get().getRequestedAt().isAfter(now.minus(config.getCooldown()))) {
            log.info("Повторный запрос кода в пределах паузы — письмо не отправлено");
            return answer;
        }

        // Активный код всегда один: старые записи не должны продлевать окно перебора.
        tokenRepository.deleteAllForUser(user);
        String code = generateCode();
        tokenRepository.save(
                PasswordResetToken.builder()
                        .user(user)
                        .codeHash(passwordEncoder.encode(normalizeCode(code)))
                        .expiresAt(now.plus(config.getTtl()))
                        .attempts(0)
                        .requestedAt(now)
                        .requestedIp(truncate(ip, 64))
                        .build());

        mailer.send(user.getEmail(), code, config.getTtl());
        return answer;
    }

    /** Шаг 2: код из письма + новый пароль. Гасит все сессии, включая текущую. */
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
                tokenRepository.findFirstByUserAndUsedAtIsNullOrderByIdDesc(user).orElse(null);
        if (token == null || !token.isUsable(now)) {
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        if (token.getAttempts() >= config.getMaxAttempts()) {
            tokenRepository.delete(token);
            log.warn("Код восстановления аннулирован: исчерпан лимит попыток");
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        if (!passwordEncoder.matches(normalizeCode(request.code()), token.getCodeHash())) {
            token.setAttempts(token.getAttempts() + 1);
            tokenRepository.save(token);
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }

        token.setUsedAt(now);
        tokenRepository.save(token);

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(now);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        if (config.isResetTotp()) {
            // Сценарий «потерял телефон»: привязка стирается, на следующем входе
            // выдаётся новый секрет и 2FA настраивается заново.
            user.setTotpSecret(null);
            user.setTotpEnabled(false);
            user.setTotpLastUsedStep(null);
        }
        appUserRepository.save(user);

        tokenRepository.deleteAllForUser(user);
        int revoked = refreshTokenRepository.revokeAllForUser(user, now);
        log.warn(
                "Пароль восстановлен по коду из письма, отозвано сессий: {}, 2FA сброшена: {}",
                revoked,
                config.isResetTotp());
        return List.of(cookieService.clearAll());
    }

    /**
     * Маска адреса: первый символ имени и домена, остальное звёздочками, домен верхнего уровня
     * остаётся видимым. Полный адрес не показывается никогда.
     */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "";
        }
        int at = email.lastIndexOf('@');
        if (at <= 0 || at == email.length() - 1) {
            return maskPart(email);
        }
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        int dot = domain.lastIndexOf('.');
        String host = dot > 0 ? domain.substring(0, dot) : domain;
        String tld = dot > 0 ? domain.substring(dot) : "";
        return maskPart(local) + "@" + maskPart(host) + tld;
    }

    private static String maskPart(String value) {
        if (value.isEmpty()) {
            return "";
        }
        if (value.length() == 1) {
            return value;
        }
        return value.charAt(0) + "*".repeat(value.length() - 1);
    }

    /** Приводит код к виду без разделителей и регистра: люди вводят по-разному. */
    public static String normalizeCode(String code) {
        return code == null ? "" : code.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    /** ~40 бит энтропии, вид {@code ABCD-2345}. */
    private String generateCode() {
        StringBuilder code = new StringBuilder(GROUPS * GROUP_LENGTH + GROUPS - 1);
        for (int group = 0; group < GROUPS; group++) {
            if (group > 0) {
                code.append('-');
            }
            for (int i = 0; i < GROUP_LENGTH; i++) {
                code.append(ALPHABET[random.nextInt(ALPHABET.length)]);
            }
        }
        return code.toString();
    }

    private void enforceIpRateLimit(String ip, Instant now) {
        SecurityProperties.RateLimit config = securityProperties.getRateLimit();
        if (!config.isEnabled() || ip == null || ip.isBlank()) {
            return;
        }
        Instant since = now.minus(config.getWindow());
        if (loginAttemptRepository.countFailuresByIpSince(ip, since)
                >= config.getMaxFailuresPerIp()) {
            log.warn("Превышен лимит попыток с IP {} — сброс пароля отклонён", ip);
            throw new TooManyAttemptsException(config.getWindow());
        }
    }

    /** Неудачи идут в общий журнал входов: перебор кода упирается в лимит по IP. */
    private void recordFailure(String email, String ip, Instant now) {
        loginAttemptRepository.save(
                LoginAttempt.builder()
                        .email(truncate(email, 256))
                        .ipAddress(truncate(ip == null || ip.isBlank() ? "unknown" : ip, 64))
                        .successful(false)
                        .attemptedAt(now)
                        .build());
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
