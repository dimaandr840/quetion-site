package com.devprep.api.web.dto;

/** Ответ на загрузку файла: ключ для последующего сохранения вопроса и адрес для превью. */
public record MediaUploadResponse(
        String storageKey,
        String url,
        String contentType,
        int width,
        int height,
        long byteSize) {}
