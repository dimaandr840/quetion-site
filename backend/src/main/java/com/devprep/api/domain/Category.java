package com.devprep.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** Тема — нижний уровень группировки перед вопросами. Историческое имя сохранено ради роутов. */
@Entity
@Table(name = "category", uniqueConstraints = @UniqueConstraint(columnNames = {"profession_id", "slug"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "slug", callSuper = false)
public class Category extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 64)
    private String slug;

    @Column(nullable = false, length = 8)
    private String emoji;

    @NotBlank
    @Column(nullable = false, length = 128)
    private String title;

    @Column(nullable = false, length = 1024)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profession_id", nullable = false)
    @ToString.Exclude
    private Profession profession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "specialization_id", nullable = false)
    @ToString.Exclude
    private Specialization specialization;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
