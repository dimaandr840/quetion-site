package com.devprep.api.security;

import com.devprep.api.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AppUserDetailsService implements UserDetailsService {

    private final AppUserRepository appUserRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return appUserRepository
                .findByEmailIgnoreCase(email)
                .map(
                        user ->
                                User.withUsername(user.getEmail())
                                        .password(user.getPasswordHash())
                                        .disabled(!user.isEnabled())
                                        .authorities(
                                                user.getRoles().stream().map(Enum::name).toArray(String[]::new))
                                        .build())
                .orElseThrow(
                        () -> new UsernameNotFoundException("Пользователь не найден: " + email));
    }
}
