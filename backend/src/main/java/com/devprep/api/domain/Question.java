package com.devprep.api.domain;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "slug", callSuper = false)
public class Question extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 128)
    private String slug;

    @NotBlank
    @Column(nullable = false, length = 512)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Level level;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profession_id", nullable = false)
    @ToString.Exclude
    private Profession profession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    @ToString.Exclude
    private Category category;

    @Column(nullable = false, length = 1024)
    private String snippet;

    @Column(nullable = false, columnDefinition = "text")
    private String tldr;

    @Column(nullable = false)
    private boolean popular;

    /** Черновик не показывается на публичных списках и не попадает в поиск. */
    @Column(nullable = false)
    @Builder.Default
    private boolean published = true;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "question_tag", joinColumns = @JoinColumn(name = "question_id"))
    @Column(name = "tag", nullable = false, length = 64)
    @OrderBy
    @Builder.Default
    private Set<String> tags = new LinkedHashSet<>();

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderColumn(name = "position")
    @ToString.Exclude
    @Builder.Default
    private List<AnswerSection> sections = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderColumn(name = "position")
    @ToString.Exclude
    @Builder.Default
    private List<PracticeTask> tasks = new ArrayList<>();

    public void addSection(AnswerSection section) {
        sections.add(section);
        section.setQuestion(this);
    }

    public void addTask(PracticeTask task) {
        tasks.add(task);
        task.setQuestion(this);
    }
}
