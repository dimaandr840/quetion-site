package com.devprep.api.service;

import java.util.Locale;
import java.util.Map;

/**
 * Сборка slug из произвольного названия.
 *
 * <p>Тему и направление админ называет по-русски, а адрес страницы обязан быть латинским: он
 * попадает в URL, в ссылки вопросов и в индекс поиска. Раньше транслитерация жила только в
 * браузере, а бэкенд отвечал 400 на всё, что не совпало с {@code [a-z0-9-]}: достаточно было
 * поправить поле «Адрес страницы» руками, и создание темы ломалось без внятной причины.
 * Теперь адрес нормализует сервер, поэтому название может быть любым.
 */
public final class Slugs {

    /** Совпадает с длиной колонки slug в базе. */
    public static final int MAX_LENGTH = 64;

    private static final Map<Character, String> TRANSLIT =
            Map.ofEntries(
                    Map.entry('а', "a"),
                    Map.entry('б', "b"),
                    Map.entry('в', "v"),
                    Map.entry('г', "g"),
                    Map.entry('д', "d"),
                    Map.entry('е', "e"),
                    Map.entry('ё', "e"),
                    Map.entry('ж', "zh"),
                    Map.entry('з', "z"),
                    Map.entry('и', "i"),
                    Map.entry('й', "y"),
                    Map.entry('к', "k"),
                    Map.entry('л', "l"),
                    Map.entry('м', "m"),
                    Map.entry('н', "n"),
                    Map.entry('о', "o"),
                    Map.entry('п', "p"),
                    Map.entry('р', "r"),
                    Map.entry('с', "s"),
                    Map.entry('т', "t"),
                    Map.entry('у', "u"),
                    Map.entry('ф', "f"),
                    Map.entry('х', "h"),
                    Map.entry('ц', "c"),
                    Map.entry('ч', "ch"),
                    Map.entry('ш', "sh"),
                    Map.entry('щ', "sch"),
                    Map.entry('ъ', ""),
                    Map.entry('ы', "y"),
                    Map.entry('ь', ""),
                    Map.entry('э', "e"),
                    Map.entry('ю', "yu"),
                    Map.entry('я', "ya"));

    private Slugs() {}

    /** Латинский slug из любой строки. Пустой результат означает, что собирать было нечего. */
    public static String slugify(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        for (char symbol : value.toLowerCase(Locale.ROOT).toCharArray()) {
            String replacement = TRANSLIT.get(symbol);
            if (replacement != null) {
                builder.append(replacement);
            } else if ((symbol >= 'a' && symbol <= 'z') || (symbol >= '0' && symbol <= '9')) {
                builder.append(symbol);
            } else {
                builder.append('-');
            }
        }
        return normalize(builder.toString());
    }

    /**
     * Первый непустой вариант: присланный slug, затем транслитерация названия, затем префикс со
     * временной меткой. Последний случай — названия из одних эмодзи или иероглифов: адрес всё
     * равно нужен, а отказывать в создании темы из-за него неправильно.
     */
    public static String slugify(String preferred, String fallbackTitle, String fallbackPrefix) {
        String fromPreferred = slugify(preferred);
        if (!fromPreferred.isEmpty()) {
            return fromPreferred;
        }
        String fromTitle = slugify(fallbackTitle);
        if (!fromTitle.isEmpty()) {
            return fromTitle;
        }
        return fallbackPrefix + "-" + Long.toString(System.currentTimeMillis(), 36);
    }

    /** Тот же slug с числовым хвостом — для разрешения коллизий. */
    public static String withSuffix(String slug, int suffix) {
        String tail = "-" + suffix;
        String head =
                slug.length() + tail.length() > MAX_LENGTH
                        ? slug.substring(0, MAX_LENGTH - tail.length())
                        : slug;
        return normalize(head) + tail;
    }

    /** Схлопывает дефисы и обрезает по длине так, чтобы адрес не кончался дефисом. */
    private static String normalize(String value) {
        String slug = value.replaceAll("-{2,}", "-").replaceAll("^-+|-+$", "");
        if (slug.length() > MAX_LENGTH) {
            slug = slug.substring(0, MAX_LENGTH).replaceAll("-+$", "");
        }
        return slug;
    }
}
