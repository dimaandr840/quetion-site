package com.devprep.api.web;

import com.devprep.api.flags.FeatureFlagService;
import com.devprep.api.web.dto.PublicFlagsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Публичные значения флагов для фронтенда: {@code GET /api/flags?bucket=<id>}.
 *
 * <p>Параметр {@code bucket} — непрозрачный стабильный идентификатор клиента. Без него
 * частичная раскатка невозможна: без стабильного ключа пользователь попадал бы то в
 * одну, то в другую группу между запросами — интерфейс мигал бы.
 */
@RestController
@RequestMapping("/api/flags")
@RequiredArgsConstructor
public class FlagsController {

    private final FeatureFlagService flags;

    @GetMapping
    public ResponseEntity<PublicFlagsDto> flags(
            @RequestParam(name = "bucket", required = false) String bucket) {
        Duration ttl = flags.cacheTtl();
        return ResponseEntity.ok()
                // Кэш ровно на TTL серверного кэша: держать дольше — значит замедлить раскатку,
                // которая и есть смысл флагов.
                .cacheControl(CacheControl.maxAge(ttl).cachePrivate())
                .body(new PublicFlagsDto(flags.snapshot(bucket), ttl.toSeconds()));
    }
}
