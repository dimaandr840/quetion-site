package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import java.util.List;
import java.util.Map;

public record SearchResponseDto(
        String query,
        long total,
        List<QuestionSummaryDto> items,
        Map<Level, Long> levelCounts,
        List<ProfessionFacetDto> professionCounts,
        boolean fromIndex) {

    public record ProfessionFacetDto(String slug, String title, String emoji, long count) {}
}
