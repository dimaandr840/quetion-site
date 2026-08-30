package com.devprep.api.recovery;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.Role;
import com.devprep.api.repository.AppUserRepository;
import com.devprep.api.repository.RefreshTokenRepository;
import com.devprep.api.service.BackupCodeService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Аварийное восстановление доступа: сброс пароля, сброс привязки 2FA, новые резервные коды.
 *
 * <p>Вызывается только из {@link RecoveryRunner} — в HTTP-слой эта логика не выведена намеренно:
 * единственное доказательство прав — доступ к серверу.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecoveryService {

    private static final int MIN_PASSWORD_LENGTH = 10;

    private final AppUserRepository appUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BackupCodeService backupCodeService;
    private final PasswordEncoder passwordEncoder;

    /** Итог восстановления для печати в лог. */
    public record Result(boolean success, List<String> actions, List<String> backupCodes) {}

    @Transactional
    public Result execute(RecoveryProperties options) {
        String email = options.getEmail().trim().toLowerCase();
        String password = options.getPassword();
        boolean hasPassword = password != null && !password.isBlank();

        if (hasPassword && password.length() < MIN_PASSWORD_LENGTH) {
            log.error(
                    "--recovery.password короче {} символов — восстановление отменено",
                    MIN_PASSWORD_LENGTH);
            return new Result(false, List.of(), List.of());
        }

        Instant now = Instant.now();
        List<String> actions = new ArrayList<>();
        Optional<AppUser> found = appUserRepository.findByEmailIgnoreCase(email);

        AppUser user;
        if (found.isPresent()) {
            user = found.get();
        } else {
            if (!hasPassword) {
                log.error(
                        "Пользователь {} не найден, а --recovery.password не задан — создавать"
                                + " админа нечем",
                        email);
                return new Result(false, List.of(), List.of());
            }
            user =
                    AppUser.builder()
                            .email(email)
                            .passwordHash(passwordEncoder.encode(password))
                            .displayName("Администратор")
                            .enabled(true)
                            .roles(Set.of(Role.ROLE_ADMIN, Role.ROLE_USER))
                            .passwordChangedAt(now)
                            .build();
            actions.add("создан новый администратор");
            hasPassword = false; // пароль уже установлен при создании
        }

        if (hasPassword) {
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setPasswordChangedAt(now);
            actions.add("пароль заменён");
        }
        if (options.isResetTotp()) {
            user.setTotpSecret(null);
            user.setTotpEnabled(false);
            user.setTotpLastUsedStep(null);
            actions.add("привязка аутентификатора стёрта");
        }
        if (options.isUnlock()) {
            user.setFailedLoginAttempts(0);
            user.setLockoutUntil(null);
            actions.add("блокировка снята");
        }
        if (!user.isEnabled()) {
            user.setEnabled(true);
            actions.add("учётка включена");
        }
        user = appUserRepository.save(user);

        List<String> codes = List.of();
        if (options.isNewCodes()) {
            codes = backupCodeService.reissue(user);
            actions.add("выпущены новые резервные коды");
        }

        // После любого восстановления активные сессии больше не доверенные.
        int revoked = refreshTokenRepository.revokeAllForUser(user, now);
        actions.add("отозвано сессий: " + revoked);

        return new Result(true, actions, codes);
    }
}
