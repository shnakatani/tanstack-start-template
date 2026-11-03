# ADR-0048: tsconfig の `verbatimModuleSyntax` を無効にし、型にだけ使う import から server のモジュールを client の bundle に入れない

- Status: Accepted
- Date: 2026-11-04
- 関連: ADR-0010 (`importProtection` の遮断の範囲)、ADR-0014 (React Compiler を `@vitejs/plugin-react` の `compiler` で当てる)、ADR-0047 (tsconfig を app・server・Node に分ける)、ADR-0007 (lint のルールの選定基準)

## Context

TanStack Start の docs「Build from Scratch」は "Enabling `verbatimModuleSyntax` can result in server bundles leaking into client bundles. It is recommended to keep this option disabled." と書く。TanStack CLI の雛形も、Start を選んだときは `"verbatimModuleSyntax": false` を書く。

### 漏れる仕組み

TypeScript の docs は、この option のもとでは "any imports or exports without a `type` modifier are left around." と書き、`import { type xyz } from "xyz";` が `import {} from "xyz";` に書き換わる例を示す。Vite は tsconfig のこの option を Oxc の変換に渡す (Vite docs「TypeScript Compiler Options」の "Other Compiler Options Affecting the Build Result")。
残った import の先のモジュールは client の bundle に入り、トップレベルの処理 (`process.env` の読み出し、接続の初期化) が client で走る。

vite-plus 1.4.0 の `transformWithOxc` で、同じ入力を option の値ごとに変換した (2026-11-04)。

| import の書き方                                          | `true` の出力                                            | `false` の出力 |
| -------------------------------------------------------- | -------------------------------------------------------- | -------------- |
| `import type { T } from "m"`                             | 消える                                                   | 消える         |
| `import { type T } from "m"`                             | `import "m"` が残る                                      | 消える         |
| `import { v } from "m"` で、`v` を `typeof v` にだけ使う | `import { v } from "m"` が残る                           | 消える         |
| `import { T } from "m"` で、`T` が interface             | `import { T } from "m"` が残る。型検査は TS1484 で止める | 消える         |

server function の宣言のファイルでも同じことが起きる。Start のコンパイラは client の build で handler を RPC の stub に置き換え、`type` の付いた specifier を外してから、使われなくなった import を消す (`@tanstack/router-utils` の `stripTypeExports`、TanStack/router#6582)。
handler の外で `typeof v` を書くと、コンパイラはこの import を消さず、`true` のときは Oxc もそれを残す (「テンプレートでの実測」の表)。
TanStack/router#3401 のコメントが説明する経路 (`import { v, type T }` の `v` を handler だけが使う) は、この `stripTypeExports` で塞がった。

TanStack/router#7806 で、メンテナは "it's not that we dont "support" it. it can be used but could cause those leaks if types are imported from modules that have server only code" と書いた。
docs「Import Protection」の「Type-Only Imports」は `import { type RequestHandler } from '...'` を実行時に消える書き方として挙げる。`verbatimModuleSyntax` を有効にすると、tsconfig を読む変換 (`vite:oxc`) では `import "m"` が残る (上の表)。

### テンプレートでの実測

`vp build` の `.output/public` に、server でだけ使うはずのモジュールが入るかを数えた (2026-11-04、vite-plus 1.4.0、`@tanstack/start-plugin-core` 1.171.55、`@vitejs/plugin-react` 6.1.2、`oxc-transform-react` 0.152.0)。
probe のモジュールはトップレベルで目印の文字列を `console.info` に渡し、`process.env` を読む。`src/routes/__root.tsx` から probe を import した。

| probe                                                                             | Compiler あり、`true` | Compiler あり、`false` | Compiler なし、`true`                               | Compiler なし、`false` |
| --------------------------------------------------------------------------------- | --------------------- | ---------------------- | --------------------------------------------------- | ---------------------- |
| probe なし                                                                        | 23 本の JS            | 23 本。hash も同じ     | 未測                                                | 未測                   |
| `import type { T }`                                                               | 入らない              | 入らない               | 入らない                                            | 入らない               |
| `import { type T }`                                                               | 入らない              | 入らない               | **入る**                                            | 入らない               |
| 値の import を `typeof v` にだけ使う                                              | 入らない              | 入らない               | **入る**                                            | 入らない               |
| server function のファイルの `import { v, type T }` (`v` は handler だけが使う)   | 入らない              | 入らない               | 入らない                                            | 入らない               |
| server function のファイルの `import { v }` (`v` を handler と `typeof v` で使う) | 入らない              | 入らない               | **入る**                                            | 入らない               |
| `*.server.ts` からの `import { type T }`                                          | 入らない              | 未測                   | `importProtection` が止める (`**/*.server.*`)       | 入らない               |
| `src/server/db/` からの `import { type T }`                                       | 未測                  | 未測                   | `importProtection` が止める (`**/src/server/db/**`) | 未測                   |
| `import { T }` (`T` は interface)                                                 | 入らない              | 未測                   | `vp build` が `MISSING_EXPORT` で落ちる             | 未測                   |

- 「Compiler なし」は `vite.config.ts` の `reactPlugin` を `compiler: false` にした build である
- React Compiler を当てると、`true` でも漏れない。`@vitejs/plugin-react` の `vite:react-compiler` は `enforce: "pre"` で、`include` (既定は `node_modules` の外の `/\.[tj]sx?$/`) に当たるすべてのファイルを、client と server の両方で `oxc-transform-react` に通す。`oxc-transform-react` は tsconfig を読まずに TypeScript の構文を外すので (`index.d.ts` の `TransformOptions` に TypeScript の option が無い)、`vite:oxc` が tsconfig を読む前に、型にだけ使う import が消える
- この働きは plugin の実装による。Compiler を外したとき、または plugin が TypeScript を外さなくなったときに、表の太字の経路が開く
- `importProtection` が止めるのは、`files` と `specifiers` に当たるモジュールだけである。接尾辞の無い server のモジュール (`process.env` から秘密を読むモジュールなど) は、太字の経路で黙って入る

## Decision

**`tsconfig.base.json` に `"verbatimModuleSyntax": false` と `"isolatedModules": true` を書く。型だけの import に `type` を書かせる lint のルールは足さない。**

- `false` を省かずに書く。TypeScript 6.0.3 の `tsc --init` は `"verbatimModuleSyntax": true` を書くので (2026-11-04 に実行して確かめた)、既定値に任せると、tsconfig を作り直したときに戻る
- `isolatedModules` は、`verbatimModuleSyntax` を外すと一緒に外れる。TypeScript 6.0.3 の `isolatedModules` は `compilerOptions.isolatedModules || compilerOptions.verbatimModuleSyntax` で決まる。Vite docs は `isolatedModules` を "Should be set to `true`." と書く。外すと、型の再 export を `export type` 無しで書いても `vp check` が止めない (TS1205。2026-11-04 に probe で確かめた)
- lint を足さない理由は 2 つある。`false` のもとでは、型にだけ使う import は書き方によらず出力から消える (上の 2 つの表の `false` の列)。`typescript/consistent-type-imports` と `typescript/no-import-type-side-effects` は、typescript-eslint のどの推奨の設定にも入っていない (ADR-0007)

### 検討した選択肢

| 案                                                                                                     | 評価                                                                                                                                                                                                   | 採否     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `false` と `isolatedModules: true`                                                                     | TanStack Start の docs と CLI の雛形に従う。client の出力は `true` と hash まで同じで、`vp check` の結果も変わらない (2026-11-04)。型にだけ使う import が漏れる経路が、plugin の実装によらず無くなる   | **採用** |
| `false` だけ                                                                                           | `isolatedModules` が外れ、TS1205 などの単一ファイルの変換で壊れる書き方を `vp check` が止めなくなる                                                                                                    | 却下     |
| `true` のまま                                                                                          | 今の client の出力は `false` と同じだが、それは React Compiler の plugin が先に TypeScript を外すからである。Compiler を外すと、`*.server.*` と `src/server/db/` の外のモジュールが黙って漏れる (実測) | 却下     |
| `true` のまま、`typescript/consistent-type-imports` と `typescript/no-import-type-side-effects` を足す | `import { type T }` は `import type { T }` に直る。TanStack Start の docs の推奨から外れ、ADR-0007 の基準に無いルールを 2 つ足す。`typeof v` の経路をこの 2 つが止めるかは確かめていない               | 却下     |

## Consequences

- 型にだけ使う import は、`type` を書いても書かなくても出力から消える。`type` を付けずに型を import しても、型検査は止めない (TS1484 は `verbatimModuleSyntax` のときだけ出る)
- 型にだけ使う import の先のモジュールは、トップレベルの処理が走らない。副作用のために読むモジュールは `import "m"` と書く
- 型を再 export するときは `export type` と書く。`isolatedModules` が TS1205 で止める
- `*.server.*` と `src/server/db/` の外にある server のモジュールは、型にだけ使う import では client に入らない。値を import すれば入るので、遮断は引き続き `importProtection` が持つ (ADR-0010)
- dev server での挙動は測っていない
- 再評価条件: TanStack Start の docs から「Build from Scratch」の注記が外れたとき。Start のコンパイラか `importProtection` が `import {}` の残りを消すか止めるようになったとき

## 出典

- TanStack Start docs「Build from Scratch」の TypeScript Configuration (main `94f36c4a9e`、2026-11-04 に確認): https://github.com/TanStack/router/blob/94f36c4a9ecf3062b326a8eb772e73b00c0644d9/docs/start/framework/react/build-from-scratch.md
- TanStack Start docs「Import Protection」の「Type-Only Imports」(main `94f36c4a9e`): https://github.com/TanStack/router/blob/94f36c4a9ecf3062b326a8eb772e73b00c0644d9/docs/start/framework/react/guide/import-protection.md
- docs に注記を足した TanStack/router#3670 (2025-03-05 merge) と、きっかけの TanStack/router#3401 (仕組みの説明は 2025-03-12 のコメント): https://github.com/TanStack/router/pull/3670 / https://github.com/TanStack/router/issues/3401
- `stripTypeExports` を足した TanStack/router#6582 (2026-02-02 merge): https://github.com/TanStack/router/pull/6582
- メンテナのコメントがある TanStack/router#7806 (2026-07-27 に merge されずに close): https://github.com/TanStack/router/pull/7806
- TanStack CLI の tsconfig の雛形 (main `58dc7ae45e`、2026-11-04 に確認): https://github.com/TanStack/cli/blob/58dc7ae45e76685c80d9e404eec93bac94f035a3/packages/create/src/frameworks/react/project/base/tsconfig.json.ejs
- TypeScript の tsconfig reference「Verbatim Module Syntax」(TypeScript-Website v2 `205122bb73`): https://github.com/microsoft/TypeScript-Website/blob/205122bb73dcbf6f3b373de5bdb0d9fa5434d015/packages/tsconfig-reference/copy/en/options/verbatimModuleSyntax.md
- Vite docs「Features」の TypeScript Compiler Options (vitejs/vite main `b3cb0575af`、2026-11-04 に確認): https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/docs/guide/features.md
- typescript-eslint の `consistent-type-imports` と `no-import-type-side-effects` の定義 (`docs` に `recommended` が無い。main `72ad812d3c`): https://github.com/typescript-eslint/typescript-eslint/tree/72ad812d3c63808b53e813d9a5c506f21aa88ea1/packages/eslint-plugin/src/rules
