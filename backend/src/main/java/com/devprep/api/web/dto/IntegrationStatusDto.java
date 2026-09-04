package com.devprep.api.web.dto;

import java.time.Instant;
import java.util.List;

/** Состояние внешних зависимостей для админки. */
public record IntegrationStatusDto(List<DependencyDto> dependencies) {

    /**
     * @param name search / media / mail
     * @param state UP / DOWN / DISABLED / UNKNOWN
     * @param checkedAt когда состояние обновлялось в последний раз
     * @param detail короткое объяснение на русском
     */
    public record DependencyDto(String name, String state, Instant checkedAt, String detail) {}
}
