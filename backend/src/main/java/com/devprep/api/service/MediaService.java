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
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

@Slf4j
@Service
public class MediaService {
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final long MAX_PIXELS = 40_000_000L;
    private static final DateTimeFormatter KEY_DATE = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);
    private static final Pattern KEY_PATTERN = Pattern.compile("^[a-z0-9-]{1,40}/\\d{4}/\\d{2}/"
            + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)$");
    private final MediaProperties properties;
    private final Optional<S3Client> client;
    public MediaService(MediaProperties properties, Optional<S3Client> client) {
        this.properties = properties; this.client = client;
    }
    public boolean isEnabled() { return properties.isEnabled() && client.isPresent(); }
    public String publicUrl(String key) {
        if (key == null || key.isBlank()) return null;
        String base = properties.getPublicBaseUrl();
        if (base == null || base.isBlank()) return "/api/media/" + key;
        return base.endsWith("/") ? base + key : base + "/" + key;
    }
    public record StoredObject(byte[] bytes, String contentType) {}
    public Optional<StoredObject> load(String key) {
        validateKey(key);
        try {
            var object = requireClient().getObjectAsBytes(GetObjectRequest.builder().bucket(properties.getBucket()).key(key).build());
            String type = object.response().contentType();
            if (type == null || type.isBlank()) type = key.endsWith(".png") ? "image/png" : "image/jpeg";
            return Optional.of(new StoredObject(object.asByteArray(), type));
        } catch (NoSuchKeyException e) { return Optional.empty(); }
    }
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public MediaUploadResponse upload(MultipartFile file) {
        S3Client s3 = requireClient();
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Файл не выбран");
        if (file.getSize() > properties.getMaxFileSize().toBytes()) throw new IllegalArgumentException("Файл слишком большой");
        String declared = file.getContentType();
        if (declared != null && !ALLOWED_CONTENT_TYPES.contains(declared.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Поддерживаются только JPEG и PNG");
        }
        BufferedImage decoded;
        // Read dimensions and ACTUAL format before allocating a decoded pixel buffer.
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
            if (input == null) throw new IllegalArgumentException("Не удалось прочитать изображение");
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IllegalArgumentException("Файл не является JPEG или PNG");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!Set.of("jpeg", "jpg", "png").contains(format)) throw new IllegalArgumentException("Поддерживаются только JPEG и PNG");
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS) {
                    throw new IllegalArgumentException("Слишком большое разрешение изображения");
                }
                decoded = reader.read(0);
            } finally { reader.dispose(); }
        } catch (IOException e) { throw new IllegalArgumentException("Не удалось прочитать файл"); }
        if (decoded == null) throw new IllegalArgumentException("Не удалось декодировать изображение");
        boolean alpha = decoded.getColorModel().hasAlpha();
        String format = alpha ? "png" : "jpg";
        String type = alpha ? "image/png" : "image/jpeg";
        BufferedImage image = resize(decoded, properties.getMaxDimension(), alpha);
        byte[] bytes = encode(image, format);
        String key = properties.getKeyPrefix() + "/" + KEY_DATE.format(Instant.now()) + "/" + UUID.randomUUID() + "." + format;
        s3.putObject(PutObjectRequest.builder().bucket(properties.getBucket()).key(key).contentType(type)
                .cacheControl("public, max-age=31536000, immutable").build(), RequestBody.fromBytes(bytes));
        return new MediaUploadResponse(key, publicUrl(key), type, image.getWidth(), image.getHeight(), bytes.length);
    }
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public void delete(String key) {
        validateKey(key);
        requireClient().deleteObject(DeleteObjectRequest.builder().bucket(properties.getBucket()).key(key).build());
    }
    private static void validateKey(String key) {
        if (!KEY_PATTERN.matcher(key == null ? "" : key).matches()) throw new IllegalArgumentException("Некорректный ключ файла");
    }
    public void deleteQuietly(Collection<String> keys) {
        if (!isEnabled() || keys == null || keys.isEmpty()) return;
        List<String> snapshot = List.copyOf(keys);
        AfterCommit.run(() -> {
            for (String key : snapshot) {
                try { delete(key); }
                catch (RuntimeException e) { log.warn("Media cleanup failed: {}", e.getClass().getSimpleName()); }
            }
        });
    }
    public List<String> listKeysOlderThan(Duration age) {
        if (!isEnabled()) return List.of();
        Instant threshold = Instant.now().minus(age);
        List<String> keys = new ArrayList<>();
        String cursor = null;
        do {
            var response = requireClient().listObjectsV2(ListObjectsV2Request.builder().bucket(properties.getBucket())
                    .prefix(properties.getKeyPrefix() + "/").continuationToken(cursor).maxKeys(1000).build());
            for (S3Object object : response.contents()) if (object.lastModified().isBefore(threshold)) keys.add(object.key());
            cursor = Boolean.TRUE.equals(response.isTruncated()) ? response.nextContinuationToken() : null;
        } while (cursor != null);
        return keys;
    }
    private S3Client requireClient() {
        if (!isEnabled()) throw new MediaUnavailableException("Хранилище картинок не настроено");
        return client.orElseThrow(() -> new MediaUnavailableException("Хранилище картинок не настроено"));
    }
    private BufferedImage resize(BufferedImage source, int maxDimension, boolean alpha) {
        if (maxDimension <= 0) throw new IllegalArgumentException("Некорректный лимит размера изображения");
        double scale = Math.min(1.0, (double) maxDimension / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage target = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            if (!alpha) { graphics.setColor(java.awt.Color.WHITE); graphics.fillRect(0, 0, width, height); }
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally { graphics.dispose(); }
        return target;
    }
    private byte[] encode(BufferedImage image, String format) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            if (!ImageIO.write(image, format, out)) throw new IllegalArgumentException("Не удалось перекодировать изображение");
        } catch (IOException e) { throw new IllegalArgumentException("Не удалось перекодировать изображение"); }
        return out.toByteArray();
    }
    public static class MediaUnavailableException extends RuntimeException {
        public MediaUnavailableException(String message) { super(message); }
    }
}
