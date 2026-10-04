# メモ化と React Compiler

手動メモ化を書くか外すかの判定と、React Compiler の診断の読み方を持つ。

| 決定                                                       | ADR      |
| ---------------------------------------------------------- | -------- |
| メモ化は React Compiler に委ね、予防的なメモ化を強制しない | ADR-0014 |

## explanation

### React Compiler が見ない箇所

Compiler はコンポーネントか hook として認識した関数しか最適化しない。テーブルの列定義のように、コンポーネントでも hook でもない定義は最適化されないまま動く。
これは仕様どおりの挙動で、欠陥として扱わない (ADR-0014)。

### 手でメモ化する場面を 2 つにする理由

Compiler を入れたコードでも、`useMemo` / `useCallback` は「どの値をメモ化するか」を制御する escape hatch として残る。公式は、新しいコードでもメモ化を Compiler に任せつつ、精密な制御が要る箇所では `useMemo` / `useCallback` を使うよう勧め、その典型に effect の依存を挙げる。依存が意味の上で変わらないのに effect が走り直すのを防ぐ使い方である ([React docs「React Compiler」][] の What should I do about useMemo, useCallback, and React.memo?)。
性能の問題が出た箇所だけに限ると、この使い方を締め出す。effect の依存は性能ではなく、effect がいつ走るかという挙動に関わるからである。

### effect の依存をメモ化より先に外す理由

`useMemo` は性能の最適化で、値が保たれることを保証しない。公式は "since `useMemo` is performance optimization, not a semantic guarantee, React may throw away the cached value if there is a specific reason to do that. This will also cause the effect to re-fire, so it's even better to remove the need for a function dependency" と書き、object を effect の中へ移す形を示す ([React docs「useMemo」][] の Preventing an Effect from firing too often)。キャッシュを捨てる場面は Caveats が挙げ、開発中の編集と初回 mount 中の suspend がある (同 Caveats)。`useCallback` にも同じ節があり、関数を effect の中へ移す形を "even better" とする ([React docs「useCallback」][] の Preventing an Effect from firing too often)。

## how-to

### 手動メモ化を書く

新しいコードのメモ化は Compiler に任せ、予防的に `useMemo` / `useCallback` を書かない (ADR-0014)。手で書くのは次の 2 つの場面だけにする。理由は「手でメモ化する場面を 2 つにする理由」にある。

| 場面                                               | 書き方                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 性能の問題が実際に出た箇所                         | 問題の出た値か関数を `useMemo` / `useCallback` で包む                                                                                                                                                                                                                                                                                                                                                                                |
| 値の同一性を精密に制御する箇所 (effect の依存など) | 上から順に当てる。まず依存を外す: 関数や object を effect の中へ移す、最新の値を読むだけなら `useEffectEvent` へ切り出す ([React docs「useEffect」][] の My Effect runs after every re-render、[React docs「useCallback」][] の Preventing an Effect from firing too often)。外せないときに最後の手段として `useMemo` / `useCallback` で包む ([React docs「useEffect」][] の同じ節)。理由は「effect の依存をメモ化より先に外す理由」 |

- キャッシュが捨てられると壊れる値は `useMemo` に持たず、state か ref に持つ。React は開発中の編集や初回 mount 中の suspend でキャッシュを捨てる ([React docs「useMemo」][] の Caveats)

### 手動メモ化を外すか判定する

既存の `useMemo` / `useCallback` は、撤去の前後でコンパイル出力が悪化しないことを測れた箇所だけ外す (ADR-0014「手動メモ化を残す条件」)。
Compiler がメモ化のスコープを作るのは、値の identity を同じコンパイル単位の中で観測できるときに限られる。カスタム hook の返り値へ入るだけの導出は消費側が見えず、スコープが粗くなる。一括で外すと依存のガードを失い、劣化が下流へ連鎖する。ガードの数が同じでもスコープが融合して依存の集合が広がることがあり、どちらも外形からは読み取れない。

撤去の前後でコンパイルし、次の 3 つを比べる。1 つでも悪化したら外さない。

| 指標           | 悪化の条件 |
| -------------- | ---------- |
| 依存ガードの数 | 減った     |
| 依存比較の総数 | 増えた     |
| mount 時の固定 | 減った     |

```js
import { transformSync } from "oxc-transform-react";
const { code } = transformSync(filename, source, {
  lang: filename.endsWith(".tsx") ? "tsx" : "ts",
});
const guards = (code.match(/if \(\$\[\d+\] !==/g) ?? []).length;
const deps = (code.match(/\$\[\d+\] !==/g) ?? []).length;
const sentinels = (code.match(/memo_cache_sentinel/g) ?? []).length;
```

- 依存比較の総数を見るのは、スコープが融合して依存の集合が広がる劣化を捕まえるためである。ガードの数だけでは取りこぼす
- コンパイル出力の diff は判定に使えない。メモ化が保たれていても、出力は必ず変わる
- `useEffect` の依存へ流れる値は、指標とは別に確かめる。識別子ではなく正しさに関わる
- `src/components/ui/` は ADR-0020 の統制下なので、判定の対象にせず改変しない

### React Compiler の診断を読む

- bail out は `vp build` のログに出る (`compiler.logDiagnostics`)。ログの行は `[plugin vite:react-compiler]` で始まり、`error` / `warn` を含まない。`react-compiler` で grep する
- `react-compiler(Todo)` の診断は、Compiler が未対応の構文に当たり、その関数の最適化を諦めたことを示す。ビルドは止まらず、その関数だけがコンパイル前のまま動く ([React docs「panicThreshold」][] の `'none'`)。コードの誤りではないので、診断を消すために書き換えず、その関数で性能の問題が実際に出たときに限って手を入れる (ADR-0014)。ログの `help:` 行は書き換えを案内するが、Todo では従わない。`src/components/ui/` に出たものは書き換えない。ADR-0020「追加と削除の基準」は性能を改変の理由に含めない
- `vp lint -D react/todo` は同じ bail out を file:line つきで報告する (2026-09-02 に同じツリーで件数が一致)。`oxc-transform-react` が非 fatal の診断をビルドログへ出さなくなったときは、こちらをその場で叩く。`react/todo` は設定で有効にしない (ADR-0014「bail out を lint で報告しない」)
- Compiler の適用が壊れたら、`@vitejs/plugin-react` と `oxc-transform-react` を前の版へ揃えて下げる。babel の経路へは戻さない (ADR-0014)

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[React docs「React Compiler」]: https://react.dev/learn/react-compiler/introduction
[React docs「useEffect」]: https://react.dev/reference/react/useEffect
[React docs「useCallback」]: https://react.dev/reference/react/useCallback
[React docs「useMemo」]: https://react.dev/reference/react/useMemo
[React docs「panicThreshold」]: https://react.dev/reference/react-compiler/panicThreshold
