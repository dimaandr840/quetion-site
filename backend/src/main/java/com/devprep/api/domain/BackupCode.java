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
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Резервный код второго фактора: одноразовая замена TOTP-кода, когда аутентификатор недоступен.
 *
 * <p>В БД лежит только BCrypt-хеш — по той же причине, что и для пароля: дамп базы не должен давать
 * возможность войти. Использованный код не удаляется, а помечается {@link #usedAt}: так видно, что
 * набор частично израсходован, и можно разобрать инцидент.
 */
@Entity
@Table(name = "user_backup_code")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "id", callSuper = false)
public class BackupCode extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private AppUser user;

    @Column(name = "code_hash", nullable = false, length = 128)
    @ToString.Exclude
    private String codeHash;

    /** Момент использования. {@code null} — код ещё действителен. */
    @Column(name = "used_at")
    private Instant usedAt;

    public boolean isUsed() {
        return usedAt != null;
    }
}
