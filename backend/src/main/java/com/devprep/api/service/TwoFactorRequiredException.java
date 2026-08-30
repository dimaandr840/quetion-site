package com.devprep.api.service;

/** Требуется второй фактор либо его первичная настройка. HTTP 200 со специальным статусом. */
public class TwoFactorRequiredException extends RuntimeException {

    public TwoFactorRequiredException(String message) {
        super(message);
    }
}
