package com.devprep.api.security;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.crypto.SecretKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Выпуск и проверка токенов (jjwt 0.12.x).
 *
 * <p>Три типа токенов:
 *
 * <ul>
 *   <li>{@code access} — короткоживущий, кладётся в httpOnly cookie, авторизует запросы;
 *   <li>{@code refresh} — содержит {@code jti}, которому соответствует строка в таблице
 *       {@code refresh_token}; без активной строки токен бесполезен;
 *   <li>{@code mfa} — очень короткий промежуточный токен между проверкой пароля и вводом TOTP-кода.
 * </ul>
 */
@Slf4j
@Service
public class JwtService {

    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_TYPE = "typ";

    /** Способы аутентификации, подтверждённые при выдаче токена (RFC 8176). */
    private static final String CLAIM_AMR = "amr";

    private static final String AMR_PASSWORD = "pwd";
    private static final String AMR_OTP = "otp";
    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";
    private static final String TYPE_MFA = "mfa";

    /** TTL промежуточного токена второго фактора. */
    private static final Duration MFA_TTL = Duration.ofMinutes(5);

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        String secret = properties.getSecret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "devprep.jwt.secret (JWT_SECRET) должен быть задан и содержать минимум 32 байта");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Выпущенный токен вместе с его идентификатором и сроком жизни. */
    public record IssuedToken(String token, String tokenId, Instant expiresAt) {}

    public IssuedToken issueAccessToken(AppUser user) {
        return issue(user, TYPE_ACCESS, properties.getAccessTokenTtl());
    }

    public IssuedToken issueRefreshToken(AppUser user) {
        return issue(user, TYPE_REFRESH, properties.getRefreshTokenTtl());
    }

    /** Токен «пароль верный, ждём второй фактор». Не даёт доступа к API. */
    public IssuedToken issueMfaToken(AppUser user) {
        return issue(user, TYPE_MFA, MFA_TTL);
    }

    public long accessTokenTtlSeconds() {
        return properties.getAccessTokenTtl().toSeconds();
    }

    public Duration accessTokenTtl() {
        return properties.getAccessTokenTtl();
    }

    public Duration refreshTokenTtl() {
        return properties.getRefreshTokenTtl();
    }

    public Duration mfaTokenTtl() {
        return MFA_TTL;
    }

    private IssuedToken issue(AppUser user, String type, Duration ttl) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);
        String tokenId = UUID.randomUUID().toString();
        String token =
                Jwts.builder()
                        .issuer(properties.getIssuer())
                        .subject(user.getEmail())
                        .id(tokenId)
                        .claim(CLAIM_TYPE, type)
                        .claim(CLAIM_ROLES, user.getRoles().stream().map(Role::name).toList())
                        // Факт пройденного второго фактора фиксируется в самом токене: иначе
                        // админ, который так и не привязал 2FA, получает полный доступ по паролю.
                        .claim(
                                CLAIM_AMR,
                                user.isTotpEnabled()
                                        ? List.of(AMR_PASSWORD, AMR_OTP)
                                        : List.of(AMR_PASSWORD))
                        .issuedAt(Date.from(now))
                        .expiration(Date.from(expiresAt))
                        .signWith(key)
                        .compact();
        return new IssuedToken(token, tokenId, expiresAt);
    }

    /** Возвращает claims либо null, если токен невалиден или просрочен. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(properties.getIssuer())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Невалидный JWT: {}", e.getMessage());
            return null;
        }
    }

    public boolean isAccessToken(Claims claims) {
        return TYPE_ACCESS.equals(claims.get(CLAIM_TYPE, String.class));
    }

    public boolean isRefreshToken(Claims claims) {
        return TYPE_REFRESH.equals(claims.get(CLAIM_TYPE, String.class));
    }

    public boolean isMfaToken(Claims claims) {
        return TYPE_MFA.equals(claims.get(CLAIM_TYPE, String.class));
    }

    /**
     * Прошёл ли владелец токена второй фактор.
     *
     * <p>Старые токены без claim {@code amr} считаются неподтверждёнными — после обновления
     * админам нужно войти заново. Это осознанный выбор в пользу безопасности.
     */
    public boolean hasSecondFactor(Claims claims) {
        Object raw = claims.get(CLAIM_AMR);
        if (raw instanceof List<?> list) {
            return list.stream().anyMatch(value -> AMR_OTP.equals(String.valueOf(value)));
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    public Set<Role> roles(Claims claims) {
        Object raw = claims.get(CLAIM_ROLES);
        Set<Role> roles = new LinkedHashSet<>();
        if (raw instanceof List<?> list) {
            for (Object value : (List<Object>) list) {
                try {
                    roles.add(Role.valueOf(String.valueOf(value)));
                } catch (IllegalArgumentException ignored) {
                    // неизвестная роль в старом токене — игнорируем
                }
            }
        }
        return roles;
    }
}
