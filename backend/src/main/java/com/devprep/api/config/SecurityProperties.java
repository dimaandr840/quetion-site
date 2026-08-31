package com.devprep.api.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Настройки защиты аутентификации: cookie, блокировка учёток, rate limit, 2FA, сброс пароля. */
@Getter
@Setter
@ConfigurationProperties(prefix = "devprep.security")
public class SecurityProperties {

    /**
     * Временный рубильник: при false авторизация не требуется — {@code /api/admin/**} и {@code
     * /api/me/**} отвечают без токена. Никогда не выключать в production: любой желающий
     * сможет редактировать базу вопросов.
     */
    private boolean authEnabled = true;

    private final Cookie cookie = new Cookie();
    private final Lockout lockout = new Lockout();
    private final RateLimit rateLimit = new RateLimit();
    private final Totp totp = new Totp();
    private final PasswordReset passwordReset = new PasswordReset();

    @Getter
    @Setter
    public static class Cookie {

        /**
         * Ставить ли флаг Secure. В production обязательно true; для локального http его приходится
         * выключать, иначе браузер не сохранит cookie.
         */
        private boolean secure = true;

        /** Strict защищает от CSRF лучше всего; Lax нужен, если планируются внешние переходы. */
        private String sameSite = "Strict";

        /** Домен cookie. Пусто — host-only cookie (рекомендуется). */
        private String domain = "";
    }

    @Getter
    @Setter
    public static class Lockout {

        private boolean enabled = true;

        /** После этого числа подряд неудачных попыток учётка блокируется. */
        private int maxAttempts = 5;

        /** На сколько блокируется учётка. */
        private Duration duration = Duration.ofMinutes(15);
    }

    @Getter
    @Setter
    public static class RateLimit {

        private boolean enabled = true;

        /** Максимум неудачных попыток входа с одного IP в окне {@link #window}. */
        private int maxFailuresPerIp = 20;

        private Duration window = Duration.ofMinutes(10);
    }

    @Getter
    @Setter
    public static class Totp {

        /** Требовать 2FA для всех аккаунтов с ROLE_ADMIN. */
        private boolean requiredForAdmins = true;

        /** Имя, которое увидит пользователь в приложении-аутентификаторе. */
        private String issuer = "DevPrep";

        /**
         * Ключ шифрования TOTP-секретов в Base64 (16/24/32 байта после декодирования).
         * Сгенерировать: {@code openssl rand -base64 32}. Пусто — секреты хранятся открыто
         * (допустимо только в разработке).
         */
        private String encryptionKey = "";
    }

    /**
     * Самостоятельное восстановление доступа по почте (замена резервных кодов).
     *
     * <p>Сам адрес нигде не настраивается: код уходит только на адрес учётки и только если он
     * совпал с введённым.
     */
    @Getter
    @Setter
    public static class PasswordReset {

        /** false полностью закрывает публичный сброс: остаётся только CLI-восстановление. */
        private boolean enabled = true;

        /** Сколько живёт код из письма. */
        private Duration ttl = Duration.ofMinutes(15);

        /** Пауза между письмами: без неё форма становится бесплатным отправщиком писем. */
        private Duration cooldown = Duration.ofMinutes(1);

        /** После этого числа неверных вводов код аннулируется. */
        private int maxAttempts = 5;

        /**
         * Стирать ли привязку аутентификатора при успешном сбросе. true заменяет резервные коды в
         * сценарии «потерял телефон», но делает почтовый ящик единственным фактором восстановления:
         * если это неприемлемо, выставляется false и 2FA сбрасывается только с сервера.
         */
        private boolean resetTotp = true;

        /** Адрес в поле From. Пусто — письма не отправляются. */
        private String mailFrom = "";

        private String mailSubject = "DevPrep: код для восстановления доступа";
    }
}
