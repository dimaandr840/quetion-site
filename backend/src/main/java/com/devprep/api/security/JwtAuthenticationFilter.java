package com.devprep.api.security;

import com.devprep.api.config.SecurityProperties;
import com.devprep.api.domain.Role;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Достаёт access-токен из httpOnly cookie {@code dp_at} либо из заголовка {@code Authorization} и
 * кладёт аутентификацию в контекст. Stateless.
 *
 * <p>Cookie — основной канал для браузера (защита от кражи токена через XSS), Bearer оставлен для
 * серверных клиентов и curl/Postman. Cookie имеет приоритет.
 *
 * <p>Здесь же реализован MFA-шлюз: если второй фактор обязателен для админов, но токен выдан
 * только по паролю ({@code amr} без {@code otp}), роль {@code ROLE_ADMIN} не выдаётся. Так обход
 * двухфакторки невозможен даже при утечке пароля и ошибке в логике выдачи токенов.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final SecurityProperties securityProperties;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = resolveToken(request);
            if (token != null) {
                Claims claims = jwtService.parse(token);
                if (claims != null && jwtService.isAccessToken(claims)) {
                    boolean secondFactorRequired =
                            securityProperties.getTotp().isRequiredForAdmins()
                                    && !jwtService.hasSecondFactor(claims);
                    List<SimpleGrantedAuthority> authorities =
                            jwtService.roles(claims).stream()
                                    .filter(
                                            role ->
                                                    !(secondFactorRequired
                                                            && role == Role.ROLE_ADMIN))
                                    .map(role -> new SimpleGrantedAuthority(role.name()))
                                    .toList();
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    claims.getSubject(), null, authorities);
                    authentication.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String fromCookie = AuthCookieService.read(request, AuthCookieService.ACCESS_COOKIE);
        if (fromCookie != null && !fromCookie.isBlank()) {
            return fromCookie;
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(PREFIX)) {
            String value = header.substring(PREFIX.length()).trim();
            return value.isEmpty() ? null : value;
        }
        return null;
    }
}
