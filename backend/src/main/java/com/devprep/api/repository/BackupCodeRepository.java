package com.devprep.api.repository;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.BackupCode;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BackupCodeRepository extends JpaRepository<BackupCode, Long> {

    List<BackupCode> findByUserAndUsedAtIsNull(AppUser user);

    long countByUserAndUsedAtIsNull(AppUser user);

    long countByUser(AppUser user);

    void deleteByUser(AppUser user);
}
