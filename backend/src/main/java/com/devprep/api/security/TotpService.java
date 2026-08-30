package com.devprep.api.security;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.OptionalLong;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * TOTP по RFC 6238 (HMAC-SHA1, 6 цифр, шаг 30 секунд) — совместимо с Google Authenticator, Authy,
 * 1Password и т.п.
 *
 * <p>Реализовано вручную, без сторонней библиотеки: алгоритм маленький, а лишняя зависимость в
 * контуре аутентификации — лишняя поверхность атаки и лишний CVE-риск.
 */
@Slf4j
@Component
public class TotpService {

    private static final String HMAC_ALGORITHM = "HmacSHA1";
    private static final int DIGITS = 6;
    private static final int PERIOD_SECONDS = 30;

    /** Допуск ±1 шаг: компенсирует расхождение часов клиента и сервера. */
    private static final int WINDOW_STEPS = 1;

    private static final int SECRET_BYTES = 20;
    private static final char[] BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final int[] BASE32_LOOKUP = new int[128];

    static {
        java.util.Arrays.fill(BASE32_LOOKUP, -1);
        for (int i = 0; i < BASE32_ALPHABET.length; i++) {
            BASE32_LOOKUP[BASE32_ALPHABET[i]] = i;
            BASE32_LOOKUP[Character.toLowerCase(BASE32_ALPHABET[i])] = i;
        }
    }

    private final SecureRandom random = new SecureRandom();

    /** Генерирует новый 160-битный секрет в Base32 без паддинга. */
    public String generateSecret() {
        byte[] buffer = new byte[SECRET_BYTES];
        random.nextBytes(buffer);
        return base32Encode(buffer);
    }

    /** otpauth-URI для QR-кода. */
    public String provisioningUri(String issuer, String email, String secret) {
        String label = issuer + ":" + email;
        return UriComponentsBuilder.newInstance()
                .scheme("otpauth")
                .host("totp")
                .path("/" + label)
                .queryParam("secret", secret)
                .queryParam("issuer", issuer)
                .queryParam("algorithm", "SHA1")
                .queryParam("digits", DIGITS)
                .queryParam("period", PERIOD_SECONDS)
                .build()
                .toUriString();
    }

    /**
     * Проверяет код без учёта повторного использования.
     *
     * <p>Для входа используйте {@link #verifyAndGetStep(String, String, Long)}: одного
     * совпадения недостаточно, код обязан быть одноразовым.
     */
    public boolean verify(String secret, String code) {
        return verifyAndGetStep(secret, code, null).isPresent();
    }

    /**
     * Проверяет код с допуском ±{@value #WINDOW_STEPS} шаг и возвращает номер совпавшего шага.
     *
     * @param lastUsedStep номер шага, который уже применялся раньше; такой и любой более ранний
     *     шаг отвергаются (anti-replay). {@code null} — проверка без учёта истории.
     * @return номер шага при успешной проверке, иначе пустое значение
     */
    public OptionalLong verifyAndGetStep(String secret, String code, Long lastUsedStep) {
        if (secret == null || secret.isBlank() || code == null) {
            return OptionalLong.empty();
        }
        String normalized = code.trim().replace(" ", "");
        if (normalized.length() != DIGITS || !normalized.chars().allMatch(Character::isDigit)) {
            return OptionalLong.empty();
        }
        byte[] key;
        try {
            key = base32Decode(secret);
        } catch (IllegalArgumentException e) {
            log.warn("Некорректный TOTP-секрет в БД");
            return OptionalLong.empty();
        }
        long step = Instant.now().getEpochSecond() / PERIOD_SECONDS;
        for (long candidate = step - WINDOW_STEPS; candidate <= step + WINDOW_STEPS; candidate++) {
            if (lastUsedStep != null && candidate <= lastUsedStep) {
                // Шаг уже использован: перехваченный код повторно не сработает.
                continue;
            }
            if (constantTimeEquals(normalized, generateCode(key, candidate))) {
                return OptionalLong.of(candidate);
            }
        }
        return OptionalLong.empty();
    }

    private String generateCode(byte[] key, long step) {
        byte[] counter = new byte[8];
        long value = step;
        for (int i = 7; i >= 0; i--) {
            counter[i] = (byte) (value & 0xFF);
            value >>>= 8;
        }
        byte[] hash;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(key, HMAC_ALGORITHM));
            hash = mac.doFinal(counter);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC-SHA1 недоступен", e);
        }
        int offset = hash[hash.length - 1] & 0x0F;
        int binary =
                ((hash[offset] & 0x7F) << 24)
                        | ((hash[offset + 1] & 0xFF) << 16)
                        | ((hash[offset + 2] & 0xFF) << 8)
                        | (hash[offset + 3] & 0xFF);
        int otp = binary % (int) Math.pow(10, DIGITS);
        return String.format(Locale.ROOT, "%0" + DIGITS + "d", otp);
    }

    /** Сравнение без утечки времени — код нельзя подобрать по таймингу. */
    private boolean constantTimeEquals(String a, String b) {
        byte[] left = a.getBytes(StandardCharsets.US_ASCII);
        byte[] right = b.getBytes(StandardCharsets.US_ASCII);
        return java.security.MessageDigest.isEqual(left, right);
    }

    static String base32Encode(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                out.append(BASE32_ALPHABET[(buffer >> (bitsLeft - 5)) & 0x1F]);
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            out.append(BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 0x1F]);
        }
        return out.toString();
    }

    static byte[] base32Decode(String encoded) {
        String clean = encoded.replace("=", "").replace(" ", "");
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Пустой Base32-секрет");
        }
        byte[] out = new byte[clean.length() * 5 / 8];
        int buffer = 0;
        int bitsLeft = 0;
        int index = 0;
        for (char c : clean.toCharArray()) {
            int value = c < BASE32_LOOKUP.length ? BASE32_LOOKUP[c] : -1;
            if (value < 0) {
                throw new IllegalArgumentException("Недопустимый символ Base32: " + c);
            }
            buffer = (buffer << 5) | value;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        return out;
    }
}
