package com.devprep.api.service;

import com.devprep.api.domain.AnswerSection;
import com.devprep.api.domain.Category;
import com.devprep.api.domain.CodeSample;
import com.devprep.api.domain.Level;
import com.devprep.api.domain.PracticeTask;
import com.devprep.api.domain.Profession;
import com.devprep.api.domain.Question;
import com.devprep.api.domain.QuestionImage;
import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.search.MeilisearchService;
import com.devprep.api.web.dto.AdminQuestionRowDto;
import com.devprep.api.web.dto.AnswerSectionDto;
import com.devprep.api.web.dto.CodeSampleDto;
import com.devprep.api.web.dto.PracticeTaskDto;
import com.devprep.api.web.dto.QuestionDetailDto;
import com.devprep.api.web.dto.QuestionImageDto;
import com.devprep.api.web.dto.QuestionUpsertRequest;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Административные операции над вопросами: создание, обновление, удаление.
 *
 * <p>{@code @PreAuthorize} дублирует правило {@code /api/admin/**} из SecurityConfiguration: если
 * когда-нибудь появится новый контроллер или внутренний вызов в обход URL-матчера, защита останется.
 * Проверка {@code !@authz.authRequired()} пропускает вызовы, когда авторизация отключена флагом.
 */
@Slf4j
@Service
public class AdminQuestionService {

    private final QuestionRepository questionRepository;
    private final ProfessionRepository professionRepository;
    private final CategoryRepository categoryRepository;
    private final ContentMapper mapper;
    private final MediaService mediaService;
    private final Optional<MeilisearchService> meilisearch;

    public AdminQuestionService(
            QuestionRepository questionRepository,
            ProfessionRepository professionRepository,
            CategoryRepository categoryRepository,
            ContentMapper mapper,
            MediaService mediaService,
            Optional<MeilisearchService> meilisearch) {
        this.questionRepository = questionRepository;
        this.professionRepository = professionRepository;
        this.categoryRepository = categoryRepository;
        this.mapper = mapper;
        this.mediaService = mediaService;
        this.meilisearch = meilisearch;
    }

    @Transactional(readOnly = true)
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public List<AdminQuestionRowDto> list() {
        return questionRepository.findAllByOrderByIdAsc().stream()
                .map(
                        question ->
                                new AdminQuestionRowDto(
                                        question.getSlug(),
                                        question.getTitle(),
                                        question.getProfession().getSlug(),
                                        question.getProfession().getTitle(),
                                        question.getCategory().getSlug(),
                                        question.getCategory().getTitle(),
                                        question.getLevel(),
                                        question.isPublished(),
                                        question.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public QuestionDetailDto get(String slug) {
        Question question =
                questionRepository
                        .findWithAnswerBySlug(slug)
                        .orElseThrow(() -> ResourceNotFoundException.question(slug));
        return mapper.toDetail(question, List.of(), null, null);
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public QuestionDetailDto create(QuestionUpsertRequest request) {
        if (questionRepository.findBySlug(request.slug()).isPresent()) {
            throw new IllegalArgumentException("Вопрос с slug «" + request.slug() + "» уже существует");
        }
        Question question = apply(new Question(), request, new ArrayList<>());
        Question saved = questionRepository.save(question);
        recount(saved);
        reindex(saved);
        return mapper.toDetail(saved, List.of(), null, null);
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public QuestionDetailDto update(String slug, QuestionUpsertRequest request) {
        Question question =
                questionRepository
                        .findWithAnswerBySlug(slug)
                        .orElseThrow(() -> ResourceNotFoundException.question(slug));
        String previousProfession = question.getProfession().getSlug();
        List<String> detachedImages = new ArrayList<>();
        Question saved = questionRepository.save(apply(question, request, detachedImages));
        recount(saved);
        if (!previousProfession.equals(saved.getProfession().getSlug())) {
            professionRepository.findBySlug(previousProfession).ifPresent(this::recountProfession);
        }
        reindex(saved);
        // Файлы удаляем после успешного сохранения: при откате транзакции вопрос остался бы
        // ссылаться на объект, которого уже нет в бакете.
        mediaService.deleteQuietly(detachedImages);
        return mapper.toDetail(saved, List.of(), null, null);
    }

    @Transactional
    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public void delete(String slug) {
        Question question =
                questionRepository.findBySlug(slug).orElseThrow(() -> ResourceNotFoundException.question(slug));
        Profession profession = question.getProfession();
        Category category = question.getCategory();
        List<String> orphanedImages =
                question.getImages().stream().map(QuestionImage::getStorageKey).toList();
        questionRepository.delete(question);
        questionRepository.flush();
        recountProfession(profession);
        recountCategory(category);
        meilisearch.ifPresent(service -> service.deleteOne(slug));
        mediaService.deleteQuietly(orphanedImages);
    }

    /**
     * @param detachedImages сюда складываются ключи картинок, которые вопрос больше не использует —
     *     вызывающий удалит их из хранилища после коммита.
     */
    private Question apply(
            Question question, QuestionUpsertRequest request, List<String> detachedImages) {
        Profession profession =
                professionRepository
                        .findBySlug(request.professionSlug())
                        .orElseThrow(() -> ResourceNotFoundException.profession(request.professionSlug()));
        Category category =
                categoryRepository
                        .findByProfessionSlugAndSlug(request.professionSlug(), request.categorySlug())
                        .orElseThrow(
                                () ->
                                        ResourceNotFoundException.category(
                                                request.professionSlug(), request.categorySlug()));

        question.setSlug(request.slug());
        question.setTitle(request.title());
        question.setLevel(request.level());
        question.setProfession(profession);
        question.setCategory(category);
        question.setSnippet(request.snippet());
        question.setTldr(request.tldr());
        question.setPopular(request.popular());
        question.setPublished(request.published() == null || request.published());
        question.setTags(
                request.tags() == null ? new LinkedHashSet<>() : new LinkedHashSet<>(request.tags()));

        question.getSections().clear();
        for (AnswerSectionDto dto : request.sections()) {
            question.addSection(toEntity(dto));
        }

        question.getTasks().clear();
        if (request.tasks() != null) {
            for (PracticeTaskDto dto : request.tasks()) {
                question.addTask(toEntity(dto));
            }
        }

        applyImages(question, request.images() == null ? List.of() : request.images(), detachedImages);
        return question;
    }

    /**
     * Картинки пересобираются по ключу, а не пересоздаются: клиент присылает итоговый список, и
     * пережившие правку записи сохраняют свои id, created_at и порядок из запроса.
     */
    private void applyImages(
            Question question, List<QuestionImageDto> requested, List<String> detachedImages) {
        Map<String, QuestionImage> existing =
                question.getImages().stream()
                        .collect(
                                Collectors.toMap(
                                        QuestionImage::getStorageKey,
                                        image -> image,
                                        (first, second) -> first,
                                        java.util.LinkedHashMap::new));
        Set<String> keep = new LinkedHashSet<>();

        List<QuestionImage> ordered = new ArrayList<>();
        for (QuestionImageDto dto : requested) {
            if (!keep.add(dto.storageKey())) {
                // Один файл дважды в одном вопросе сломал бы уникальный индекс по storage_key.
                continue;
            }
            QuestionImage image = existing.get(dto.storageKey());
            if (image == null) {
                image = new QuestionImage();
                image.setStorageKey(dto.storageKey());
            }
            image.setAlt(dto.alt());
            image.setCaption(dto.caption());
            image.setWidth(dto.width());
            image.setHeight(dto.height());
            ordered.add(image);
        }

        existing.keySet().stream().filter(key -> !keep.contains(key)).forEach(detachedImages::add);

        question.getImages().clear();
        for (QuestionImage image : ordered) {
            question.addImage(image);
        }
    }

    private PracticeTask toEntity(PracticeTaskDto dto) {
        PracticeTask task = new PracticeTask();
        task.setTaskKey(dto.id());
        task.setTitle(dto.title());
        task.setHint(dto.hint());
        task.setStatement(
                dto.statement() == null ? new ArrayList<>() : new ArrayList<>(dto.statement()));
        return task;
    }

    private AnswerSection toEntity(AnswerSectionDto dto) {
        AnswerSection section = new AnswerSection();
        section.setSectionKey(dto.id());
        section.setHeading(dto.heading());
        section.setParagraphs(dto.paragraphs() == null ? new ArrayList<>() : new ArrayList<>(dto.paragraphs()));
        section.setBullets(dto.bullets() == null ? new ArrayList<>() : new ArrayList<>(dto.bullets()));

        CodeSampleDto code = dto.code();
        if (code != null) {
            CodeSample sample = new CodeSample();
            sample.setLanguage(code.language());
            sample.setTitle(code.title());
            sample.setLines(code.lines() == null ? List.of() : code.lines());
            section.setCode(sample);
        }
        return section;
    }

    private void recount(Question question) {
        questionRepository.flush();
        recountProfession(question.getProfession());
        recountCategory(question.getCategory());
    }

    private void recountProfession(Profession profession) {
        profession.setQuestionCount(
                (int) questionRepository.countByProfessionSlugAndPublishedTrue(profession.getSlug()));
        Map<Level, Integer> counts = new EnumMap<>(Level.class);
        for (Level level : Level.values()) {
            counts.put(
                    level,
                    (int)
                            questionRepository.countByProfessionSlugAndLevelAndPublishedTrue(
                                    profession.getSlug(), level));
        }
        profession.getLevelCounts().clear();
        profession.getLevelCounts().putAll(counts);
        professionRepository.save(profession);
    }

    private void recountCategory(Category category) {
        category.setQuestionCount(
                (int)
                        questionRepository.countByProfessionSlugAndCategorySlugAndPublishedTrue(
                                category.getProfession().getSlug(), category.getSlug()));
        categoryRepository.save(category);
    }

    /** Черновик убираем из индекса, иначе он остался бы в поиске после снятия публикации. */
    private void reindex(Question question) {
        meilisearch.ifPresent(
                service -> {
                    if (question.isPublished()) {
                        service.indexOne(question.getSlug());
                    } else {
                        service.deleteOne(question.getSlug());
                    }
                });
    }
}
