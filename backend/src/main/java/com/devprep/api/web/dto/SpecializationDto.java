package com.devprep.api.web.dto;

/** Специализация внутри профессии. Повторяет Specialization из lib/types.ts. */
public record SpecializationDto(
        String slug, String professionSlug, String title, String description, int questionCount) {}
