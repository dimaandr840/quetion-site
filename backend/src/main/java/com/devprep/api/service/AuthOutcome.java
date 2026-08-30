package com.devprep.api.service;

import com.devprep.api.web.dto.AuthResponse;
import java.util.List;

/** Результат auth-операции: тело ответа плюс cookie, которые нужно установить/погасить. */
public record AuthOutcome(AuthResponse body, List<String> cookies) {

    public static AuthOutcome of(AuthResponse body, List<String> cookies) {
        return new AuthOutcome(body, List.copyOf(cookies));
    }
}
