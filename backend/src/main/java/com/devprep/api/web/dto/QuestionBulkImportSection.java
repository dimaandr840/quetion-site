package com.devprep.api.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Секция ответа в формате массовой загрузки.
 *
 * <p>Отличается от {@link AnswerSectionDto} тем, что абзацы можно передать простым списком строк:
 * при импорте сотен вопросов писать для каждого абзаца объект с {@code kind: "PARAGRAPH"} нет
 * смысла. Сервис сам собирает из {@code paragraphs} блоки нужного вида.
 *
 * <p>{@code blocks} остаётся на случай, когда порядок картинок и абзацев внутри секции важен: если
 * список заполнен, он попадает в ответ как есть, а {@code paragraphs} дописываются после него.
 *
 * <p>{@code id} и {@code heading} необязательны — сервис подставит {@code s1..sN} и «Ответ», иначе
 * не заполнить NOT NULL поля {@code section_key} и {@code heading}.
 */
public record QuestionBulkImportSection(
        @Size(max = 128) String id,
        @Size(max = 512) String heading,
        List<String> paragraphs,
        List<String> bullets,
        CodeSampleDto code,
        List<@Valid AnswerBlockDto> blocks) {}
