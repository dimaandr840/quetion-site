package com.devprep.api.web.dto;

import java.time.Instant;

/** Админское представление флага. */
public record FeatureFlagDto(
        String key,
        boolean enabled,
        int rolloutPercentage,
        String description,
        Instant updatedAt,
        String updatedBy) {}
