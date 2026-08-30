package com.devprep.api.web;

import com.devprep.api.service.AccountLockedException;
import com.devprep.api.service.ResourceNotFoundException;
import com.devprep.api.service.TooManyAttemptsException;
import com.devprep.api.service.TwoFactorRequiredException;
import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Ошибки в формате RFC 7807 (application/problem+json). */
@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "Не найдено", e.getMessage(), "not-found");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException e) {
        ProblemDetail detail =
                problem(
                        HttpStatus.BAD_REQUEST,
                        "Некорректный запрос",
                        "Проверьте поля запроса",
                        "validation");
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult()
                .getFieldErrors()
                .forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        detail.setProperty("errors", errors);
        return detail;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraint(ConstraintViolationException e) {
        // Сообщение самого исключения содержит имена Java-классов и полный
        // список ConstraintViolationImpl — наружу отдаём только поля и текст.
        Map<String, String> errors = new LinkedHashMap<>();
        if (e.getConstraintViolations() != null) {
            e.getConstraintViolations()
                    .forEach(
                            violation ->
                                    errors.putIfAbsent(
                                            String.valueOf(violation.getPropertyPath()),
                                            violation.getMessage()));
        }
        ProblemDetail detail =
                problem(
                        HttpStatus.BAD_REQUEST,
                        "Некорректный запрос",
                        errors.isEmpty()
                                ? "Проверьте поля запроса"
                                : "Проверьте поля: " + String.join(", ", errors.keySet()),
                        "validation");
        detail.setProperty("errors", errors);
        return detail;
    }

    @ExceptionHandler(org.springframework.security.authentication.BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(
            org.springframework.security.authentication.BadCredentialsException e) {
        return problem(HttpStatus.UNAUTHORIZED, "Неавторизован", e.getMessage(), "unauthorized");
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(
            org.springframework.security.access.AccessDeniedException e) {
        return problem(HttpStatus.FORBIDDEN, "Доступ запрещён", e.getMessage(), "forbidden");
    }

    @ExceptionHandler(AccountLockedException.class)
    public ProblemDetail handleAccountLocked(AccountLockedException e) {
        ProblemDetail detail =
                problem(HttpStatus.LOCKED, "Учётка заблокирована", e.getMessage(), "account-locked");
        detail.setProperty("retryAfterSeconds", Math.max(1, e.getRetryAfter().toSeconds()));
        return detail;
    }

    @ExceptionHandler(TooManyAttemptsException.class)
    public ProblemDetail handleTooManyAttempts(TooManyAttemptsException e) {
        ProblemDetail detail =
                problem(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Слишком много попыток",
                        e.getMessage(),
                        "rate-limited");
        detail.setProperty("retryAfterSeconds", Math.max(1, e.getRetryAfter().toSeconds()));
        return detail;
    }

    @ExceptionHandler(TwoFactorRequiredException.class)
    public ProblemDetail handleTwoFactorRequired(TwoFactorRequiredException e) {
        return problem(
                HttpStatus.UNAUTHORIZED, "Требуется второй фактор", e.getMessage(), "totp-required");
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class})
    public ProblemDetail handleBadArgument(Exception e) {
        return problem(HttpStatus.BAD_REQUEST, "Некорректный параметр", e.getMessage(), "bad-request");
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception e) {
        log.error("Необработанная ошибка", e);
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Внутренняя ошибка",
                "Что-то пошло не так. Попробуйте позже.",
                "internal");
    }

    private static ProblemDetail problem(
            HttpStatus status, String title, String detail, String type) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(URI.create("https://devprep.dev/problems/" + type));
        return problem;
    }
}
