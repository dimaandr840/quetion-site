package com.devprep.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Одноразовый код восстановления доступа, отправленный письмом.
 *
 * <p>Сам код не хранится: в БД лежит только BCrypt-хеш, как и у пароля — дамп базы не
 * позволяет восстановить чей-либо доступ. Счётчик {@code attempts} гасит перебор по одному
 * высланному коду, {@code expiresAt} ограничивает окно его жизни.
 */
@Entity
@Table(name = "password_reset_token")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(name = "code_hash", nullable = false, length = 128)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Проставляется при успешном сбросе: повторно такой код не сработает. */
    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    /** IP запроса — только для разбора инцидентов. */
    @Column(name = "requested_ip", length = 64)
    private String requestedIp;

    /** Код ещё не использован и не просрочен. */
    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt != null && expiresAt.isAfter(now);
    }
}
