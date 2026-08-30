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
 * Персистентный refresh-токен. В самом JWT лежит только {@code jti} ({@link #tokenId}) — сам токен в
 * БД не хранится, поэтому утечка дампа не даёт возможности выпускать сессии.
 *
 * <p>Ротация: при каждом /api/auth/refresh старая запись помечается {@link #revokedAt} и
 * {@link #replacedBy}. Повторное использование уже отозванного токена трактуется как компрометация —
 * все сессии пользователя отзываются.
 */
@Entity
@Table(name = "refresh_token")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "tokenId", callSuper = false)
public class RefreshToken extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Значение claim {@code jti} выпущенного refresh-токена. */
    @Column(name = "token_id", nullable = false, unique = true, length = 64)
    private String tokenId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private AppUser user;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** jti токена, который заменил этот при ротации. */
    @Column(name = "replaced_by", length = 64)
    private String replacedBy;

    @Column(name = "user_agent", length = 256)
    private String userAgent;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }
}
