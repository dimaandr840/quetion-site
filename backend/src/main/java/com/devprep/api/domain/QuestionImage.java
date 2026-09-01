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
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Изображение, прикреплённое к вопросу.
 *
 * <p>В базе хранится только ключ объекта в S3-совместимом хранилище, а не URL: публичный домен
 * (r2.dev, свой поддомен или CDN) может измениться, и переписывать строки в базе из-за этого
 * не нужно — адрес собирается на чтении из {@code devprep.media.public-base-url}.
 */
@Entity
@Table(name = "question_image")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(of = "storageKey", callSuper = false)
public class QuestionImage extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    @ToString.Exclude
    private Question question;

    @NotBlank
    @Column(name = "storage_key", nullable = false, length = 200)
    private String storageKey;

    /**
     * Описание картинки. Необязательно: у вставленного скриншота его обычно нет, а пустая строка —
     * корректная разметка для декоративной картинки. Колонка при этом остаётся {@code NOT NULL},
     * поэтому вместо {@code null} сюда пишется пустая строка (см. {@code AdminQuestionService}).
     */
    @Column(nullable = false, length = 300)
    private String alt = "";

    @Column(length = 500)
    private String caption;

    private Integer width;

    private Integer height;

    @Column(name = "content_type", length = 60)
    private String contentType;

    @Column(name = "byte_size")
    private Long byteSize;
}
