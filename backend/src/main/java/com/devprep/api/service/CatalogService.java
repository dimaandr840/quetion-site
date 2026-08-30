package com.devprep.api.service;

import com.devprep.api.domain.Category;
import com.devprep.api.domain.Specialization;
import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.IndustryRepository;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.SpecializationRepository;
import com.devprep.api.web.dto.CategoryDto;
import com.devprep.api.web.dto.IndustryDto;
import com.devprep.api.web.dto.IndustryGroupDto;
import com.devprep.api.web.dto.ProfessionDto;
import com.devprep.api.web.dto.SpecializationDto;
import com.devprep.api.web.dto.SpecializationTreeDto;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Повторяет getProfessions/getProfession/getCategories/getCategory, а также getIndustries,
 * getIndustryGroups, getFeaturedProfessions и getSpecializationTree из lib/queries.ts.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    /** Столько профессий показывает главная в блоке «Популярные профессии». */
    private static final int DEFAULT_FEATURED_LIMIT = 8;

    private final ProfessionRepository professionRepository;
    private final CategoryRepository categoryRepository;
    private final IndustryRepository industryRepository;
    private final SpecializationRepository specializationRepository;
    private final ContentMapper mapper;

    public List<IndustryDto> getIndustries() {
        return industryRepository.findAllByOrderBySortOrderAsc().stream()
                .map(mapper::toDto)
                .toList();
    }

    public IndustryDto getIndustry(String slug) {
        return industryRepository
                .findBySlug(slug)
                .map(mapper::toDto)
                .orElseThrow(() -> ResourceNotFoundException.industry(slug));
    }

    public List<ProfessionDto> getProfessionsByIndustry(String industrySlug) {
        if (industryRepository.findBySlug(industrySlug).isEmpty()) {
            throw ResourceNotFoundException.industry(industrySlug);
        }
        return professionRepository.findByIndustrySlugOrderBySortOrderAsc(industrySlug).stream()
                .map(mapper::toDto)
                .toList();
    }

    /** Каталог, сгруппированный по сферам. Пустые сферы не показываем — это тупик для читателя. */
    public List<IndustryGroupDto> getIndustryGroups() {
        List<IndustryGroupDto> groups = new ArrayList<>();
        for (var industry : industryRepository.findAllByOrderBySortOrderAsc()) {
            List<ProfessionDto> professions =
                    professionRepository
                            .findByIndustrySlugOrderBySortOrderAsc(industry.getSlug())
                            .stream()
                            .map(mapper::toDto)
                            .toList();
            if (!professions.isEmpty()) {
                groups.add(new IndustryGroupDto(mapper.toDto(industry), professions));
            }
        }
        return groups;
    }

    /** Сначала отмеченные featured, затем остальные по порядку — как во фронтенде. */
    public List<ProfessionDto> getFeaturedProfessions(Integer limit) {
        int size = limit == null || limit <= 0 ? DEFAULT_FEATURED_LIMIT : limit;
        List<ProfessionDto> ordered = new ArrayList<>();
        var all = professionRepository.findAllByOrderBySortOrderAsc();
        all.stream().filter(p -> p.isFeatured()).map(mapper::toDto).forEach(ordered::add);
        all.stream().filter(p -> !p.isFeatured()).map(mapper::toDto).forEach(ordered::add);
        return ordered.size() <= size ? ordered : List.copyOf(ordered.subList(0, size));
    }

    public List<SpecializationDto> getSpecializations(String professionSlug) {
        if (professionSlug == null || professionSlug.isBlank()) {
            return specializationRepository.findAllByOrderBySortOrderAsc().stream()
                    .map(s -> mapper.toDto(s, questionCount(s)))
                    .toList();
        }
        if (professionRepository.findBySlug(professionSlug).isEmpty()) {
            throw ResourceNotFoundException.profession(professionSlug);
        }
        return specializationRepository
                .findByProfessionSlugOrderBySortOrderAsc(professionSlug)
                .stream()
                .map(s -> mapper.toDto(s, questionCount(s)))
                .toList();
    }

    public SpecializationDto getSpecialization(String professionSlug, String slug) {
        return specializationRepository
                .findByProfessionSlugAndSlug(professionSlug, slug)
                .map(s -> mapper.toDto(s, questionCount(s)))
                .orElseThrow(
                        () -> ResourceNotFoundException.specialization(professionSlug, slug));
    }

    /** Специализации профессии вместе с темами. Специализации без тем пропускаем. */
    public List<SpecializationTreeDto> getSpecializationTree(String professionSlug) {
        if (professionRepository.findBySlug(professionSlug).isEmpty()) {
            throw ResourceNotFoundException.profession(professionSlug);
        }
        List<SpecializationTreeDto> tree = new ArrayList<>();
        for (var specialization :
                specializationRepository.findByProfessionSlugOrderBySortOrderAsc(professionSlug)) {
            List<Category> topics = topicsOf(specialization);
            if (topics.isEmpty()) {
                continue;
            }
            tree.add(
                    new SpecializationTreeDto(
                            mapper.toDto(specialization, sumQuestions(topics)),
                            topics.stream().map(mapper::toDto).toList()));
        }
        return tree;
    }

    public List<ProfessionDto> getProfessions() {
        return professionRepository.findAllByOrderBySortOrderAsc().stream()
                .map(mapper::toDto)
                .toList();
    }

    public ProfessionDto getProfession(String slug) {
        return professionRepository
                .findBySlug(slug)
                .map(mapper::toDto)
                .orElseThrow(() -> ResourceNotFoundException.profession(slug));
    }

    public List<CategoryDto> getCategories(String professionSlug) {
        var categories =
                professionSlug == null || professionSlug.isBlank()
                        ? categoryRepository.findAllByOrderBySortOrderAsc()
                        : categoryRepository.findByProfessionSlugOrderBySortOrderAsc(professionSlug);
        return categories.stream().map(mapper::toDto).toList();
    }

    public List<CategoryDto> getProfessionCategories(String professionSlug) {
        if (!professionRepository.findBySlug(professionSlug).isPresent()) {
            throw ResourceNotFoundException.profession(professionSlug);
        }
        return getCategories(professionSlug);
    }

    public CategoryDto getCategory(String professionSlug, String categorySlug) {
        return categoryRepository
                .findByProfessionSlugAndSlug(professionSlug, categorySlug)
                .map(mapper::toDto)
                .orElseThrow(
                        () -> ResourceNotFoundException.category(professionSlug, categorySlug));
    }

    private List<Category> topicsOf(Specialization specialization) {
        return categoryRepository
                .findBySpecializationProfessionSlugAndSpecializationSlugOrderBySortOrderAsc(
                        specialization.getProfession().getSlug(), specialization.getSlug());
    }

    private int questionCount(Specialization specialization) {
        return sumQuestions(topicsOf(specialization));
    }

    private int sumQuestions(List<Category> topics) {
        return topics.stream().mapToInt(Category::getQuestionCount).sum();
    }
}
