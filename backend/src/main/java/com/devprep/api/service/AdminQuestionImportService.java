package com.devprep.api.service;

import com.devprep.api.domain.AnswerBlockKind;
import com.devprep.api.domain.Question;
import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.web.dto.AdminCategoryRequest;
import com.devprep.api.web.dto.AnswerBlockDto;
import com.devprep.api.web.dto.AnswerSectionDto;
import com.devprep.api.web.dto.CategoryDto;
import com.devprep.api.web.dto.QuestionBulkImportItem;
import com.devprep.api.web.dto.QuestionBulkImportRequest;
import com.devprep.api.web.dto.QuestionBulkImportRequest.ImportMode;
import com.devprep.api.web.dto.QuestionBulkImportResponse;
import com.devprep.api.web.dto.QuestionBulkImportResponse.ItemResult;
import com.devprep.api.web.dto.QuestionBulkImportResponse.Outcome;
import com.devprep.api.web.dto.QuestionBulkImportSection;
import com.devprep.api.web.dto.QuestionUpsertRequest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

/**
 * Массовая загрузка вопросов.
 *
 * <p>Метод намеренно не {@code @Transactional}: каждый вопрос пишется через прокси
 * {@link AdminQuestionService}, то есть в своей транзакции. Одна общая транзакция на пакет из 500
 * вопросов означала бы, что последний элемент с битой темой откатывает всю загрузку, а отчёт по
 * элементам терял бы смысл. Побочный эффект того же решения — переиндексация Meilisearch идёт
 * поштучно через {@code AfterCommit}, что для импорта приемлемо: документы уходят по мере коммитов.
 *
 * <p>Дедупликация двухуровневая — по slug и по нормализованному названию. Второе нужно потому, что
 * в скриптах импорта slug выводится из заголовка и достаточно поправить запятую, чтобы получить
 * новый адрес и дубль по смыслу.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminQuestionImportService {

    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final int MAX_SLUG_SUFFIX = 999;
    private static final int SNIPPET_LIMIT = 1024;
    private static final String DEFAULT_HEADING = "Ответ";

    private final AdminQuestionService adminQuestionService;
    private final AdminCatalogService adminCatalogService;
    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final ProfessionRepository professionRepository;

    @PreAuthorize("!@authz.authRequired() or hasRole('ADMIN')")
    public QuestionBulkImportResponse importQuestions(QuestionBulkImportRequest request) {
        ImportMode mode = request.modeOrDefault();
        Set<String> takenSlugs = new HashSet<>();
        Map<String, String> slugByTitle = new HashMap<>();
        for (Question question : questionRepository.findAll()) {
            takenSlugs.add(question.getSlug());
            slugByTitle.putIfAbsent(normalizeTitle(question.getTitle()), question.getSlug());
        }
        Map<String, String> knownCategories = new HashMap<>();

        List<ItemResult> results = new ArrayList<>(request.items().size());
        int created = 0;
        int updated = 0;
        int skipped = 0;
        int failed = 0;

        for (int index = 0; index < request.items().size(); index++) {
            QuestionBulkImportItem item = request.items().get(index);
            try {
                ItemResult result = handle(index, item, request, mode, takenSlugs, slugByTitle, knownCategories);
                results.add(result);
                switch (result.outcome()) {
                    case CREATED -> created++;
                    case UPDATED -> updated++;
                    case SKIPPED -> skipped++;
                    case FAILED -> failed++;
                    case VALIDATED -> created++;
                }
            } catch (RuntimeException e) {
                // Ошибка одного вопроса не должна отменять пакет: причина уходит в отчёт.
                log.warn("Bulk import item {} failed: {}", index, e.toString());
                failed++;
                results.add(new ItemResult(index, item.title(), item.slug(), Outcome.FAILED, reason(e)));
            }
        }

        return new QuestionBulkImportResponse(
                request.items().size(), created, updated, skipped, failed, request.dryRun(), results);
    }

    private ItemResult handle(
            int index,
            QuestionBulkImportItem item,
            QuestionBulkImportRequest request,
            ImportMode mode,
            Set<String> takenSlugs,
            Map<String, String> slugByTitle,
            Map<String, String> knownCategories) {

        String professionSlug = blankTo(item.professionSlug(), request.professionSlug());
        if (professionSlug == null || professionSlug.isBlank()) {
            return new ItemResult(index, item.title(), null, Outcome.FAILED,
                    "Не указано направление: заполните professionSlug в элементе или в запросе");
        }
        if (professionRepository.findBySlug(professionSlug).isEmpty()) {
            return new ItemResult(index, item.title(), null, Outcome.FAILED,
                    "Направление «" + professionSlug + "» не найдено");
        }

        String normalizedTitle = normalizeTitle(item.title());
        String existingSlug = slugByTitle.get(normalizedTitle);
        if (existingSlug == null && item.slug() != null && takenSlugs.contains(item.slug())) {
            existingSlug = item.slug();
        }
        if (existingSlug != null) {
            switch (mode) {
                case SKIP_EXISTING -> {
                    return new ItemResult(index, item.title(), existingSlug, Outcome.SKIPPED,
                            "Вопрос с таким названием уже есть");
                }
                case FAIL_ON_EXISTING -> {
                    return new ItemResult(index, item.title(), existingSlug, Outcome.FAILED,
                            "Вопрос с таким названием уже есть");
                }
                case UPDATE_EXISTING -> {
                    // Обновление идёт по существующему адресу: менять slug у живого вопроса нельзя,
                    // на него уже стоят ссылки и он проиндексирован поисковиками.
                }
            }
        }

        String categorySlug = resolveCategory(professionSlug, item, request, knownCategories);
        String slug = existingSlug != null ? existingSlug : resolveSlug(item.slug(), item.title(), takenSlugs);
        QuestionUpsertRequest upsert = toUpsert(item, professionSlug, categorySlug, slug);

        if (request.dryRun()) {
            takenSlugs.add(slug);
            slugByTitle.putIfAbsent(normalizedTitle, slug);
            return new ItemResult(index, item.title(), slug,
                    existingSlug != null ? Outcome.UPDATED : Outcome.VALIDATED, null);
        }

        if (existingSlug != null) {
            adminQuestionService.update(existingSlug, upsert);
            return new ItemResult(index, item.title(), existingSlug, Outcome.UPDATED, null);
        }
        adminQuestionService.create(upsert);
        takenSlugs.add(slug);
        slugByTitle.putIfAbsent(normalizedTitle, slug);
        return new ItemResult(index, item.title(), slug, Outcome.CREATED, null);
    }

    /**
     * Возвращает адрес темы, при необходимости создавая её. Адрес возвращается, а не проверяется:
     * {@link AdminCatalogService} нормализует slug (в том числе кириллический), и в вопрос должен
     * попасть именно тот, что оказался в базе.
     */
    private String resolveCategory(
            String professionSlug,
            QuestionBulkImportItem item,
            QuestionBulkImportRequest request,
            Map<String, String> knownCategories) {

        String key = professionSlug + "\u0000" + item.categorySlug();
        String cached = knownCategories.get(key);
        if (cached != null) {
            return cached;
        }
        if (categoryRepository.findByProfessionSlugAndSlug(professionSlug, item.categorySlug()).isPresent()) {
            knownCategories.put(key, item.categorySlug());
            return item.categorySlug();
        }
        if (!request.createMissingCategories()) {
            throw new ResourceNotFoundException(
                    "Тема «" + item.categorySlug() + "» не найдена в направлении «" + professionSlug
                            + "»; передайте createMissingCategories=true или создайте её заранее");
        }
        if (request.dryRun()) {
            knownCategories.put(key, item.categorySlug());
            return item.categorySlug();
        }
        CategoryDto category = adminCatalogService.createCategory(new AdminCategoryRequest(
                item.categorySlug(),
                blankTo(item.categoryTitle(), item.categorySlug()),
                item.categoryEmoji(),
                null,
                professionSlug,
                null));
        knownCategories.put(key, category.slug());
        return category.slug();
    }

    private QuestionUpsertRequest toUpsert(
            QuestionBulkImportItem item, String professionSlug, String categorySlug, String slug) {
        List<AnswerSectionDto> sections = toSections(item.sections());
        String plain = firstPlainText(sections);
        String snippet = blankTo(item.snippet(), plain == null ? item.title() : clamp(plain, SNIPPET_LIMIT));
        String tldr = blankTo(item.tldr(), plain == null ? item.title() : plain);
        return new QuestionUpsertRequest(
                slug,
                item.title().trim(),
                item.level(),
                professionSlug,
                categorySlug,
                item.tags() == null ? List.of() : item.tags(),
                clamp(snippet, SNIPPET_LIMIT),
                tldr,
                Boolean.TRUE.equals(item.popular()),
                item.published(),
                sections,
                item.tasks() == null ? List.of() : item.tasks());
    }

    private List<AnswerSectionDto> toSections(List<QuestionBulkImportSection> sections) {
        List<AnswerSectionDto> converted = new ArrayList<>(sections.size());
        for (int i = 0; i < sections.size(); i++) {
            QuestionBulkImportSection section = sections.get(i);
            List<AnswerBlockDto> blocks = new ArrayList<>();
            if (section.blocks() != null) {
                blocks.addAll(section.blocks());
            }
            if (section.paragraphs() != null) {
                for (String paragraph : section.paragraphs()) {
                    if (paragraph != null && !paragraph.isBlank()) {
                        blocks.add(new AnswerBlockDto(
                                AnswerBlockKind.PARAGRAPH, null, paragraph, null, null, null, null, null, null));
                    }
                }
            }
            converted.add(new AnswerSectionDto(
                    blankTo(section.id(), "s" + (i + 1)),
                    blankTo(section.heading(), DEFAULT_HEADING),
                    blocks,
                    section.bullets() == null ? List.of() : section.bullets(),
                    section.code()));
        }
        return converted;
    }

    private String resolveSlug(String preferred, String title, Set<String> taken) {
        String base = Slugs.slugify(preferred, title, "question");
        if (!taken.contains(base)) {
            return base;
        }
        for (int suffix = 2; suffix <= MAX_SLUG_SUFFIX; suffix++) {
            String candidate = Slugs.withSuffix(base, suffix);
            if (!taken.contains(candidate)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("Не удалось подобрать свободный адрес для «" + title + "»");
    }

    /** Первый содержательный текст ответа — источник snippet и tldr, когда их не прислали. */
    private static String firstPlainText(List<AnswerSectionDto> sections) {
        for (AnswerSectionDto section : sections) {
            if (section.blocks() != null) {
                for (AnswerBlockDto block : section.blocks()) {
                    if (block.kind() == AnswerBlockKind.PARAGRAPH && block.text() != null && !block.text().isBlank()) {
                        return stripTags(block.text());
                    }
                }
            }
            if (section.bullets() != null) {
                for (String bullet : section.bullets()) {
                    if (bullet != null && !bullet.isBlank()) {
                        return stripTags(bullet);
                    }
                }
            }
        }
        return null;
    }

    private static String stripTags(String value) {
        return SPACES.matcher(TAGS.matcher(value).replaceAll(" ")).replaceAll(" ").trim();
    }

    private static String clamp(String value, int limit) {
        if (value.length() <= limit) {
            return value;
        }
        return value.substring(0, limit - 1).trim() + "…";
    }

    private static String normalizeTitle(String title) {
        return SPACES.matcher(title.trim().toLowerCase(Locale.ROOT)).replaceAll(" ");
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String reason(RuntimeException e) {
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
    }
}
