package com.devprep.api.web;

import com.devprep.api.domain.AppUser;
import com.devprep.api.repository.AppUserRepository;
import com.devprep.api.web.dto.AuthResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Личный кабинет: возвращает профиль текущего пользователя по access-токену.
 * Доступ только аутентифицированным (см. SecurityConfiguration, /api/me/**).
 */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final AppUserRepository users;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<AuthResponse.UserDto> me(Authentication authentication) {
        // При выключенной авторизации маршрут открыт (см. SecurityConfiguration),
        // и Authentication может быть null или анонимным — отвечаем 401, а не 500.
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return ResponseEntity.status(401).build();
        }
        return users.findByEmailIgnoreCase(authentication.getName())
                .map(MeController::toDto)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    private static AuthResponse.UserDto toDto(AppUser user) {
        return new AuthResponse.UserDto(user.getEmail(), user.getDisplayName(), user.getRoles());
    }
}
