package com.devprep.api.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Отчёт о пакетной загрузке. Ответ всегда 200: пакет заведомо частично успешен — один вопрос с
 * неизвестной темой не должен отменять остальные 499, поэтому исход по каждому элементу приходит
 * в теле, а не кодом статуса.
 */
public record QuestionBulkImportResponse(
        int total,
        int created,
        int updated,
        int skipped,
        int failed,
        boolean dryRun,
        List<ItemResult> results) {

    public enum Outcome {
        CREATED,
        UPDATED,
        SKIPPED,
        FAILED,
        /** Только для {@code dryRun}: элемент прошёл проверку и был бы записан. */
        VALIDATED
    }

    /**
     * @param index позиция элемента во входном массиве — по ней вызывающая сторона находит источник
     * @param slug итоговый адрес вопроса (может отличаться от присланного из-за коллизий)
     * @param error человекочитаемая причина для {@link Outcome#FAILED} и {@link Outcome#SKIPPED}
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ItemResult(int index, String title, String slug, Outcome outcome, String error) {}
}
