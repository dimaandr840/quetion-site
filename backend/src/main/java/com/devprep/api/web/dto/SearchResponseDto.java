package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import java.util.List;
import java.util.Map;

/**
 * Ответ поиска.
 *
 * @param query нормализованный запрос
 * @param total сколько всего найдено (не размер страницы)
 * @param page номер страницы, с нуля
 * @param size размер страницы после нормализации
 * @param items элементы текущей страницы
 * @param levelCounts фасеты по уровням, считаются по всей выдаче
 * @param professionCounts фасеты по профессиям, считаются по всей выдаче
 * @param fromIndex выдачу отдал Meilisearch (поле сохранено для совместимости с фронтендом)
 * @param searchMode index / database / fallback / deep-page
 * @param degraded поиск работает в упрощённом режиме: индекс включён, но недоступен.
 *     Фронтенд показывает баннер именно по этому полю, а не по {@code !fromIndex}: выключенный
 *     в конфигурации индекс — это штатный режим, а не авария.
 */
public record SearchResponseDto(
        String query,
        long total,
        int page,
        int size,
        List<QuestionSummaryDto> items,
        Map<Level, Long> levelCounts,
        List<ProfessionFacetDto> professionCounts,
        boolean fromIndex,
        String searchMode,
        boolean degraded) {

    public record ProfessionFacetDto(String slug, String title, String emoji, long count) {}
}
