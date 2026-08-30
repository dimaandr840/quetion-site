package com.devprep.api.security;

import com.devprep.api.config.SecurityProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Единая точка формирования auth-cookie. Токены живут только в httpOnly cookie — JS их не читает,
 * поэтому XSS не приводит к краже долгоживущего refresh-токена.
 */
@Component
@RequiredArgsConstructor
public class AuthCookieService {

    public static final String ACCESS_COOKIE = "dp_at";
    public static final String REFRESH_COOKIE = "dp_rt";
    public static final String MFA_COOKIE = "dp_mfa";

    /**
     * Неsecure-флаг для фронта: по нему middleware понимает, что сессия есть, не читая сам токен.
     * Внутри нет ничего чувствительного, кроме роли.
     */
    public static final String SESSION_HINT_COOKIE = "dp_session";

    private static final String ROOT_PATH = "/";
    private static final String REFRESH_PATH = "/api/auth";

    private final SecurityProperties securityProperties;

    public String accessCookie(String token, Duration ttl) {
        return build(ACCESS_COOKIE, token, ttl, ROOT_PATH, true).toString();
    }

    public String refreshCookie(String token, Duration ttl) {
        // Refresh-токен отправляется только на /api/auth/** — на остальные запросы он не уходит.
        return build(REFRESH_COOKIE, token, ttl, REFRESH_PATH, true).toString();
    }

    public String mfaCookie(String token, Duration ttl) {
        return build(MFA_COOKIE, token, ttl, REFRESH_PATH, true).toString();
    }

    /** Читаемая фронтом подсказка о сессии: роль и срок действия access-токена. */
    public String sessionHintCookie(String value, Duration ttl) {
        return build(SESSION_HINT_COOKIE, value, ttl, ROOT_PATH, false).toString();
    }

    public String[] clearAll() {
        return new String[] {
            expire(ACCESS_COOKIE, ROOT_PATH, true),
            expire(REFRESH_COOKIE, REFRESH_PATH, true),
            expire(MFA_COOKIE, REFRESH_PATH, true),
            expire(SESSION_HINT_COOKIE, ROOT_PATH, false)
        };
    }

    public String clearMfa() {
        return expire(MFA_COOKIE, REFRESH_PATH, true);
    }

    public void applyTo(HttpHeaders headers, String... cookies) {
        for (String cookie : cookies) {
            headers.add(HttpHeaders.SET_COOKIE, cookie);
        }
    }

    /** Значение cookie из запроса либо null. */
    public static String read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String expire(String name, String path, boolean httpOnly) {
        return build(name, "", Duration.ZERO, path, httpOnly).toString();
    }

    private ResponseCookie build(
            String name, String value, Duration ttl, String path, boolean httpOnly) {
        SecurityProperties.Cookie config = securityProperties.getCookie();
        ResponseCookie.ResponseCookieBuilder builder =
                ResponseCookie.from(name, value)
                        .httpOnly(httpOnly)
                        .secure(config.isSecure())
                        .path(path)
                        .maxAge(ttl)
                        .sameSite(config.getSameSite());
        if (config.getDomain() != null && !config.getDomain().isBlank()) {
            builder.domain(config.getDomain());
        }
        return builder.build();
    }
}
