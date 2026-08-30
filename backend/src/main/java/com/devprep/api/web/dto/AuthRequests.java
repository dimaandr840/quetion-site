package com.devprep.api.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AuthRequests() {

    public record Login(@Email @NotBlank String email, @NotBlank String password) {}

    public record Register(
            @Email @NotBlank String email,
            @NotBlank @Size(min = 10, max = 128) String password,
            @NotBlank @Size(max = 128) String displayName) {}

    /**
     * Второй шаг входа: 6-значный код из приложения-аутентификатора либо резервный код вида
     * {@code XXXX-XXXX-XXXX}.
     */
    public record TotpVerify(
            @NotBlank
                    @Pattern(
                            regexp = "\\d{6}|(?:[A-Za-z0-9]{4}[- ]?){2}[A-Za-z0-9]{4}",
                            message = "Нужен 6-значный код или резервный код")
                    String code) {}

    /** Смена пароля. Отзывает все refresh-токены пользователя. */
    public record ChangePassword(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 10, max = 128) String newPassword) {}
}
