package com.devprep.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.Arrays;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode
public class CodeSample {

    @Column(name = "code_language", length = 32)
    private String language;

    @Column(name = "code_title", length = 256)
    private String title;

    /** Строки листинга храним одним текстом с \n — порядок строк критичен, отдельная таблица тут только мешает. */
    @Column(name = "code_body", columnDefinition = "text")
    private String body;

    public List<String> getLines() {
        return body == null || body.isBlank() ? List.of() : Arrays.asList(body.split("\n", -1));
    }

    public void setLines(List<String> lines) {
        this.body = lines == null || lines.isEmpty() ? null : String.join("\n", lines);
    }

    public boolean isEmpty() {
        return language == null && title == null && (body == null || body.isBlank());
    }
}
