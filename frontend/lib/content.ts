import type {
  Category,
  Industry,
  Profession,
  Question,
  Specialization,
} from "./types";

export const NAV_LINKS = [
  { label: "Профессии", href: "/professions" },
  { label: "Вопросы", href: "/questions" },
  { label: "Темы", href: "/categories" },
  { label: "О проекте", href: "/about" },
] as const;

export const FOOTER_TAGLINE =
  "База вопросов, ответов и практических заданий для подготовки к собеседованиям и системного изучения профессии.";

export const FOOTER_COLUMNS = [
  {
    title: "Сферы",
    links: [
      { label: "IT и разработка", href: "/professions#it" },
      { label: "Дизайн", href: "/professions#design" },
      { label: "Маркетинг", href: "/professions#marketing" },
      { label: "Бизнес и продукт", href: "/professions#business" },
      { label: "Финансы", href: "/professions#finance" },
      { label: "HR и подбор", href: "/professions#hr" },
    ],
  },
  {
    title: "Ресурсы",
    links: [
      { label: "База вопросов", href: "/questions" },
      { label: "Темы", href: "/categories" },
      { label: "Все профессии", href: "/professions" },
      { label: "О проекте", href: "/about" },
    ],
  },
] as const;

export const HERO = {
  overline: "База знаний для подготовки к собеседованиям",
  title: "Вопросы и ответы для успешного собеседования",
  // Лид в герое — не длиннее 20 слов (layout discipline из taste-skill).
  subtitle:
    "Структурированная база вопросов, ответов и практических заданий — от Junior до Senior.",
  searchPlaceholder: "Поиск по вопросам...",
  popularLabel: "Популярно:",
  primaryCta: { label: "Выбрать профессию", href: "/professions" },
  secondaryCta: { label: "Как устроен проект", href: "/about" },
} as const;

export const industries: Industry[] = [
  {
    slug: "it",
    emoji: "💻",
    title: "IT и разработка",
    description: "Разработка, тестирование, инфраструктура, данные и продукт.",
  },
  {
    slug: "design",
    emoji: "🎨",
    title: "Дизайн",
    description: "Продуктовый и графический дизайн, исследования, анимация.",
  },
  {
    slug: "marketing",
    emoji: "📈",
    title: "Маркетинг",
    description: "Performance, SEO, соцсети, контент и бренд-коммуникации.",
  },
  {
    slug: "business",
    emoji: "🧭",
    title: "Бизнес и продукт",
    description: "Продукт, проекты, аналитика требований и операции.",
  },
  {
    slug: "finance",
    emoji: "💰",
    title: "Финансы",
    description: "Финансовый анализ, учёт, инвестиции и управление бюджетом.",
  },
  {
    slug: "sales",
    emoji: "🤝",
    title: "Продажи",
    description: "Работа с клиентами, воронка, развитие бизнеса и переговоры.",
  },
  {
    slug: "hr",
    emoji: "👥",
    title: "HR и подбор",
    description: "Подбор, оценка, развитие людей и HR-партнёрство.",
  },
  {
    slug: "media",
    emoji: "✍️",
    title: "Медиа и контент",
    description: "Копирайтинг, редактура, PR и работа с аудиторией.",
  },
];


export const professions: Profession[] = [
  {
    slug: "frontend",
    emoji: "🎨",
    title: "Frontend Developer",
    pageTitle: "Frontend Developer",
    industrySlug: "it",
    featured: true,
    cardDescription:
      "JavaScript, TypeScript, React, HTML/CSS, Webpack и архитектура приложений.",
    description:
      "Подготовка к собеседованию по фронтенду: язык, браузер, фреймворки и производительность интерфейсов.",
  },
  {
    slug: "backend",
    emoji: "⚙️",
    title: "Backend Developer",
    pageTitle: "Backend Developer",
    industrySlug: "it",
    featured: true,
    cardDescription:
      "System Design, Node.js, Go, Python, API и паттерны проектирования.",
    description:
      "Серверная разработка: проектирование систем, протоколы, хранилища данных и надежность сервисов.",
  },
  {
    slug: "java",
    emoji: "☕",
    title: "Java Developer",
    pageTitle: "Java Developer",
    industrySlug: "it",
    featured: true,
    cardDescription:
      "Core Java, Collections, Multithreading, Spring Framework, Hibernate и базы данных.",
    description:
      "Полный путеводитель по подготовке к Java-собеседованию. Вопросы разбиты на ключевые темы от базового синтаксиса до архитектуры распределенных систем и микросервисов.",
  },
  {
    slug: "python",
    emoji: "🐍",
    title: "Python Developer",
    pageTitle: "Python Developer",
    industrySlug: "it",
    cardDescription: "Основы языка, Django/FastAPI, асинхронность, ООП и алгоритмы.",
    description:
      "Python на собеседовании: модель данных языка, асинхронность, веб-фреймворки и алгоритмы.",
  },
  {
    slug: "qa",
    emoji: "🧪",
    title: "QA Engineer",
    pageTitle: "QA Engineer",
    industrySlug: "it",
    featured: true,
    cardDescription:
      "Тест-дизайн, тестирование API, автоматизация на Python/Java и Selenium.",
    description:
      "Обеспечение качества: тест-дизайн, автоматизация, работа с API и стратегии тестирования.",
  },
  {
    slug: "devops",
    emoji: "☁️",
    title: "DevOps Engineer",
    pageTitle: "DevOps Engineer",
    industrySlug: "it",
    featured: true,
    cardDescription: "Docker, Kubernetes, CI/CD pipelines, облака, Linux и мониторинг.",
    description:
      "Инфраструктура и эксплуатация: контейнеры, оркестрация, пайплайны доставки и наблюдаемость.",
  },
  {
    slug: "data-analyst",
    emoji: "📊",
    title: "Data Analyst",
    pageTitle: "Data Analyst",
    industrySlug: "it",
    featured: true,
    cardDescription: "SQL, статистика, метрики продукта, A/B-тесты и визуализация данных.",
    description:
      "Аналитика данных: SQL и модель данных, статистика, продуктовые метрики и защита выводов перед бизнесом.",
  },
  {
    slug: "ux-ui-designer",
    emoji: "🖌️",
    title: "UX/UI Designer",
    pageTitle: "UX/UI Designer",
    industrySlug: "design",
    featured: true,
    cardDescription:
      "UX-исследования, пользовательские сценарии, интерфейсные паттерны и прототипы.",
    description:
      "Собеседование дизайнера интерфейсов: исследования, сценарии, визуальный язык и защита решений.",
  },
  {
    slug: "product-designer",
    emoji: "🧩",
    title: "Product Designer",
    pageTitle: "Product Designer",
    industrySlug: "design",
    cardDescription: "Продуктовые метрики, дизайн-системы, работа с гипотезами и командой.",
    description:
      "Продуктовый дизайн: связь дизайна с метриками, работа с гипотезами, дизайн-системы и кейсы в портфолио.",
  },
  {
    slug: "graphic-designer",
    emoji: "🎭",
    title: "Graphic Designer",
    pageTitle: "Graphic Designer",
    industrySlug: "design",
    cardDescription: "Композиция, типографика, цвет, брендинг и подготовка макетов.",
    description:
      "Графический дизайн: визуальные основы, айдентика, работа с носителями и подготовка файлов.",
  },
  {
    slug: "motion-designer",
    emoji: "🎬",
    title: "Motion Designer",
    pageTitle: "Motion Designer",
    industrySlug: "design",
    cardDescription: "Принципы анимации, тайминги, интерфейсная моция и работа в After Effects.",
    description:
      "Моушн-дизайн: принципы движения, интерфейсная анимация, форматы отдачи и работа с продакшеном.",
  },
  {
    slug: "performance-marketer",
    emoji: "🎯",
    title: "Performance Marketer",
    pageTitle: "Performance Marketer",
    industrySlug: "marketing",
    featured: true,
    cardDescription: "Google Ads, аукцион, юнит-экономика, атрибуция и оптимизация кампаний.",
    description:
      "Performance-маркетинг: закупка трафика, аналитика кампаний, атрибуция и работа с юнит-экономикой.",
  },
  {
    slug: "marketing-manager",
    emoji: "📣",
    title: "Marketing Manager",
    pageTitle: "Marketing Manager",
    industrySlug: "marketing",
    cardDescription: "Стратегия, позиционирование, каналы, бюджет и оценка результата.",
    description:
      "Маркетинг-менеджмент: стратегия и позиционирование, планирование каналов, бюджет и отчётность.",
  },
  {
    slug: "seo-specialist",
    emoji: "🔍",
    title: "SEO Specialist",
    pageTitle: "SEO Specialist",
    industrySlug: "marketing",
    cardDescription: "Техническое SEO, семантика, контент-стратегия и ссылочный профиль.",
    description:
      "SEO: техническая оптимизация, семантическое ядро, контент под поиск и работа со ссылками.",
  },
  {
    slug: "smm-manager",
    emoji: "💬",
    title: "SMM Manager",
    pageTitle: "SMM Manager",
    industrySlug: "marketing",
    cardDescription: "Контент-план, вовлечённость, работа с сообществом и реклама в соцсетях.",
    description:
      "SMM: стратегия в соцсетях, контент-план, работа с сообществом и платное продвижение.",
  },
  {
    slug: "content-manager",
    emoji: "📝",
    title: "Content Manager",
    pageTitle: "Content Manager",
    industrySlug: "marketing",
    cardDescription: "Контент-стратегия, редакционный процесс, дистрибуция и метрики контента.",
    description:
      "Контент-менеджмент: планирование и производство материалов, дистрибуция и оценка эффективности.",
  },
  {
    slug: "product-manager",
    emoji: "🚀",
    title: "Product Manager",
    pageTitle: "Product Manager",
    industrySlug: "business",
    featured: true,
    cardDescription: "Метрики, приоритизация, discovery, работа с командой и roadmap.",
    description:
      "Продуктовый менеджмент: discovery и гипотезы, метрики, приоритизация и работа с командой разработки.",
  },
  {
    slug: "project-manager",
    emoji: "🗂️",
    title: "Project Manager",
    pageTitle: "Project Manager",
    industrySlug: "business",
    cardDescription: "Сроки, риски, ресурсы, коммуникации и методологии управления.",
    description:
      "Управление проектами: планирование и сроки, риски, коммуникация со стейкхолдерами и методологии.",
  },
  {
    slug: "business-analyst",
    emoji: "📐",
    title: "Business Analyst",
    pageTitle: "Business Analyst",
    industrySlug: "business",
    cardDescription: "Требования, процессы, документация, интеграции и работа с заказчиком.",
    description:
      "Бизнес-анализ: сбор и формализация требований, описание процессов, документация и постановка задач.",
  },
  {
    slug: "operations-manager",
    emoji: "⚙️",
    title: "Operations Manager",
    pageTitle: "Operations Manager",
    industrySlug: "business",
    cardDescription: "Операционные процессы, регламенты, метрики эффективности и команда.",
    description:
      "Операционное управление: выстраивание процессов, регламенты, контроль эффективности и работа с командой.",
  },
  {
    slug: "financial-analyst",
    emoji: "📈",
    title: "Financial Analyst",
    pageTitle: "Financial Analyst",
    industrySlug: "finance",
    featured: true,
    cardDescription: "Финансовая модель, отчётность, оценка проектов и прогнозирование.",
    description:
      "Финансовый анализ: чтение отчётности, построение моделей, оценка проектов и прогнозирование.",
  },
  {
    slug: "accountant",
    emoji: "🧾",
    title: "Accountant",
    pageTitle: "Accountant",
    industrySlug: "finance",
    cardDescription: "Учёт, проводки, налоги, отчётность и работа с первичными документами.",
    description:
      "Бухгалтерия: учётная политика, проводки, налоги и подготовка отчётности.",
  },
  {
    slug: "investment-analyst",
    emoji: "💹",
    title: "Investment Analyst",
    pageTitle: "Investment Analyst",
    industrySlug: "finance",
    cardDescription: "Оценка компаний, DCF, мультипликаторы, риск и портфель.",
    description:
      "Инвестиционный анализ: оценка активов, DCF и мультипликаторы, риск-менеджмент и портфельные решения.",
  },
  {
    slug: "financial-manager",
    emoji: "🏦",
    title: "Financial Manager",
    pageTitle: "Financial Manager",
    industrySlug: "finance",
    cardDescription: "Бюджетирование, денежный поток, юнит-экономика и управление рисками.",
    description:
      "Финансовый менеджмент: бюджет и денежный поток, юнит-экономика, контроль затрат и управление рисками.",
  },
  {
    slug: "sales-manager",
    emoji: "🤝",
    title: "Sales Manager",
    pageTitle: "Sales Manager",
    industrySlug: "sales",
    cardDescription: "Воронка продаж, квалификация, работа с возражениями и план.",
    description:
      "Продажи: работа с воронкой, квалификация лидов, возражения и выполнение плана.",
  },
  {
    slug: "account-manager",
    emoji: "📞",
    title: "Account Manager",
    pageTitle: "Account Manager",
    industrySlug: "sales",
    cardDescription: "Удержание клиентов, апсейл, коммуникация и работа с конфликтами.",
    description:
      "Работа с клиентами: удержание и развитие аккаунтов, апсейл, коммуникация и сложные ситуации.",
  },
  {
    slug: "business-development-manager",
    emoji: "🌐",
    title: "Business Development Manager",
    pageTitle: "Business Development Manager",
    industrySlug: "sales",
    cardDescription: "Новые рынки, партнёрства, переговоры и оценка потенциала сделок.",
    description:
      "Развитие бизнеса: поиск рынков и партнёров, переговоры, оценка сделок и построение каналов.",
  },
  {
    slug: "hr-manager",
    emoji: "👥",
    title: "HR Manager",
    pageTitle: "HR Manager",
    industrySlug: "hr",
    cardDescription: "Подбор, адаптация, оценка, обучение и HR-метрики.",
    description:
      "HR-менеджмент: полный цикл работы с людьми — подбор, адаптация, оценка, развитие и метрики.",
  },
  {
    slug: "recruiter",
    emoji: "🔎",
    title: "Recruiter",
    pageTitle: "Recruiter",
    industrySlug: "hr",
    featured: true,
    cardDescription: "Поиск кандидатов, интервью, оценка компетенций и работа с воронкой найма.",
    description:
      "Рекрутинг: сорсинг, проведение интервью, оценка компетенций и управление воронкой найма.",
  },
  {
    slug: "hr-business-partner",
    emoji: "🧠",
    title: "HR Business Partner",
    pageTitle: "HR Business Partner",
    industrySlug: "hr",
    cardDescription: "Работа с руководителями, организационные изменения и вовлечённость.",
    description:
      "HR BP: партнёрство с бизнесом, организационные изменения, вовлечённость и развитие команд.",
  },
  {
    slug: "copywriter",
    emoji: "✍️",
    title: "Copywriter",
    pageTitle: "Copywriter",
    industrySlug: "media",
    cardDescription: "Структура текста, tone of voice, работа с брифом и продающие форматы.",
    description:
      "Копирайтинг: работа с брифом и аудиторией, структура текста, tone of voice и редактура.",
  },
  {
    slug: "editor",
    emoji: "📚",
    title: "Editor",
    pageTitle: "Editor",
    industrySlug: "media",
    cardDescription: "Редакционные стандарты, работа с авторами, факт-чекинг и планирование.",
    description:
      "Редактура: стандарты качества, работа с авторами, факт-чекинг и управление редакционным планом.",
  },
  {
    slug: "pr-manager",
    emoji: "📰",
    title: "PR Manager",
    pageTitle: "PR Manager",
    industrySlug: "media",
    cardDescription: "Работа с медиа, инфоповоды, репутация и коммуникации в кризис.",
    description:
      "PR: работа с медиа и инфоповодами, управление репутацией и коммуникации в кризисных ситуациях.",
  },
];

/**
 * Специализации — направления внутри профессии.
 * Порядок в массиве задаёт порядок вывода на странице профессии.
 */
export const specializations: Specialization[] = [
  {
    slug: "java-core",
    professionSlug: "java",
    title: "Java Core",
    description: "Язык, JVM, коллекции и многопоточность.",
  },
  {
    slug: "java-spring",
    professionSlug: "java",
    title: "Spring и персистентность",
    description: "Spring Framework, Hibernate и работа с транзакциями.",
  },
  {
    slug: "java-architecture",
    professionSlug: "java",
    title: "Архитектура и данные",
    description: "Паттерны, микросервисы и базы данных.",
  },
  {
    slug: "javascript",
    professionSlug: "frontend",
    title: "JavaScript",
    description: "Язык, асинхронность, прототипы и типы.",
  },
  {
    slug: "frontend-frameworks",
    professionSlug: "frontend",
    title: "Фреймворки",
    description: "React, состояние, рендеринг и производительность.",
  },
  {
    slug: "frontend-markup",
    professionSlug: "frontend",
    title: "Вёрстка и доступность",
    description: "HTML, CSS, семантика и адаптивность.",
  },
  {
    slug: "backend-architecture",
    professionSlug: "backend",
    title: "Архитектура систем",
    description: "Масштабирование, кэш, очереди и консистентность.",
  },
  {
    slug: "backend-platform",
    professionSlug: "backend",
    title: "Платформа и асинхронность",
    description: "Операционные системы, процессы и неблокирующий ввод-вывод.",
  },
  {
    slug: "devops-delivery",
    professionSlug: "devops",
    title: "Контейнеры и доставка",
    description: "Docker, оркестрация и пайплайны CI/CD.",
  },
  {
    slug: "qa-theory",
    professionSlug: "qa",
    title: "Теория тестирования",
    description: "Тест-дизайн, стратегии и работа с требованиями.",
  },
  {
    slug: "python-core",
    professionSlug: "python",
    title: "Основы Python",
    description: "Модель данных, изменяемость и генераторы.",
  },
  {
    slug: "sql-analytics",
    professionSlug: "data-analyst",
    title: "SQL и данные",
    description: "Выборки, соединения, оконные функции и качество данных.",
  },
  {
    slug: "product-metrics",
    professionSlug: "data-analyst",
    title: "Метрики и эксперименты",
    description: "Продуктовые метрики, A/B-тесты и статистическая значимость.",
  },
  {
    slug: "ux-research",
    professionSlug: "ux-ui-designer",
    title: "UX Research",
    description: "Интервью, тестирование прототипов и работа с данными исследований.",
  },
  {
    slug: "interface-design",
    professionSlug: "ux-ui-designer",
    title: "Проектирование интерфейсов",
    description: "Сценарии, паттерны, состояния и доступность.",
  },
  {
    slug: "google-ads",
    professionSlug: "performance-marketer",
    title: "Google Ads",
    description: "Аукцион, структура кампаний, ставки и аналитика рекламы.",
  },
  {
    slug: "unit-economics",
    professionSlug: "performance-marketer",
    title: "Юнит-экономика",
    description: "CAC, LTV, окупаемость канала и работа с бюджетом.",
  },
  {
    slug: "product-discovery",
    professionSlug: "product-manager",
    title: "Discovery и приоритизация",
    description: "Гипотезы, исследование проблем и выбор задач в бэклог.",
  },
  {
    slug: "financial-modeling",
    professionSlug: "financial-analyst",
    title: "Отчётность и модели",
    description: "Чтение отчётности, финансовая модель и прогноз.",
  },
  {
    slug: "hiring-process",
    professionSlug: "recruiter",
    title: "Процесс найма",
    description: "Воронка, интервью и оценка компетенций.",
  },
];


export const categories: Category[] = [
  {
    slug: "core-java",
    professionSlug: "java",
    specializationSlug: "java-core",
    emoji: "📦",
    title: "Core Java",
    description:
      "JVM, сборщик мусора, примитивные типы, классы Object и базовая спецификация.",
  },
  {
    slug: "collections",
    professionSlug: "java",
    specializationSlug: "java-core",
    emoji: "📚",
    title: "Collections",
    description:
      "Интерфейсы List, Set, Map, их внутреннее устройство и сложность операций.",
  },
  {
    slug: "multithreading",
    professionSlug: "java",
    specializationSlug: "java-core",
    emoji: "🧵",
    title: "Multithreading",
    description:
      "Потоки, синхронизация, пакет java.util.concurrent и модели памяти.",
  },
  {
    slug: "spring-framework",
    professionSlug: "java",
    specializationSlug: "java-spring",
    emoji: "🍃",
    title: "Spring Framework",
    description: "IoC/DI, Spring Boot, Data, Security и управление транзакциями.",
  },
  {
    slug: "hibernate-jpa",
    professionSlug: "java",
    specializationSlug: "java-spring",
    emoji: "💾",
    title: "Hibernate & JPA",
    description:
      "Связи сущностей, кэширование первого и второго уровней, проблемы N+1 запросов.",
  },
  {
    slug: "microservices",
    professionSlug: "java",
    specializationSlug: "java-architecture",
    emoji: "🕸️",
    title: "Microservices",
    description:
      "REST, gRPC, распределенные транзакции, API Gateway и сервис-дискавери.",
  },
  {
    slug: "design-patterns",
    professionSlug: "java",
    specializationSlug: "java-architecture",
    emoji: "🧩",
    title: "Design Patterns",
    description:
      "Порождающие, структурные и поведенческие паттерны в Java-приложениях.",
  },
  {
    slug: "sql-databases",
    professionSlug: "java",
    specializationSlug: "java-architecture",
    emoji: "🗄️",
    title: "SQL & Databases",
    description:
      "Индексы, уровни изолированности транзакций, нормализация и оптимизация запросов.",
  },
  {
    slug: "core-js",
    professionSlug: "frontend",
    specializationSlug: "javascript",
    emoji: "🟨",
    title: "Core JS",
    description:
      "Замыкания, прототипы, контекст вызова, event loop и приведение типов.",
  },
  {
    slug: "react",
    professionSlug: "frontend",
    specializationSlug: "frontend-frameworks",
    emoji: "⚛️",
    title: "React",
    description:
      "Хуки, реконсиляция, состояние, мемоизация и серверный рендеринг.",
  },
  {
    slug: "layout-css",
    professionSlug: "frontend",
    specializationSlug: "frontend-markup",
    emoji: "🎯",
    title: "HTML & CSS",
    description: "Семантика, доступность, Flexbox, Grid и каскад стилей.",
  },
  {
    slug: "system-design",
    professionSlug: "backend",
    specializationSlug: "backend-architecture",
    emoji: "🏗️",
    title: "System Design",
    description:
      "Масштабирование, кэширование, очереди сообщений и консистентность данных.",
  },
  {
    slug: "os-systems",
    professionSlug: "backend",
    specializationSlug: "backend-platform",
    emoji: "🖥️",
    title: "OS & Systems",
    description: "Процессы, потоки, память, планировщик и системные вызовы.",
  },
  {
    slug: "asynchronous",
    professionSlug: "backend",
    specializationSlug: "backend-platform",
    emoji: "🔄",
    title: "Asynchronous",
    description: "Event loop, промисы, корутины и неблокирующий ввод-вывод.",
  },
  {
    slug: "containers",
    professionSlug: "devops",
    specializationSlug: "devops-delivery",
    emoji: "🐳",
    title: "Docker & Контейнеры",
    description: "Образы, слои, сети, тома и оптимизация сборки контейнеров.",
  },
  {
    slug: "ci-cd",
    professionSlug: "devops",
    specializationSlug: "devops-delivery",
    emoji: "🚀",
    title: "CI/CD",
    description: "Пайплайны, артефакты, стратегии деплоя и откат релизов.",
  },
  {
    slug: "test-design",
    professionSlug: "qa",
    specializationSlug: "qa-theory",
    emoji: "🧭",
    title: "Тест-дизайн",
    description: "Классы эквивалентности, граничные значения и тест-стратегии.",
  },
  {
    slug: "python-basics",
    professionSlug: "python",
    specializationSlug: "python-core",
    emoji: "🧱",
    title: "Основы Python",
    description: "Модель данных, изменяемость, генераторы и менеджеры контекста.",
  },
  {
    slug: "sql-queries",
    professionSlug: "data-analyst",
    specializationSlug: "sql-analytics",
    emoji: "🧮",
    title: "SQL-запросы",
    description: "JOIN, группировки, оконные функции и оптимизация выборок.",
  },
  {
    slug: "ab-testing",
    professionSlug: "data-analyst",
    specializationSlug: "product-metrics",
    emoji: "🧪",
    title: "A/B-тесты",
    description: "Дизайн эксперимента, значимость, мощность и типичные ошибки.",
  },
  {
    slug: "product-metrics-basics",
    professionSlug: "data-analyst",
    specializationSlug: "product-metrics",
    emoji: "📊",
    title: "Продуктовые метрики",
    description: "Retention, конверсии, воронки и выбор метрики решения.",
  },
  {
    slug: "user-interviews",
    professionSlug: "ux-ui-designer",
    specializationSlug: "ux-research",
    emoji: "🎤",
    title: "Интервью с пользователями",
    description: "Подготовка гайда, ведение интервью и анализ ответов.",
  },
  {
    slug: "usability-testing",
    professionSlug: "ux-ui-designer",
    specializationSlug: "ux-research",
    emoji: "🔬",
    title: "Юзабилити-тестирование",
    description: "Сценарии, метрики задач и приоритизация найденных проблем.",
  },
  {
    slug: "interface-patterns",
    professionSlug: "ux-ui-designer",
    specializationSlug: "interface-design",
    emoji: "🧱",
    title: "Интерфейсные паттерны",
    description: "Навигация, формы, состояния загрузки и обработка ошибок.",
  },
  {
    slug: "ads-analytics",
    professionSlug: "performance-marketer",
    specializationSlug: "google-ads",
    emoji: "📉",
    title: "Аналитика кампаний",
    description: "Метрики эффективности, атрибуция и решения по оптимизации.",
  },
  {
    slug: "ads-structure",
    professionSlug: "performance-marketer",
    specializationSlug: "google-ads",
    emoji: "🗃️",
    title: "Структура и ставки",
    description: "Аукцион, качество объявления, стратегии ставок и бюджет.",
  },
  {
    slug: "cac-ltv",
    professionSlug: "performance-marketer",
    specializationSlug: "unit-economics",
    emoji: "💵",
    title: "CAC и LTV",
    description: "Стоимость привлечения, ценность клиента и окупаемость канала.",
  },
  {
    slug: "prioritization",
    professionSlug: "product-manager",
    specializationSlug: "product-discovery",
    emoji: "🎯",
    title: "Приоритизация",
    description: "Фреймворки выбора задач и защита решения перед стейкхолдерами.",
  },
  {
    slug: "hypotheses",
    professionSlug: "product-manager",
    specializationSlug: "product-discovery",
    emoji: "🔭",
    title: "Гипотезы и исследования",
    description: "Формулировка гипотез, проверка и работа с обратной связью.",
  },
  {
    slug: "financial-statements",
    professionSlug: "financial-analyst",
    specializationSlug: "financial-modeling",
    emoji: "🧾",
    title: "Финансовая отчётность",
    description: "P&L, баланс, денежный поток и связи между отчётами.",
  },
  {
    slug: "candidate-assessment",
    professionSlug: "recruiter",
    specializationSlug: "hiring-process",
    emoji: "🧭",
    title: "Оценка кандидатов",
    description: "Компетенции, структурированное интервью и критерии решения.",
  },
];

export const questions: Question[] = [
  {
    slug: "hashmap-internals",
    title: "Что такое HashMap и как он работает внутри?",
    level: "Middle",
    professionSlug: "java",
    categorySlug: "collections",
    tags: ["Collections", "Java"],
    snippet:
      "При возникновении коллизий HashMap использует метод цепочек. С версии Java 8, если длина списка превышает 8 элементов, он преобразуется в дерево...",
    tldr:
      "HashMap в Java — это структура данных, представляющая собой хеш-таблицу. Она хранит пары «ключ-значение» и обеспечивает базовые операции поиска и вставки за константное время O(1). В основе лежит массив бакетов, где коллизии разрешаются с помощью связных списков и красно-черных деревьев.",
    sections: [
      {
        id: "princip-raboty",
        heading: "Принцип работы",
        paragraphs: [
          "При добавлении элемента в HashMap методом put(key, value), сначала вычисляется хеш-код ключа. По значению этого хеш-кода определяется индекс в массиве бакетов (корзин), куда будет помещена пара.",
        ],
        code: {
          language: "java",
          title: "Java Example",
          lines: [
            "Map<String, Integer> map = new HashMap<>();",
            'map.put("key", 100);',
            "// hash() вычисляется неявно внутри метода",
          ],
        },
      },
      {
        id: "vnutrennyaya-struktura",
        heading: "Внутренняя структура",
        paragraphs: [
          "Основной массив состоит из объектов типа Node. Каждый Node содержит в себе:",
        ],
        bullets: [
          "final int hash — хеш-код ключа",
          "final K key — ссылка на ключ",
          "V value — текущее значение",
          "Node next — ссылка на следующий элемент в случае цепочки",
        ],
      },
      {
        id: "kollizii",
        heading: "Коллизии и их разрешение",
        paragraphs: [
          "Коллизия возникает, когда два разных ключа попадают в один бакет. HashMap разрешает такие ситуации методом цепочек: элементы связываются в список внутри бакета.",
          "Начиная с Java 8, если длина связного списка в бакете превышает 8 элементов, он преобразуется в сбалансированное красно-черное дерево, что снижает сложность поиска с O(n) до O(log n).",
        ],
      },
    ],
  },
  {
    slug: "hashmap-collisions-java8",
    title: "Каким образом HashMap обрабатывает коллизии и что изменилось в Java 8?",
    level: "Middle",
    professionSlug: "java",
    categorySlug: "core-java",
    tags: ["Collections"],
    snippet:
      "При возникновении коллизий (когда два ключа возвращают одинаковый бакет-индекс), HashMap использует метод цепочек. Начиная с Java 8, если длина связного списка в бакете превышает 8 элементов, он преобразуется в сбалансированное красно-черное дерево...",
    tldr:
      "Коллизии разрешаются методом цепочек. С Java 8 длинная цепочка (более 8 элементов) превращается в красно-черное дерево, что ускоряет поиск в вырожденных случаях.",
    sections: [
      {
        id: "metod-cepochek",
        heading: "Метод цепочек",
        paragraphs: [
          "При возникновении коллизий (когда два ключа возвращают одинаковый бакет-индекс), HashMap использует метод цепочек. Элементы одного бакета связываются между собой ссылками next.",
        ],
      },
      {
        id: "treeify",
        heading: "Преобразование в дерево",
        paragraphs: [
          "Начиная с Java 8, если длина связного списка в бакете превышает 8 элементов, он преобразуется в сбалансированное красно-черное дерево. Обратное преобразование происходит при уменьшении размера бакета до 6 элементов.",
        ],
      },
    ],
    tasks: [
      {
        id: "collisions-practice",
        title: "Спровоцировать коллизии осознанно",
        statement: [
          "Напишите класс-ключ, у которого hashCode() всегда возвращает одно и то же число, а equals() сравнивает поле id.",
          "Положите в HashMap 10 таких ключей и объясните, что произойдёт со структурой бакета и со сложностью операции get.",
        ],
        hint: "Все ключи попадут в один бакет: сначала цепочка, после порога — дерево.",
      },
    ],
    popular: true,
  },
  {
    slug: "constant-vs-variable-java",
    title: "В чем разница между константой и обычной переменной в Java?",
    level: "Junior",
    professionSlug: "java",
    categorySlug: "core-java",
    tags: ["Basics"],
    snippet:
      "Константа объявляется с модификатором final: её значение нельзя переприсвоить после инициализации.",
    tldr:
      "Константа в Java объявляется через final (часто вместе со static). Её ссылку нельзя переприсвоить после инициализации, тогда как обычная переменная может менять значение в любой момент.",
    sections: [
      {
        id: "final",
        heading: "Модификатор final",
        paragraphs: [
          "Поле, объявленное как final, должно быть инициализировано один раз — в объявлении, в блоке инициализации или в конструкторе. Дальнейшее присваивание вызывает ошибку компиляции.",
        ],
        code: {
          language: "java",
          title: "Java Example",
          lines: [
            "static final int MAX_SIZE = 16;",
            "int currentSize = 0;",
            "// MAX_SIZE = 32; — ошибка компиляции",
          ],
        },
      },
      {
        id: "immutability",
        heading: "Неизменяемость ссылки, а не объекта",
        paragraphs: [
          "final фиксирует только ссылку. Если объект изменяемый, его внутреннее состояние по-прежнему можно поменять.",
        ],
      },
    ],
  },
  {
    slug: "classloader-java",
    title: "Как работает механизм ClassLoader в Java и какие бывают уровни?",
    level: "Senior",
    professionSlug: "java",
    categorySlug: "core-java",
    tags: ["JVM"],
    snippet:
      "ClassLoader загружает байт-код классов в JVM по принципу делегирования родителю.",
    tldr:
      "ClassLoader отвечает за загрузку байт-кода в JVM. Загрузчики образуют иерархию Bootstrap → Platform → Application и работают по принципу делегирования родителю.",
    sections: [
      {
        id: "ierarhiya",
        heading: "Иерархия загрузчиков",
        paragraphs: [
          "Bootstrap ClassLoader загружает базовые классы платформы, Platform ClassLoader — стандартные модули, Application ClassLoader — классы приложения из classpath.",
        ],
        bullets: [
          "Bootstrap — встроен в JVM, загружает java.base",
          "Platform — модули платформы Java",
          "Application — classpath приложения",
        ],
      },
      {
        id: "delegirovanie",
        heading: "Принцип делегирования",
        paragraphs: [
          "Перед загрузкой класса загрузчик передает запрос родителю. Только если родитель не смог найти класс, загрузчик пытается загрузить его сам. Это защищает системные классы от подмены.",
        ],
      },
    ],
  },
  {
    slug: "sleep-vs-wait",
    title: "В чем разница между методами sleep() и wait()?",
    level: "Middle",
    professionSlug: "java",
    categorySlug: "multithreading",
    tags: ["Multithreading"],
    snippet:
      "sleep() приостанавливает поток и не освобождает монитор, wait() освобождает монитор и ждет notify().",
    tldr:
      "sleep() — статический метод Thread, который усыпляет поток и удерживает захваченные мониторы. wait() — метод Object, он освобождает монитор и ждет notify()/notifyAll().",
    sections: [
      {
        id: "monitor",
        heading: "Работа с монитором",
        paragraphs: [
          "wait() можно вызвать только внутри synchronized-блока: метод освобождает монитор объекта и переводит поток в состояние ожидания. sleep() монитор не освобождает.",
        ],
        code: {
          language: "java",
          title: "Java Example",
          lines: [
            "synchronized (lock) {",
            "    lock.wait();   // монитор освобожден",
            "}",
            "Thread.sleep(1000); // монитор удерживается",
          ],
        },
      },
      {
        id: "probuzhdenie",
        heading: "Пробуждение потока",
        paragraphs: [
          "Поток после sleep() продолжает работу по истечении таймаута. Поток после wait() ждет вызова notify() или notifyAll() на том же объекте либо таймаута.",
        ],
      },
    ],
  },
  {
    slug: "references-java",
    title: "Что такое strong, soft, weak и phantom references?",
    level: "Senior",
    professionSlug: "java",
    categorySlug: "core-java",
    tags: ["Управление памятью"],
    snippet:
      "Четыре типа ссылок определяют, при каких условиях сборщик мусора может освободить объект.",
    tldr:
      "Тип ссылки определяет поведение сборщика мусора: strong не даёт удалить объект, soft удаляется при нехватке памяти, weak — на первой же сборке, phantom позволяет узнать о финализации.",
    sections: [
      {
        id: "tipy-ssylok",
        heading: "Типы ссылок",
        bullets: [
          "Strong — обычная ссылка, объект не собирается",
          "Soft — объект удаляется при нехватке памяти, подходит для кэшей",
          "Weak — объект удаляется на следующей сборке мусора",
          "Phantom — используется для отслеживания момента освобождения",
        ],
      },
      {
        id: "primenenie",
        heading: "Применение",
        paragraphs: [
          "SoftReference используют для кэшей, WeakReference — для метаданных и WeakHashMap, PhantomReference — для управляемой очистки внешних ресурсов вместо finalize().",
        ],
      },
    ],
  },
  {
    slug: "hashmap-default-capacity",
    title: "Какова начальная емкость HashMap по умолчанию?",
    level: "Junior",
    professionSlug: "java",
    categorySlug: "collections",
    tags: ["Collections", "Basics"],
    snippet:
      "Начальная емкость (initial capacity) по умолчанию составляет 16 бакетов, а коэффициент загрузки (load factor) равен 0.75...",
    tldr:
      "По умолчанию HashMap создаёт 16 бакетов с коэффициентом загрузки 0.75 — расширение происходит при 12 элементах.",
    sections: [
      {
        id: "capacity",
        heading: "Емкость и коэффициент загрузки",
        paragraphs: [
          "Начальная емкость (initial capacity) по умолчанию составляет 16 бакетов, а коэффициент загрузки (load factor) равен 0.75. При достижении порога массив увеличивается вдвое и элементы перераспределяются.",
        ],
      },
    ],
  },
  {
    slug: "concurrenthashmap",
    title: "Как устроен ConcurrentHashMap в Java?",
    level: "Senior",
    professionSlug: "java",
    categorySlug: "multithreading",
    tags: ["Concurrency", "Collections"],
    snippet:
      "ConcurrentHashMap обеспечивает потокобезопасность на уровне отдельных сегментов (в Java 7) или через CAS и synchronized бакетов (в Java 8+)...",
    tldr:
      "ConcurrentHashMap даёт потокобезопасный доступ без блокировки всей структуры: в Java 7 — через сегменты, в Java 8+ — через CAS и синхронизацию по отдельным бакетам.",
    sections: [
      {
        id: "segmenty",
        heading: "От сегментов к бакетам",
        paragraphs: [
          "ConcurrentHashMap обеспечивает потокобезопасность на уровне отдельных сегментов (в Java 7) или через CAS и synchronized бакетов (в Java 8+). Это позволяет нескольким потокам писать в разные части таблицы параллельно.",
        ],
      },
      {
        id: "chtenie",
        heading: "Чтение без блокировок",
        paragraphs: [
          "Операции чтения не требуют блокировки: поля Node объявлены volatile, поэтому читатели видят согласованное состояние без синхронизации.",
        ],
      },
    ],
  },
  {
    slug: "hashtable-vs-hashmap",
    title: "В чем разница между HashTable и HashMap?",
    level: "Junior",
    professionSlug: "java",
    categorySlug: "collections",
    tags: ["Collections"],
    snippet:
      "HashTable синхронизирован целиком и не допускает null, HashMap быстрее и допускает один null-ключ.",
    tldr:
      "HashTable — устаревший синхронизированный класс, не допускающий null. HashMap не синхронизирован, быстрее и допускает один null-ключ и любое число null-значений.",
    sections: [
      {
        id: "sravnenie",
        heading: "Сравнение",
        bullets: [
          "HashTable синхронизирует каждый метод, HashMap — нет",
          "HashTable не допускает null ни в ключах, ни в значениях",
          "Для многопоточности вместо HashTable используют ConcurrentHashMap",
        ],
      },
    ],
  },
  {
    slug: "linkedhashmap",
    title: "В чем особенности реализации LinkedHashMap?",
    level: "Middle",
    professionSlug: "java",
    categorySlug: "collections",
    tags: ["Collections"],
    snippet:
      "LinkedHashMap хранит дополнительный двусвязный список, который задает порядок обхода элементов.",
    tldr:
      "LinkedHashMap наследует HashMap и добавляет двусвязный список поверх бакетов, сохраняя порядок вставки или порядок обращения (access-order).",
    sections: [
      {
        id: "poryadok",
        heading: "Порядок обхода",
        paragraphs: [
          "По умолчанию сохраняется порядок вставки. Если конструктор вызван с accessOrder = true, элементы переупорядочиваются при обращении, что позволяет реализовать LRU-кэш.",
        ],
      },
    ],
  },
  {
    slug: "garbage-collector-java",
    title: "Как работает сборщик мусора (Garbage Collector) в Java?",
    level: "Middle",
    professionSlug: "java",
    categorySlug: "core-java",
    tags: ["Virtual Machine", "Java"],
    snippet:
      "Сборщик мусора находит недостижимые объекты и освобождает занимаемую ими память, работая по поколениям.",
    tldr:
      "GC автоматически освобождает память недостижимых объектов. Куча разделена на поколения: молодые объекты собираются часто и быстро, выжившие переходят в старое поколение.",
    sections: [
      {
        id: "dostizhimost",
        heading: "Достижимость объектов",
        paragraphs: [
          "Сборщик мусора строит граф достижимости от корней (GC roots): стеки потоков, статические поля, JNI-ссылки. Объекты, недостижимые из корней, считаются мусором.",
        ],
      },
      {
        id: "pokoleniya",
        heading: "Поколения и алгоритмы",
        paragraphs: [
          "Куча делится на young и old generation. Minor GC собирает молодое поколение копированием выживших, Major GC работает со старым поколением.",
        ],
        bullets: [
          "Serial GC — однопоточный, для небольших приложений",
          "Parallel GC — упор на пропускную способность",
          "G1 GC — сбалансированный, регионный, по умолчанию с Java 9",
          "ZGC / Shenandoah — паузы менее миллисекунды",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "closure-javascript",
    title: "Что такое замыкание (Closure) в JavaScript и как оно работает?",
    level: "Junior",
    professionSlug: "frontend",
    categorySlug: "core-js",
    tags: ["Core JS", "Frontend"],
    snippet:
      "Замыкание — это функция вместе с лексическим окружением, в котором она была создана.",
    tldr:
      "Замыкание — это функция, которая сохраняет доступ к переменным внешней области видимости даже после завершения внешней функции.",
    sections: [
      {
        id: "leksicheskoe-okruzhenie",
        heading: "Лексическое окружение",
        paragraphs: [
          "Каждая функция при создании запоминает ссылку на окружение, где она была объявлена. Поэтому внутренняя функция продолжает видеть переменные внешней даже после её возврата.",
        ],
        code: {
          language: "javascript",
          title: "JavaScript Example",
          lines: [
            "function counter() {",
            "  let count = 0;",
            "  return () => ++count;",
            "}",
          ],
        },
      },
      {
        id: "primenenie-closure",
        heading: "Практическое применение",
        bullets: [
          "Приватное состояние без классов",
          "Мемоизация и кэширование результатов",
          "Каррирование и частичное применение функций",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "process-vs-thread",
    title: "В чем разница между процессами и потоками?",
    level: "Middle",
    professionSlug: "backend",
    categorySlug: "os-systems",
    tags: ["OS & Systems", "Backend"],
    snippet:
      "Процесс имеет изолированное адресное пространство, потоки одного процесса разделяют память.",
    tldr:
      "Процесс — изолированная единица выполнения со своим адресным пространством. Потоки живут внутри процесса и разделяют память, поэтому переключение между ними дешевле.",
    sections: [
      {
        id: "izolyaciya",
        heading: "Изоляция и память",
        paragraphs: [
          "Процессы не могут напрямую читать память друг друга — для обмена нужны IPC-механизмы. Потоки одного процесса разделяют кучу, но имеют собственные стеки.",
        ],
      },
      {
        id: "stoimost",
        heading: "Стоимость переключения",
        paragraphs: [
          "Переключение контекста между процессами дороже: требуется смена таблиц страниц. Переключение потоков ограничивается сохранением регистров и стека.",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "event-loop-nodejs",
    title: "Как устроен цикл событий (Event Loop) в Node.js?",
    level: "Senior",
    professionSlug: "backend",
    categorySlug: "asynchronous",
    tags: ["Asynchronous", "Backend"],
    snippet:
      "Event Loop обходит фазы таймеров, ожидающих колбэков, poll, check и close-колбэков.",
    tldr:
      "Event Loop в Node.js — цикл с несколькими фазами (timers, pending callbacks, poll, check, close). Микротаски и process.nextTick выполняются между фазами.",
    sections: [
      {
        id: "fazy",
        heading: "Фазы цикла",
        bullets: [
          "timers — колбэки setTimeout и setInterval",
          "pending callbacks — отложенные системные колбэки",
          "poll — получение новых событий ввода-вывода",
          "check — колбэки setImmediate",
          "close callbacks — обработчики закрытия дескрипторов",
        ],
      },
      {
        id: "mikrotaski",
        heading: "Микротаски",
        paragraphs: [
          "После каждой фазы очередь process.nextTick опустошается первой, затем выполняются промис-микротаски. Поэтому тяжелые nextTick-колбэки способны задержать ввод-вывод.",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "singleton-pattern",
    title: "Что такое паттерн Singleton и какие у него недостатки?",
    level: "Middle",
    professionSlug: "java",
    categorySlug: "design-patterns",
    tags: ["Design Patterns", "Common"],
    snippet:
      "Singleton гарантирует единственный экземпляр класса, но усложняет тестирование и скрывает зависимости.",
    tldr:
      "Singleton обеспечивает единственный экземпляр класса и глобальную точку доступа. Недостатки: скрытые зависимости, сложность тестирования и проблемы в многопоточной среде.",
    sections: [
      {
        id: "realizaciya",
        heading: "Реализация",
        paragraphs: [
          "В Java безопасный вариант — enum-синглтон либо статическое поле с ленивой инициализацией через holder-класс.",
        ],
        code: {
          language: "java",
          title: "Java Example",
          lines: [
            "public enum Config {",
            "    INSTANCE;",
            "}",
          ],
        },
      },
      {
        id: "nedostatki",
        heading: "Недостатки",
        bullets: [
          "Скрытые зависимости вместо явного внедрения",
          "Глобальное состояние мешает изоляции тестов",
          "Требует аккуратной синхронизации при ленивой инициализации",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "classpath-jvm",
    title: "Что такое Classpath и JVM?",
    level: "Junior",
    professionSlug: "java",
    categorySlug: "core-java",
    tags: ["JVM", "Basics"],
    snippet:
      "JVM исполняет байт-код, classpath указывает, где искать классы и ресурсы приложения.",
    tldr:
      "JVM — виртуальная машина, исполняющая байт-код. Classpath — список путей, по которым загрузчик ищет классы и ресурсы.",
    sections: [
      {
        id: "jvm",
        heading: "Виртуальная машина",
        paragraphs: [
          "JVM загружает и верифицирует байт-код, управляет памятью и компилирует горячие участки в машинный код через JIT.",
        ],
      },
    ],
  },
  {
    slug: "sql-join-types",
    title: "Чем отличаются INNER, LEFT и FULL JOIN?",
    level: "Junior",
    professionSlug: "data-analyst",
    categorySlug: "sql-queries",
    tags: ["SQL", "Данные"],
    snippet:
      "Тип соединения определяет, какие строки останутся в результате, если совпадения по ключу нет.",
    tldr:
      "INNER оставляет только совпавшие строки, LEFT сохраняет все строки левой таблицы, FULL — строки обеих таблиц. Незаполненные поля становятся NULL.",
    sections: [
      {
        id: "raznica",
        heading: "Разница на практике",
        bullets: [
          "INNER JOIN — только заказы, у которых нашёлся клиент",
          "LEFT JOIN — все заказы, даже если клиент удалён",
          "FULL JOIN — и заказы без клиента, и клиенты без заказов",
        ],
      },
      {
        id: "lovushka",
        heading: "Типичная ошибка",
        paragraphs: [
          "Условие на правую таблицу в WHERE после LEFT JOIN превращает его в INNER: строки с NULL отфильтруются. Такое условие нужно переносить в ON.",
        ],
        code: {
          language: "sql",
          title: "SQL Example",
          lines: [
            "select o.id, c.name",
            "from orders o",
            "left join clients c",
            "  on c.id = o.client_id and c.is_active",
            "-- а не where c.is_active",
          ],
        },
      },
    ],
    tasks: [
      {
        id: "join-audit",
        title: "Найти потерянные строки",
        statement: [
          "В отчёте по выручке за месяц сумма меньше, чем в бухгалтерии. В запросе есть INNER JOIN со справочником товаров.",
          "Опишите, как проверить гипотезу о потерянных строках и каким запросом её подтвердить.",
        ],
        hint: "Сравните количество строк до и после соединения и найдите заказы с товарами, которых нет в справочнике.",
      },
    ],
    popular: true,
  },
  {
    slug: "ab-test-significance",
    title: "Что означает статистическая значимость в A/B-тесте?",
    level: "Middle",
    professionSlug: "data-analyst",
    categorySlug: "ab-testing",
    tags: ["A/B-тесты", "Статистика"],
    snippet:
      "Значимость говорит о вероятности увидеть такой результат при отсутствии реального эффекта, а не о размере выгоды.",
    tldr:
      "p-value — вероятность получить наблюдаемое различие, если между вариантами разницы нет. Значимость не измеряет размер эффекта и не гарантирует, что изменение выгодно бизнесу.",
    sections: [
      {
        id: "p-value",
        heading: "Что показывает p-value",
        paragraphs: [
          "Значимость на уровне 0,05 означает: если бы эффекта не было, такой или более сильный результат встречался бы примерно в 5% экспериментов. Это утверждение о данных, а не о вероятности гипотезы.",
        ],
      },
      {
        id: "razmer-effekta",
        heading: "Значимость и размер эффекта",
        paragraphs: [
          "На большой выборке значимым становится и прирост в 0,1%, который не покрывает стоимость разработки. Поэтому вместе с p-value смотрят доверительный интервал и минимальный интересный эффект.",
        ],
      },
      {
        id: "oshibki",
        heading: "Частые ошибки",
        bullets: [
          "Подглядывание в результаты и остановка теста на первом «значимом» дне",
          "Много метрик без поправки на множественные сравнения",
          "Разные условия у групп: акции, релизы, сезонность",
        ],
      },
    ],
    tasks: [
      {
        id: "ab-review",
        title: "Разобрать сомнительный тест",
        statement: [
          "Команда остановила тест на третий день: конверсия выросла на 12%, p-value = 0,04.",
          "Перечислите проверки, которые нужно сделать до раскатки, и объясните, почему результат может не воспроизвестись.",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "retention-metric",
    title: "Как выбрать главную метрику для продукта?",
    level: "Middle",
    professionSlug: "data-analyst",
    categorySlug: "product-metrics-basics",
    tags: ["Метрики", "Продукт"],
    snippet:
      "Главная метрика должна отражать полученную пользователем ценность и быть управляемой командой.",
    tldr:
      "Хорошая метрика связана с ценностью для пользователя, чувствительна к изменениям продукта и не растёт за счёт вреда пользователю. Одну метрику дополняют контрольными.",
    sections: [
      {
        id: "kriterii",
        heading: "Критерии выбора",
        bullets: [
          "Отражает повторяющееся полезное действие, а не разовый визит",
          "Меняется от действий команды в разумный срок",
          "Её нельзя улучшить приёмами, которые вредят пользователю",
        ],
      },
      {
        id: "kontrolnye",
        heading: "Контрольные метрики",
        paragraphs: [
          "К основной метрике добавляют ограничители: отток, жалобы, скорость загрузки. Они не дают оптимизировать одну цифру в ущерб продукту.",
        ],
      },
    ],
  },
  {
    slug: "user-interview-process",
    title: "Как вы проводите пользовательское исследование?",
    level: "Middle",
    professionSlug: "ux-ui-designer",
    categorySlug: "user-interviews",
    tags: ["UX Research", "Интервью"],
    snippet:
      "Исследование начинается с вопроса к продукту, а не с набора вопросов к пользователю.",
    tldr:
      "Сначала формулируется решение, которое нужно принять, затем метод, критерии отбора участников и гайд из вопросов о прошлом опыте. Выводы фиксируются как проблемы с частотой, а не как цитаты.",
    sections: [
      {
        id: "podgotovka",
        heading: "Подготовка",
        paragraphs: [
          "Формулируется исследовательский вопрос и решение, которое зависит от ответа. Затем подбираются участники по поведению, а не по демографии: важно, чтобы человек действительно решал задачу.",
        ],
      },
      {
        id: "vedenie",
        heading: "Ведение интервью",
        bullets: [
          "Спрашивать о конкретном прошлом опыте, а не о планах",
          "Не показывать решение до того, как понята проблема",
          "Не задавать вопросов, в которых уже есть ответ",
        ],
      },
      {
        id: "vyvody",
        heading: "Обработка резул��татов",
        paragraphs: [
          "Ответы разбираются на наблюдения, наблюдения группируются в проблемы, у каждой проблемы фиксируется частота и влияние. На выходе — список гипотез с приоритетом, а не отчёт с цитатами.",
        ],
      },
    ],
    tasks: [
      {
        id: "interview-guide",
        title: "Написать гайд интервью",
        statement: [
          "Продукт — сервис доставки продуктов. Команда хочет понять, почему пользователи не пользуются повторным заказом.",
          "Составьте 6 вопросов для интервью и объясните, какие из них проверяют поведение, а не мнение.",
        ],
        hint: "Начните с последнего реального заказа и восстановите шаги, которые человек прошёл.",
      },
    ],
    popular: true,
  },
  {
    slug: "usability-test-metrics",
    title: "Как измерить результат юзабилити-тестирования?",
    level: "Middle",
    professionSlug: "ux-ui-designer",
    categorySlug: "usability-testing",
    tags: ["UX Research"],
    snippet:
      "Тестирование даёт измеримые данные: успешность задачи, время, количество ошибок и запросов помощи.",
    tldr:
      "Измеряют долю выполненных задач, время выполнения, число ошибок и обращений за подсказкой. Найденные проблемы приоритизируют по частоте и серьёзности последствий.",
    sections: [
      {
        id: "metriki",
        heading: "Что измеряется",
        bullets: [
          "Успешность: задача выполнена без помощи",
          "Время выполнения по сравнению с прежней версией",
          "Ошибки и попытки восстановиться после них",
        ],
      },
      {
        id: "prioritet",
        heading: "Приоритизация проблем",
        paragraphs: [
          "Проблема, которая блокирует задачу у большинства участников, важнее косметической, замеченной один раз. Такой список удобно защищать перед командой: он опирается на наблюдения, а не на вкус.",
        ],
      },
    ],
  },
  {
    slug: "empty-states-design",
    title: "Как проектировать пустые состояния и состояния ошибки?",
    level: "Junior",
    professionSlug: "ux-ui-designer",
    categorySlug: "interface-patterns",
    tags: ["Интерфейсы", "Паттерны"],
    snippet:
      "Пустое состояние — не отсутствие интерфейса, а точка входа: оно объясняет причину и предлагает действие.",
    tldr:
      "Пустое состояние объясняет, почему данных нет, и даёт следующий шаг. Ошибка сообщает, что произошло, и как исправить, без технических подробностей и обвинений пользователя.",
    sections: [
      {
        id: "pustoe",
        heading: "Пустое состояние",
        bullets: [
          "Первый запуск: объяснить ценность и дать одно действие",
          "Пустой результат фильтра: показать, что именно отфильтровано, и дать сброс",
          "Ошибка загрузки: отделить её от «данных нет»",
        ],
      },
      {
        id: "oshibka",
        heading: "Состояние ошибки",
        paragraphs: [
          "Текст ошибки описывает последствие и действие: «Не удалось сохранить черновик, попробуйте ещё раз». Технический код полезен рядом мелким текстом — для поддержки.",
        ],
      },
    ],
  },
  {
    slug: "ads-campaign-metrics",
    title: "Какие метрики используются для оценки рекламной кампании?",
    level: "Junior",
    professionSlug: "performance-marketer",
    categorySlug: "ads-analytics",
    tags: ["Google Ads", "Метрики"],
    snippet:
      "Метрики выстраиваются по воронке: показы и клики отвечают за трафик, CPA и ROAS — за деньги.",
    tldr:
      "CTR и CPC описывают качество трафика, CR и CPA — эффективность воронки, ROAS и окупаемость с учётом LTV — результат для бизнеса. Решения принимают по нижним метрикам, верхние помогают понять причину.",
    sections: [
      {
        id: "voronka",
        heading: "Метрики по уровням воронки",
        bullets: [
          "Показы, CTR, CPC — попадание в аудиторию и стоимость трафика",
          "CR, CPL, CPA — способность трафика превращаться в заявки и продажи",
          "ROAS, доля рекламных расходов, окупаемость по LTV — вклад в прибыль",
        ],
      },
      {
        id: "resheniya",
        heading: "Как по ним принимать решения",
        paragraphs: [
          "Низкий CTR при нормальном CPA — повод улучшать объявления, но не отключать кампанию. Высокий CTR и дорогой CPA чаще означают несовпадение обещания и посадочной страницы.",
        ],
      },
      {
        id: "atribuciya",
        heading: "Атрибуция",
        paragraphs: [
          "Одна и та же кампания выглядит по-разному в last-click и в моделях с распределением. Сравнивать каналы можно только в одной модели атрибуции и на одном окне конверсии.",
        ],
      },
    ],
    tasks: [
      {
        id: "ads-diagnose",
        title: "Поставить диагноз кампании",
        statement: [
          "CTR вырос в два раза после смены объявлений, а количество заявок не изменилось, CPA вырос на 40%.",
          "Сформулируйте две гипотезы о причине и укажите, какие отчёты проверите первыми.",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "ads-auction",
    title: "Как работает аукцион в Google Ads?",
    level: "Middle",
    professionSlug: "performance-marketer",
    categorySlug: "ads-structure",
    tags: ["Google Ads"],
    snippet:
      "Позиция определяется не только ставкой: показатель качества может дать дешёвый показ выше конкурента.",
    tldr:
      "Место в выдаче зависит от рейтинга объявления — комбинации ставки, ожидаемого CTR, релевантности и опыта на странице. Поэтому улучшение качества снижает цену клика без роста ставки.",
    sections: [
      {
        id: "rejting",
        heading: "Рейтинг объявления",
        bullets: [
          "Ставка — максимум, который вы готовы заплатить",
          "Ожидаемый CTR — прогноз кликабельности на этом запросе",
          "Релевантность объявления и качество посадочной страницы",
        ],
      },
      {
        id: "vyvod",
        heading: "Практический вывод",
        paragraphs: [
          "Работа над структурой кампаний и соответствием «запрос — объявление — страница» удешевляет трафик надёжнее, чем повышение ставок.",
        ],
      },
    ],
  },
  {
    slug: "cac-ltv-ratio",
    title: "Как связаны CAC и LTV и когда канал считается окупаемым?",
    level: "Middle",
    professionSlug: "performance-marketer",
    categorySlug: "cac-ltv",
    tags: ["Юнит-экономика"],
    snippet:
      "Канал окупается, когда прибыль с клиента превышает стоимость его привлечения в приемлемый срок.",
    tldr:
      "CAC — все затраты на привлечение, поделённые на число клиентов. LTV считают по маржинальной прибыли, а не по выручке. Важны и отношение LTV к CAC, и срок возврата вложений.",
    sections: [
      {
        id: "raschet",
        heading: "Что входит в расчёт",
        bullets: [
          "В CAC — рекламный бюджет, работа команды и сервисы, а не только клики",
          "В LTV — маржа, а не выручка, и реальный срок жизни клиента",
          "Отдельно считают срок окупаемости: деньги нужны раньше, чем LTV реализуется",
        ],
      },
      {
        id: "resheniya",
        heading: "Решения по каналу",
        paragraphs: [
          "Отношение LTV/CAC около единицы означает работу без прибыли. Но и высокое отношение при окупаемости в два года может не подойти компании без запаса денег.",
        ],
      },
    ],
    tasks: [
      {
        id: "unit-check",
        title: "Проверить окупаемость",
        statement: [
          "Канал даёт клиентов по CAC 3000 ₽. Средний чек 2500 ₽, маржинальность 40%, клиент делает 4 покупки за год.",
          "Посчитайте LTV по марже, отношение LTV/CAC и срок окупаемости в покупках.",
        ],
        hint: "Маржа с покупки — 1000 ₽, значит вложения возвращаются на третьей покупке.",
      },
    ],
  },
  {
    slug: "backlog-prioritization",
    title: "Как вы приоритизируете задачи в бэклоге?",
    level: "Middle",
    professionSlug: "product-manager",
    categorySlug: "prioritization",
    tags: ["Продукт", "Приоритизация"],
    snippet:
      "Фреймворк не принимает решение за менеджера: он делает аргументы сравнимыми и обсуждаемыми.",
    tldr:
      "Задачи сравнивают по ожидаемому влиянию на цель, стоимости и уверенности в оценке. Фреймворки вроде RICE помогают вести разговор, но требуют честных данных и пересмотра после релизов.",
    sections: [
      {
        id: "podhod",
        heading: "Основа приоритизации",
        bullets: [
          "Влияние на выбранную цель квартала, а не на абстрактную пользу",
          "Стоимость: разработка, поддержка и риск усложнения продукта",
          "Уверенность: есть ли данные или только мнение",
        ],
      },
      {
        id: "obsuzhdenie",
        heading: "Работа со стейкхолдерами",
        paragraphs: [
          "Прозрачные критерии переводят спор «моя задача важнее» в обсуждение оценок. Если задача попадает в работу вне порядка, стоит явно назвать, что уходит из плана.",
        ],
      },
    ],
    tasks: [
      {
        id: "priority-defense",
        title: "Защитить порядок работ",
        statement: [
          "Коммерческий директор требует срочную интеграцию для одного клиента, в плане — работа над оттоком.",
          "Опишите, какие данные соберёте и как сформулируете решение, чтобы оно было проверяемым.",
        ],
      },
    ],
    popular: true,
  },
  {
    slug: "financial-statements-link",
    title: "Как связаны P&L, баланс и отчёт о движении денежных средств?",
    level: "Middle",
    professionSlug: "financial-analyst",
    categorySlug: "financial-statements",
    tags: ["Отчётность", "Финансы"],
    snippet:
      "Прибыль в отчёте и деньги на счёте — разные величины: их связывает изменение баланса.",
    tldr:
      "P&L показывает начисленный результат, ДДС — фактические движения денег, баланс — состояние на дату. Прибыль сходится с денежным потоком через изменения запасов, дебиторки, кредиторки и амортизацию.",
    sections: [
      {
        id: "svyaz",
        heading: "Точки связи",
        bullets: [
          "Чистая прибыль из P&L попадает в капитал в балансе",
          "Амортизация уменьшает прибыль, но не уменьшает деньги",
          "Рост дебиторки означает признанную выручку без поступления денег",
        ],
      },
      {
        id: "praktika",
        heading: "Зачем ��то на собеседовании",
        paragraphs: [
          "Компания с прибылью может не иметь денег на зарплату — из-за отсрочек и запасов. Умение объяснить этот разрыв важнее, чем знание форм отчётности.",
        ],
      },
    ],
    tasks: [
      {
        id: "cash-gap",
        title: "Объяснить разрыв",
        statement: [
          "Прибыль за квартал — 5 млн, денег на счёте стало меньше на 2 млн.",
          "Назовите четыре возможные причины и укажите, где в отчётности их искать.",
        ],
      },
    ],
  },
  {
    slug: "structured-interview",
    title: "Что такое структурированное интервью и зачем оно нужно?",
    level: "Junior",
    professionSlug: "recruiter",
    categorySlug: "candidate-assessment",
    tags: ["Найм", "Интервью"],
    snippet:
      "Одинаковые вопросы и заранее описанные критерии делают сравнение кандидатов возможным.",
    tldr:
      "В структурированном интервью список компетенций, вопросы и шкала оценки заданы заранее и одинаковы для всех кандидатов. Это снижает влияние симпатии и позволяет сравнивать людей, а не впечатления.",
    sections: [
      {
        id: "ustroystvo",
        heading: "Как устроено",
        bullets: [
          "Компетенции выводятся из задач роли, а не из шаблона вакансии",
          "Под каждую компетенцию — вопросы о прошлом опыте и признаки уровней",
          "Оценка ставится по шкале сразу после интервью, до обсуждения с коллегами",
        ],
      },
      {
        id: "effekt",
        heading: "Что это даёт",
        paragraphs: [
          "Решение опирается на записанные наблюдения, поэтому его можно объяснить кандидату и заказчику. Заодно уменьшается влияние первого впечатления и похожести на интервьюера.",
        ],
      },
    ],
    tasks: [
      {
        id: "competency-questions",
        title: "Собрать вопросы под компетенцию",
        statement: [
          "Роль: менеджер поддержки. Компетенция — работа с конфликтным клиентом.",
          "Напишите три вопроса о прошлом опыте и опишите признаки сильного и слабого ответа.",
        ],
      },
    ],
  },
];

/* Заглушки RECENT_SEARCHES и OVERLAY_TOPICS из макета удалены: оверлей поиска
   берёт недавние запросы из lib/recent.ts, а темы — из getTopicPills(). */
