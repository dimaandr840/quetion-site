package com.devprep.api.observability;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.micrometer.tracing.Tracer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Кладёт request-id и trace-id в MDC, чтобы каждая строка лога была связана
 * с конкретным запросом и с трейсом в Tempo.
 *
 * <p>request-id берётся из заголовка {@code X-Request-Id}, который выставляет nginx
 * (там же он идёт в access-лог и отдаётся клиенту). Значение санитизируется:
 * бэкенд может быть доступен напрямую (локальная разработка, другой шлюз),
 * и чужое значение из заголовка попадает прямиком в логи — с переводами строки
 * и килобайтами мусора, если не ограничить.
 *
 * <p>Фильтр стоит перед цепочкой Spring Security (её порядок -100), чтобы
 * отказы аутентификации тоже имели request-id.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

	public static final String REQUEST_ID_HEADER = "X-Request-Id";
	public static final String MDC_REQUEST_ID = "requestId";
	public static final String MDC_TRACE_ID = "traceId";
	public static final String MDC_SPAN_ID = "spanId";

	private static final int MAX_REQUEST_ID_LENGTH = 64;

	private final ObjectProvider<Tracer> tracerProvider;

	public RequestIdFilter(ObjectProvider<Tracer> tracerProvider) {
		this.tracerProvider = tracerProvider;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String requestId = sanitize(request.getHeader(REQUEST_ID_HEADER));
		if (requestId == null) {
			requestId = UUID.randomUUID().toString().replace("-", "");
		}
		MDC.put(MDC_REQUEST_ID, requestId);
		// Отдаём назад и сами: при обращении к API напрямую (без nginx) клиент
		// всё равно видит идентификатор, который можно найти в логах.
		response.setHeader(REQUEST_ID_HEADER, requestId);

		putTraceIds();
		try {
			chain.doFilter(request, response);
		}
		finally {
			MDC.remove(MDC_REQUEST_ID);
			MDC.remove(MDC_TRACE_ID);
			MDC.remove(MDC_SPAN_ID);
		}
	}

	/**
	 * Micrometer Tracing сам кладёт traceId в MDC внутри собственного observation-скоупа,
	 * но этот скоуп открывается позже нашего фильтра. Дублируем значения, если они
	 * уже есть, чтобы строки без скоупа тоже были связаны с трейсом.
	 */
	private void putTraceIds() {
		Tracer tracer = tracerProvider.getIfAvailable();
		if (tracer == null || tracer.currentSpan() == null) {
			return;
		}
		MDC.put(MDC_TRACE_ID, tracer.currentSpan().context().traceId());
		MDC.put(MDC_SPAN_ID, tracer.currentSpan().context().spanId());
	}

	private static String sanitize(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String trimmed = value.trim();
		if (trimmed.length() > MAX_REQUEST_ID_LENGTH) {
			trimmed = trimmed.substring(0, MAX_REQUEST_ID_LENGTH);
		}
		// Только безобидные символы: остальное приведёт к инъекции в логи.
		return trimmed.matches("[A-Za-z0-9._:-]+") ? trimmed : null;
	}
}
