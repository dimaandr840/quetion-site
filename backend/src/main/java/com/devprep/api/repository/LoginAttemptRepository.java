package com.devprep.api.repository;

import com.devprep.api.domain.LoginAttempt;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    @Query(
            "select count(a) from LoginAttempt a where a.ipAddress = :ip and a.successful = false"
                    + " and a.attemptedAt > :since")
    long countFailuresByIpSince(@Param("ip") String ip, @Param("since") Instant since);

    @Modifying
    @Query("delete from LoginAttempt a where a.attemptedAt < :before")
    int deleteOlderThan(@Param("before") Instant before);
}
