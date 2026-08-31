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
     * Второй шаг входа: 6-значный код из приложения-аутентификатора. Резервные коды больше не
     * принимаются: потерянный второй фактор восстанавливается кодом из письма.
     */
    public record TotpVerify(
            @NotBlank @Pattern(regexp = "\\d{6}", message = "Нужен 6-значный код") String code) {}

    /** Смена пароля. Отзывает все refresh-токены пользователя. */
    public record ChangePassword(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 10, max = 128) String newPassword) {}

    /**
     * Шаг 1 восстановления доступа: пользователь сам вводит адрес. Код уйдёт только если
     * адрес совпадёт с адресом учётки; ответ одинаковый в любом случае.
     */
    public record PasswordResetRequest(@Email @NotBlank @Size(max = 256) String email) {}

    /** Шаг 2 восстановления доступа: код из письма и новый пароль. */
    public record PasswordResetConfirm(
            @Email @NotBlank @Size(max = 256) String email,
            @NotBlank
                    @Pattern(
                            regexp = "[A-Za-z0-9]{4}[- ]?[A-Za-z0-9]{4}",
                            message = "Нужен код вида XXXX-XXXX")
                    String code,
            @NotBlank @Size(min = 10, max = 128) String newPassword) {}
}
