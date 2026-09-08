package com.devprep.api.web;

import com.devprep.api.service.AdminQuestionImportService;
import com.devprep.api.web.dto.QuestionBulkImportRequest;
import com.devprep.api.web.dto.QuestionBulkImportResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Массовая загрузка вопросов. Вынесена из {@link AdminQuestionController}, потому что это отдельный
 * сценарий со своей семантикой ответа: не 201 на созданный ресурс, а 200 с отчётом по пакету.
 *
 * <p>Требует ROLE_ADMIN (см. SecurityConfiguration: /api/admin/**).
 */
@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class AdminQuestionImportController {

    private final AdminQuestionImportService adminQuestionImportService;

    /** Загружает пакет вопросов; всегда 200 — исход по каждому элементу приходит в теле. */
    @PostMapping("/import")
    public QuestionBulkImportResponse importQuestions(
            @Valid @RequestBody QuestionBulkImportRequest request) {
        return adminQuestionImportService.importQuestions(request);
    }
}
