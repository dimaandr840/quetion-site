package com.devprep.api.recovery;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Режим восстановления доступа к админке из командной строки.
 *
 * <pre>
 * docker compose run --rm --no-deps api \
 *   java -jar /app/app.jar \
 *   --recovery.email=admin@example.com \
 *   --recovery.password='новый-очень-длинный-пароль' \
 *   --recovery.reset-totp=true \
 *   --recovery.new-codes=true
 * </pre>
 *
 * <p>Процесс выполняет восстановление, печатает результат и завершается: HTTP-порт в этом режиме
 * не нужен, а оставлять запущенный сервис с паролем в аргументах процесса не стоит.
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class RecoveryRunner implements ApplicationRunner {

    private final RecoveryProperties options;
    private final RecoveryService recoveryService;
    private final ConfigurableApplicationContext context;

    @Override
    public void run(ApplicationArguments args) {
        if (!options.isRequested()) {
            return;
        }
        log.warn("=== РЕЖИМ ВОССТАНОВЛЕНИЯ ДОСТУПА ===");
        RecoveryService.Result result;
        try {
            result = recoveryService.execute(options);
        } catch (RuntimeException e) {
            log.error("Восстановление не выполнено: {}", e.getMessage(), e);
            exit(1);
            return;
        }

        if (!result.success()) {
            exit(2);
            return;
        }

        log.warn("Восстановление выполнено для {}", options.getEmail().trim().toLowerCase());
        result.actions().forEach(action -> log.warn("  - {}", action));
        if (!result.backupCodes().isEmpty()) {
            log.warn("Новые резервные коды (показываются один раз):");
            result.backupCodes().forEach(code -> log.warn("  {}", code));
            log.warn(
                    "Коды попали в лог. Перенесите их в менеджер паролей, после чего очистите"
                            + " логи или выпустите набор заново через UI");
        }
        log.warn("Не забудьте почистить history оболочки: пароль был передан в командной строке");
        exit(0);
    }

    private void exit(int code) {
        int status = SpringApplication.exit(context, () -> code);
        System.exit(status);
    }
}
