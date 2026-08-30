package com.devprep.api.seed;

import com.devprep.api.domain.Level;
import java.util.List;
import java.util.Map;

/** Форма файла seed/content.json, выгруженного из lib/content.ts фронтенда. */
public record SeedContent(
        List<SeedIndustry> industries,
        List<SeedProfession> professions,
        List<SeedSpecialization> specializations,
        List<SeedCategory> categories,
        List<SeedQuestion> questions) {

    public record SeedIndustry(
            String slug, String emoji, String title, String description, int sortOrder) {}

    public record SeedProfession(
            String slug,
            String emoji,
            String title,
            String pageTitle,
            String description,
            String cardDescription,
            String industrySlug,
            boolean featured,
            int questionCount,
            Map<Level, Integer> levelCounts,
            int sortOrder) {}

    public record SeedSpecialization(
            String slug,
            String professionSlug,
            String title,
            String description,
            int sortOrder) {}

    public record SeedCategory(
            String slug,
            String emoji,
            String title,
            String description,
            String professionSlug,
            String specializationSlug,
            int questionCount,
            int sortOrder) {}

    public record SeedQuestion(
            String slug,
            String title,
            Level level,
            String professionSlug,
            String categorySlug,
            List<String> tags,
            String snippet,
            String tldr,
            boolean popular,
            List<SeedSection> sections,
            List<SeedTask> tasks) {}

    public record SeedTask(String id, String title, List<String> statement, String hint) {}

    public record SeedSection(
            String id,
            String heading,
            List<String> paragraphs,
            List<String> bullets,
            SeedCode code) {}

    public record SeedCode(String language, String title, List<String> lines) {}
}
