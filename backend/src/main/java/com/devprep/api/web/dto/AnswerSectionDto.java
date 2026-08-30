package com.devprep.api.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnswerSectionDto(
        String id,
        String heading,
        List<String> paragraphs,
        List<String> bullets,
        CodeSampleDto code) {}
