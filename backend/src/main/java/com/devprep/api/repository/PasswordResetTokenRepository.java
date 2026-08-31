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

    /** Последний неиспользованный код пользователя. Активным считается только он. */
    Optional<PasswordResetToken> findFirstByUserAndUsedAtIsNullOrderByIdDesc(AppUser user);

    @Modifying
    @Query("delete from PasswordResetToken t where t.user = :user")
    int deleteAllForUser(@Param("user") AppUser user);

    @Modifying
    @Query("delete from PasswordResetToken t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
