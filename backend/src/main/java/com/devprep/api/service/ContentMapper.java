package com.devprep.api.service;

import com.devprep.api.domain.AnswerSection;
import com.devprep.api.domain.Category;
import com.devprep.api.domain.CodeSample;
import com.devprep.api.domain.Industry;
import com.devprep.api.domain.Level;
import com.devprep.api.domain.PracticeTask;
import com.devprep.api.domain.Profession;
import com.devprep.api.domain.Question;
import com.devprep.api.domain.QuestionImage;
import com.devprep.api.domain.Specialization;
import com.devprep.api.web.dto.AnswerSectionDto;
import com.devprep.api.web.dto.CategoryDto;
import com.devprep.api.web.dto.CodeSampleDto;
import com.devprep.api.web.dto.IndustryDto;
import com.devprep.api.web.dto.PracticeTaskDto;
import com.devprep.api.web.dto.ProfessionDto;
import com.devprep.api.web.dto.QuestionDetailDto;
import com.devprep.api.web.dto.QuestionImageDto;
import com.devprep.api.web.dto.QuestionSummaryDto;
import com.devprep.api.web.dto.SpecializationDto;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ContentMapper {

    private final MediaService mediaService;

    public ContentMapper(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    public IndustryDto toDto(Industry industry) {
        return new IndustryDto(
                industry.getSlug(),
                industry.getEmoji(),
                industry.getTitle(),
                industry.getDescription());
    }

    public SpecializationDto toDto(Specialization specialization, int questionCount) {
        return new SpecializationDto(
                specialization.getSlug(),
                specialization.getProfession().getSlug(),
                specialization.getTitle(),
                specialization.getDescription(),
                questionCount);
    }

    public ProfessionDto toDto(Profession profession) {
        // EnumMap(Map) падает на пустой карте, а у только что созданного
        // направления счётчиков по уровням ещё нет.
        Map<Level, Integer> levelCounts = new EnumMap<>(Level.class);
        levelCounts.putAll(profession.getLevelCounts());

        return new ProfessionDto(
                profession.getSlug(),
                profession.getEmoji(),
                profession.getTitle(),
                profession.getPageTitle(),
                profession.getDescription(),
                profession.getCardDescription(),
                profession.getIndustry().getSlug(),
                profession.isFeatured(),
                profession.getQuestionCount(),
                levelCounts);
    }

    public CategoryDto toDto(Category category) {
        return new CategoryDto(
                category.getSlug(),
                category.getEmoji(),
                category.getTitle(),
                category.getDescription(),
                category.getProfession().getSlug(),
                category.getSpecialization().getSlug(),
                category.getQuestionCount());
    }

    public QuestionSummaryDto toSummary(Question question) {
        return new QuestionSummaryDto(
                question.getSlug(),
                question.getTitle(),
                question.getLevel(),
                question.getProfession().getSlug(),
                question.getCategory().getSlug(),
                List.copyOf(question.getTags()),
                question.getSnippet(),
                question.getTldr(),
                question.isPopular(),
                path(question));
    }

    public QuestionDetailDto toDetail(
            Question question,
            List<QuestionSummaryDto> related,
            QuestionSummaryDto previous,
            QuestionSummaryDto next) {
        return new QuestionDetailDto(
                question.getSlug(),
                question.getTitle(),
                question.getLevel(),
                question.getProfession().getSlug(),
                question.getCategory().getSlug(),
                List.copyOf(question.getTags()),
                question.getSnippet(),
                question.getTldr(),
                question.isPopular(),
                question.isPublished(),
                path(question),
                question.getSections().stream().map(this::toDto).toList(),
                question.getTasks().isEmpty()
                        ? null
                        : question.getTasks().stream().map(this::toDto).toList(),
                question.getImages().isEmpty()
                        ? null
                        : question.getImages().stream().map(this::toDto).toList(),
                related,
                previous,
                next);
    }

    public PracticeTaskDto toDto(PracticeTask task) {
        return new PracticeTaskDto(
                task.getTaskKey(),
                task.getTitle(),
                List.copyOf(task.getStatement()),
                task.getHint());
    }

    /**
     * Публичный адрес собирается на чтении из {@code devprep.media.public-base-url}: смена домена
     * или переезд за CDN не требует переписывать строки в базе.
     */
    public QuestionImageDto toDto(QuestionImage image) {
        return new QuestionImageDto(
                image.getStorageKey(),
                mediaService.publicUrl(image.getStorageKey()),
                image.getAlt(),
                image.getCaption(),
                image.getWidth(),
                image.getHeight());
    }

    public AnswerSectionDto toDto(AnswerSection section) {
        CodeSample code = section.getCode();
        return new AnswerSectionDto(
                section.getSectionKey(),
                section.getHeading(),
                section.getParagraphs().isEmpty() ? null : List.copyOf(section.getParagraphs()),
                section.getBullets().isEmpty() ? null : List.copyOf(section.getBullets()),
                code == null || code.isEmpty()
                        ? null
                        : new CodeSampleDto(code.getLanguage(), code.getTitle(), code.getLines()));
    }

    /** «Профессия > Специализация > Тема» — та же строка, что рисует фронтенд в хлебных крошках. */
    public String path(Question question) {
        Specialization specialization = question.getCategory().getSpecialization();
        String middle = specialization == null ? "" : specialization.getTitle() + " > ";
        return question.getProfession().getTitle()
                + " > "
                + middle
                + question.getCategory().getTitle();
    }
}
