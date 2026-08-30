package com.devprep.api.web;

import com.devprep.api.service.AdminQuestionService;
import com.devprep.api.web.dto.AdminQuestionRowDto;
import com.devprep.api.web.dto.QuestionDetailDto;
import com.devprep.api.web.dto.QuestionUpsertRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Требует ROLE_ADMIN (см. SecurityConfiguration: /api/admin/**). */
@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class AdminQuestionController {

    private final AdminQuestionService adminQuestionService;

    @GetMapping
    public List<AdminQuestionRowDto> list() {
        return adminQuestionService.list();
    }

    @GetMapping("/{slug}")
    public QuestionDetailDto get(@PathVariable String slug) {
        return adminQuestionService.get(slug);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionDetailDto create(@Valid @RequestBody QuestionUpsertRequest request) {
        return adminQuestionService.create(request);
    }

    @PutMapping("/{slug}")
    public QuestionDetailDto update(
            @PathVariable String slug, @Valid @RequestBody QuestionUpsertRequest request) {
        return adminQuestionService.update(slug, request);
    }

    @DeleteMapping("/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String slug) {
        adminQuestionService.delete(slug);
    }
}
