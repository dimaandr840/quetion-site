package com.devprep.api.repository;

import com.devprep.api.domain.Profession;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfessionRepository extends JpaRepository<Profession, Long> {

    @EntityGraph(attributePaths = "industry")
    Optional<Profession> findBySlug(String slug);

    @EntityGraph(attributePaths = "industry")
    List<Profession> findAllByOrderBySortOrderAsc();

    @EntityGraph(attributePaths = "industry")
    List<Profession> findByIndustrySlugOrderBySortOrderAsc(String industrySlug);

    @EntityGraph(attributePaths = "industry")
    List<Profession> findByFeaturedTrueOrderBySortOrderAsc();
}
