package com.brewery.digitaltwin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // 与 WebSocketConfig 一致，允许任意 origin 模式（覆盖 Vite dev/Browser Preview/Nginx 等动态端口场景）
        // 注意：使用 allowedOriginPatterns 而非 allowedOrigins，是因为 allowCredentials=true 与通配 "*" 不能共存
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .exposedHeaders("Authorization")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
