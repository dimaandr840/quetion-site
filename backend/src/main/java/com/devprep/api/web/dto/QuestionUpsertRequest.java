package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record QuestionUpsertRequest(
        @NotBlank @Size(max = 128) String slug,
        @NotBlank @Size(max = 512) String title,
        @NotNull Level level,
        @NotBlank String professionSlug,
        @NotBlank String categorySlug,
        List<@NotBlank String> tags,
        @NotBlank @Size(max = 1024) String snippet,
        @NotBlank String tldr,
        boolean popular,
        /** null трактуется как «опубликован» — совместимость с клиентами без этого поля. */
        Boolean published,
        @NotNull List<AnswerSectionDto> sections,
        List<PracticeTaskDto> tasks) {}
