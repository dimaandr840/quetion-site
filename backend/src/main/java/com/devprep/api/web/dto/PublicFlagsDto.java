package com.devprep.api.web.dto;

import java.util.Map;

/**
 * Ответ публичного {@code GET /api/flags}.
 *
 * @param flags ключ -> разрешён ли флаг именно этому клиенту
 * @param cacheSeconds сколько секунд клиенту можно кэшировать ответ
 */
public record PublicFlagsDto(Map<String, Boolean> flags, long cacheSeconds) {}
