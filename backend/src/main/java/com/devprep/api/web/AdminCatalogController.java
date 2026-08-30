package com.devprep.api.web;

import com.devprep.api.service.AdminCatalogService;
import com.devprep.api.web.dto.AdminCategoryRequest;
import com.devprep.api.web.dto.AdminProfessionRequest;
import com.devprep.api.web.dto.CategoryDto;
import com.devprep.api.web.dto.ProfessionDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Направления и темы из админки. Требует ROLE_ADMIN (см. SecurityConfiguration: /api/admin/**).
 *
 * <p>Чтение идёт через публичные {@code /api/professions} и {@code /api/categories} — отдельных
 * админских списков нет, они вернули бы то же самое.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminCatalogController {

    private final AdminCatalogService adminCatalogService;

    @PostMapping("/professions")
    @ResponseStatus(HttpStatus.CREATED)
    public ProfessionDto createProfession(@Valid @RequestBody AdminProfessionRequest request) {
        return adminCatalogService.createProfession(request);
    }

    @PutMapping("/professions/{slug}")
    public ProfessionDto updateProfession(
            @PathVariable String slug, @Valid @RequestBody AdminProfessionRequest request) {
        return adminCatalogService.updateProfession(slug, request);
    }

    @DeleteMapping("/professions/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProfession(@PathVariable String slug) {
        adminCatalogService.deleteProfession(slug);
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryDto createCategory(@Valid @RequestBody AdminCategoryRequest request) {
        return adminCatalogService.createCategory(request);
    }

    @PutMapping("/professions/{professionSlug}/categories/{slug}")
    public CategoryDto updateCategory(
            @PathVariable String professionSlug,
            @PathVariable String slug,
            @Valid @RequestBody AdminCategoryRequest request) {
        return adminCatalogService.updateCategory(professionSlug, slug, request);
    }

    @DeleteMapping("/professions/{professionSlug}/categories/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(
            @PathVariable String professionSlug, @PathVariable String slug) {
        adminCatalogService.deleteCategory(professionSlug, slug);
    }
}
