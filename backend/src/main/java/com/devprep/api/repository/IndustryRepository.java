package com.devprep.api.repository;

import com.devprep.api.domain.Industry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IndustryRepository extends JpaRepository<Industry, Long> {

    Optional<Industry> findBySlug(String slug);

    List<Industry> findAllByOrderBySortOrderAsc();
}
