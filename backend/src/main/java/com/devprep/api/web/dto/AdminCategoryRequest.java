package com.devprep.api.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Создание и правка темы (категории базы знаний) из админки.
 *
 * <p>{@code specializationSlug} необязателен: если он пуст, тема попадает в первую специализацию
 * направления, а при её отсутствии сервис создаёт специализацию «Общее».
 */
public record AdminCategoryRequest(
        @NotBlank
                @Size(max = 64)
                @Pattern(
                        regexp = "[a-z0-9]+(-[a-z0-9]+)*",
                        message = "Slug: строчные латинские буквы, цифры и дефис")
                String slug,
        @NotBlank @Size(max = 128) String title,
        @Size(max = 8) String emoji,
        @Size(max = 1024) String description,
        @NotBlank String professionSlug,
        @Size(max = 64) String specializationSlug) {}
