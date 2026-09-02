# ADR-0009: メモ化は React Compiler に委ね、予防的なメモ化を強制しない

- Status: Accepted
- Date: 2026-08-17
- Revised: 2026-09-02 (Compiler の適用を babel から oxc ネイティブへ移し、bail out の扱いをビルドログへ変更。`react/react-compiler` 廃止に伴う lint ルールの指定も書き換えた)
- 関連: ADR-0004 (React Compiler ルールの選定基準)、ADR-0005 (依存の待機と pin の一般則)、ADR-0006 (registry コードは改変しない)

## Context

「JSX の prop に新しい参照を渡すな」という型の lint ルール群 (`react-perf` 系) は、効果の有無を区別せず全箇所へ予防的なメモ化を強制する。
メモ化が実際に効果を持つのは React 公式が挙げる 2 つの場面に限られる。

> Caching a function with `useCallback` is only valuable in a few cases:
>
> - You pass it as a prop to a component wrapped in `memo`.
> - The function you're passing is later used as a dependency of some Hook.

前者は base-ui が render 要素を毎レンダー `cloneElement` で複製し primitive も `memo` を持たないため成立しない。
公式の lint 体系にも対応物がない。`eslint-plugin-react-hooks` v7 のルールは Rules of React の強制と、Compiler がサポートしない構文の検出と、手動メモ化との整合に分かれ、「prop に新しい参照を渡すな」型のルールは 1 つも無い。

## Decision

**React Compiler を `infer` モードで導入し、予防的なメモ化を強制する lint プラグインを積まない。**

| #   | 決定                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `@vitejs/plugin-react` の `compiler` オプション (`oxc-transform-react`) で Compiler を適用し、`compilationMode` は既定の `infer` を使う。babel は経路から外す         |
| 2   | `react-perf` などメモ化を強制するプラグインを `lint.plugins` に置かない                                                                                               |
| 3   | 分割後の React Compiler ルールは `correctness` / `perf` のカテゴリ経由と `react/unsupported-syntax` の名指しで入れる。bail out を報告する `react/todo` は有効にしない |
| 4   | 手動メモ化を外すのは、撤去前後でコンパイル出力が悪化しないことを実測できた箇所だけとする                                                                              |
| 5   | Compiler がカバーしない箇所を欠陥として扱わない。判断は実測された性能劣化で行い、予防的なメモ化は入れない                                                             |
| 6   | bail out は `compiler.logDiagnostics` でビルドログへ出す。期待値として固定する検査は持たない                                                                          |

### 手動メモ化を残す条件 (決定 4)

React チームは既存コードの手動メモ化を残すよう推奨している。
Compiler がメモ化スコープを作るのは値の identity を同じコンパイル単位の中で観測できるときに限られ、カスタム hook の返り値へ入るだけの導出は消費側が見えずスコープが粗くなる。
一括で外すと依存ガードを失い、劣化が下流へ連鎖する。ガード数が同じでもスコープが融合して依存集合が広がることもあり、どちらの劣化も外形からは読み取れない。

撤去の前後でコンパイルし、次の 3 つを比べる。1 つでも悪化したら撤去しない。

| 指標           | 悪化の条件 |
| -------------- | ---------- |
| 依存ガード数   | 減った     |
| 依存比較の総数 | 増えた     |
| mount 時固定   | 減った     |

```js
import { transformSync } from "oxc-transform-react";
const { code } = transformSync(filename, source, {
  lang: filename.endsWith(".tsx") ? "tsx" : "ts",
});
const guards = (code.match(/if \(\$\[\d+\] !==/g) ?? []).length;
const deps = (code.match(/\$\[\d+\] !==/g) ?? []).length;
const sentinels = (code.match(/memo_cache_sentinel/g) ?? []).length;
```

依存比較の総数を見るのは、スコープが融合して依存集合が広がる劣化を捕まえるためである。ガード数だけでは取りこぼす。
コンパイル出力の diff は判定に使えない。メモ化が保たれていても出力は必ず変わる。
`useEffect` の依存へ流れる値は識別子ではなく正しさに関わるため、指標と別に確認する。

registry コード (`src/components/ui/`) は ADR-0006 の統制対象なので、この判定の対象にせず改変しない。

### bail out をビルドログへ出す (決定 6)

`viteReact({ compiler: { logDiagnostics: true } })` で、Compiler が諦めた箇所をビルドログへ出す。
既定は `false` で、最適化が外れたことがどこにも現れない。
`result.fatal` が立つ診断は `logDiagnostics` によらず transform を失敗させ、ビルドが落ちる (`@vitejs/plugin-react` の `dist/index.js` が `this.error` を呼ぶ)。ただし fatal になるのはパース・意味解析・オプション検証の失敗で、Compiler 自身の診断は `panicThreshold` の既定 `none` により recoverable に留まる。

bail out の一覧を期待値として固定する検査 (`scripts/checks/source/react-compiler.test.ts`) は 2026-09-02 に撤去した。理由は 3 つある。

| 理由                               | 内容                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 直さない検査だった                 | 落ちてもコードは直さず期待値を書き換えるだけになる (決定 5)。修正義務のない赤信号は、上流更新のたびに文言と件数で鳴る。実際、babel から oxc へ移した時点で bail out の件数が変わった |
| 守ると謳った経路を守っていなかった | 検査は Compiler を直接呼び、`vite.config.ts` を読まない。`compiler` オプションを外しても検査は緑のままになる                                                                         |
| 残りは他が見ている                 | パース・意味解析の失敗はビルドが落ちる。パッケージの欠落も `config` フックが `this.error` を投げる                                                                                   |

初版 (2026-08-17) がこの検査を置いた動機は、`@babel/core` 8 系が最適化を silent に落とすことだった。babel を経路から外した決定 1 で、その動機は消えている。

### bail out を lint で報告しない (決定 3)

oxlint 1.79 で `react/react-compiler` と `reportAllBailouts` は廃止され、診断は 22 のルールへ分割された。
未実装による bail out は `react/todo` が担う (カテゴリ分けと選定の基準は ADR-0004)。

`react/todo` を `"error"` にすると bail out を修正すべき違反として扱うことになり、決定 5 と矛盾する。原因は Compiler の未実装でありコードの誤りではない。
`vp lint -D react/todo` が報告するのは registry コードだけで、ADR-0006 により書き換えない (2026-09-02 確認)。件数は上流の追随で動くため、必要なときにこのコマンドで数える。

このコマンドは `logDiagnostics` の退路でもある。2026-09-02 に両方を同じツリーで走らせると、`vp build` のログと `vp lint -D react/todo` は同じ bail out を同じ数だけ報告し、後者は file:line まで出した。`oxc-transform-react` が非 fatal の Compiler 診断を `errors` から外したときは、ビルドログの代わりにこれをオンデマンドで叩く。
`"warn"` にもできない。`vp check` は warn を exit 0 で通すため、gate に載らないルールは設定してあるだけの状態になる。

`react/unsupported-syntax` は分けて扱い `"error"` で入れる。
こちらが指すのは Compiler が対応する予定のない構文 (`this` / `with` / インライン `class` 宣言) で、書き換えれば消えるためコード側の欠陥として扱える。

### 検討した選択肢

| 案                                           | 評価                                                                                                                        | 採否     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| Compiler 導入 + 予防的メモ化ルールを積まない | 指摘の大半を Compiler が自動で担い、手作業がゼロになる。代償はビルド時間の増加                                              | **採用** |
| メモ化ルールを有効にして全箇所を修正         | Compiler 環境では推奨形の方がコンパイル出力が大きくなる。base-ui の `render` prop 標準形にも反する                          | 却下     |
| `compilationMode: "annotation"` で段階導入   | 対象が `"use memo"` を書いた関数に限られ、ルールを積まない根拠 (全関数が対象) が成り立たない                                | 却下     |
| Compiler の適用を oxc ネイティブで行う       | `@vitejs/plugin-react` 6.1 の `compiler` オプションで babel を経路から外せる。experimental だが退避は版を下げるだけで足りる | **採用** |
| Compiler の適用を babel で行う               | 2026-08-17 の初版で採った経路。`@babel/core` が 8 系で最適化を silent に落とすため major の停止が要り、ビルドも延びる       | 却下     |
| bail out をビルドログへ出す                  | 見えるのは処理を試みて失敗した箇所だけで、対象外の関数はイベントすら出ない。それでも維持コストがゼロなので採る              | **採用** |
| bail out の一覧を検査で固定する              | 落ちてもコードは直さず期待値を更新するだけになる (決定 5)。検査自体も `vite.config.ts` の配線を見ていなかった               | 却下     |

## Consequences

- Compiler の適用は experimental な機能に乗る (`@vitejs/plugin-react` の README が明記)。壊れたときの退避は `@vitejs/plugin-react` と `oxc-transform-react` を前の版へ揃えて下げることで行い、babel へは戻さない
- `package.json` から babel を外しても install からは消えない。`@vitejs/plugin-react` の optional peer として `@rolldown/plugin-babel` と `babel-plugin-react-compiler` と `@babel/core` が lockfile に残る (2026-09-02 実測: `vp why babel-plugin-react-compiler` が plugin-react 経由で解決する)。プロジェクト root からは解決できないので (`require.resolve` が `MODULE_NOT_FOUND`)、`vite.config.ts` から使うことはできない
- Compiler は client 環境だけで走る。自前コードの SSR 出力にメモ化は入らない (2026-09-02 実測: `grep -c useMemoCache .output/server/_ssr/ssr.mjs` が 0)。`.output/server/_libs/` にはコンパイル済みで配布される base-ui と react-router が入るため、`.output/server` を丸ごと grep すると当たる。単一レンダーの経路なのでメモ化の効きどころが無い
- `oxc-transform-react` は `@vitejs/plugin-react` の optional peer で、宣言された範囲 (`^0.145.0`) が上流自身の devDependency (`^0.147.0`) より狭い。範囲の是正までは `pnpm-workspace.yaml` の `peerDependencyRules` で受ける
- bail out はビルドログにしか出ない。増減はゲートにならず、気づくのはログを読んだときになる。決定 5 が bail out を欠陥として扱わないので、この非対称は意図どおりである
- Compiler が黙って外れる経路 (`vite.config.ts` から `compiler` オプションが消える) を機械で見張るものは無い。塞ぐならビルド成果物を見る検査が要る
- Compiler がカバーしない箇所 (コンポーネントでも hook でもない定義、たとえばテーブルの column 定義) は最適化されないまま動く。仕様どおりの挙動であり、性能問題として顕在化した箇所だけ手でメモ化する
- 新しいコードでは手動メモ化を書かない。既にあるものは決定 4 の判定を通してから外す
- 「Select の `items` prop」のように、メモ化が正しさや依存ガードに効く箇所は規範として rules 側に残る。Compiler への委譲はそれを否定しない
- Rules of React の検査を外すと Compiler が bail out する土壌ができる。分割後のルール群は導入の前提として据え置く
- `compiler` オプションが experimental でなくなったら決定 1 を見直す。`peerDependencyRules` の緩和の出口条件は `pnpm-workspace.yaml` のコメントが持つ

## 出典

- React Compiler installation: https://react.dev/learn/react-compiler/installation
- useCallback (メモ化が価値を持つ 2 条件): https://react.dev/reference/react/useCallback
- eslint-plugin-react-hooks のルール一覧: https://react.dev/reference/eslint-plugin-react-hooks
- 既存コードの手動メモ化を残す推奨: https://github.com/reactwg/react-compiler/discussions/16
- bail out を lint で報告しない設計: https://github.com/reactwg/react-compiler/discussions/24
- `@babel/core` 8 系のバグ (babel 経路を却下する根拠): https://github.com/facebook/react/issues/36868
- 診断が 1 ルールに束ねられていた件と、その解消 (per-category ルールへの分割): https://github.com/oxc-project/oxc/issues/23538 / https://oxc.rs/blog/2026-08-18-react-compiler-support
- oxc ネイティブ統合の追加 (`compiler` オプションと `oxc-transform-react`): https://github.com/vitejs/vite-plugin-react/pull/1419
- `@vitejs/plugin-react` の React Compiler ドキュメント (native 版が experimental であること): https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#react-compiler
