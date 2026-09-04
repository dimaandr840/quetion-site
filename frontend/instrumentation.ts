/**
 * Трейсинг и метрики Next.js.
 *
 * Next вызывает `register()` один раз на старте сервера, до обработки запросов.
 *
 * Зачем это нужно: без трейсов на стороне Next цепочка рвётся: nginx передаёт
 * traceparent, Spring его принимает, но середина (SSR, серверные fetch к API) остаётся
 * невидимой — именно там живёт «медленно на странице вопроса».
 *
 * Адрес экспортера и сэмплинг берутся из штатных переменных OTEL_* (см. docker-compose.yml),
 * поэтому здесь их перечитывать не нужно.
 */

export async function register(): Promise<void> {
  // В edge-рантайме нет ни http-сервера, ни счётчиков процесса.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerOTel } = await import("@vercel/otel");
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "devprep-web" });

  // Метрики отдаются на отдельном порту, а не роутом приложения: иначе /metrics
  // оказался бы доступен через nginx снаружи, а его надо было бы отдельно закрывать.
  const port = Number.parseInt(process.env.METRICS_PORT ?? "9464", 10);
  if (!Number.isFinite(port) || port <= 0) return;

  const [{ createServer }, promClient] = await Promise.all([
    import("node:http"),
    import("prom-client"),
  ]);

  const registry = new promClient.Registry();
  registry.setDefaultLabels({ service: "web" });
  promClient.collectDefaultMetrics({ register: registry });

  const server = createServer(async (request, response) => {
    if (request.url !== "/metrics") {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await registry.metrics();
      response.writeHead(200, { "Content-Type": registry.contentType }).end(body);
    } catch {
      response.writeHead(500).end();
    }
  });

  // Ошибка служебного порта (например, EADDRINUSE при hot reload в dev) не должна
  // ронять сайт: наблюдаемость не может быть причиной простоя.
  server.on("error", (error) => {
    console.warn("metrics server disabled", error);
  });
  server.unref();
  server.listen(port, "0.0.0.0");
}
