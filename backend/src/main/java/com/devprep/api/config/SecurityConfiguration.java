package com.devprep.api.config;

import com.devprep.api.domain.Role;
import com.devprep.api.security.JwtAuthenticationFilter;
import jakarta.servlet.DispatcherType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless-безопасность.
 *
 * <p>Чтение контента (профессии, категории, вопросы, поиск) намеренно публично — это открытый
 * справочник, который читает Next.js без токена. Любая запись требует ROLE_ADMIN.
 *
 * <p>Аутентификация — по httpOnly cookie, поэтому CSRF-защита включена: браузер прикладывает cookie
 * автоматически, и без double-submit токена сторонний сайт мог бы выполнить запись от имени
 * администратора. Токен лежит в читаемой JS cookie {@code XSRF-TOKEN}, клиент дублирует его в
 * заголовке {@code X-XSRF-TOKEN}.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfiguration {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsProperties corsProperties;
    private final SecurityProperties securityProperties;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(
                        csrf ->
                                csrf.csrfTokenRepository(
                                                CookieCsrfTokenRepository.withHttpOnlyFalse())
                                        .csrfTokenRequestHandler(csrfTokenRequestHandler())
                                        // Вход/регистрация/ротация происходят до появления
                                        // CSRF-токена, а cookie с SameSite=Strict в кросс-сайтовый
                                        // запрос всё равно не попадёт.
                                        .ignoringRequestMatchers(
                                                "/api/auth/login",
                                                "/api/auth/register",
                                                "/api/auth/refresh",
                                                "/api/auth/totp/verify"))
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(
                        headers ->
                                headers.frameOptions(frame -> frame.deny())
                                        .contentTypeOptions(options -> {})
                                        .referrerPolicy(
                                                referrer ->
                                                        referrer.policy(
                                                                ReferrerPolicy
                                                                        .STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                                        .httpStrictTransportSecurity(
                                                hsts ->
                                                        hsts.includeSubDomains(true)
                                                                .maxAgeInSeconds(63072000))
                                        .cacheControl(cache -> {}))
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(
                        handling ->
                                handling.authenticationEntryPoint(
                                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(
                        auth -> {
                            // ERROR/ASYNC-диспетчер проходит через цепочку повторно и уже
                            // без аутентификации: без этого правила 403 от
                            // AccessDeniedHandler перезаписывается на 401 при forward
                            // на /error.
                            auth.dispatcherTypeMatchers(
                                            DispatcherType.ERROR, DispatcherType.ASYNC)
                                    .permitAll()
                                    .requestMatchers(HttpMethod.OPTIONS, "/**")
                                    .permitAll()
                                    .requestMatchers(
                                            "/api/auth/login",
                                            "/api/auth/register",
                                            "/api/auth/refresh",
                                            "/api/auth/totp/verify",
                                            "/api/auth/logout",
                                            "/api/auth/csrf",
                                            // Восстановление доступа по почте по определению
                                            // вызывается без сессии; защита — одноразовый код,
                                            // лимит попыток и rate limit по IP.
                                            "/api/auth/password/reset/request",
                                            "/api/auth/password/reset/confirm")
                                    .permitAll()
                                    .requestMatchers(
                                            "/actuator/health",
                                            "/actuator/health/**",
                                            "/actuator/info")
                                    .permitAll()
                                    .requestMatchers("/api/docs/**", "/api/openapi.json")
                                    .permitAll();

                            if (securityProperties.isAuthEnabled()) {
                                auth.requestMatchers("/api/admin/**")
                                        .hasAuthority(Role.ROLE_ADMIN.name())
                                        .requestMatchers("/api/me/**", "/api/auth/password")
                                        .authenticated();
                            } else {
                                auth.requestMatchers(
                                                "/api/admin/**",
                                                "/api/me/**",
                                                "/api/auth/password")
                                        .permitAll();
                            }

                            auth.requestMatchers(HttpMethod.GET, "/api/**")
                                    .permitAll()
                                    .anyRequest()
                                    .authenticated();
                        })
                .addFilterBefore(
                        jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * BREACH-защита: значение токена в теле/заголовке маскируется случайной солью. Так как токен
     * читается из заголовка, а не из параметра формы, применяем обработчик как есть.
     */
    private CsrfTokenRequestAttributeHandler csrfTokenRequestHandler() {
        CsrfTokenRequestAttributeHandler handler = new CsrfTokenRequestAttributeHandler();
        handler.setCsrfRequestAttributeName(null);
        return handler;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Стоимость 12: ~250 мс на хеш — заметно дороже подбора, но терпимо для входа.
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // При allowCredentials=true список источников должен быть точным: "*" запрещён спецификацией.
        configuration.setAllowedOrigins(corsProperties.getAllowedOrigins());
        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(
                List.of("Authorization", "Content-Type", "Accept", "X-XSRF-TOKEN"));
        configuration.setExposedHeaders(List.of("Location"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
