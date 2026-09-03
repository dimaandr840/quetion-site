package com.devprep.api.observability;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.stereotype.Service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * Единое место, где живёт состояние внешних зависимостей (поиск, хранилище
 * картинок, почта).
 *
 * <p>Одни и те же данные нужны в трёх местах сразу: в метриках (алерты),
 * в /actuator/health (диагностика) и в админке (человеку надо видеть, что письма
 * не уходят, без доступа к Grafana). Держать три копии логики — верный способ
 * получить три разных ответа о том же самом.
 */
@Service
public class IntegrationStatusService {

	public enum State {
		/** Зависимость отвечает. */
		UP,
		/** Включена, но не отвечает — работаем в деградированном режиме. */
		DOWN,
		/** Выключена настройками — это не авария. */
		DISABLED,
		/** Ещё не проверяли. */
		UNKNOWN
	}

	/**
	 * @param name техническое имя: search / media / mail
	 * @param state текущее состояние
	 * @param checkedAt когда состояние обновлялось в последний раз
	 * @param detail короткое человеческое объяснение для админки
	 */
	public record DependencyStatus(String name, State state, Instant checkedAt, String detail) {

		static DependencyStatus unknown(String name) {
			return new DependencyStatus(name, State.UNKNOWN, null, null);
		}
	}

	private final AtomicReference<DependencyStatus> search = new AtomicReference<>(DependencyStatus.unknown("search"));
	private final AtomicReference<DependencyStatus> media = new AtomicReference<>(DependencyStatus.unknown("media"));
	private final AtomicReference<DependencyStatus> mail = new AtomicReference<>(DependencyStatus.unknown("mail"));

	private final Counter searchIndexRequests;
	private final Counter searchFallbackRequests;
	private final Counter mailFailures;
	private final Counter mediaFailures;

	public IntegrationStatusService(MeterRegistry registry) {
		// Гейджи читают состояние лениво, в момент scrape: отдельные set() на каждое
		// изменение легко рассогласуются с реальным состоянием.
		registry.gauge("devprep.search.up", this, service -> gaugeValue(service.search.get()));
		registry.gauge("devprep.media.up", this, service -> gaugeValue(service.media.get()));
		registry.gauge("devprep.mail.up", this, service -> gaugeValue(service.mail.get()));

		this.searchIndexRequests = Counter.builder("devprep.search.requests")
				.description("Поисковые запросы по режимам обслуживания")
				.tag("mode", "index")
				.register(registry);
		this.searchFallbackRequests = Counter.builder("devprep.search.requests")
				.description("Поисковые запросы по режимам обслуживания")
				.tag("mode", "fallback")
				.register(registry);
		this.mailFailures = Counter.builder("devprep.mail.failures")
				.description("Неудавшиеся отправки писем")
				.register(registry);
		this.mediaFailures = Counter.builder("devprep.media.failures")
				.description("Ошибки объектного хранилища")
				.register(registry);
	}

	private static double gaugeValue(DependencyStatus status) {
		return switch (status.state()) {
			case UP -> 1d;
			case DOWN -> 0d;
			// Выключенная и непроверенная зависимость — не авария: NaN не даёт
			// алерту сработать по условию == 0.
			case DISABLED, UNKNOWN -> Double.NaN;
		};
	}

	public void searchUp() {
		search.set(new DependencyStatus("search", State.UP, Instant.now(), "Индекс отвечает"));
	}

	public void searchDown(String detail) {
		search.set(new DependencyStatus("search", State.DOWN, Instant.now(), detail));
	}

	public void searchDisabled() {
		search.set(new DependencyStatus("search", State.DISABLED, Instant.now(),
				"Поисковый индекс выключен (MEILI_ENABLED=false)"));
	}

	public void mediaUp() {
		media.set(new DependencyStatus("media", State.UP, Instant.now(), "Хранилище доступно"));
	}

	public void mediaDown(String detail) {
		media.set(new DependencyStatus("media", State.DOWN, Instant.now(), detail));
		mediaFailures.increment();
	}

	public void mediaDisabled() {
		media.set(new DependencyStatus("media", State.DISABLED, Instant.now(),
				"Загрузка картинок выключена (MEDIA_ENABLED=false)"));
	}

	public void mailUp() {
		mail.set(new DependencyStatus("mail", State.UP, Instant.now(), "Последнее письмо отправлено успешно"));
	}

	public void mailDown(String detail) {
		mail.set(new DependencyStatus("mail", State.DOWN, Instant.now(), detail));
		mailFailures.increment();
	}

	public void mailDisabled(String detail) {
		mail.set(new DependencyStatus("mail", State.DISABLED, Instant.now(), detail));
	}

	public void searchServedFromIndex() {
		searchIndexRequests.increment();
	}

	public void searchServedFromFallback() {
		searchFallbackRequests.increment();
	}

	public DependencyStatus searchStatus() {
		return search.get();
	}

	public DependencyStatus mediaStatus() {
		return media.get();
	}

	public DependencyStatus mailStatus() {
		return mail.get();
	}

	public List<DependencyStatus> all() {
		return List.of(search.get(), media.get(), mail.get());
	}
}
