/**
 * Вставка JSON-LD. Серверный компонент: разметка попадает в HTML
 * сразу, без ожидания JS — именно так её видит краулер.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Экранируем "<", чтобы контент не смог закрыть тег script.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
