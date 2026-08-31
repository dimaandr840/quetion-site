package com.devprep.api.web.dto;

import com.devprep.api.domain.Role;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Set;

/**
 * Ответ auth-эндпоинтов. Токенов в теле нет намеренно: и access, и refresh уходят только в httpOnly
 * cookie, поэтому JS (а значит и XSS) до них не достаёт.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(Status status, long expiresIn, UserDto user, TotpSetupDto totpSetup) {

    public enum Status {
        /** Полный доступ выдан, cookie установлены. */
        AUTHENTICATED,
        /** Пароль верен, нужен код из приложения-аутентификатора. */
        TOTP_REQUIRED,
        /** Пароль верен, но 2FA обязательна и ещё не настроена — см. {@link #totpSetup()}. */
        TOTP_SETUP_REQUIRED
    }

    public record UserDto(String email, String displayName, Set<Role> roles) {}

    /** Данные для первичной настройки 2FA. Отдаются один раз, до подтверждения кодом. */
    public record TotpSetupDto(String secret, String provisioningUri) {}

    /**
     * Ответ на запрос восстановления доступа.
     *
     * <p>Адрес получателя не возвращается ни целиком, ни маской, ни намёком: иначе форма стала
     * бы способом узнать почту пользователя или проверить, зарегистрирован ли адрес. Клиенту
     * нужен только срок жизни кода — всё остальное человек видит в своём почтовом ящике.
     */
    public record PasswordResetRequestedDto(long expiresInMinutes) {}

    public static AuthResponse authenticated(long expiresIn, UserDto user) {
        return new AuthResponse(Status.AUTHENTICATED, expiresIn, user, null);
    }

    public static AuthResponse totpRequired() {
        return new AuthResponse(Status.TOTP_REQUIRED, 0, null, null);
    }

    public static AuthResponse totpSetupRequired(TotpSetupDto setup) {
        return new AuthResponse(Status.TOTP_SETUP_REQUIRED, 0, null, setup);
    }
}
