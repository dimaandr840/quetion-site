package com.devprep.api.repository;

import com.devprep.api.domain.Level;
import com.devprep.api.domain.Question;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/** Фолбэк-поиск по базе: повторяет searchQuestions из lib/queries.ts через ILIKE. */
public final class QuestionSpecifications {

    private QuestionSpecifications() {}

    public static Specification<Question> search(
            String needle, Collection<Level> levels, Collection<String> professionSlugs) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Черновики не участвуют в публичном поиске.
            predicates.add(cb.isTrue(root.get("published")));

            if (levels != null && !levels.isEmpty()) {
                predicates.add(root.get("level").in(levels));
            }
            if (professionSlugs != null && !professionSlugs.isEmpty()) {
                predicates.add(root.get("profession").get("slug").in(professionSlugs));
            }
            if (needle != null && !needle.isBlank()) {
                String pattern = "%" + needle.toLowerCase() + "%";
                Join<Object, Object> profession = root.join("profession");
                Join<Object, Object> category = root.join("category");
                Join<Object, Object> specialization =
                        category.join("specialization", JoinType.LEFT);

                Subquery<String> tagMatch = query.subquery(String.class);
                Root<Question> tagRoot = tagMatch.from(Question.class);
                Join<Object, String> tags = tagRoot.join("tags");
                tagMatch.select(tags)
                        .where(cb.equal(tagRoot, root), cb.like(cb.lower(tags), pattern));

                // «Профессия > Специализация > Тема» — тот же путь, что собирает ContentMapper.path.
                var path =
                        cb.concat(
                                cb.concat(
                                        cb.concat(
                                                cb.concat(profession.get("title"), " > "),
                                                cb.coalesce(
                                                        specialization.get("title").as(String.class),
                                                        "")),
                                        " > "),
                                category.get("title"));

                predicates.add(
                        cb.or(
                                cb.like(cb.lower(root.get("title")), pattern),
                                cb.like(cb.lower(root.get("snippet")), pattern),
                                cb.like(cb.lower(root.get("tldr")), pattern),
                                cb.like(cb.lower(path), pattern),
                                cb.exists(tagMatch)));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
