package com.devprep.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** Сфера — верхний уровень иерархии: IT, Дизайн, Маркетинг и другие. */
@Entity
@Table(name = "industry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "slug", callSuper = false)
public class Industry extends Auditable {

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

    @Column(nullable = false, length = 1024)
    private String description;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
