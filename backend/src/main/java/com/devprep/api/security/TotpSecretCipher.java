package com.devprep.api.security;

import com.devprep.api.config.SecurityProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Шифрование TOTP-секретов перед записью в БД (AES-GCM).
 *
 * <p>Зачем: дамп базы не должен давать возможность клонировать второй фактор. Пароли защищены
 * BCrypt, а TOTP-секрет по своей природе восстанавливаемый — значит его нужно шифровать ключом,
 * который живёт вне БД (переменная окружения {@code TOTP_ENC_KEY}).
 *
 * <p>Формат хранения: {@code v1:base64(nonce||ciphertext||tag)}. Версия в префиксе нужна для
 * будущей смены алгоритма или ротации ключа без миграции «одним движением».
 *
 * <p>Совместимость: значения без префикса считаются старыми открытыми секретами и читаются как
 * есть. Так внедрение шифрования не выкидывает уже привязанные аутентификаторы — секрет
 * перешифруется при следующей успешной проверке кода.
 */
@Slf4j
@Component
public class TotpSecretCipher {

    private static final String PREFIX = "v1:";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public TotpSecretCipher(SecurityProperties properties) {
        String configured = properties.getTotp().getEncryptionKey();
        if (configured == null || configured.isBlank()) {
            this.key = null;
            log.warn(
                    "TOTP_ENC_KEY не задан: секреты второго фактора будут храниться в открытом виде."
                            + " Сгенерируйте ключ командой openssl rand -base64 32");
            return;
        }
        byte[] material;
        try {
            material = Base64.getDecoder().decode(configured.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "devprep.security.totp.encryption-key (TOTP_ENC_KEY) должен быть строкой Base64",
                    e);
        }
        if (material.length != 16 && material.length != 24 && material.length != 32) {
            throw new IllegalStateException(
                    "TOTP_ENC_KEY должен декодироваться в 16, 24 или 32 байта, получено "
                            + material.length);
        }
        this.key = new SecretKeySpec(material, "AES");
    }

    /** Включено ли шифрование. При false значения пишутся как есть. */
    public boolean isEnabled() {
        return key != null;
    }

    /** Нужно ли перешифровать значение из БД (старый открытый секрет при включённом ключе). */
    public boolean needsRewrap(String stored) {
        return isEnabled() && stored != null && !stored.isBlank() && !stored.startsWith(PREFIX);
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank() || key == null) {
            return plaintext;
        }
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[nonce.length + ciphertext.length];
            System.arraycopy(nonce, 0, payload, 0, nonce.length);
            System.arraycopy(ciphertext, 0, payload, nonce.length, ciphertext.length);
            return PREFIX + Base64.getEncoder().encodeToString(payload);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Не удалось зашифровать TOTP-секрет", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || stored.isBlank()) {
            return stored;
        }
        if (!stored.startsWith(PREFIX)) {
            // Старый открытый секрет: читаем как есть, перешифруем при следующей проверке кода.
            return stored;
        }
        if (key == null) {
            throw new IllegalStateException(
                    "TOTP-секрет зашифрован, но TOTP_ENC_KEY не задан — вход администратора"
                            + " невозможен");
        }
        try {
            byte[] payload = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            if (payload.length <= NONCE_BYTES) {
                throw new IllegalStateException("Повреждённый TOTP-секрет");
            }
            byte[] nonce = new byte[NONCE_BYTES];
            System.arraycopy(payload, 0, nonce, 0, NONCE_BYTES);
            byte[] ciphertext = new byte[payload.length - NONCE_BYTES];
            System.arraycopy(payload, NONCE_BYTES, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.error("Не удалось расшифровать TOTP-секрет: {}", e.getMessage());
            return null;
        }
    }
}
