package com.devprep.api.web;

import com.devprep.api.observability.IntegrationStatusService;
import com.devprep.api.web.dto.IntegrationStatusDto;
import com.devprep.api.web.dto.IntegrationStatusDto.DependencyDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Состояние интеграций для админки: {@code GET /api/admin/status}.
 *
 * <p>Это не дубликат Grafana, а единственное место, где человек без доступа к мониторингу
 * увидит, что письма не уходят или поиск работает в упрощённом режиме.
 */
@RestController
@RequestMapping("/api/admin/status")
@RequiredArgsConstructor
public class AdminStatusController {

    private final IntegrationStatusService status;

    @GetMapping
    public IntegrationStatusDto status() {
        List<DependencyDto> dependencies =
                status.all().stream()
                        .map(
                                dependency ->
                                        new DependencyDto(
                                                dependency.name(),
                                                dependency.state().name(),
                                                dependency.checkedAt(),
                                                dependency.detail()))
                        .toList();
        return new IntegrationStatusDto(dependencies);
    }
}
