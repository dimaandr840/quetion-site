export const THEME_STORAGE_KEY = "devprep-theme";

/** Скрипт применяет сохранённую тему до первой отрисовки, чтобы избежать мигания. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
