package com.devprep.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * Настройки хранилища картинок. Совместимо с любым S3 API; по умолчанию рассчитано
 * на Cloudflare R2 (region = auto, endpoint вида https://ACCOUNT_ID.r2.cloudflarestorage.com).
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "devprep.media")
public class MediaProperties {

    /** Выключено — загрузка отвечает 503, остальное приложение работает как раньше. */
    private boolean enabled = false;

    private String endpoint = "";

    private String bucket = "";

    private String accessKey = "";

    private String secretKey = "";

    /** У R2 региона нет, SDK требует непустое значение — используется литерал auto. */
    private String region = "auto";

    /**
     * Публичный префикс, из которого собирается адрес картинки: домен r2.dev,
     * свой поддомен или CDN. Без завершающего слэша.
     */
    private String publicBaseUrl = "";

    /** Префикс ключей внутри бакета — чтобы бакет можно было делить с другими файлами. */
    private String keyPrefix = "questions";

    /**
     * Верхняя граница размера исходного файла. Дублируется в
     * {@code spring.servlet.multipart.max-file-size} и в {@code client_max_body_size} nginx:
     * контейнер обрывает запрос раньше, чем до него дойдёт приложение.
     */
    private DataSize maxFileSize = DataSize.ofMegabytes(5);

    /** Длинная сторона после ресайза. 1600 px хватает для полноэкранного показа на 2x. */
    private int maxDimension = 1600;
}
