# メモ化と React Compiler

手動メモ化を書くか外すかの判定と、React Compiler の診断の読み方を持つ。

| 決定                                                       | ADR      |
| ---------------------------------------------------------- | -------- |
| メモ化は React Compiler に委ね、予防的なメモ化を強制しない | ADR-0014 |

## explanation

### React Compiler が見ない箇所

Compiler はコンポーネントか hook として認識した関数しか最適化しない。テーブルの列定義のように、コンポーネントでも hook でもない定義は最適化されないまま動く。
これは仕様どおりの挙動で、欠陥として扱わない (ADR-0014)。

## how-to

### 手動メモ化を書く

新しいコードで予防的に `useMemo` / `useCallback` を書かない。性能の問題として実際に現れた箇所だけを手でメモ化する (ADR-0014)。

### 手動メモ化を外すか判定する

既存の `useMemo` / `useCallback` は、撤去の前後でコンパイル出力が悪化しないことを測れた箇所だけ外す (ADR-0014 の決定 4)。
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
- `vp lint -D react/todo` は同じ bail out を file:line つきで報告する (2026-09-02 に同じツリーで件数が一致)。`oxc-transform-react` が非 fatal の診断をビルドログへ出さなくなったときは、こちらをその場で叩く。`react/todo` は設定で有効にしない (ADR-0014 の決定 3)
- Compiler の適用が壊れたら、`@vitejs/plugin-react` と `oxc-transform-react` を前の版へ揃えて下げる。babel の経路へは戻さない (ADR-0014)
