package com.devprep.api.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Картинка вопроса. На запись клиент присылает {@code storageKey} (выданный
 * {@code POST /api/admin/media}) и {@code alt}; {@code url} на запись игнорируется —
 * адрес всегда собирает бэкенд, иначе в базу можно было бы подсунуть чужой домен.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuestionImageDto(
        @NotBlank @Size(max = 200) String storageKey,
        String url,
        @NotBlank @Size(max = 300) String alt,
        @Size(max = 500) String caption,
        Integer width,
        Integer height) {}
