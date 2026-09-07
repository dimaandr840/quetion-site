package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import java.util.List;
import java.util.Map;

/** Page is zero-based; total and facets always refer to the complete query, not items. */
public record SearchResponseDto(
        String query, long total, int page, int size, List<QuestionSummaryDto> items,
        Map<Level, Long> levelCounts, List<ProfessionFacetDto> professionCounts,
        boolean fromIndex, String searchMode, boolean degraded,
        long unfilteredTotal, long popularCount) {
    public record ProfessionFacetDto(String slug, String title, String emoji, long count) {}
}
