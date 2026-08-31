package com.devprep.api.service;

import com.devprep.api.config.SecurityProperties;
import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.LoginAttempt;
import com.devprep.api.domain.RefreshToken;
import com.devprep.api.domain.Role;
import com.devprep.api.repository.AppUserRepository;
import com.devprep.api.repository.LoginAttemptRepository;
import com.devprep.api.repository.RefreshTokenRepository;
import com.devprep.api.security.AuthCookieService;
import com.devprep.api.security.JwtService;
import com.devprep.api.security.TotpSecretCipher;
import com.devprep.api.security.TotpService;
import com.devprep.api.web.dto.AuthRequests;
import com.devprep.api.web.dto.AuthResponse;
import io.jsonwebtoken.Claims;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Регистрация, вход, второй фактор, ротация и отзыв сессий.
 *
 * <p>Ключевые свойства контура:
 *
 * <ul>
 *   <li>токены отдаются только через httpOnly cookie — тело ответа их не содержит;
 *   <li>каждый refresh-токен имеет строку в БД; при обновлении старый отзывается (ротация), а
 *       попытка переиспользовать отозванный токен отзывает все сессии пользователя;
 *   <li>подряд идущие неудачные попытки блокируют учётку, а серия неудач с одного IP — сам IP;
 *   <li>для ROLE_ADMIN обязателен TOTP: без подтверждённого второго фактора выдаётся только
 *       короткоживущий промежуточный токен, который не даёт доступа к API.
 * </ul>
 *
 * <p>Потерянный пароль или телефон восстанавливаются кодом из письма — см. {@link
 * PasswordResetService}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String INVALID_CREDENTIALS = "Неверный email или пароль";
    private static final String INVALID_REFRESH = "Refresh-токен недействителен";

    /**
     * Валидный BCrypt-хеш заведомо недостижимого пароля. Нужен, чтобы сравнение выполнялось и для
     * несуществующих пользователей (защита от перечисления email по времени ответа).
     */
    private static final String DUMMY_HASH =
            "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    private final AppUserRepository appUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TotpService totpService;
    private final TotpSecretCipher totpSecretCipher;
    private final AuthCookieService cookieService;
    private final SecurityProperties securityProperties;

    @Transactional
    public AuthOutcome register(AuthRequests.Register request, String ip, String userAgent) {
        String email = request.email().trim().toLowerCase();
        if (appUserRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Пользователь с таким email уже существует");
        }
        AppUser user =
                AppUser.builder()
                        .email(email)
                        .passwordHash(passwordEncoder.encode(request.password()))
                        .displayName(request.displayName().trim())
                        .enabled(true)
                        .roles(Set.of(Role.ROLE_USER))
                        .passwordChangedAt(Instant.now())
                        .build();
        return startSession(appUserRepository.save(user), ip, userAgent);
    }

    @Transactional
    public AuthOutcome login(AuthRequests.Login request, String ip, String userAgent) {
        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);

        String email = request.email().trim().toLowerCase();
        Optional<AppUser> found = appUserRepository.findByEmailIgnoreCase(email);

        boolean passwordMatches =
                passwordEncoder.matches(
                        request.password(), found.map(AppUser::getPasswordHash).orElse(DUMMY_HASH));

        if (found.isEmpty()) {
            recordAttempt(email, ip, false, now);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }
        AppUser user = found.get();

        if (securityProperties.getLockout().isEnabled() && user.isLocked(now)) {
            recordAttempt(email, ip, false, now);
            throw new AccountLockedException(Duration.between(now, user.getLockoutUntil()));
        }

        if (!user.isEnabled() || !passwordMatches) {
            registerFailure(user, ip, now);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }

        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        appUserRepository.save(user);
        recordAttempt(email, ip, true, now);

        return continueAfterPassword(user, ip, userAgent);
    }

    /**
     * Второй шаг входа: проверка TOTP-кода по промежуточному mfa-токену.
     *
     * <p>Принимается только 6-значный код из приложения-аутентификатора: резервные коды из контура
     * входа убраны, потерянный второй фактор восстанавливается через почту.
     */
    @Transactional
    public AuthOutcome verifyTotp(
            String mfaToken, AuthRequests.TotpVerify request, String ip, String userAgent) {
        Claims claims = mfaToken == null ? null : jwtService.parse(mfaToken);
        if (claims == null || !jwtService.isMfaToken(claims)) {
            throw new BadCredentialsException("Сессия подтверждения истекла, войдите заново");
        }
        AppUser user =
                appUserRepository
                        .findByEmailIgnoreCase(claims.getSubject())
                        .filter(AppUser::isEnabled)
                        .orElseThrow(() -> new BadCredentialsException("Пользователь недоступен"));

        Instant now = Instant.now();
        if (securityProperties.getLockout().isEnabled() && user.isLocked(now)) {
            throw new AccountLockedException(Duration.between(now, user.getLockoutUntil()));
        }

        String secret = totpSecretCipher.decrypt(user.getTotpSecret());
        // Код одноразовый: шаг, который уже применялся, второй раз не принимается.
        OptionalLong step =
                secret == null
                        ? OptionalLong.empty()
                        : totpService.verifyAndGetStep(
                                secret, request.code().trim(), user.getTotpLastUsedStep());
        if (step.isEmpty()) {
            registerFailure(user, ip, now);
            throw new BadCredentialsException("Неверный код подтверждения");
        }
        user.setTotpLastUsedStep(step.getAsLong());
        // Унаследованные открытые секреты перешифровываются при первом же успешном входе.
        if (totpSecretCipher.needsRewrap(user.getTotpSecret())) {
            user.setTotpSecret(totpSecretCipher.encrypt(secret));
        }

        if (!user.isTotpEnabled()) {
            user.setTotpEnabled(true);
            log.info("2FA активирована для {}", user.getEmail());
        }
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        appUserRepository.save(user);

        return startSession(user, ip, userAgent);
    }

    /**
     * Ротация: старый refresh-токен отзывается, выпускается новая пара. Повторное использование уже
     * отозванного токена трактуется как компрометация — все сессии пользователя гасятся.
     */
    @Transactional
    public AuthOutcome refresh(String refreshToken, String ip, String userAgent) {
        Claims claims = refreshToken == null ? null : jwtService.parse(refreshToken);
        if (claims == null || !jwtService.isRefreshToken(claims) || claims.getId() == null) {
            throw new BadCredentialsException(INVALID_REFRESH);
        }
        RefreshToken stored =
                refreshTokenRepository
                        .findByTokenId(claims.getId())
                        .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH));

        Instant now = Instant.now();
        AppUser user = stored.getUser();

        if (!stored.isActive(now)) {
            log.warn(
                    "Повторное использование отозванного refresh-токена {} — отзываем все сессии",
                    user.getEmail());
            refreshTokenRepository.revokeAllForUser(user, now);
            throw new BadCredentialsException(INVALID_REFRESH);
        }
        if (!user.isEnabled()) {
            refreshTokenRepository.revokeAllForUser(user, now);
            throw new BadCredentialsException("Пользователь недоступен");
        }
        // Токен, выпущенный до последней смены пароля, недействителен.
        if (user.getPasswordChangedAt() != null
                && claims.getIssuedAt() != null
                && user.getPasswordChangedAt().isAfter(claims.getIssuedAt().toInstant())) {
            stored.revoke(now);
            refreshTokenRepository.save(stored);
            throw new BadCredentialsException(INVALID_REFRESH);
        }
        if (requiresTotp(user) && !user.isTotpEnabled()) {
            throw new BadCredentialsException("Требуется настройка двухфакторной аутентификации");
        }

        JwtService.IssuedToken refreshed = jwtService.issueRefreshToken(user);
        stored.revoke(now);
        stored.setReplacedBy(refreshed.tokenId());
        refreshTokenRepository.save(stored);

        return issueSession(user, refreshed, ip, userAgent);
    }

    /** Отзывает переданную сессию и гасит cookie. Идемпотентно. */
    @Transactional
    public List<String> logout(String refreshToken) {
        if (refreshToken != null) {
            Claims claims = jwtService.parse(refreshToken);
            if (claims != null && jwtService.isRefreshToken(claims) && claims.getId() != null) {
                refreshTokenRepository
                        .findByTokenId(claims.getId())
                        .ifPresent(
                                token -> {
                                    token.revoke(Instant.now());
                                    refreshTokenRepository.save(token);
                                });
            }
        }
        return List.of(cookieService.clearAll());
    }

    /** Смена пароля: гасит все сессии, включая текущую. */
    @Transactional
    public List<String> changePassword(String email, AuthRequests.ChangePassword request) {
        AppUser user =
                appUserRepository
                        .findByEmailIgnoreCase(email)
                        .orElseThrow(() -> new BadCredentialsException("Пользователь недоступен"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Текущий пароль неверен");
        }
        Instant now = Instant.now();
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(now);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        appUserRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user, now);
        log.info("Пароль изменён, все сессии отозваны: {}", user.getEmail());
        return List.of(cookieService.clearAll());
    }

    private AuthOutcome continueAfterPassword(AppUser user, String ip, String userAgent) {
        if (!requiresTotp(user)) {
            return startSession(user, ip, userAgent);
        }
        if (user.isTotpEnabled()) {
            JwtService.IssuedToken mfa = jwtService.issueMfaToken(user);
            return AuthOutcome.of(
                    AuthResponse.totpRequired(),
                    List.of(cookieService.mfaCookie(mfa.token(), jwtService.mfaTokenTtl())));
        }
        // Принудительный enroll: секрет сохраняем сразу, но включаем 2FA только после
        // подтверждения кодом — иначе прерванная настройка навсегда закрыла бы доступ.
        String existing = totpSecretCipher.decrypt(user.getTotpSecret());
        String secret = existing != null ? existing : totpService.generateSecret();
        user.setTotpSecret(totpSecretCipher.encrypt(secret));
        appUserRepository.save(user);
        JwtService.IssuedToken mfa = jwtService.issueMfaToken(user);
        String uri =
                totpService.provisioningUri(
                        securityProperties.getTotp().getIssuer(), user.getEmail(), secret);
        return AuthOutcome.of(
                AuthResponse.totpSetupRequired(new AuthResponse.TotpSetupDto(secret, uri)),
                List.of(cookieService.mfaCookie(mfa.token(), jwtService.mfaTokenTtl())));
    }

    private boolean requiresTotp(AppUser user) {
        return user.isTotpEnabled()
                || (securityProperties.getTotp().isRequiredForAdmins() && user.isAdmin());
    }

    private AuthOutcome startSession(AppUser user, String ip, String userAgent) {
        return issueSession(user, jwtService.issueRefreshToken(user), ip, userAgent);
    }

    private AuthOutcome issueSession(
            AppUser user, JwtService.IssuedToken refresh, String ip, String userAgent) {
        refreshTokenRepository.save(
                RefreshToken.builder()
                        .tokenId(refresh.tokenId())
                        .user(user)
                        .expiresAt(refresh.expiresAt())
                        .userAgent(truncate(userAgent, 256))
                        .ipAddress(truncate(ip, 64))
                        .build());

        JwtService.IssuedToken access = jwtService.issueAccessToken(user);
        List<String> cookies = new ArrayList<>();
        cookies.add(cookieService.accessCookie(access.token(), jwtService.accessTokenTtl()));
        cookies.add(cookieService.refreshCookie(refresh.token(), jwtService.refreshTokenTtl()));
        cookies.add(
                cookieService.sessionHintCookie(
                        user.isAdmin() ? "admin" : "user", jwtService.refreshTokenTtl()));
        cookies.add(cookieService.clearMfa());

        return AuthOutcome.of(
                AuthResponse.authenticated(
                        jwtService.accessTokenTtlSeconds(),
                        new AuthResponse.UserDto(
                                user.getEmail(), user.getDisplayName(), user.getRoles())),
                cookies);
    }

    private void enforceIpRateLimit(String ip, Instant now) {
        SecurityProperties.RateLimit config = securityProperties.getRateLimit();
        if (!config.isEnabled() || ip == null || ip.isBlank()) {
            return;
        }
        Instant since = now.minus(config.getWindow());
        if (loginAttemptRepository.countFailuresByIpSince(ip, since)
                >= config.getMaxFailuresPerIp()) {
            log.warn("Превышен лимит неудачных попыток входа с IP {}", ip);
            throw new TooManyAttemptsException(config.getWindow());
        }
    }

    private void registerFailure(AppUser user, String ip, Instant now) {
        SecurityProperties.Lockout config = securityProperties.getLockout();
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);
        if (config.isEnabled() && attempts >= config.getMaxAttempts()) {
            user.setLockoutUntil(now.plus(config.getDuration()));
            user.setFailedLoginAttempts(0);
            log.warn("Учётка {} заблокирована на {}", user.getEmail(), config.getDuration());
        }
        appUserRepository.save(user);
        recordAttempt(user.getEmail(), ip, false, now);
    }

    private void recordAttempt(String email, String ip, boolean successful, Instant now) {
        loginAttemptRepository.save(
                LoginAttempt.builder()
                        .email(truncate(email, 256))
                        .ipAddress(truncate(ip == null || ip.isBlank() ? "unknown" : ip, 64))
                        .successful(successful)
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
