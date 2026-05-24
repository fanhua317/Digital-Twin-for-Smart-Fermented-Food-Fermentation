package com.brewery.digitaltwin.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * 允许的前端 Origin 模式 (逗号分隔)。
     * 默认 "*" 用于本地开发；生产环境通过 application-prod.yml 或环境变量
     * APP_CORS_ORIGINS 收敛到具体域名，例如:
     *   APP_CORS_ORIGINS=https://twin.example.com,https://staging.example.com
     *
     * 用 allowedOriginPatterns 而非 allowedOrigins, 是因为 allowCredentials=true 时
     * Spring CORS 规范禁止与通配 "*" 共用 allowedOrigins。
     */
    @Value("${app.cors.origins:*}")
    private String corsOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] patterns = corsOrigins.split("\\s*,\\s*");
        registry.addMapping("/**")
                .allowedOriginPatterns(patterns)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .exposedHeaders("Authorization")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
