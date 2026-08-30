package com.devprep.api.service;

import java.time.Duration;
import lombok.Getter;

/** Учётка временно заблокирована после серии неудачных попыток входа. HTTP 423. */
@Getter
public class AccountLockedException extends RuntimeException {

    private final Duration retryAfter;

    public AccountLockedException(Duration retryAfter) {
        super(
                "Учётная запись временно заблокирована из-за неудачных попыток входа. Повторите через "
                        + Math.max(1, retryAfter.toMinutes())
                        + " мин.");
        this.retryAfter = retryAfter;
    }
}
