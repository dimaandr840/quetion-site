package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import java.util.List;

/** Форма карточки вопроса на списках — без тела ответа. */
public record QuestionSummaryDto(
        String slug,
        String title,
        Level level,
        String professionSlug,
        String categorySlug,
        List<String> tags,
        String snippet,
        String tldr,
        boolean popular,
        String path) {}
