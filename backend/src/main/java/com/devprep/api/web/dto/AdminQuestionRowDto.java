package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import java.time.Instant;

/** Строка админской таблицы: реальные статус публикации и дата создания. */
public record AdminQuestionRowDto(
        String slug,
        String title,
        String professionSlug,
        String professionTitle,
        String categorySlug,
        String categoryTitle,
        Level level,
        boolean published,
        Instant createdAt) {}
