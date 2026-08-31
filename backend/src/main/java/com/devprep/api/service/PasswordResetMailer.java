package com.devprep.api.service;

import com.devprep.api.config.SecurityProperties;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Письмо с кодом восстановления доступа.
 *
 * <p>Ни код, ни адрес получателя не попадают в лог: логи читает больше людей, чем почтовый ящик
 * владельца учётки. {@link JavaMailSender} берётся через {@link ObjectProvider} — если SMTP не
 * настроен (пустой {@code SMTP_HOST}), сервис остаётся работоспособным, а попытка отправки
 * честно пишет ошибку.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PasswordResetMailer {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecurityProperties securityProperties;

    /** @return true, если письмо удалось передать SMTP-серверу. */
    public boolean send(String email, String code, Duration ttl) {
        SecurityProperties.PasswordReset config = securityProperties.getPasswordReset();
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.error("SMTP не настроен: код восстановления доступа отправить некуда");
            return false;
        }
        String from = config.getMailFrom();
        if (from == null || from.isBlank()) {
            log.error("Не задан PASSWORD_RESET_MAIL_FROM: письмо со сбросом пароля не отправлено");
            return false;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject(config.getMailSubject());
        message.setText(body(code, ttl));
        try {
            sender.send(message);
            log.info("Код восстановления доступа отправлен письмом");
            return true;
        } catch (RuntimeException e) {
            // Текст исключения может содержать адрес получателя, поэтому наружу только тип.
            log.error("Не удалось отправить письмо со сбросом пароля: {}", e.getClass().getName());
            return false;
        }
    }

    private String body(String code, Duration ttl) {
        long minutes = Math.max(1, ttl.toMinutes());
        return """
                Кто-то запросил восстановление доступа к DevPrep для этого адреса.

                Код подтверждения: %s

                Код действует %d мин. и работает только один раз.
                Введите его на странице восстановления доступа вместе с новым паролем.

                Если вы этого не запрашивали — просто удалите письмо: без кода
                пароль изменить нельзя, а активные сессии останутся как были.
                """
                .formatted(code, minutes);
    }
}
