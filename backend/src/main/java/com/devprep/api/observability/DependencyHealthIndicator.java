package com.devprep.api.observability;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.stereotype.Component;

import com.devprep.api.observability.IntegrationStatusService.DependencyStatus;

/**
 * Состояние внешних зависимостей в /actuator/health под ключом
 * {@code dependencies}.
 *
 * <p>Статус DEGRADED, а не DOWN, намеренно: падение поискового индекса или SMTP
 * не должно делать общий health красным: иначе docker и балансировщик начнут
 * перезапускать и выводить из ротации контейнер, который прекрасно отдаёт
 * страницы в упрощённом режиме. Неизвестные статусы Actuator отдаёт с HTTP 200.
 */
@Component("dependencies")
public class DependencyHealthIndicator implements HealthIndicator {

	private static final Status DEGRADED = new Status("DEGRADED", "Работаем без части зависимостей");

	private final IntegrationStatusService status;

	public DependencyHealthIndicator(IntegrationStatusService status) {
		this.status = status;
	}

	@Override
	public Health health() {
		boolean degraded = status.all().stream()
				.anyMatch(dependency -> dependency.state() == IntegrationStatusService.State.DOWN);
		Health.Builder builder = Health.status(degraded ? DEGRADED : Status.UP);
		for (DependencyStatus dependency : status.all()) {
			builder.withDetail(dependency.name(), dependency.state().name());
		}
		return builder.build();
	}
}
