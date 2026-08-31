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
 * Одноразовый код восстановления доступа, отправленный на почту пользователя.
 *
 * <p>В БД лежит только BCrypt-хеш кода: по дампу базы код не восстановить. Сам адрес здесь тоже не
 * дублируется — он берётся из связанного {@link AppUser}, поэтому лишней копии персональных данных
 * не появляется.
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

    /** Заполняется при успешном использовании: код строго одноразовый. */
    @Column(name = "used_at")
    private Instant usedAt;

    /** Число неверных вводов. Перебор упирается в лимит и код аннулируется. */
    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    /** IP, с которого запросили код — нужен для разбора инцидентов. */
    @Column(name = "requested_ip", length = 64)
    private String requestedIp;

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt != null && expiresAt.isAfter(now);
    }
}
