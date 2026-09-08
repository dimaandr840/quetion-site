/**
 * 100 подробных вопросов Java Developer с веб-источниками.
 * Проверка: node scripts/import-questions.mjs data/java-interview.mjs --dry
 * Импорт:  node scripts/import-questions.mjs data/java-interview.mjs
 */
import part01 from "./java-interview-part-01.mjs";
import part02 from "./java-interview-part-02.mjs";
import part03 from "./java-interview-part-03.mjs";
import part04 from "./java-interview-part-04.mjs";

const categories = [
  ["java-platform","Платформа Java","☕","JDK, JVM, байт-код и выполнение программ."],
  ["jvm-memory","Память и GC","🧠","Области памяти JVM, сборщики мусора и ссылки."],
  ["jvm-runtime","Выполнение в JVM","⚙️","ClassLoader, JIT и runtime-диагностика."],
  ["oop","ООП","🧩","Абстракция, наследование, композиция и полиморфизм."],
  ["classes-objects","Классы и объекты","🏗️","Конструкторы, методы, модификаторы и члены классов."],
  ["object-contract","Контракты объектов","🤝","equals, hashCode, копирование и неизменяемость."],
  ["strings","Строки","🔤","String, pool и изменяемые строковые буферы."],
  ["language-basics","Возможности языка","📘","Типы, параметры, enum, annotations и reflection."],
  ["collections","Коллекции","🗂️","List, Set, Map, Queue и выбор реализации."],
  ["exceptions","Исключения","🚨","Иерархия, обработка и управление ресурсами."],
  ["generics","Generics","🧬","Параметры типов, стирание, bounds и wildcards."],
  ["concurrency","Многопоточность","🧵","JMM, синхронизация, executors и concurrent utilities."],
  ["functional-java","Функциональный Java","λ","Lambda, functional interfaces и Optional."],
  ["streams","Stream API","🌊","Конвейеры, преобразования, сборка и параллелизм."],
  ["io","Ввод-вывод","💾","Streams, NIO и сериализация."],
  ["modern-java","Современная Java","✨","Records, modules, sealed types, patterns и java.time."],
  ["performance","Производительность","📈","Benchmarking и анализ производительности."],
  ["design","Проектирование","📐","Создание устойчивых публичных API."],
].map(([slug,title,emoji,description])=>({slug,title,emoji,description}));

const questions=[...part01,...part02,...part03,...part04];
if(questions.length!==100) throw new Error(`Ожидалось 100 вопросов, получено ${questions.length}`);

export default {professionSlug:"java",categories,questions};
