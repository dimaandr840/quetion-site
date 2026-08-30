package com.devprep.api.web.dto;

import java.util.List;

/** Специализация вместе с темами — для страницы профессии. */
public record SpecializationTreeDto(SpecializationDto specialization, List<CategoryDto> topics) {}
