package com.devprep.api.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Создание и правка направления из админки.
 *
 * <p>Обязательны только название и сфера: остальные тексты бэкенд выводит из названия, чтобы
 * форма не заставляла заполнять поля, которых нет в макете. {@code slug} тоже необязателен и
 * не обязан быть латинским — адрес нормализует {@link com.devprep.api.service.Slugs}.
 */
public record AdminProfessionRequest(
        @Size(max = 128) String slug,
        @NotBlank @Size(max = 128) String title,
        @Size(max = 8) String emoji,
        @Size(max = 256) String pageTitle,
        @Size(max = 1024) String description,
        @Size(max = 1024) String cardDescription,
        @NotBlank String industrySlug,
        Boolean featured) {}
