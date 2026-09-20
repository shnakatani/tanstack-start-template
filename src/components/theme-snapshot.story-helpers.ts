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
/**
 * `import.meta.hot` のうち、この store が使う部分だけ。Vitest は `server.hmr: false` で
 * 実イベントを配らないため、差し替えられないと HMR の経路をテストで固定できない
 */
export interface UpdateNotifier {
  on: (event: "vite:afterUpdate", callback: () => void) => void;
  off: (event: "vite:afterUpdate", callback: () => void) => void;
}

export interface ThemeSnapshotStore<T> {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
}

/**
 * `read` の結果をテーマごとに 1 回だけ計算して配る。`getSnapshot` は同じテーマの間は
 * 同じ参照を返す必要があるため (返さないと React が無限に再 render する)、class をキーに
 * 覚えておく。
 *
 * キーには世代も混ぜる。class は「読み取り結果が古くなったこと」の代理だが、CSS の HMR は
 * stylesheet の中身だけを差し替えて class を動かさないため、代理が破れる。React は
 * `Object.is` で snapshot を比べて再 render の要否を決めるので、class だけをキーにすると
 * 購読していても同じ参照が返り、再 render に至らない (React 公式「How you determine whether
 * mutable data has changed depends on your mutable store」)。
 */
export function createThemeSnapshotStore<T>(
  read: () => T,
  fallback: T,
  root: () => Element = () => document.documentElement,
  hot: UpdateNotifier | undefined = import.meta.hot,
): ThemeSnapshotStore<T> {
  let cache: { key: string; value: T } | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();
  let observer: MutationObserver | null = null;

  // 変更の契機は store に 1 つだけ置き、そこから購読者へ配る。購読者ごとに観測すると、
  // 1 回の変更で購読者の数だけ世代が進み、その数だけ read が走る
  const notify = (): void => {
    // 世代を進めてから配る。進めないと getSnapshot がキャッシュを返し、React は
    // 変化なしと見て再 render を見送る
    generation += 1;
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      if (listeners.size === 1) {
        observer = new MutationObserver(notify);
        observer.observe(root(), { attributes: true, attributeFilter: ["class"] });
        // CSS の HMR は stylesheet の中身だけを差し替えるので、class の MutationObserver
        // では拾えない。値は stylesheet から読んでいるため、読み直さないとカタログが古い
        // まま残る。vite:afterUpdate は CSS の load 完了後に発火するので、この時点の CSSOM
        // は新しい (vitejs/vite#9810)。本番では import.meta.hot が無く、購読ごと落ちる
        hot?.on("vite:afterUpdate", notify);
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          observer?.disconnect();
          observer = null;
          hot?.off("vite:afterUpdate", notify);
        }
      };
    },
    getSnapshot: () => {
      const key = `${generation} ${root().className}`;
      if (cache === null || cache.key !== key) {
        cache = { key, value: read() };
      }
      return cache.value;
    },
    // 描画前は読む対象が無い。空を返して mount 後の最初の snapshot に委ねる
    getServerSnapshot: () => fallback,
  };
}
