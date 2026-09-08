package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Один вопрос внутри пакета. Мягче, чем {@link QuestionUpsertRequest}, ровно в тех местах, где
 * ручное заполнение поля на объёме в сотни вопросов бессмысленно:
 *
 * <ul>
 *   <li>{@code slug} необязателен и может быть кириллическим — адрес соберёт {@code Slugs}, а
 *       коллизии сервис разведёт числовым суффиксом;
 *   <li>{@code snippet} и {@code tldr} необязательны — если их нет, сервис берёт первый абзац
 *       ответа, вычищая инлайновую разметку;
 *   <li>{@code professionSlug} необязателен, когда он задан один раз на весь пакет;
 *   <li>{@code categoryTitle} и {@code categoryEmoji} нужны только при
 *       {@code createMissingCategories}: из них создаётся отсутствующая тема.
 * </ul>
 */
public record QuestionBulkImportItem(
        @Size(max = 128) String slug,
        @NotBlank @Size(max = 512) String title,
        @NotNull Level level,
        String professionSlug,
        @NotBlank @Size(max = 128) String categorySlug,
        @Size(max = 128) String categoryTitle,
        @Size(max = 8) String categoryEmoji,
        List<@NotBlank @Size(max = 64) String> tags,
        @Size(max = 1024) String snippet,
        String tldr,
        Boolean popular,
        Boolean published,
        @NotNull @NotEmpty List<@Valid QuestionBulkImportSection> sections,
        List<@Valid PracticeTaskDto> tasks) {}
