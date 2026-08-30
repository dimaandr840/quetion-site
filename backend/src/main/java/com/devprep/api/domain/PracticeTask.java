package com.devprep.api.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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

/** Практическое задание к вопросу: то, что нельзя проверить пересказом теории. */
@Entity
@Table(name = "practice_task")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = {"taskKey", "title"}, callSuper = false)
public class PracticeTask extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** id задания из фронтенда — используется как якорь. */
    @NotBlank
    @Column(name = "task_key", nullable = false, length = 128)
    private String taskKey;

    @NotBlank
    @Column(nullable = false, length = 512)
    private String title;

    @Column(columnDefinition = "text")
    private String hint;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    @ToString.Exclude
    private Question question;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "practice_task_statement",
            joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "statement", nullable = false, columnDefinition = "text")
    @OrderColumn(name = "position")
    @Builder.Default
    private List<String> statement = new ArrayList<>();
}
