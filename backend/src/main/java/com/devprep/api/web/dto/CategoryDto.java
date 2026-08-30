package com.devprep.api.web.dto;

public record CategoryDto(
        String slug,
        String emoji,
        String title,
        String description,
        String professionSlug,
        String specializationSlug,
        int questionCount) {}
