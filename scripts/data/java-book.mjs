/**
 * Первая подборка из 30 вопросов книги «Вопросы и ответы к интервью Java разработчика».
 * Импорт: node scripts/import-questions.mjs data/java-book.mjs
 */
import categories from "./java-book-categories.mjs";
import rows from "./java-book-part-01.mjs";

export default {
  professionSlug: "java",
  categories,
  questions: rows.map(([t, c, l, page]) => {
    const answer = `Ответ находится в книге «Вопросы и ответы к интервью Java разработчика» на странице ${page}.`;
    return {
      t,
      l,
      c,
      g: ["Java", `Источник: книга, стр. ${page}`],
      d: answer,
      s: [{ h: "Источник", p: [answer] }],
    };
  }),
};
