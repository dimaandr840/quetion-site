package com.devprep.api.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** Практическое задание к вопросу. Повторяет PracticeTask из lib/types.ts. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PracticeTaskDto(String id, String title, List<String> statement, String hint) {}
