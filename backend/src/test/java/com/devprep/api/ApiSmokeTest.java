package com.devprep.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.ProfessionRepository;
import com.devprep.api.repository.QuestionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiSmokeTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ProfessionRepository professionRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private QuestionRepository questionRepository;

    /**
     * Точные размеры сида здесь не фиксируются намеренно: контент пополняется, и
     * смоук-тест, переписываемый после каждой правки seed/content.json, ничего не
     * охраняет. Проверяем то, что действительно должно быть верно всегда: импорт
     * прошёл и справочник непустой.
     */
    @Test
    void seedDataIsImported() {
        assertThat(professionRepository.count()).isPositive();
        assertThat(categoryRepository.count()).isPositive();
        assertThat(questionRepository.count()).isPositive();
    }

    @Test
    void professionsArePublic() throws Exception {
        int expected = (int) professionRepository.count();

        mockMvc.perform(get("/api/professions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(expected)))
                .andExpect(jsonPath("$[0].slug").exists());
    }

    @Test
    void questionDetailReturnsSections() throws Exception {
        String slug =
                questionRepository.findAllByOrderByIdAsc().get(0).getSlug();
        mockMvc.perform(get("/api/questions/{slug}", slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(slug))
                .andExpect(jsonPath("$.sections").isArray());
    }

    @Test
    void unknownQuestionReturnsProblemDetail() throws Exception {
        mockMvc.perform(get("/api/questions/{slug}", "no-such-question"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Не найдено"));
    }

    @Test
    void searchFallsBackToDatabase() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "java"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fromIndex").value(false))
                .andExpect(jsonPath("$.levelCounts").exists())
                .andExpect(jsonPath("$.professionCounts").isArray());
    }

    /**
     * Запрос идёт с CSRF-токеном: без него CsrfFilter отвечает 403 раньше, чем
     * дело доходит до проверки прав, и тест проверял бы уже не аутентификацию.
     */
    @Test
    void adminWritesRequireAuthentication() throws Exception {
        mockMvc.perform(delete("/api/admin/questions/{slug}", "anything").with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    /** Обратная сторона той же защиты: запись без double-submit токена запрещена. */
    @Test
    void adminWritesRequireCsrfToken() throws Exception {
        mockMvc.perform(delete("/api/admin/questions/{slug}", "anything"))
                .andExpect(status().isForbidden());
    }
}
