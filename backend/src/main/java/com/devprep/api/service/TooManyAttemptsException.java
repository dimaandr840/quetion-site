package com.devprep.api.service;

import java.time.Duration;
import lombok.Getter;

/** Слишком много неудачных попыток входа с одного IP. HTTP 429. */
@Getter
public class TooManyAttemptsException extends RuntimeException {

    private final Duration retryAfter;

    public TooManyAttemptsException(Duration retryAfter) {
        super("Слишком много попыток входа. Попробуйте позже.");
        this.retryAfter = retryAfter;
    }
}
