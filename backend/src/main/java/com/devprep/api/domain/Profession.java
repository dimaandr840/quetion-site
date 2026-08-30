package com.devprep.api.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import java.util.EnumMap;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "profession")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "slug", callSuper = false)
public class Profession extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 64)
    private String slug;

    @Column(nullable = false, length = 8)
    private String emoji;

    @NotBlank
    @Column(nullable = false, length = 128)
    private String title;

    @Column(name = "page_title", nullable = false, length = 256)
    private String pageTitle;

    @Column(nullable = false, length = 1024)
    private String description;

    @Column(name = "card_description", nullable = false, length = 1024)
    private String cardDescription;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "industry_id", nullable = false)
    @ToString.Exclude
    private Industry industry;

    /** Попадает в блок «Популярные профессии» на главной. */
    @Column(nullable = false)
    private boolean featured;

    /** Счётчик из макета: отображается на карточке, пересчитывается при импорте вопросов. */
    @Column(name = "question_count", nullable = false)
    private int questionCount;

    /** Разбивка по уровням из макета — показывается в шапке страницы профессии. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "profession_level_count",
            joinColumns = @JoinColumn(name = "profession_id"))
    @MapKeyColumn(name = "level", length = 16)
    @MapKeyEnumerated(EnumType.STRING)
    @Column(name = "question_count", nullable = false)
    @Builder.Default
    private Map<Level, Integer> levelCounts = new EnumMap<>(Level.class);

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
