package com.devprep.api.web;

import com.devprep.api.security.AuthCookieService;
import com.devprep.api.service.AuthOutcome;
import com.devprep.api.service.AuthService;
import com.devprep.api.service.PasswordResetService;
import com.devprep.api.web.dto.AuthRequests;
import com.devprep.api.web.dto.AuthResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Аутентификация. Токены никогда не попадают в тело ответа — только в httpOnly cookie, поэтому
 * клиенту не нужно (и нельзя) их хранить самому.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody AuthRequests.Register request, HttpServletRequest httpRequest) {
        return respond(
                authService.register(request, clientIp(httpRequest), userAgent(httpRequest)),
                HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequests.Login request, HttpServletRequest httpRequest) {
        return respond(
                authService.login(request, clientIp(httpRequest), userAgent(httpRequest)),
                HttpStatus.OK);
    }

    /** Второй шаг входа: код TOTP. Промежуточный токен читается из cookie {@code dp_mfa}. */
    @PostMapping("/totp/verify")
    public ResponseEntity<AuthResponse> verifyTotp(
            @Valid @RequestBody AuthRequests.TotpVerify request, HttpServletRequest httpRequest) {
        String mfaToken = AuthCookieService.read(httpRequest, AuthCookieService.MFA_COOKIE);
        return respond(
                authService.verifyTotp(
                        mfaToken, request, clientIp(httpRequest), userAgent(httpRequest)),
                HttpStatus.OK);
    }

    /** Ротация пары токенов. Refresh-токен берётся только из cookie. */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest httpRequest) {
        String refreshToken =
                AuthCookieService.read(httpRequest, AuthCookieService.REFRESH_COOKIE);
        return respond(
                authService.refresh(refreshToken, clientIp(httpRequest), userAgent(httpRequest)),
                HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        String refreshToken =
                AuthCookieService.read(httpRequest, AuthCookieService.REFRESH_COOKIE);
        return ResponseEntity.noContent()
                .headers(headers(authService.logout(refreshToken)))
                .build();
    }

    /** Смена пароля отзывает все сессии — после неё требуется повторный вход. */
    @PostMapping("/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody AuthRequests.ChangePassword request,
            Authentication authentication) {
        return ResponseEntity.noContent()
                .headers(headers(authService.changePassword(authentication.getName(), request)))
                .build();
    }

    /**
     * Шаг 1 восстановления доступа: человек вводит адрес, код уходит на него только при
     * совпадении с адресом учётки.
     *
     * <p>Всегда 202 с одним и тем же телом: по ответу нельзя определить, зарегистрирован ли
     * адрес. В {@code emailHint} уходит только маска.
     */
    @PostMapping("/password/reset/request")
    public ResponseEntity<AuthResponse.PasswordResetRequestedDto> requestPasswordReset(
            @Valid @RequestBody AuthRequests.PasswordResetRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.accepted()
                .body(passwordResetService.request(request.email(), clientIp(httpRequest)));
    }

    /** Шаг 2 восстановления доступа: код из письма и новый пароль. Гасит все сессии. */
    @PostMapping("/password/reset/confirm")
    public ResponseEntity<Void> confirmPasswordReset(
            @Valid @RequestBody AuthRequests.PasswordResetConfirm request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.noContent()
                .headers(headers(passwordResetService.confirm(request, clientIp(httpRequest))))
                .build();
    }

    /**
     * Инициализация CSRF-токена: Spring выставляет cookie {@code XSRF-TOKEN} при первом обращении к
     * токену. Фронт вызывает этот эндпоинт перед первым изменяющим запросом.
     */
    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken();
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<AuthResponse> respond(AuthOutcome outcome, HttpStatus status) {
        return ResponseEntity.status(status)
                .headers(headers(outcome.cookies()))
                .body(outcome.body());
    }

    private HttpHeaders headers(List<String> cookies) {
        HttpHeaders headers = new HttpHeaders();
        cookies.forEach(cookie -> headers.add(HttpHeaders.SET_COOKIE, cookie));
        return headers;
    }

    /**
     * IP клиента. Доверяем только первому значению X-Forwarded-For, которое подставляет наш nginx —
     * он перезаписывает этот заголовок, поэтому клиентское значение до бэкенда не доходит.
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }
}
