package com.devprep.api.security;

import com.devprep.api.config.SecurityProperties;
import com.devprep.api.domain.Role;
import com.devprep.api.repository.AppUserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Validate signature AND current account state; stale roles/credentials must not authorize writes. */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final SecurityProperties securityProperties;
    private final AppUserRepository appUserRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = resolveToken(request);
            Claims claims = token == null ? null : jwtService.parse(token);
            if (claims != null && jwtService.isAccessToken(claims) && claims.getSubject() != null) {
                appUserRepository.findByEmailIgnoreCase(claims.getSubject())
                        .filter(user -> jwtService.matchesCurrentCredentials(claims, user))
                        .filter(user -> !user.isTotpEnabled() || jwtService.hasSecondFactor(claims))
                        .ifPresent(user -> {
                            var authorities = jwtService.roles(claims).stream()
                                    .filter(user.getRoles()::contains)
                                    .filter(role -> role != Role.ROLE_ADMIN
                                            || !securityProperties.getTotp().isRequiredForAdmins()
                                            || (user.isTotpEnabled() && jwtService.hasSecondFactor(claims)))
                                    .map(role -> new SimpleGrantedAuthority(role.name())).toList();
                            var authentication = new UsernamePasswordAuthenticationToken(
                                    user.getEmail(), null, authorities);
                            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                        });
            }
        }
        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String cookie = AuthCookieService.read(request, AuthCookieService.ACCESS_COOKIE);
        if (cookie != null && !cookie.isBlank()) return cookie;
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) return null;
        String token = header.substring(7).trim();
        return token.isEmpty() ? null : token;
    }
}
