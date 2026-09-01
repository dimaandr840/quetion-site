package com.devprep.api.web.dto;

import com.devprep.api.domain.AnswerBlockKind;
import com.devprep.api.domain.BlockAlign;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Блок ответа. Для {@code PARAGRAPH} заполнен {@code text}, для {@code IMAGE} — {@code storageKey}
 * и {@code alt}; связку проверяет сервис, потому что bean validation не выражает «одно из двух».
 *
 * <p>{@code url} на запись игнорируется: публичный адрес всегда собирает бэкенд, иначе в базу можно
 * было бы подсунуть чужой домен. {@code Pattern} на ключе — та же защита, что и в
 * {@link QuestionImageDto}: из ключа строится URL и вычисляется, какой объект удалить из бакета.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnswerBlockDto(
        @NotNull AnswerBlockKind kind,
        BlockAlign align,
        String text,
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
