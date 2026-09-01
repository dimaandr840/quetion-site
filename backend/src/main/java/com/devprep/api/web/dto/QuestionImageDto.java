package com.devprep.api.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Картинка вопроса. На запись клиент присылает {@code storageKey} (выданный
 * {@code POST /api/admin/media}); {@code url} на запись игнорируется — адрес всегда собирает
 * бэкенд, иначе в базу можно было бы подсунуть чужой домен.
 *
 * <p>{@code alt} необязателен: скриншот, вставленный в ответ, обычно объясняется соседним
 * текстом и подписью, а пустой {@code alt} — корректная разметка для декоративной картинки.
 * Требовать описание на каждую вставку означало бы блокировать сохранение ответа из-за
 * необязательной метаданной.
 *
 * <p>{@code Pattern} принимает только ключи нашего формата. Это не косметика: без проверки в
 * {@code question_image.storage_key} попала бы произвольная строка от клиента, а из неё потом
 * собирается публичный URL и вычисляется, какой объект удалить из бакета.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuestionImageDto(
        @NotBlank
                @Size(max = 200)
                @Pattern(
                        regexp =
                                "^[a-z0-9-]{1,40}/\\d{4}/\\d{2}/"
                                        + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                                        + "\\.(jpg|png)$",
                        message = "Некорректный ключ файла")
                String storageKey,
        String url,
        @Size(max = 300) String alt,
        @Size(max = 500) String caption,
        Integer width,
        Integer height) {}
