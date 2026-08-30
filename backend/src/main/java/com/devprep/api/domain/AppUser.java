package com.devprep.api.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "email", callSuper = false)
public class AppUser extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Email
    @NotBlank
    @Column(nullable = false, unique = true, length = 256)
    private String email;

    @NotBlank
    @Column(name = "password_hash", nullable = false, length = 128)
    @ToString.Exclude
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 128)
    private String displayName;

    @Builder.Default
    @Column(nullable = false)
    private boolean enabled = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "app_user_role", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 32)
    @Builder.Default
    private Set<Role> roles = EnumSet.noneOf(Role.class);

    /** Число подряд неудачных попыток входа. Сбрасывается при успешном входе. */
    @Builder.Default
    @Column(name = "failed_login_attempts", nullable = false)
    private int failedLoginAttempts = 0;

    /** До этого момента вход заблокирован. {@code null} — блокировки нет. */
    @Column(name = "lockout_until")
    private Instant lockoutUntil;

    /**
     * Момент последней смены пароля. Все refresh-токены, выпущенные раньше, считаются
     * недействительными.
     */
    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    /**
     * TOTP-секрет. Хранится зашифрованным (AES-GCM, формат {@code v1:base64}); значения без
     * префикса — унаследованные открытые секреты. Не логируется и не отдаётся в API после
     * подтверждения.
     */
    @Column(name = "totp_secret", length = 256)
    @ToString.Exclude
    private String totpSecret;

    /**
     * Номер последнего использованного 30-секундного шага TOTP.
     *
     * <p>Anti-replay: код одноразовый, поэтому шаг, который уже принимали, повторно не проходит.
     * Без этого перехваченный код остаётся валидным до конца окна (до 90 секунд).
     */
    @Column(name = "totp_last_used_step")
    private Long totpLastUsedStep;

    /** Двухфакторка подтверждена и активна. */
    @Builder.Default
    @Column(name = "totp_enabled", nullable = false)
    private boolean totpEnabled = false;

    public boolean isAdmin() {
        return roles.contains(Role.ROLE_ADMIN);
    }

    public boolean isLocked(Instant now) {
        return lockoutUntil != null && lockoutUntil.isAfter(now);
    }
}
