package com.devprep.api.repository;

import com.devprep.api.domain.Category;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    @EntityGraph(attributePaths = {"profession", "specialization"})
    List<Category> findAllByOrderBySortOrderAsc();

    @EntityGraph(attributePaths = {"profession", "specialization"})
    List<Category> findByProfessionSlugOrderBySortOrderAsc(String professionSlug);

    @EntityGraph(attributePaths = {"profession", "specialization"})
    List<Category> findBySpecializationProfessionSlugAndSpecializationSlugOrderBySortOrderAsc(
            String professionSlug, String specializationSlug);

    @EntityGraph(attributePaths = {"profession", "specialization"})
    Optional<Category> findByProfessionSlugAndSlug(String professionSlug, String slug);

    long countBySpecializationId(Long specializationId);
}
