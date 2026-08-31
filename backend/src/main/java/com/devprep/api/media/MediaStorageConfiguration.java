package com.devprep.api.media;

import com.devprep.api.config.MediaProperties;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

/**
 * Клиент S3-совместимого хранилища. Бин появляется только при
 * {@code devprep.media.enabled=true}: без ключей R2 сервис должен стартовать
 * (как и с выключенным Meilisearch), просто без загрузки картинок.
 */
@Configuration
@RequiredArgsConstructor
public class MediaStorageConfiguration {

    private final MediaProperties properties;

    @Bean
    @ConditionalOnProperty(prefix = "devprep.media", name = "enabled", havingValue = "true")
    public S3Client mediaS3Client() {
        if (properties.getEndpoint().isBlank() || properties.getBucket().isBlank()) {
            throw new IllegalStateException(
                    "devprep.media.enabled=true требует endpoint и bucket (см. docs/media.md)");
        }
        return S3Client.builder()
                .endpointOverride(URI.create(properties.getEndpoint()))
                .region(Region.of(properties.getRegion()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(
                                        properties.getAccessKey(), properties.getSecretKey())))
                .serviceConfiguration(
                        S3Configuration.builder()
                                // R2 не поддерживает virtual-hosted-адреса для произвольных
                                // бакетов и aws-chunked-кодирование тела запроса.
                                .pathStyleAccessEnabled(true)
                                .chunkedEncodingEnabled(false)
                                .build())
                .build();
    }
}
