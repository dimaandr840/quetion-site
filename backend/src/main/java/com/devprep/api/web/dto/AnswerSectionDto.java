package com.devprep.api.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnswerSectionDto(
        String id,
        String heading,
        List<@Valid AnswerBlockDto> blocks,
        List<String> bullets,
        CodeSampleDto code) {}
