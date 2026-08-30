package com.devprep.api.seed;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.Role;
import com.devprep.api.repository.AppUserRepository;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Создаёт администратора из переменных окружения ADMIN_EMAIL / ADMIN_PASSWORD. Если они не заданы,
 * ничего не делает — дефолтных учёток в репозитории нет намеренно.
 */
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final org.springframework.core.env.Environment environment;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String email = environment.getProperty("ADMIN_EMAIL");
        String password = environment.getProperty("ADMIN_PASSWORD");
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            log.info("ADMIN_EMAIL/ADMIN_PASSWORD не заданы — администратор не создан");
            return;
        }
        String normalized = email.trim().toLowerCase();
        if (appUserRepository.existsByEmailIgnoreCase(normalized)) {
            return;
        }
        appUserRepository.save(
                AppUser.builder()
                        .email(normalized)
                        .passwordHash(passwordEncoder.encode(password))
                        .displayName("Администратор")
                        .enabled(true)
                        .roles(Set.of(Role.ROLE_ADMIN, Role.ROLE_USER))
                        .passwordChangedAt(java.time.Instant.now())
                        .build());
        log.info(
                "Создан администратор {}. При первом входе потребуется настроить 2FA.", normalized);
    }
}
