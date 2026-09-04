import { IntegrationStatusPanel } from "@/components/admin/IntegrationStatusPanel";

export const metadata = { title: "Статистика и состояние" };

/**
 * Цифровая статистика живёт в Grafana — дублировать её в админке нет смысла.
 * Здесь только то, что нужно администратору контента без доступа к серверу: работают ли
 * поиск, хранилище картинок и почта.
 */
export default function AdminStatsPage() {
  return (
    <section>
      <h1 className="h1">Состояние сервисов</h1>
      <p className="body">
        Здесь видно, работают ли внешние зависимости. Если почта в состоянии
        «Не работает», письма с кодом восстановления до пользователей не доходят, даже если
        сам сайт открывается нормально.
      </p>

      <IntegrationStatusPanel />

      <p className="body">
        Подробные метрики (RPS, ошибки, p95/p99, пул соединений) — в дашборде Grafana
        «DevPrep API RED». Он доступен только из внутренней сети, см. docs/observability.md.
      </p>
    </section>
  );
}
