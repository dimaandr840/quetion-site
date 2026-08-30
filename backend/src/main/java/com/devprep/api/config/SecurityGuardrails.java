package com.devprep.api.config;

import com.devprep.api.security.TotpSecretCipher;
import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Предохранители конфигурации: лучше не запуститься, чем подняться без авторизации.
 *
 * <p>Самый дорогой инцидент в таком проекте — не изощрённая атака, а забытый в продакшене
 * отладочный флаг. {@code AUTH_ENABLED=false} открывает {@code /api/admin/**} всем желающим, а
 * {@code COOKIE_SECURE=false} отправляет токены по открытому HTTP. Оба режима разрешены
 * только при явно включённом профиле разработки.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SecurityGuardrails {

    private static final Set<String> DEV_PROFILES = Set.of("dev", "local", "test");

    private final SecurityProperties securityProperties;
    private final TotpSecretCipher totpSecretCipher;
    private final Environment environment;

    @PostConstruct
    void verify() {
        List<String> profiles = Arrays.asList(environment.getActiveProfiles());
        boolean development = profiles.stream().anyMatch(DEV_PROFILES::contains);

        if (!securityProperties.isAuthEnabled() && !development) {
            throw new IllegalStateException(
                    "AUTH_ENABLED=false допустим только при профиле dev/local/test. С этим"
                            + " флагом /api/admin/** отвечает без токена. Активные профили: "
                            + (profiles.isEmpty() ? "<нет>" : String.join(",", profiles)));
        }

        if (!securityProperties.getCookie().isSecure()) {
            log.warn(
                    "COOKIE_SECURE=false: auth-cookie будет уезжать по открытому HTTP. Для"
                            + " продакшена обязательно true вместе с HTTPS");
        }

        if (!securityProperties.getTotp().isRequiredForAdmins() && !development) {
            log.warn(
                    "TOTP_REQUIRED_FOR_ADMINS=false в не-разработочном профиле: админка защищена"
                            + " только паролем");
        }

        if (!totpSecretCipher.isEnabled() && !development) {
            log.warn(
                    "TOTP_ENC_KEY не задан: секреты второго фактора лежат в БД в открытом виде"
                            + " — дамп базы позволит клонировать 2FA");
        }

        log.info(
                "Контур безопасности: auth={}, cookieSecure={}, totpForAdmins={}, totpEncryption={}",
                securityProperties.isAuthEnabled(),
                securityProperties.getCookie().isSecure(),
                securityProperties.getTotp().isRequiredForAdmins(),
                totpSecretCipher.isEnabled());
    }
}
