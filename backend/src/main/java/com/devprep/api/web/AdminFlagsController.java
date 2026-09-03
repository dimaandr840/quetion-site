package com.devprep.api.web;

import com.devprep.api.flags.FeatureFlag;
import com.devprep.api.flags.FeatureFlagService;
import com.devprep.api.web.dto.FeatureFlagDto;
import com.devprep.api.web.dto.FeatureFlagUpdateRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Управление флагами без пересборки образа: {@code /api/admin/flags}. */
@RestController
@RequestMapping("/api/admin/flags")
@RequiredArgsConstructor
public class AdminFlagsController {

    private final FeatureFlagService flags;

    @GetMapping
    public List<FeatureFlagDto> list() {
        return flags.listAll().stream().map(AdminFlagsController::toDto).toList();
    }

    @PutMapping("/{key}")
    public FeatureFlagDto update(
            @PathVariable("key") String key,
            @Valid @RequestBody FeatureFlagUpdateRequest request,
            Principal principal) {
        String actor = principal == null ? "anonymous" : principal.getName();
        return toDto(
                flags.update(
                        key,
                        request.enabled(),
                        request.rolloutPercentage(),
                        request.description(),
                        actor));
    }

    private static FeatureFlagDto toDto(FeatureFlag flag) {
        return new FeatureFlagDto(
                flag.getKey(),
                flag.isEnabled(),
                flag.getRolloutPercentage(),
                flag.getDescription(),
                flag.getUpdatedAt(),
                flag.getUpdatedBy());
    }
}
