package com.devprep.api.security;

import com.devprep.api.config.CorsProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Второй контур защиты от CSRF: изменяющие запросы должны приходить с того же источника.
 *
 * <p>Двойной токен (XSRF-TOKEN) уже есть, но он зависит от правильной работы клиента и от того,
 * что ни один маршрут не попадёт в список исключений. Проверка {@code Sec-Fetch-Site} и
 * {@code Origin} не зависит ни от того, ни от другого.
 *
 * <p>Совместимость:
 *
 * <ul>
 *   <li>серверные клиенты (SSR Next.js, curl, healthcheck) не слали ни {@code Sec-Fetch-Site},
 *       ни {@code Origin} — такие запросы пропускаем;
 *   <li>локальная разработка с разными портами работает: источники из
 *       {@code devprep.cors.allowed-origins} считаются своими.
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SameOriginRequestFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");
    private static final String FETCH_SITE_HEADER = "Sec-Fetch-Site";
    private static final Set<String> ALLOWED_FETCH_SITES = Set.of("same-origin", "none");

    private final CorsProperties corsProperties;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (SAFE_METHODS.contains(request.getMethod().toUpperCase(java.util.Locale.ROOT))) {
            filterChain.doFilter(request, response);
            return;
        }

        String origin = request.getHeader("Origin");
        String fetchSite = request.getHeader(FETCH_SITE_HEADER);

        if (fetchSite != null
                && !ALLOWED_FETCH_SITES.contains(fetchSite.toLowerCase(java.util.Locale.ROOT))
                && !isKnownOrigin(origin)) {
            reject(request, response, "Sec-Fetch-Site=" + fetchSite);
            return;
        }

        if (fetchSite == null && origin != null && !isKnownOrigin(origin) && !isSelf(request, origin)) {
            reject(request, response, "Origin=" + origin);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isKnownOrigin(String origin) {
        if (origin == null || origin.isBlank()) {
            return false;
        }
        List<String> allowed = corsProperties.getAllowedOrigins();
        if (allowed == null) {
            return false;
        }
        return allowed.stream().anyMatch(candidate -> candidate.equalsIgnoreCase(origin.trim()));
    }

    /** Сравнение с собственным origin запроса (уже с учётом X-Forwarded-* от nginx). */
    private boolean isSelf(HttpServletRequest request, String origin) {
        String scheme = request.getScheme();
        String host = request.getServerName();
        int port = request.getServerPort();
        boolean defaultPort =
                ("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443);
        String self = scheme + "://" + host + (defaultPort ? "" : ":" + port);
        return self.equalsIgnoreCase(origin.trim());
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, String reason)
            throws IOException {
        log.warn(
                "Отклонён cross-site запрос {} {} ({})",
                request.getMethod(),
                request.getRequestURI(),
                reason);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/problem+json;charset=UTF-8");
        response.getWriter()
                .write(
                        "{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,"
                                + "\"detail\":\"Запрос с другого сайта отклонён\"}");
    }
}
