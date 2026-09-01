package com.devprep.api.web;

import com.devprep.api.service.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Публичная отдача картинок вопросов.
 *
 * <p>Штатный путь — публичный домен хранилища ({@code devprep.media.public-base-url}): он дешевле
 * и кешируется у провайдера. Но настроен он далеко не всегда: локальный стенд, приватный бакет,
 * превью-окружение. В такой конфигурации картинка сохранялась, но не показывалась ни в админке,
 * ни на странице вопроса — адрес было не из чего собрать, а фронтенд блок без url пропускает.
 *
 * <p>Только GET: путь попадает под правило «GET /api/** — permitAll» в SecurityConfiguration,
 * загрузка и удаление остаются в {@code /api/admin/media} под ROLE_ADMIN и CSRF.
 */
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private static final String PREFIX = "/api/media/";

    private final MediaService mediaService;

    /**
     * Ключ берём из пути целиком: в нём есть слэши, поэтому {@code @PathVariable} пришлось бы
     * склеивать из wildcard вручную.
     */
    @GetMapping("/**")
    public ResponseEntity<byte[]> get(HttpServletRequest request) {
        String uri = request.getRequestURI();
        int start = uri.indexOf(PREFIX);
        String key =
                start < 0
                        ? ""
                        : URLDecoder.decode(
                                uri.substring(start + PREFIX.length()), StandardCharsets.UTF_8);

        return mediaService
                .load(key)
                .<ResponseEntity<byte[]>>map(
                        object ->
                                ResponseEntity.ok()
                                        .contentType(MediaType.parseMediaType(object.contentType()))
                                        // Ключ содержит UUID и никогда не переиспользуется,
                                        // поэтому ответ можно кешировать надолго.
                                        .cacheControl(
                                                CacheControl.maxAge(Duration.ofDays(365))
                                                        .cachePublic()
                                                        .immutable())
                                        .body(object.bytes()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
