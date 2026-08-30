package com.devprep.api.recovery;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Аргументы аварийного восстановления доступа к админке ({@code --recovery.*}).
 *
 * <p>Режим включается только при заданном {@link #email}: чтобы обычный запуск сервиса никогда
 * не мог случайно сбросить второй фактор. Подтверждением прав считается сам доступ к серверу,
 * где выполняется команда.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "recovery")
public class RecoveryProperties {

    /** Email администратора. Без него режим восстановления не включается вовсе. */
    private String email;

    /** Новый пароль (минимум 10 символов). Если пользователя нет — будет создан админ. */
    private String password;

    /** Стереть привязку аутентификатора: на следующем входе выдастся новый секрет. */
    private boolean resetTotp;

    /** Выпустить новые резервные коды и напечатать их в лог. */
    private boolean newCodes;

    /** Снять блокировку и сбросить счётчик неудачных попыток. */
    private boolean unlock = true;

    /** Запрошено ли восстановление. */
    public boolean isRequested() {
        return email != null && !email.isBlank();
    }
}
