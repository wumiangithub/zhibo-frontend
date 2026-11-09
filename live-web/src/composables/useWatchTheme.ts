import { computed, ref, type Ref } from "vue";

export type WatchTheme = "light" | "dark";

const STORAGE_KEY = "lw-watch-theme";

function isWatchTheme(v: unknown): v is WatchTheme {
  return v === "light" || v === "dark";
}

function readStoredTheme(): WatchTheme {
  if (typeof localStorage === "undefined") return "light";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isWatchTheme(raw) ? raw : "light";
  } catch {
    return "light";
  }
}

function writeStoredTheme(next: WatchTheme) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore quota / private mode */
  }
}

/** 模块级单例：直播页 / 回放页 / 底 sheet / 两个工具栏共享 */
const theme: Ref<WatchTheme> = ref(readStoredTheme());

export function useWatchTheme() {
  const isLight = computed(() => theme.value === "light");

  function setTheme(next: WatchTheme) {
    if (!isWatchTheme(next)) return;
    theme.value = next;
    writeStoredTheme(next);
  }

  function toggleTheme() {
    setTheme(theme.value === "light" ? "dark" : "light");
  }

  return {
    theme,
    isLight,
    setTheme,
    toggleTheme,
  };
}
