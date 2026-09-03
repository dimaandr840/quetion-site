package com.devprep.api.service;

import com.devprep.api.config.SecurityProperties;
import com.devprep.api.observability.IntegrationStatusService;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Отправка письма с кодом восстановления доступа.
 *
 * <p>Ни адрес получателя, ни сам код никогда не попадают в логи: журналы часто доступны шире,
 * чем база, и утечка кода в лог равносильна утечке доступа.
 *
 * <p>{@link ObjectProvider} нужен потому, что {@link JavaMailSender} создаётся только при
 * заданном {@code spring.mail.host}: без SMTP сервис должен стартовать как обычно.
 *
 * <p>Результат каждой отправки попадает в {@link IntegrationStatusService}: раньше отказ SMTP
 * был виден только в логах — то есть на практике никому: администратор узнавал о проблеме
 * от пользователя, который так и не получил код.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PasswordResetMailer {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecurityProperties securityProperties;
    private final IntegrationStatusService integrationStatus;

    /** @return true, если письмо отдано SMTP-серверу. */
    public boolean send(String email, String code, Duration ttl) {
        SecurityProperties.PasswordReset config = securityProperties.getPasswordReset();
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null || config.getMailFrom() == null || config.getMailFrom().isBlank()) {
            log.error(
                    "SMTP не настроен (SMTP_HOST / PASSWORD_RESET_MAIL_FROM) — письмо с кодом"
                            + " восстановления не отправлено");
            integrationStatus.mailDisabled(
                    "SMTP не настроен: задайте SMTP_HOST и PASSWORD_RESET_MAIL_FROM");
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(config.getMailFrom());
            message.setTo(email);
            message.setSubject(config.getMailSubject());
            message.setText(
                    "Здравствуйте!\n\n"
                            + "Код для восстановления доступа к DevPrep: "
                            + code
                            + "\n\n"
                            + "Код действует "
                            + Math.max(1, ttl.toMinutes())
                            + " мин. и срабатывает один раз.\n"
                            + "Если вы не запрашивали восстановление — просто проигнорируйте"
                            + " это письмо: текущий пароль остался без изменений.\n");
            sender.send(message);
            integrationStatus.mailUp();
            return true;
        } catch (RuntimeException e) {
            // Сообщение ошибки SMTP может содержать адрес, поэтому логируем только класс.
            log.error(
                    "Не удалось отправить письмо с кодом восстановления: {}",
                    e.getClass().getSimpleName());
            integrationStatus.mailDown("Ошибка отправки: " + e.getClass().getSimpleName());
            return false;
        }
    }
}
