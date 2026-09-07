package com.devprep.api.security;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.crypto.SecretKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Signed tokens are also bound to the current credential version. */
@Slf4j
@Service
public class JwtService {
    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_TYPE = "typ";
    private static final String CLAIM_AMR = "amr";
    private static final String CLAIM_CREDENTIAL_VERSION = "cv";
    private static final Duration MFA_TTL = Duration.ofMinutes(5);
    private final JwtProperties properties;
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        String secret = properties.getSecret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET должен содержать минимум 32 байта");
        }
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public record IssuedToken(String token, String tokenId, Instant expiresAt) {}
    public IssuedToken issueAccessToken(AppUser user) {
        return issue(user, "access", properties.getAccessTokenTtl());
    }
    public IssuedToken issueRefreshToken(AppUser user) {
        return issue(user, "refresh", properties.getRefreshTokenTtl());
    }
    public IssuedToken issueMfaToken(AppUser user) {
        return issue(user, "mfa", MFA_TTL);
    }
    public long accessTokenTtlSeconds() { return properties.getAccessTokenTtl().toSeconds(); }
    public Duration accessTokenTtl() { return properties.getAccessTokenTtl(); }
    public Duration refreshTokenTtl() { return properties.getRefreshTokenTtl(); }
    public Duration mfaTokenTtl() { return MFA_TTL; }

    private IssuedToken issue(AppUser user, String type, Duration ttl) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);
        String tokenId = UUID.randomUUID().toString();
        String token = Jwts.builder()
                .issuer(properties.getIssuer()).subject(user.getEmail()).id(tokenId)
                .claim(CLAIM_TYPE, type)
                .claim(CLAIM_CREDENTIAL_VERSION, credentialVersion(user))
                .claim(CLAIM_ROLES, user.getRoles().stream().map(Role::name).toList())
                .claim(CLAIM_AMR, user.isTotpEnabled() ? List.of("pwd", "otp") : List.of("pwd"))
                .issuedAt(Date.from(now)).expiration(Date.from(expiresAt)).signWith(key).compact();
        return new IssuedToken(token, tokenId, expiresAt);
    }

    /**
     * Do not put the password hash itself in a JWT. A digest of the salted BCrypt hash
     * changes even when the same password is reset. Unlike JWT iat (whole seconds),
     * this also invalidates tokens changed within the same second and across DB precision changes.
     */
    private static String credentialVersion(AppUser user) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256")
                            .digest(user.getPasswordHash().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** Legacy tokens without a credential version deliberately require a fresh login. */
    public boolean matchesCurrentCredentials(Claims claims, AppUser user) {
        Object version = claims.get(CLAIM_CREDENTIAL_VERSION);
        return user.isEnabled() && version instanceof String value
                && MessageDigest.isEqual(value.getBytes(StandardCharsets.UTF_8),
                        credentialVersion(user).getBytes(StandardCharsets.UTF_8));
    }

    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).requireIssuer(properties.getIssuer())
                    .build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            // Do not log raw tokens or token-bearing parser exception messages.
            log.debug("Невалидный JWT: {}", e.getClass().getSimpleName());
            return null;
        }
    }
    public boolean isAccessToken(Claims claims) { return "access".equals(claims.get(CLAIM_TYPE)); }
    public boolean isRefreshToken(Claims claims) { return "refresh".equals(claims.get(CLAIM_TYPE)); }
    public boolean isMfaToken(Claims claims) { return "mfa".equals(claims.get(CLAIM_TYPE)); }
    public boolean hasSecondFactor(Claims claims) {
        return claims.get(CLAIM_AMR) instanceof List<?> values && values.contains("otp");
    }
    public Set<Role> roles(Claims claims) {
        Set<Role> roles = new LinkedHashSet<>();
        if (claims.get(CLAIM_ROLES) instanceof List<?> values) {
            for (Object value : values) {
                try { roles.add(Role.valueOf(String.valueOf(value))); }
                catch (IllegalArgumentException ignored) { /* Unknown legacy role. */ }
            }
        }
        return roles;
    }
}
