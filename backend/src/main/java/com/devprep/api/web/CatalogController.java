package com.devprep.api.web;

import com.devprep.api.service.CatalogService;
import com.devprep.api.service.QuestionService;
import com.devprep.api.web.dto.CategoryDto;
import com.devprep.api.web.dto.IndustryDto;
import com.devprep.api.web.dto.IndustryGroupDto;
import com.devprep.api.web.dto.ProfessionDto;
import com.devprep.api.web.dto.QuestionSummaryDto;
import com.devprep.api.web.dto.SpecializationDto;
import com.devprep.api.web.dto.SpecializationTreeDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Публичный каталог: сферы, профессии, специализации и темы. Соответствует lib/queries.ts. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogService catalogService;
    private final QuestionService questionService;

    @GetMapping("/industries")
    public List<IndustryDto> industries() {
        return catalogService.getIndustries();
    }

    @GetMapping("/industries/{slug}")
    public IndustryDto industry(@PathVariable String slug) {
        return catalogService.getIndustry(slug);
    }

    @GetMapping("/industries/{slug}/professions")
    public List<ProfessionDto> industryProfessions(@PathVariable String slug) {
        return catalogService.getProfessionsByIndustry(slug);
    }

    /** Каталог, сгруппированный по сферам — повторяет getIndustryGroups(). */
    @GetMapping("/industry-groups")
    public List<IndustryGroupDto> industryGroups() {
        return catalogService.getIndustryGroups();
    }

    /** {@code ?featured=true&limit=8} повторяет getFeaturedProfessions(limit). */
    @GetMapping("/professions")
    public List<ProfessionDto> professions(
            @RequestParam(required = false, defaultValue = "false") boolean featured,
            @RequestParam(required = false) Integer limit) {
        return featured
                ? catalogService.getFeaturedProfessions(limit)
                : catalogService.getProfessions();
    }

    @GetMapping("/professions/{slug}/specializations")
    public List<SpecializationDto> specializations(@PathVariable String slug) {
        return catalogService.getSpecializations(slug);
    }

    /** Все специализации каталога — повторяет getSpecializations() без аргумента. */
    @GetMapping("/specializations")
    public List<SpecializationDto> allSpecializations() {
        return catalogService.getSpecializations(null);
    }

    @GetMapping("/professions/{slug}/specializations/{specializationSlug}")
    public SpecializationDto specialization(
            @PathVariable String slug, @PathVariable String specializationSlug) {
        return catalogService.getSpecialization(slug, specializationSlug);
    }

    /** Специализации с темами — для страницы профессии. */
    @GetMapping("/professions/{slug}/specialization-tree")
    public List<SpecializationTreeDto> specializationTree(@PathVariable String slug) {
        return catalogService.getSpecializationTree(slug);
    }

    @GetMapping("/professions/{slug}")
    public ProfessionDto profession(@PathVariable String slug) {
        return catalogService.getProfession(slug);
    }

    @GetMapping("/professions/{slug}/categories")
    public List<CategoryDto> professionCategories(@PathVariable String slug) {
        return catalogService.getProfessionCategories(slug);
    }

    @GetMapping("/professions/{slug}/categories/{categorySlug}")
    public CategoryDto category(@PathVariable String slug, @PathVariable String categorySlug) {
        return catalogService.getCategory(slug, categorySlug);
    }

    @GetMapping("/professions/{slug}/categories/{categorySlug}/questions")
    public List<QuestionSummaryDto> categoryQuestions(
            @PathVariable String slug, @PathVariable String categorySlug) {
        return questionService.getQuestionsByCategory(slug, categorySlug);
    }

    /** {@code ?profession=} повторяет getCategories(professionSlug?). */
    @GetMapping("/categories")
    public List<CategoryDto> categories(
            @RequestParam(required = false) String profession) {
        return catalogService.getCategories(profession);
    }
}
