package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuestionDetailDto(
        String slug,
        String title,
        Level level,
        String professionSlug,
        String categorySlug,
        List<String> tags,
        String snippet,
        String tldr,
        boolean popular,
        boolean published,
        String path,
        List<AnswerSectionDto> sections,
        List<PracticeTaskDto> tasks,
        List<QuestionImageDto> images,
        List<QuestionSummaryDto> related,
        QuestionSummaryDto previous,
        QuestionSummaryDto next) {}
