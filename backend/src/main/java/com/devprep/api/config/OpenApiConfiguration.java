package com.devprep.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfiguration {

    @Bean
    public OpenAPI devprepOpenApi() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("DevPrep API")
                                .version("1.0.0")
                                .description(
                                        "Справочник вопросов для IT-собеседований. Чтение публичное, запись — ROLE_ADMIN."))
                .schemaRequirement(
                        "bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT"));
    }
}
