package com.devprep.api.web;

import com.devprep.api.service.QuestionService;
import com.devprep.api.web.dto.QuestionDetailDto;
import com.devprep.api.web.dto.QuestionSummaryDto;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Публичные эндпоинты вопросов. */
@Validated
@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @GetMapping
    public List<QuestionSummaryDto> questions() {
        return questionService.getQuestions();
    }

    @GetMapping("/popular")
    public List<QuestionSummaryDto> popular(
            @RequestParam(required = false) @Min(1) @Max(50) Integer limit) {
        return questionService.getPopularQuestions(limit);
    }

    @GetMapping("/{slug}")
    public QuestionDetailDto question(@PathVariable String slug) {
        return questionService.getQuestion(slug);
    }

    @GetMapping("/{slug}/related")
    public List<QuestionSummaryDto> related(
            @PathVariable String slug, @RequestParam(required = false) @Min(1) @Max(20) Integer limit) {
        return questionService.getRelatedQuestions(slug, limit);
    }
}
