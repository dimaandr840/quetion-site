package com.devprep.api.service;

import com.devprep.api.domain.Category;
import com.devprep.api.domain.Industry;
import com.devprep.api.domain.Profession;
import com.devprep.api.domain.Specialization;
import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.IndustryRepository;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.repository.SpecializationRepository;
import com.devprep.api.web.dto.AdminCategoryRequest;
import com.devprep.api.web.dto.AdminProfessionRequest;
import com.devprep.api.web.dto.CategoryDto;
import com.devprep.api.web.dto.ProfessionDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Управление направлениями и темами из админки.
 *
 * <p>{@code @PreAuthorize} дублирует правило {@code /api/admin/**} из SecurityConfiguration — как в
 * AdminQuestionService, чтобы защита не зависела только от URL-матчера.
 */
@Service
@RequiredArgsConstructor
public class AdminCatalogService {

    /** Специализация-контейнер для тем, созданных без выбора специализации. */
    private static final String DEFAULT_SPECIALIZATION_SLUG = "obshee";

    private static final String DEFAULT_EMOJI = "📁";

    private final ProfessionRepository professionRepository;
    private final CategoryRepository categoryRepository;
    private final SpecializationRepository specializationRepository;
    private final IndustryRepository industryRepository;
    private final QuestionRepository questionRepository;
    private final ContentMapper mapper;

    /* ---- Направления ---- */

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public ProfessionDto createProfession(AdminProfessionRequest request) {
        if (professionRepository.findBySlug(request.slug()).isPresent()) {
            throw new IllegalArgumentException(
                    "Направление с slug «" + request.slug() + "» уже существует");
        }

        Profession profession = new Profession();
        profession.setSlug(request.slug());
        profession.setSortOrder(nextProfessionSortOrder());
        applyProfession(profession, request);
        return mapper.toDto(professionRepository.save(profession));
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public ProfessionDto updateProfession(String slug, AdminProfessionRequest request) {
        Profession profession =
                professionRepository
                        .findBySlug(slug)
                        .orElseThrow(() -> ResourceNotFoundException.profession(slug));
        // Slug не меняем: он уже в ссылках, в вопросах и в индексе поиска.
        applyProfession(profession, request);
        return mapper.toDto(professionRepository.save(profession));
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public void deleteProfession(String slug) {
        Profession profession =
                professionRepository
                        .findBySlug(slug)
                        .orElseThrow(() -> ResourceNotFoundException.profession(slug));

        long questions = questionRepository.countByProfessionSlug(slug);
        if (questions > 0) {
            throw new IllegalArgumentException(
                    "Сначала удалите вопросы направления (осталось " + questions + ")");
        }

        // Темы и специализации без вопросов удаляем вместе с направлением:
        // сами по себе они не имеют смысла и остались бы висеть в каталоге.
        categoryRepository.deleteAll(categoryRepository.findByProfessionSlugOrderBySortOrderAsc(slug));
        specializationRepository.deleteAll(
                specializationRepository.findByProfessionSlugOrderBySortOrderAsc(slug));
        professionRepository.delete(profession);
    }

    private void applyProfession(Profession profession, AdminProfessionRequest request) {
        Industry industry =
                industryRepository
                        .findBySlug(request.industrySlug())
                        .orElseThrow(() -> ResourceNotFoundException.industry(request.industrySlug()));

        String title = request.title().trim();
        profession.setTitle(title);
        profession.setEmoji(blankTo(request.emoji(), "💼"));
        profession.setPageTitle(blankTo(request.pageTitle(), "Вопросы для " + title));
        profession.setDescription(
                blankTo(request.description(), "Вопросы для подготовки к собеседованию: " + title));
        profession.setCardDescription(blankTo(request.cardDescription(), title));
        profession.setIndustry(industry);
        profession.setFeatured(Boolean.TRUE.equals(request.featured()));
    }

    private int nextProfessionSortOrder() {
        return professionRepository.findAllByOrderBySortOrderAsc().stream()
                        .mapToInt(Profession::getSortOrder)
                        .max()
                        .orElse(0)
                + 1;
    }

    /* ---- Темы ---- */

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public CategoryDto createCategory(AdminCategoryRequest request) {
        if (categoryRepository
                .findByProfessionSlugAndSlug(request.professionSlug(), request.slug())
                .isPresent()) {
            throw new IllegalArgumentException(
                    "Тема с slug «" + request.slug() + "» уже есть в этом направлении");
        }

        Category category = new Category();
        category.setSlug(request.slug());
        category.setSortOrder(nextCategorySortOrder(request.professionSlug()));
        applyCategory(category, request);
        return mapper.toDto(categoryRepository.save(category));
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public CategoryDto updateCategory(
            String professionSlug, String slug, AdminCategoryRequest request) {
        Category category =
                categoryRepository
                        .findByProfessionSlugAndSlug(professionSlug, slug)
                        .orElseThrow(() -> ResourceNotFoundException.category(professionSlug, slug));
        if (!professionSlug.equals(request.professionSlug())) {
            throw new IllegalArgumentException(
                    "Тему нельзя перенести в другое направление: у её вопросов уже есть адреса");
        }
        applyCategory(category, request);
        return mapper.toDto(categoryRepository.save(category));
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public void deleteCategory(String professionSlug, String slug) {
        Category category =
                categoryRepository
                        .findByProfessionSlugAndSlug(professionSlug, slug)
                        .orElseThrow(() -> ResourceNotFoundException.category(professionSlug, slug));

        long questions =
                questionRepository.countByProfessionSlugAndCategorySlug(professionSlug, slug);
        if (questions > 0) {
            throw new IllegalArgumentException(
                    "Сначала удалите вопросы темы (осталось " + questions + ")");
        }

        Specialization specialization = category.getSpecialization();
        categoryRepository.delete(category);
        categoryRepository.flush();

        // Специализация — служебная группировка без своего URL: без тем она пуста.
        if (specialization != null
                && categoryRepository.countBySpecializationId(specialization.getId()) == 0) {
            specializationRepository.delete(specialization);
        }
    }

    private void applyCategory(Category category, AdminCategoryRequest request) {
        Profession profession =
                professionRepository
                        .findBySlug(request.professionSlug())
                        .orElseThrow(() -> ResourceNotFoundException.profession(request.professionSlug()));

        category.setTitle(request.title().trim());
        category.setEmoji(blankTo(request.emoji(), DEFAULT_EMOJI));
        category.setDescription(blankTo(request.description(), request.title().trim()));
        category.setProfession(profession);
        category.setSpecialization(resolveSpecialization(profession, request.specializationSlug()));
    }

    /**
     * Форма не спрашивает специализацию, поэтому её надо получить или создать: тема без
     * специализации невозможна — колонка {@code specialization_id} обязательная.
     */
    private Specialization resolveSpecialization(Profession profession, String requestedSlug) {
        List<Specialization> existing =
                specializationRepository.findByProfessionSlugOrderBySortOrderAsc(profession.getSlug());

        if (requestedSlug != null && !requestedSlug.isBlank()) {
            return existing.stream()
                    .filter(item -> item.getSlug().equals(requestedSlug))
                    .findFirst()
                    .orElseThrow(
                            () ->
                                    ResourceNotFoundException.specialization(
                                            profession.getSlug(), requestedSlug));
        }
        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        Specialization created = new Specialization();
        created.setSlug(DEFAULT_SPECIALIZATION_SLUG);
        created.setTitle("Общее");
        created.setDescription("Темы направления " + profession.getTitle());
        created.setProfession(profession);
        created.setSortOrder(1);
        return specializationRepository.save(created);
    }

    private int nextCategorySortOrder(String professionSlug) {
        return categoryRepository.findByProfessionSlugOrderBySortOrderAsc(professionSlug).stream()
                        .mapToInt(Category::getSortOrder)
                        .max()
                        .orElse(0)
                + 1;
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
