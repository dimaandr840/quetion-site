package com.devprep.api.repository;

import com.devprep.api.domain.Level;
import com.devprep.api.domain.Question;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuestionRepository
        extends JpaRepository<Question, Long>, JpaSpecificationExecutor<Question> {

    @EntityGraph(attributePaths = {"profession.industry", "category.specialization", "tags"})
    List<Question> findAllByOrderByIdAsc();

    /** Публичные списки не показывают черновики. */
    @EntityGraph(attributePaths = {"profession.industry", "category.specialization", "tags"})
    List<Question> findByPublishedTrueOrderByIdAsc();

    /**
     * Полная выгрузка вопроса вместе с ответом — для страницы вопроса и индексации. Практические
     * задания остаются ленивыми: две коллекции-списка в одном графе дают MultipleBagFetchException.
     */
    @EntityGraph(
            attributePaths = {
                "profession.industry",
                "category.specialization",
                "tags",
                "sections"
            })
    Optional<Question> findWithAnswerBySlug(String slug);

    @EntityGraph(attributePaths = {"profession.industry", "category.specialization", "tags"})
    Optional<Question> findBySlug(String slug);

    @EntityGraph(attributePaths = {"profession.industry", "category.specialization", "tags"})
    List<Question> findByPopularTrueAndPublishedTrueOrderByIdAsc(Pageable pageable);

    @EntityGraph(attributePaths = {"profession.industry", "category.specialization", "tags"})
    List<Question> findByProfessionSlugAndCategorySlugAndPublishedTrueOrderByIdAsc(
            String professionSlug, String categorySlug);

    @EntityGraph(attributePaths = {"profession.industry", "category.specialization", "tags"})
    List<Question> findBySlugIn(Collection<String> slugs);

    long countByProfessionSlugAndPublishedTrue(String professionSlug);

    /** Без фильтра по публикации: черновики тоже мешают удалить направление или тему. */
    long countByProfessionSlug(String professionSlug);

    long countByProfessionSlugAndCategorySlug(String professionSlug, String categorySlug);

    long countByProfessionSlugAndLevelAndPublishedTrue(String professionSlug, Level level);

    long countByProfessionSlugAndCategorySlugAndPublishedTrue(
            String professionSlug, String categorySlug);

    @Query("""
            select q.level as level, count(q) as total
            from Question q
            where q.slug in :slugs
            group by q.level
            """)
    List<LevelCount> countLevelsBySlugs(@Param("slugs") Collection<String> slugs);

    @Query("""
            select p.slug as slug, count(q) as total
            from Question q join q.profession p
            where q.slug in :slugs
            group by p.slug
            """)
    List<SlugCount> countProfessionsBySlugs(@Param("slugs") Collection<String> slugs);

    interface LevelCount {
        Level getLevel();

        long getTotal();
    }

    interface SlugCount {
        String getSlug();

        long getTotal();
    }
}
