package com.devprep.api.repository;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.PasswordResetToken;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /** Последний ещё не использованный код пользователя. */
    Optional<PasswordResetToken> findFirstByUserAndUsedAtIsNullOrderByIdDesc(AppUser user);

    /** Новый запрос и успешный сброс гасят все предыдущие коды. */
    @Modifying
    @Query("delete from PasswordResetToken t where t.user = :user")
    int deleteAllForUser(@Param("user") AppUser user);

    /** Просроченные коды бесполезны — чистит регламентная задача. */
    @Modifying
    @Query("delete from PasswordResetToken t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
