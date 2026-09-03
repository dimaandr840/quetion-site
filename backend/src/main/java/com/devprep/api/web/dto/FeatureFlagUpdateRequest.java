package com.devprep.api.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * Частичное обновление флага: null-поля остаются без изменений.
 *
 * <p>Отдельный rolloutPercentage нужен, чтобы включать функциональность постепенно,
 * а не рубильником на всю аудиторию.
 */
public record FeatureFlagUpdateRequest(
        Boolean enabled,
        @Min(0) @Max(100) Integer rolloutPercentage,
        @Size(max = 500) String description) {}
