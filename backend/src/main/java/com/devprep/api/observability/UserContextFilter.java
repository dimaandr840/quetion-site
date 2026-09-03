package com.devprep.api.observability;

import java.io.IOException;

import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Добавляет user-id в MDC после цепочки Spring Security (её порядок -100),
 * когда аутентификация уже выполнена.
 *
 * <p>В логи пишется именно имя принципала (email админа) — оно и есть
 * идентификатор учётки в этой системе. Анонимные запросы поле не получают
 * вообще: в Loki дешевле фильтровать по отсутствию поля, чем по строке
 * "anonymous".
 */
@Component
@Order(0)
public class UserContextFilter extends OncePerRequestFilter {

	public static final String MDC_USER_ID = "userId";

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		boolean added = false;
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.isAuthenticated()
				&& !"anonymousUser".equals(authentication.getName())) {
			MDC.put(MDC_USER_ID, authentication.getName());
			added = true;
		}
		try {
			chain.doFilter(request, response);
		}
		finally {
			if (added) {
				MDC.remove(MDC_USER_ID);
			}
		}
	}
}
