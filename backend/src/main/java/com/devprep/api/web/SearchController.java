package com.devprep.api.web;

import com.devprep.api.domain.Level;
import com.devprep.api.service.SearchService;
import com.devprep.api.web.dto.SearchResponseDto;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Поиск с фасетами и пагинацией:
 * {@code /api/search?q=hashmap&level=Junior&profession=java&page=0&size=20}.
 *
 * <p>Отрицательные и абсурдно большие page/size не отвергаются ошибкой, а нормализуются
 * в сервисе: строка запроса — публичный ввод, и 400 на {@code ?page=-1} только добавляет
 * шума в мониторинг.
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public SearchResponseDto search(
            @RequestParam(name = "q", required = false, defaultValue = "") String query,
            @RequestParam(name = "level", required = false) List<String> levels,
            @RequestParam(name = "profession", required = false) List<String> professions,
            @RequestParam(name = "page", required = false, defaultValue = "0") int page,
            @RequestParam(name = "size", required = false, defaultValue = "0") int size) {
        return searchService.search(query, parseLevels(levels), toSet(professions), page, size);
    }

    private static Set<Level> parseLevels(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return Collections.emptySet();
        }
        Set<Level> levels = new LinkedHashSet<>();
        for (String value : raw) {
            if (value != null && !value.isBlank()) {
                levels.add(Level.fromLabel(value.trim()));
            }
        }
        return levels;
    }

    private static Set<String> toSet(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> values = new LinkedHashSet<>();
        for (String value : raw) {
            if (value != null && !value.isBlank()) {
                values.add(value.trim());
            }
        }
        return values;
    }
}
