package com.devprep.api.web;

import com.devprep.api.service.MediaService;
import com.devprep.api.web.dto.MediaUploadResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Загрузка картинок для вопросов.
 *
 * <p>Отдельный эндпоинт, а не поле в JSON вопроса: админке нужно превью до сохранения, а
 * base64 в теле апсерта раздул бы запрос на треть и сломал существующий контракт.
 *
 * <p>Правило {@code /api/admin/**} из SecurityConfiguration закрывает эти методы ROLE_ADMIN
 * автоматически, CSRF-защита тоже действует: клиент присылает {@code X-XSRF-TOKEN}, как и в
 * остальных мутациях. В {@code ignoringRequestMatchers} этот путь добавлять нельзя.
 */
@RestController
@RequestMapping("/api/admin/media")
@RequiredArgsConstructor
public class AdminMediaController {

    private final MediaService mediaService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MediaUploadResponse upload(@RequestPart("file") MultipartFile file) {
        return mediaService.upload(file);
    }

    /**
     * Ключ передаётся параметром, а не частью пути: он содержит слэши, и в {@code @PathVariable}
     * его пришлось бы склеивать вручную из wildcard.
     */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestParam("key") String key) {
        mediaService.delete(key);
    }
}
