package com.devprep.api.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "answer_section")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = {"sectionKey", "heading"}, callSuper = false)
public class AnswerSection extends Auditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** id секции из фронтенда — используется как якорь в оглавлении ответа. */
    @NotBlank
    @Column(name = "section_key", nullable = false, length = 128)
    private String sectionKey;

    @NotBlank
    @Column(nullable = false, length = 512)
    private String heading;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    @ToString.Exclude
    private Question question;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "answer_section_paragraph", joinColumns = @JoinColumn(name = "section_id"))
    @Column(name = "paragraph", nullable = false, columnDefinition = "text")
    @OrderColumn(name = "position")
    @Builder.Default
    private List<String> paragraphs = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "answer_section_bullet", joinColumns = @JoinColumn(name = "section_id"))
    @Column(name = "bullet", nullable = false, columnDefinition = "text")
    @OrderColumn(name = "position")
    @Builder.Default
    private List<String> bullets = new ArrayList<>();

    @Embedded
    private CodeSample code;
}
