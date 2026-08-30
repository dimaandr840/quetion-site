package com.devprep.api.search;

import com.devprep.api.domain.Question;
import com.devprep.api.domain.Specialization;
import java.util.List;
import java.util.Set;

/** Документ индекса Meilisearch — плоская проекция вопроса. */
public record QuestionDocument(
        String id,
        String slug,
        String title,
        String level,
        String industrySlug,
        String professionSlug,
        String specializationSlug,
        String categorySlug,
        String path,
        Set<String> tags,
        String snippet,
        String tldr,
        boolean popular) {

    public static QuestionDocument of(Question question, String path) {
        Specialization specialization = question.getCategory().getSpecialization();
        return new QuestionDocument(
                question.getSlug(),
                question.getSlug(),
                question.getTitle(),
                question.getLevel().name(),
                question.getProfession().getIndustry().getSlug(),
                question.getProfession().getSlug(),
                specialization == null ? null : specialization.getSlug(),
                question.getCategory().getSlug(),
                path,
                Set.copyOf(question.getTags()),
                question.getSnippet(),
                question.getTldr(),
                question.isPopular());
    }

    public static List<String> searchableAttributes() {
        return List.of("title", "snippet", "tldr", "tags", "path");
    }

    public static List<String> filterableAttributes() {
        return List.of(
                "level",
                "industrySlug",
                "professionSlug",
                "specializationSlug",
                "categorySlug",
                "tags",
                "popular");
    }
}
