package com.devprep.api.web.dto;

import com.devprep.api.domain.Level;
import java.util.Map;

public record ProfessionDto(
        String slug,
        String emoji,
        String title,
        String pageTitle,
        String description,
        String cardDescription,
        String industrySlug,
        boolean featured,
        int questionCount,
        Map<Level, Integer> levelCounts) {}
