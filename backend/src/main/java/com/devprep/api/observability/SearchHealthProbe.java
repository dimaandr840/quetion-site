package com.devprep.api.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.devprep.api.config.MediaProperties;
import com.devprep.api.search.MeilisearchService;
import com.devprep.api.search.SearchProperties;

/**
 * Периодически спрашивает индекс о живости и держит актуальным гейдж
 * {@code devprep_search_up}.
 *
 * <p>Почему отдельный пробник, а не только реакция на ошибки запросов: на сайте
 * с небольшим трафиком поисковые запросы могут не приходить часами, и падение
 * Meilisearch обнаружится только вместе с жалобой пользователя.
 */
@Component
public class SearchHealthProbe {

	private static final Logger log = LoggerFactory.getLogger(SearchHealthProbe.class);

	private final ObjectProvider<MeilisearchService> meilisearch;
	private final SearchProperties searchProperties;
	private final MediaProperties mediaProperties;
	private final IntegrationStatusService status;

	public SearchHealthProbe(ObjectProvider<MeilisearchService> meilisearch, SearchProperties searchProperties,
			MediaProperties mediaProperties, IntegrationStatusService status) {
		this.meilisearch = meilisearch;
		this.searchProperties = searchProperties;
		this.mediaProperties = mediaProperties;
		this.status = status;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void initialState() {
		if (!mediaProperties.isEnabled()) {
			status.mediaDisabled();
		}
		else {
			status.mediaUp();
		}
		probe();
	}

	@Scheduled(fixedDelayString = "${devprep.search.health-check-interval:PT30S}")
	public void probe() {
		if (!searchProperties.isEnabled()) {
			status.searchDisabled();
			return;
		}
		MeilisearchService service = meilisearch.getIfAvailable();
		if (service == null) {
			status.searchDisabled();
			return;
		}
		try {
			if (service.isHealthy()) {
				status.searchUp();
			}
			else {
				status.searchDown("Индекс не ответил на проверку живости");
			}
		}
		catch (RuntimeException ex) {
			// Пробник никогда не должен выбрасывать: исключение из @Scheduled
			// гасит дальнейшие запуски задачи, и метрика навсегда замирает.
			log.debug("Проверка живости Meilisearch не удалась", ex);
			status.searchDown(ex.getClass().getSimpleName());
		}
	}
}
