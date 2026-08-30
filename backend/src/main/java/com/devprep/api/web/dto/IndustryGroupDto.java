package com.devprep.api.web.dto;

import java.util.List;

/** Сфера вместе со своими профессиями — для каталога, сгруппированного по сферам. */
public record IndustryGroupDto(IndustryDto industry, List<ProfessionDto> professions) {}
