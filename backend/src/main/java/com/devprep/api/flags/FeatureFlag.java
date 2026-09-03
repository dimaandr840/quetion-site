package com.devprep.api.flags;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Строка таблицы {@code feature_flags} — источник правды для рантайм-флагов. */
@Getter
@Setter
@Entity
@Table(name = "feature_flags")
public class FeatureFlag {

    @Id
    @Column(name = "flag_key", nullable = false, length = 100)
    private String key;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    /**
     * Процент аудитории, которому флаг виден, при {@code enabled = true}.
     *
     * <p>100 — всем, 0 — никому. Промежуточные значения дают постепенную раскатку.
     */
    @Column(name = "rollout_percentage", nullable = false)
    private int rolloutPercentage = 100;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by", length = 200)
    private String updatedBy;
}
