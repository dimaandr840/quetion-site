package com.devprep.api.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Создание и правка темы (категории базы знаний) из админки.
 *
 * <p>{@code slug} необязателен и не обязан быть латинским: адрес собирает сервис через
 * {@link com.devprep.api.service.Slugs}, а при пустом значении выводит его из названия. Раньше
 * здесь стоял {@code @Pattern([a-z0-9-])}, и запрос с кириллицей в slug отклонялся с 400 —
 * при этом название темы по условию может быть любым.
 *
 * <p>{@code specializationSlug} необязателен: если он пуст, тема попадает в первую специализацию
 * направления, а при её отсутствии сервис создаёт специализацию «Общее».
 */
public record AdminCategoryRequest(
        @Size(max = 128) String slug,
        @NotBlank @Size(max = 128) String title,
        @Size(max = 8) String emoji,
        @Size(max = 1024) String description,
        @NotBlank String professionSlug,
        @Size(max = 64) String specializationSlug) {}
