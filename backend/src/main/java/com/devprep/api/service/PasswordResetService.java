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
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private static final String INVALID_CODE = "Неверный или истекший код восстановления";
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AppUserRepository appUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailer mailer;
    private final AuthCookieService cookieService;
    private final SecurityProperties securityProperties;

    @Transactional
    public AuthResponse.PasswordResetRequestedDto request(String rawEmail, String ip) {
        var config = securityProperties.getPasswordReset();
        var response = new AuthResponse.PasswordResetRequestedDto(Math.max(1, config.getTtl().toMinutes()));
        if (!config.isEnabled()) return response;
        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);
        // Count requests too: otherwise requesting reset emails never consumed the IP budget.
        recordFailure(normalizeEmail(rawEmail), ip, now);
        AppUser user = appUserRepository.findForAuthentication(normalizeEmail(rawEmail))
                .filter(AppUser::isEnabled).orElse(null);
        if (user == null) return response;
        var active = passwordResetTokenRepository.findFirstByUserAndUsedAtIsNullOrderByIdDesc(user);
        if (active.isPresent() && active.get().getRequestedAt() != null
                && active.get().getRequestedAt().isAfter(now.minus(config.getCooldown()))) return response;
        passwordResetTokenRepository.deleteAllForUser(user);
        String code = generateCode();
        passwordResetTokenRepository.save(PasswordResetToken.builder().user(user)
                .codeHash(passwordEncoder.encode(normalizeCode(code))).expiresAt(now.plus(config.getTtl()))
                .attempts(0).requestedAt(now).requestedIp(truncate(ip, 64)).build());
        mailer.send(user.getEmail(), code, config.getTtl());
        return response;
    }

    /** Only expected code rejections commit counter/audit changes. Other failures still roll back. */
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public List<String> confirm(AuthRequests.PasswordResetConfirm request, String ip) {
        var config = securityProperties.getPasswordReset();
        if (!config.isEnabled()) throw new BadCredentialsException(INVALID_CODE);
        Instant now = Instant.now();
        enforceIpRateLimit(ip, now);
        String email = normalizeEmail(request.email());
        AppUser user = appUserRepository.findForAuthentication(email).filter(AppUser::isEnabled).orElse(null);
        if (user == null) {
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        PasswordResetToken token = passwordResetTokenRepository
                .findFirstByUserAndUsedAtIsNullOrderByIdDesc(user).orElse(null);
        if (token == null || !token.isUsable(now)) {
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        if (token.getAttempts() >= config.getMaxAttempts()) {
            passwordResetTokenRepository.deleteAllForUser(user);
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        if (!passwordEncoder.matches(normalizeCode(request.code()), token.getCodeHash())) {
            token.setAttempts(token.getAttempts() + 1);
            if (token.getAttempts() >= config.getMaxAttempts()) {
                passwordResetTokenRepository.deleteAllForUser(user);
            } else {
                passwordResetTokenRepository.save(token);
            }
            recordFailure(email, ip, now);
            throw new BadCredentialsException(INVALID_CODE);
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(now);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        if (config.isResetTotp()) {
            user.setTotpSecret(null);
            user.setTotpEnabled(false);
            user.setTotpLastUsedStep(null);
        }
        appUserRepository.save(user);
        passwordResetTokenRepository.deleteAllForUser(user);
        refreshTokenRepository.revokeAllForUser(user, now);
        return List.of(cookieService.clearAll());
    }
    private static String generateCode() {
        StringBuilder code = new StringBuilder(9);
        for (int i = 0; i < 8; i++) {
            if (i == 4) code.append('-');
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
    private static String normalizeCode(String code) {
        return code == null ? "" : code.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }
    private void recordFailure(String email, String ip, Instant now) {
        loginAttemptRepository.save(LoginAttempt.builder().email(truncate(email, 256))
                .ipAddress(truncate(ip == null || ip.isBlank() ? "unknown" : ip, 64))
                .successful(false).attemptedAt(now).build());
    }
    private void enforceIpRateLimit(String ip, Instant now) {
        var config = securityProperties.getRateLimit();
        if (config.isEnabled() && ip != null && !ip.isBlank()
                && loginAttemptRepository.countFailuresByIpSince(ip, now.minus(config.getWindow()))
                        >= config.getMaxFailuresPerIp()) {
            throw new TooManyAttemptsException(config.getWindow());
        }
    }
    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
