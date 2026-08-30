package com.devprep.api.config;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Ссылка на этот бин используется в {@code @PreAuthorize}, чтобы method security уважала флаг {@code
 * devprep.security.auth-enabled} так же, как и URL-правила в {@link SecurityConfiguration}.
 */
@Component("authz")
@RequiredArgsConstructor
public class AuthorizationGuard {

    private final SecurityProperties securityProperties;

    public boolean authRequired() {
        return securityProperties.isAuthEnabled();
    }
}
