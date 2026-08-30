package com.devprep.api.repository;

import com.devprep.api.domain.Specialization;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpecializationRepository extends JpaRepository<Specialization, Long> {

    @EntityGraph(attributePaths = "profession")
    List<Specialization> findAllByOrderBySortOrderAsc();

    @EntityGraph(attributePaths = "profession")
    List<Specialization> findByProfessionSlugOrderBySortOrderAsc(String professionSlug);

    @EntityGraph(attributePaths = "profession")
    Optional<Specialization> findByProfessionSlugAndSlug(String professionSlug, String slug);
}
