package com.devprep.api;

import com.devprep.api.domain.AppUser;
import com.devprep.api.domain.PasswordResetToken;
import com.devprep.api.domain.RefreshToken;
import com.devprep.api.domain.Role;
import com.devprep.api.repository.AppUserRepository;
import com.devprep.api.repository.LoginAttemptRepository;
import com.devprep.api.repository.PasswordResetTokenRepository;
import com.devprep.api.repository.RefreshTokenRepository;
import com.devprep.api.security.JwtService;
import com.devprep.api.service.AuthService;
import com.devprep.api.service.PasswordResetService;
import com.devprep.api.service.SearchService;
import com.devprep.api.web.dto.AuthRequests;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.*;

/** No test transaction: assertions must observe commits made by the service proxy. */
@SpringBootTest
@ActiveProfiles("test")
class ReliabilityRegressionTest {
    @Autowired AuthService auth;
    @Autowired PasswordResetService reset;
    @Autowired AppUserRepository users;
    @Autowired LoginAttemptRepository attempts;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordResetTokenRepository resetTokens;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;
    @Autowired SearchService search;

    private AppUser user() {
        return users.save(AppUser.builder().email(UUID.randomUUID() + "@example.test")
                .displayName("Regression test").passwordHash(encoder.encode("valid-password-123"))
                .passwordChangedAt(Instant.now()).enabled(true).roles(Set.of(Role.ROLE_USER)).build());
    }
    private String ip() { return "test-" + UUID.randomUUID(); }

    @Test
    void rejectedLoginCommitsCounterAndAudit() {
        AppUser user = user();
        String ip = ip();
        assertThatThrownBy(() -> auth.login(new AuthRequests.Login(user.getEmail(), "wrong"), ip, "test"))
                .isInstanceOf(BadCredentialsException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getFailedLoginAttempts()).isEqualTo(1);
        assertThat(attempts.countFailuresByIpSince(ip, Instant.now().minusSeconds(60))).isEqualTo(1);
    }
    @Test
    void fifthFailedLoginPersistsLockout() {
        AppUser user = user();
        String ip = ip();
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> auth.login(new AuthRequests.Login(user.getEmail(), "wrong"), ip, "test"))
                    .isInstanceOf(BadCredentialsException.class);
        }
        assertThat(users.findById(user.getId()).orElseThrow().isLocked(Instant.now())).isTrue();
    }
    @Test
    void rejectedResetConsumesAttemptsAndFinallyInvalidatesCode() {
        AppUser user = user();
        PasswordResetToken token = resetTokens.save(PasswordResetToken.builder().user(user)
                .codeHash(encoder.encode("ABCD2345")).requestedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(600)).attempts(0).build());
        String ip = ip();
        var request = new AuthRequests.PasswordResetConfirm(user.getEmail(), "ZZZZ-ZZZZ", "new-password-123");
        assertThatThrownBy(() -> reset.confirm(request, ip)).isInstanceOf(BadCredentialsException.class);
        assertThat(resetTokens.findById(token.getId()).orElseThrow().getAttempts()).isEqualTo(1);
        for (int i = 1; i < 5; i++) {
            assertThatThrownBy(() -> reset.confirm(request, ip)).isInstanceOf(BadCredentialsException.class);
        }
        assertThat(resetTokens.findById(token.getId())).isEmpty();
        assertThat(attempts.countFailuresByIpSince(ip, Instant.now().minusSeconds(60))).isEqualTo(5);
    }
    @Test
    void refreshReplayCommitsRevocationOfOtherSessions() {
        AppUser user = user();
        var old = jwt.issueRefreshToken(user);
        var active = jwt.issueRefreshToken(user);
        RefreshToken revoked = RefreshToken.builder().user(user).tokenId(old.tokenId()).expiresAt(old.expiresAt()).build();
        revoked.revoke(Instant.now());
        refreshTokens.save(revoked);
        refreshTokens.save(RefreshToken.builder().user(user).tokenId(active.tokenId()).expiresAt(active.expiresAt()).build());
        assertThatThrownBy(() -> auth.refresh(old.token(), ip(), "test")).isInstanceOf(BadCredentialsException.class);
        assertThat(refreshTokens.findByTokenId(active.tokenId()).orElseThrow().isActive(Instant.now())).isFalse();
    }
    @Test
    void changingPasswordInvalidatesAccessRefreshAndMfaIncludingSameSecond() {
        AppUser user = user();
        var access = jwt.parse(jwt.issueAccessToken(user).token());
        var refresh = jwt.parse(jwt.issueRefreshToken(user).token());
        var mfa = jwt.parse(jwt.issueMfaToken(user).token());
        assertThat(jwt.matchesCurrentCredentials(access, user)).isTrue();
        auth.changePassword(user.getEmail(), new AuthRequests.ChangePassword("valid-password-123", "changed-password-123"));
        AppUser changed = users.findById(user.getId()).orElseThrow();
        assertThat(jwt.matchesCurrentCredentials(access, changed)).isFalse();
        assertThat(jwt.matchesCurrentCredentials(refresh, changed)).isFalse();
        assertThat(jwt.matchesCurrentCredentials(mfa, changed)).isFalse();
    }
    @Test
    void disabledAccountCannotUseExistingToken() {
        AppUser user = user();
        var claims = jwt.parse(jwt.issueAccessToken(user).token());
        user.setEnabled(false);
        assertThat(jwt.matchesCurrentCredentials(claims, user)).isFalse();
    }
    @Test
    void totalsAndFacetsAreNotPageSized() {
        var first = search.search("", Set.of(), Set.of(), 0, 1, false, "alpha");
        assertThat(first.total()).isGreaterThan(1);
        assertThat(first.items()).hasSize(1);
        var second = search.search("", Set.of(), Set.of(), 1, 1, false, "alpha");
        assertThat(second.total()).isEqualTo(first.total());
        assertThat(second.levelCounts()).isEqualTo(first.levelCounts());
        assertThat(second.items().get(0).slug()).isNotEqualTo(first.items().get(0).slug());
        var filtered = search.search("", Set.of(first.items().get(0).level()), Set.of(), 0, 1, false, "alpha");
        assertThat(filtered.levelCounts()).isEqualTo(first.levelCounts());
    }
}
