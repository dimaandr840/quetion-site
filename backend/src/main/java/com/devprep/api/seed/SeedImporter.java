package com.devprep.api.seed;

import com.devprep.api.domain.AnswerSection;
import com.devprep.api.domain.Category;
import com.devprep.api.domain.CodeSample;
import com.devprep.api.domain.Industry;
import com.devprep.api.domain.Level;
import com.devprep.api.domain.PracticeTask;
import com.devprep.api.domain.Profession;
import com.devprep.api.domain.Question;
import com.devprep.api.domain.Specialization;
import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.IndustryRepository;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.repository.SpecializationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Заливает контент из seed/content.json в пустую базу. Схему создаёт Liquibase, данные — этот
 * раннер: контент содержит вложенные списки параграфов и листинги, что неудобно описывать
 * changeset-ами loadData.
 */
@Slf4j
@Component
@Order(SeedImporter.ORDER)
@RequiredArgsConstructor
public class SeedImporter implements ApplicationRunner {

    /** Импорт должен пройти до реиндексации Meilisearch. */
    public static final int ORDER = 100;

    private static final String LOCATION = "classpath:seed/content.json";

    private final ProfessionRepository professionRepository;
    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;
    private final IndustryRepository industryRepository;
    private final SpecializationRepository specializationRepository;
    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;
    private final SeedProperties properties;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (!properties.isEnabled()) {
            log.debug("Импорт seed-данных выключен (devprep.seed.enabled=false)");
            return;
        }
        if (professionRepository.count() > 0) {
            log.debug("База уже наполнена, импорт seed-данных пропущен");
            return;
        }

        Resource resource = resourceLoader.getResource(LOCATION);
        if (!resource.exists()) {
            log.warn("Файл {} не найден, импорт seed-данных пропущен", LOCATION);
            return;
        }

        SeedContent content;
        try (InputStream in = resource.getInputStream()) {
            content = objectMapper.readValue(in, SeedContent.class);
        }

        Map<String, Industry> industries = importIndustries(content);
        Map<String, Profession> professions = importProfessions(content, industries);
        Map<String, Specialization> specializations = importSpecializations(content, professions);
        Map<String, Category> categories = importCategories(content, professions, specializations);
        importQuestions(content, professions, categories);

        log.info(
                "Импортировано: сфер={}, профессий={}, специализаций={}, тем={}, вопросов={}",
                industries.size(),
                professions.size(),
                specializations.size(),
                categories.size(),
                content.questions().size());
    }

    private Map<String, Industry> importIndustries(SeedContent content) {
        if (content.industries() == null || content.industries().isEmpty()) {
            throw new IllegalStateException(
                    "В seed-данных нет сфер: каждая профессия должна принадлежать сфере");
        }
        List<Industry> saved =
                industryRepository.saveAll(
                        content.industries().stream()
                                .map(
                                        i ->
                                                Industry.builder()
                                                        .slug(i.slug())
                                                        .emoji(i.emoji())
                                                        .title(i.title())
                                                        .description(i.description())
                                                        .sortOrder(i.sortOrder())
                                                        .build())
                                .toList());
        return saved.stream().collect(Collectors.toMap(Industry::getSlug, Function.identity()));
    }

    private Map<String, Specialization> importSpecializations(
            SeedContent content, Map<String, Profession> professions) {
        if (content.specializations() == null || content.specializations().isEmpty()) {
            throw new IllegalStateException(
                    "В seed-данных нет специализаций: каждая тема должна принадлежать специализации");
        }
        List<Specialization> saved =
                specializationRepository.saveAll(
                        content.specializations().stream()
                                .map(
                                        s ->
                                                Specialization.builder()
                                                        .slug(s.slug())
                                                        .title(s.title())
                                                        .description(s.description())
                                                        .profession(
                                                                require(
                                                                        professions,
                                                                        s.professionSlug(),
                                                                        "профессия"))
                                                        .sortOrder(s.sortOrder())
                                                        .build())
                                .toList());
        return saved.stream()
                .collect(
                        Collectors.toMap(
                                s -> key(s.getProfession().getSlug(), s.getSlug()),
                                Function.identity()));
    }

    private Map<String, Profession> importProfessions(
            SeedContent content, Map<String, Industry> industries) {
        List<Profession> saved =
                professionRepository.saveAll(
                        content.professions().stream()
                                .map(
                                        p ->
                                                Profession.builder()
                                                        .slug(p.slug())
                                                        .emoji(p.emoji())
                                                        .title(p.title())
                                                        .pageTitle(p.pageTitle())
                                                        .description(p.description())
                                                        .cardDescription(p.cardDescription())
                                                        .industry(
                                                                require(
                                                                        industries,
                                                                        p.industrySlug(),
                                                                        "сфера"))
                                                        .featured(p.featured())
                                                        .questionCount(p.questionCount())
                                                        .levelCounts(
                                                                p.levelCounts() == null
                                                                        ? new EnumMap<>(Level.class)
                                                                        : new EnumMap<>(
                                                                                p.levelCounts()))
                                                        .sortOrder(p.sortOrder())
                                                        .build())
                                .toList());
        return saved.stream().collect(Collectors.toMap(Profession::getSlug, Function.identity()));
    }

    private Map<String, Category> importCategories(
            SeedContent content,
            Map<String, Profession> professions,
            Map<String, Specialization> specializations) {
        List<Category> saved =
                categoryRepository.saveAll(
                        content.categories().stream()
                                .map(
                                        c ->
                                                Category.builder()
                                                        .slug(c.slug())
                                                        .emoji(c.emoji())
                                                        .title(c.title())
                                                        .description(c.description())
                                                        .profession(
                                                                require(
                                                                        professions,
                                                                        c.professionSlug(),
                                                                        "профессия"))
                                                        .specialization(
                                                                require(
                                                                        specializations,
                                                                        key(
                                                                                c.professionSlug(),
                                                                                c
                                                                                        .specializationSlug()),
                                                                        "специализация"))
                                                        .questionCount(c.questionCount())
                                                        .sortOrder(c.sortOrder())
                                                        .build())
                                .toList());
        return saved.stream()
                .collect(
                        Collectors.toMap(
                                c -> key(c.getProfession().getSlug(), c.getSlug()),
                                Function.identity()));
    }

    private void importQuestions(
            SeedContent content,
            Map<String, Profession> professions,
            Map<String, Category> categories) {
        for (SeedContent.SeedQuestion q : content.questions()) {
            Question question =
                    Question.builder()
                            .slug(q.slug())
                            .title(q.title())
                            .level(q.level())
                            .profession(require(professions, q.professionSlug(), "профессия"))
                            .category(
                                    require(
                                            categories,
                                            key(q.professionSlug(), q.categorySlug()),
                                            "категория"))
                            .snippet(q.snippet())
                            .tldr(q.tldr())
                            .popular(q.popular())
                            .tags(
                                    q.tags() == null
                                            ? new LinkedHashSet<>()
                                            : new LinkedHashSet<>(q.tags()))
                            .build();

            if (q.sections() != null) {
                for (SeedContent.SeedSection s : q.sections()) {
                    question.addSection(toSection(s));
                }
            }
            if (q.tasks() != null) {
                for (SeedContent.SeedTask t : q.tasks()) {
                    question.addTask(toTask(t));
                }
            }
            questionRepository.save(question);
        }
    }

    private PracticeTask toTask(SeedContent.SeedTask t) {
        return PracticeTask.builder()
                .taskKey(t.id())
                .title(t.title())
                .hint(t.hint())
                .statement(
                        t.statement() == null ? new ArrayList<>() : new ArrayList<>(t.statement()))
                .build();
    }

    private AnswerSection toSection(SeedContent.SeedSection s) {
        AnswerSection section =
                AnswerSection.builder()
                        .sectionKey(s.id())
                        .heading(s.heading())
                        .paragraphs(
                                s.paragraphs() == null
                                        ? new ArrayList<>()
                                        : new ArrayList<>(s.paragraphs()))
                        .bullets(
                                s.bullets() == null ? new ArrayList<>() : new ArrayList<>(s.bullets()))
                        .build();

        if (s.code() != null) {
            CodeSample code = new CodeSample();
            code.setLanguage(s.code().language());
            code.setTitle(s.code().title());
            code.setLines(s.code().lines() == null ? List.of() : s.code().lines());
            section.setCode(code);
        }
        return section;
    }

    private static <T> T require(Map<String, T> source, String key, String what) {
        T value = source.get(key);
        if (value == null) {
            throw new IllegalStateException(
                    "Не найдена " + what + " со ссылкой '" + key + "' в seed-данных");
        }
        return value;
    }

    private static String key(String professionSlug, String categorySlug) {
        return professionSlug + "/" + categorySlug;
    }
}
