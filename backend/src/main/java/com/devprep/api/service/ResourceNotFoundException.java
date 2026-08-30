package com.devprep.api.service;

/** 404 для отсутствующих профессий, категорий и вопросов. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException profession(String slug) {
        return new ResourceNotFoundException("Профессия не найдена: " + slug);
    }

    public static ResourceNotFoundException category(String professionSlug, String slug) {
        return new ResourceNotFoundException(
                "Категория не найдена: " + professionSlug + "/" + slug);
    }

    public static ResourceNotFoundException question(String slug) {
        return new ResourceNotFoundException("Вопрос не найден: " + slug);
    }

    public static ResourceNotFoundException industry(String slug) {
        return new ResourceNotFoundException("Сфера не найдена: " + slug);
    }

    public static ResourceNotFoundException specialization(String professionSlug, String slug) {
        return new ResourceNotFoundException(
                "Специализация не найдена: " + professionSlug + "/" + slug);
    }
}
