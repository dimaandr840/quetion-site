package com.devprep.api.service;

import com.devprep.api.config.MediaProperties;
import com.devprep.api.web.dto.MediaUploadResponse;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

/**
 * Загрузка и удаление картинок в S3-совместимом хранилище.
 *
 * <p>Ключевая идея валидации: файлу не верим ни в чём. Ни {@code Content-Type} из запроса, ни
 * расширение, ни имя не проверяются и не используются — картинка декодируется и заново кодируется
 * средствами ImageIO. Это отсекает переименованный исполняемый файл, полиглот-файл (архив с
 * дописанным заголовком JPEG) и попутно вырезает EXIF, где обычно приезжают геометки автора.
 *
 * <p>SVG не поддерживается сознательно: это XML со скриптами внутри, а отдаётся он с публичного
 * домена — то есть был бы готовым XSS, если домен когда-нибудь окажется на одном origin с сайтом.
 */
@Slf4j
@Service
public class MediaService {

    /** Форматы, которые умеет декодировать штатный ImageIO без внешних плагинов. */
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png");

    /** Защита от decompression bomb: файл в 200 КБ может развернуться в гигабайты пикселей. */
    private static final long MAX_PIXELS = 40_000_000L;

    private static final DateTimeFormatter KEY_DATE =
            DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

    /**
     * Ключи мы выдаём сами, поэтому на удалении принимаем только свой формат. Без этого
     * {@code DELETE /api/admin/media?key=...} позволял бы вычистить произвольный объект бакета,
     * включая чужие файлы, если бакет когда-нибудь станет общим.
     */
    private static final Pattern KEY_PATTERN =
            Pattern.compile(
                    "^[a-z0-9-]{1,40}/\\d{4}/\\d{2}/"
                            + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                            + "\\.(jpg|png)$");

    /** Проксирующий эндпоинт: используется, когда публичный домен хранилища не задан. */
    private static final String API_PREFIX = "/api/media/";

    private final MediaProperties properties;
    private final Optional<S3Client> client;

    public MediaService(MediaProperties properties, Optional<S3Client> client) {
        this.properties = properties;
        this.client = client;
    }

    public boolean isEnabled() {
        return properties.isEnabled() && client.isPresent();
    }

    /**
     * Публичный адрес объекта. Собирается на чтении, в базе не хранится.
     *
     * <p>Если публичный домен не настроен (локальный стенд, приватный бакет), отдаём адрес
     * собственного эндпоинта {@code GET /api/media/<key>}. Раньше здесь возвращался null, и
     * сохранённая картинка просто не показывалась: в блоке ответа оставался только storageKey.
     */
    public String publicUrl(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return null;
        }
        String base = properties.getPublicBaseUrl();
        if (base == null || base.isBlank()) {
            return API_PREFIX + storageKey;
        }
        return base.endsWith("/") ? base + storageKey : base + "/" + storageKey;
    }

    /** Содержимое объекта для проксирующего эндпоинта. */
    public record StoredObject(byte[] bytes, String contentType) {}

    /**
     * Читает объект из хранилища. Нужно, когда картинки отдаёт сам API, а не публичный
     * домен. Чтение публичное, поэтому без {@code @PreAuthorize}, но ключ проверяется тем же
     * шаблоном, что и на удалении: читать произвольные ключи бакета через API нельзя.
     */
    public Optional<StoredObject> load(String storageKey) {
        if (!KEY_PATTERN.matcher(storageKey == null ? "" : storageKey).matches()) {
            throw new IllegalArgumentException("Некорректный ключ файла");
        }
        try {
            ResponseBytes<GetObjectResponse> object =
                    requireClient()
                            .getObjectAsBytes(
                                    GetObjectRequest.builder()
                                            .bucket(properties.getBucket())
                                            .key(storageKey)
                                            .build());
            String contentType = object.response().contentType();
            if (contentType == null || contentType.isBlank()) {
                // Расширение задали мы сами при загрузке, ему можно верить.
                contentType = storageKey.endsWith(".png") ? "image/png" : "image/jpeg";
            }
            return Optional.of(new StoredObject(object.asByteArray(), contentType));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        }
    }

    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public MediaUploadResponse upload(MultipartFile file) {
        S3Client s3 = requireClient();

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Файл не выбран");
        }
        long limit = properties.getMaxFileSize().toBytes();
        if (file.getSize() > limit) {
            throw new IllegalArgumentException(
                    "Файл больше " + properties.getMaxFileSize().toMegabytes() + " МБ");
        }
        // Заявленный тип не является доказательством, но отсеивает очевидно чужие файлы
        // до декодирования — дешёвая проверка перед дорогой.
        String declared = file.getContentType();
        if (declared != null && !ALLOWED_CONTENT_TYPES.contains(declared.toLowerCase())) {
            throw new IllegalArgumentException("Поддерживаются только JPEG и PNG");
        }

        byte[] source;
        BufferedImage decoded;
        try {
            source = file.getBytes();
            decoded = ImageIO.read(new ByteArrayInputStream(source));
        } catch (IOException e) {
            throw new IllegalArgumentException("Не удалось прочитать файл");
        }
        if (decoded == null) {
            throw new IllegalArgumentException("Файл не является изображением JPEG или PNG");
        }
        if ((long) decoded.getWidth() * decoded.getHeight() > MAX_PIXELS) {
            throw new IllegalArgumentException("Слишком большое разрешение изображения");
        }

        boolean transparent = decoded.getColorModel().hasAlpha();
        String format = transparent ? "png" : "jpg";
        String contentType = transparent ? "image/png" : "image/jpeg";

        BufferedImage normalized = resize(decoded, properties.getMaxDimension(), transparent);
        byte[] encoded = encode(normalized, format);

        String key =
                properties.getKeyPrefix()
                        + "/"
                        + KEY_DATE.format(Instant.now())
                        + "/"
                        + UUID.randomUUID()
                        + "."
                        + format;

        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(properties.getBucket())
                        .key(key)
                        .contentType(contentType)
                        // Ключ содержит UUID и никогда не переиспользуется, поэтому объект
                        // можно кэшировать навсегда.
                        .cacheControl("public, max-age=31536000, immutable")
                        .build(),
                RequestBody.fromBytes(encoded));

        return new MediaUploadResponse(
                key,
                publicUrl(key),
                contentType,
                normalized.getWidth(),
                normalized.getHeight(),
                encoded.length);
    }

    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public void delete(String storageKey) {
        if (!KEY_PATTERN.matcher(storageKey == null ? "" : storageKey).matches()) {
            throw new IllegalArgumentException("Некорректный ключ файла");
        }
        requireClient()
                .deleteObject(
                        DeleteObjectRequest.builder()
                                .bucket(properties.getBucket())
                                .key(storageKey)
                                .build());
    }

    /**
     * Удаление «попутных» объектов: отвязанных от вопроса картинок и файлов удалённого вопроса.
     * Ошибка хранилища здесь не должна ронять транзакцию сохранения — в худшем случае объект
     * подберёт ночной уборщик.
     */
    public void deleteQuietly(Collection<String> storageKeys) {
        if (!isEnabled() || storageKeys == null || storageKeys.isEmpty()) {
            return;
        }
        for (String key : storageKeys) {
            try {
                delete(key);
            } catch (RuntimeException e) {
                log.warn("Не удалось удалить объект {}: {}", key, e.getClass().getSimpleName());
            }
        }
    }

    /** Ключи объектов старше указанного возраста — вход для поиска сирот. */
    public List<String> listKeysOlderThan(Duration age) {
        if (!isEnabled()) {
            return List.of();
        }
        Instant threshold = Instant.now().minus(age);
        List<String> keys = new ArrayList<>();
        String cursor = null;
        do {
            ListObjectsV2Response response =
                    requireClient()
                            .listObjectsV2(
                                    ListObjectsV2Request.builder()
                                            .bucket(properties.getBucket())
                                            .prefix(properties.getKeyPrefix() + "/")
                                            .continuationToken(cursor)
                                            .maxKeys(1000)
                                            .build());
            for (S3Object object : response.contents()) {
                if (object.lastModified().isBefore(threshold)) {
                    keys.add(object.key());
                }
            }
            cursor = Boolean.TRUE.equals(response.isTruncated()) ? response.nextContinuationToken() : null;
        } while (cursor != null);
        return keys;
    }

    private S3Client requireClient() {
        return client.orElseThrow(
                () ->
                        new MediaUnavailableException(
                                "Хранилище картинок не настроено: задайте R2_* переменные"));
    }

    /**
     * Ресайз с одновременным «отбеливанием» файла: результат собирается из пикселей в новом
     * буфере, поэтому в выходной файл физически не может попасть ничего из метаданных исходника.
     * Картинку меньше лимита не растягиваем, но всё равно перекодируем.
     */
    private BufferedImage resize(BufferedImage source, int maxDimension, boolean transparent) {
        int width = source.getWidth();
        int height = source.getHeight();
        double scale = Math.min(1.0, (double) maxDimension / Math.max(width, height));
        int targetWidth = Math.max(1, (int) Math.round(width * scale));
        int targetHeight = Math.max(1, (int) Math.round(height * scale));

        BufferedImage target =
                new BufferedImage(
                        targetWidth,
                        targetHeight,
                        transparent ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(
                    RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(
                    RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            if (!transparent) {
                // JPEG не умеет прозрачность: без заливки полупрозрачные пиксели стали бы чёрными.
                graphics.setColor(java.awt.Color.WHITE);
                graphics.fillRect(0, 0, targetWidth, targetHeight);
            }
            graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private byte[] encode(BufferedImage image, String format) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            if (!ImageIO.write(image, format, out)) {
                throw new IllegalArgumentException("Не удалось перекодировать изображение");
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("Не удалось перекодировать изображение");
            }
        return out.toByteArray();
    }

    /** Хранилище выключено или недоступно — это 503, а не ошибка запроса. */
    public static class MediaUnavailableException extends RuntimeException {
        public MediaUnavailableException(String message) {
            super(message);
        }
    }
}
