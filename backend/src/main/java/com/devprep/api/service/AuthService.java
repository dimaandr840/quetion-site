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
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authentication state changes are serialized on the user row. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {
    private static final String INVALID_CREDENTIALS = "Неверный email или пароль";
    private static final String INVALID_REFRESH = "Refresh-токен недействителен";
    private final AppUserRepository appUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TotpService totpService;
    private final TotpSecretCipher totpSecretCipher;
    private final AuthCookieService cookieService;
    private final SecurityProperties securityProperties;
    private volatile String dummyHash;

    private String dummyHash() {
        // Use the configured encoder cost, not a cheaper hardcoded BCrypt hash.
        String value = dummyHash;
        if (value == null) {
            synchronized (this) {
                if (dummyHash == null) dummyHash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
                value = dummyHash;
            }
        }
        return value;
    }

    @Transactional
    public AuthOutcome register(AuthRequests.Register request, String ip, String userAgent) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (appUserRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Пользователь с таким email уже существует");
        }
        AppUser user = AppUser.builder().email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .displayName(request.displayName().trim()).enabled(true)
                .roles(Set.of(Role.ROLE_USER)).passwordChangedAt(Instant.now()).build();
        return startSession(appUserRepository.save(user), ip, userAgent);
    }

    /**
     * These two EXPECTED rejections only follow counter/audit updates. Commit them;
     * unexpected failures (including DB failures) still roll back. Do not generalize
     * this to RuntimeException or to successful content/business transactions.
     */
    @Transactional(noRollbackFor = {BadCredentialsException.class, AccountLockedException.class})
    public AuthOutcome login(AuthRequests.Login request, String ip, String userAgent) {
        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Optional<AppUser> found = appUserRepository.findForAuthentication(email);
        boolean matches = passwordEncoder.matches(request.password(),
                found.map(AppUser::getPasswordHash).orElseGet(this::dummyHash));
        if (found.isEmpty()) {
            recordAttempt(email, ip, false, now);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }
        AppUser user = found.get();
        if (securityProperties.getLockout().isEnabled() && user.isLocked(now)) {
            recordAttempt(email, ip, false, now);
            throw new AccountLockedException(Duration.between(now, user.getLockoutUntil()));
        }
        if (!user.isEnabled() || !matches) {
            registerFailure(user, ip, now);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        appUserRepository.save(user);
        recordAttempt(email, ip, true, now);
        return continueAfterPassword(user, ip, userAgent);
    }

    @Transactional(noRollbackFor = {BadCredentialsException.class, AccountLockedException.class})
    public AuthOutcome verifyTotp(String mfaToken, AuthRequests.TotpVerify request,
            String ip, String userAgent) {
        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);
        Claims claims = mfaToken == null ? null : jwtService.parse(mfaToken);
        if (claims == null || !jwtService.isMfaToken(claims)) {
            throw new BadCredentialsException("Сессия подтверждения истекла, войдите заново");
        }
        AppUser user = appUserRepository.findForAuthentication(claims.getSubject())
                .filter(u -> jwtService.matchesCurrentCredentials(claims, u))
                .orElseThrow(() -> new BadCredentialsException("Пользователь недоступен"));
        if (securityProperties.getLockout().isEnabled() && user.isLocked(now)) {
            recordAttempt(user.getEmail(), ip, false, now);
            throw new AccountLockedException(Duration.between(now, user.getLockoutUntil()));
        }
        String secret = totpSecretCipher.decrypt(user.getTotpSecret());
        OptionalLong step = secret == null ? OptionalLong.empty()
                : totpService.verifyAndGetStep(secret, request.code().trim(), user.getTotpLastUsedStep());
        if (step.isEmpty()) {
            registerFailure(user, ip, now);
            throw new BadCredentialsException("Неверный код подтверждения");
        }
        user.setTotpLastUsedStep(step.getAsLong());
        if (totpSecretCipher.needsRewrap(user.getTotpSecret())) {
            user.setTotpSecret(totpSecretCipher.encrypt(secret));
        }
        user.setTotpEnabled(true);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        appUserRepository.save(user);
        return startSession(user, ip, userAgent);
    }

    @Transactional(noRollbackFor = BadCredentialsException.class)
    public AuthOutcome refresh(String refreshToken, String ip, String userAgent) {
        Claims claims = refreshToken == null ? null : jwtService.parse(refreshToken);
        if (claims == null || !jwtService.isRefreshToken(claims) || claims.getId() == null) {
            throw new BadCredentialsException(INVALID_REFRESH);
        }
        // Always lock the account before reading a refresh row, consistently with password reset.
        AppUser user = appUserRepository.findForAuthentication(claims.getSubject())
                .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH));
        RefreshToken stored = refreshTokenRepository.findByTokenId(claims.getId())
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH));
        Instant now = Instant.now();
        if (!stored.isActive(now) || !jwtService.matchesCurrentCredentials(claims, user)) {
            refreshTokenRepository.revokeAllForUser(user, now);
            throw new BadCredentialsException(INVALID_REFRESH);
        }
        if (requiresTotp(user) && (!user.isTotpEnabled() || !jwtService.hasSecondFactor(claims))) {
            refreshTokenRepository.revokeAllForUser(user, now);
            throw new BadCredentialsException("Требуется двухфакторная аутентификация");
        }
        JwtService.IssuedToken refreshed = jwtService.issueRefreshToken(user);
        stored.revoke(now);
        stored.setReplacedBy(refreshed.tokenId());
        refreshTokenRepository.save(stored);
        return issueSession(user, refreshed, ip, userAgent);
    }

    @Transactional
    public List<String> logout(String refreshToken) {
        Claims claims = refreshToken == null ? null : jwtService.parse(refreshToken);
        if (claims != null && jwtService.isRefreshToken(claims) && claims.getId() != null) {
            appUserRepository.findForAuthentication(claims.getSubject()).ifPresent(user ->
                    refreshTokenRepository.findByTokenId(claims.getId()).ifPresent(token -> {
                        if (token.getUser().getId().equals(user.getId())) {
                            token.revoke(Instant.now());
                            refreshTokenRepository.save(token);
                        }
                    }));
        }
        return List.of(cookieService.clearAll());
    }

    @Transactional
    public List<String> changePassword(String email, AuthRequests.ChangePassword request) {
        AppUser user = appUserRepository.findForAuthentication(email)
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
        return List.of(cookieService.clearAll());
    }

    private AuthOutcome continueAfterPassword(AppUser user, String ip, String userAgent) {
        if (!requiresTotp(user)) return startSession(user, ip, userAgent);
        if (user.isTotpEnabled()) {
            JwtService.IssuedToken mfa = jwtService.issueMfaToken(user);
            return AuthOutcome.of(AuthResponse.totpRequired(),
                    List.of(cookieService.mfaCookie(mfa.token(), jwtService.mfaTokenTtl())));
        }
        String existing = totpSecretCipher.decrypt(user.getTotpSecret());
        String secret = existing != null ? existing : totpService.generateSecret();
        user.setTotpSecret(totpSecretCipher.encrypt(secret));
        appUserRepository.save(user);
        JwtService.IssuedToken mfa = jwtService.issueMfaToken(user);
        String uri = totpService.provisioningUri(securityProperties.getTotp().getIssuer(), user.getEmail(), secret);
        return AuthOutcome.of(AuthResponse.totpSetupRequired(new AuthResponse.TotpSetupDto(secret, uri)),
                List.of(cookieService.mfaCookie(mfa.token(), jwtService.mfaTokenTtl())));
    }
    private boolean requiresTotp(AppUser user) {
        return user.isTotpEnabled() || (securityProperties.getTotp().isRequiredForAdmins() && user.isAdmin());
    }
    private AuthOutcome startSession(AppUser user, String ip, String userAgent) {
        return issueSession(user, jwtService.issueRefreshToken(user), ip, userAgent);
    }
    private AuthOutcome issueSession(AppUser user, JwtService.IssuedToken refresh, String ip, String userAgent) {
        refreshTokenRepository.save(RefreshToken.builder().tokenId(refresh.tokenId()).user(user)
                .expiresAt(refresh.expiresAt()).userAgent(truncate(userAgent, 256)).ipAddress(truncate(ip, 64)).build());
        JwtService.IssuedToken access = jwtService.issueAccessToken(user);
        List<String> cookies = new ArrayList<>();
        cookies.add(cookieService.accessCookie(access.token(), jwtService.accessTokenTtl()));
        cookies.add(cookieService.refreshCookie(refresh.token(), jwtService.refreshTokenTtl()));
        cookies.add(cookieService.sessionHintCookie(user.isAdmin() ? "admin" : "user", jwtService.refreshTokenTtl()));
        cookies.add(cookieService.clearMfa());
        return AuthOutcome.of(AuthResponse.authenticated(jwtService.accessTokenTtlSeconds(),
                new AuthResponse.UserDto(user.getEmail(), user.getDisplayName(), user.getRoles())), cookies);
    }
    private void enforceIpRateLimit(String ip, Instant now) {
        var config = securityProperties.getRateLimit();
        if (config.isEnabled() && ip != null && !ip.isBlank()
                && loginAttemptRepository.countFailuresByIpSince(ip, now.minus(config.getWindow()))
                        >= config.getMaxFailuresPerIp()) {
            throw new TooManyAttemptsException(config.getWindow());
        }
    }
    private void registerFailure(AppUser user, String ip, Instant now) {
        var config = securityProperties.getLockout();
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);
        if (config.isEnabled() && attempts >= config.getMaxAttempts()) {
            user.setLockoutUntil(now.plus(config.getDuration()));
            user.setFailedLoginAttempts(0);
        }
        appUserRepository.save(user);
        recordAttempt(user.getEmail(), ip, false, now);
    }
    private void recordAttempt(String email, String ip, boolean successful, Instant now) {
        loginAttemptRepository.save(LoginAttempt.builder().email(truncate(email, 256))
                .ipAddress(truncate(ip == null || ip.isBlank() ? "unknown" : ip, 64))
                .successful(successful).attemptedAt(now).build());
    }
    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
