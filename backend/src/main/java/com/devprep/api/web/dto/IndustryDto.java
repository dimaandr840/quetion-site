package com.devprep.api.web.dto;

/** Сфера — верхний уровень каталога. Повторяет Industry из lib/types.ts. */
public record IndustryDto(String slug, String emoji, String title, String description) {}
