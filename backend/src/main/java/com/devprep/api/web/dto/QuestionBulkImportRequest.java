package com.devprep.api.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Пакетная загрузка вопросов из админки или скрипта импорта.
 *
 * <p>Ограничение в {@value #MAX_ITEMS} элементов — не про базу, а про таймауты и память: тело
 * запроса целиком держится в памяти, а каждый вопрос пишется в своей транзакции. Пул на несколько
 * тысяч вопросов заливается последовательными пакетами, порядок между ними не важен.
 *
 * @param professionSlug направление по умолчанию для элементов без своего {@code professionSlug}
 * @param mode что делать с уже существующим вопросом; по умолчанию {@link ImportMode#SKIP_EXISTING}
 * @param createMissingCategories создавать отсутствующие темы вместо ошибки по элементу
 * @param dryRun только проверить пакет и вернуть отчёт, ничего не записывая
 */
public record QuestionBulkImportRequest(
        String professionSlug,
        ImportMode mode,
        boolean createMissingCategories,
        boolean dryRun,
        @NotNull @NotEmpty @Size(max = MAX_ITEMS) List<@Valid QuestionBulkImportItem> items) {

    public static final int MAX_ITEMS = 500;

    /** Стратегия для вопроса, который уже есть в базе (совпал slug или название). */
    public enum ImportMode {
        /** Пропустить: повторный запуск импорта не должен ничего ломать. */
        SKIP_EXISTING,
        /** Перезаписать содержимое существующего вопроса. */
        UPDATE_EXISTING,
        /** Отметить элемент как ошибочный. */
        FAIL_ON_EXISTING
    }

    public ImportMode modeOrDefault() {
        return mode == null ? ImportMode.SKIP_EXISTING : mode;
    }
}
