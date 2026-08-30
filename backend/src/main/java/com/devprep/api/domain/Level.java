package com.devprep.api.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum Level {
    JUNIOR("Junior"),
    MIDDLE("Middle"),
    SENIOR("Senior");

    @JsonValue
    private final String label;

    /** Принимает и «Middle», и «MIDDLE» — фронтенд присылает подписи из макета. */
    @JsonCreator
    public static Level fromLabel(String value) {
        for (Level level : values()) {
            if (level.label.equalsIgnoreCase(value) || level.name().equalsIgnoreCase(value)) {
                return level;
            }
        }
        throw new IllegalArgumentException("Неизвестный уровень сложности: " + value);
    }
}
