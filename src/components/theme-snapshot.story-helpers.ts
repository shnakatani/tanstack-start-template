/**
 * `<html>` の class (light/dark) をキーに、テーマごとの読み取り結果を配る外部ストア。
 *
 * CSSOM や `getComputedStyle` から読んだ値は React の依存に現れない。再 render だけでは
 * React Compiler がメモ化した結果を返して値が止まるため、購読の仕組みが要る (ADR-0022)。
 *
 * story を `key` で remount する形は採らない。`withThemeByClassName` は `STORY_RENDERED`
 * 後の `useEffect` で class を当てるので、class の変化は常に play function より後に来る。
 * そこで remount すると play が作った状態を捨てることになる (2026-09-20 実測)。
 */
export interface ThemeSnapshotStore<T> {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
}

/**
 * `read` の結果をテーマごとに 1 回だけ計算して配る。`getSnapshot` は同じテーマの間は
 * 同じ参照を返す必要があるため (返さないと React が無限に再 render する)、class をキーに
 * 覚えておく。
 */
export function createThemeSnapshotStore<T>(
  read: () => T,
  fallback: T,
  root: () => Element = () => document.documentElement,
): ThemeSnapshotStore<T> {
  let cache: { key: string; value: T } | null = null;

  return {
    subscribe: (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(root(), { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    getSnapshot: () => {
      const key = root().className;
      if (cache === null || cache.key !== key) {
        cache = { key, value: read() };
      }
      return cache.value;
    },
    // 描画前は読む対象が無い。空を返して mount 後の最初の snapshot に委ねる
    getServerSnapshot: () => fallback,
  };
}
