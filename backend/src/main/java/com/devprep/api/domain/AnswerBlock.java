package com.devprep.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Блок ответа: либо абзац текста, либо картинка, стоящая между абзацами.
 *
 * <p>Раньше абзацы были плоским списком строк, а картинки — отдельным списком у вопроса, поэтому
 * место картинки внутри ответа负 негде было хранить. Блок решает обе задачи сразу: порядок задаёт
 * {@code position} коллекции, а выравнивание живёт на самом блоке.
 *
 * <p>Поля картинки и текста лежат в одной таблице и взаимоисключающи по {@link #kind}. Отдельная
 * таблица на каждый тип блока дала бы больше строгости, но и join на каждый рендер ответа —
 * при двух типах блоков это не окупается.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
public class AnswerBlock {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 16)
    private AnswerBlockKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "align", nullable = false, length = 8)
    private BlockAlign align = BlockAlign.LEFT;

    /** Текст абзаца с инлайновой разметкой. Пусто у картинки. */
    @Column(name = "body", columnDefinition = "text")
    private String body;

    /** Ключ объекта в хранилище. Пусто у абзаца. */
    @Column(name = "storage_key", length = 200)
    private String storageKey;

    @Column(name = "alt", length = 300)
    private String alt;

    @Column(name = "caption", length = 500)
    private String caption;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    public static AnswerBlock paragraph(String body, BlockAlign align) {
        AnswerBlock block = new AnswerBlock();
        block.setKind(AnswerBlockKind.PARAGRAPH);
        block.setBody(body);
        block.setAlign(align == null ? BlockAlign.LEFT : align);
        return block;
    }
}
