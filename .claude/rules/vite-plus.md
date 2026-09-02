---
paths:
  - "vite.config.*"
  - "package.json"
---

# Vite+ ツールチェーン設定

## lint 設定 (`vite.config.ts` の `lint` ブロック)

プラグインの設定は ADR-0003、ルールの選定は ADR-0004。ここは書き方を持つ。

| キー                | 規範                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins`           | 既定集合 (typescript / unicorn / oxc) を追加ではなく**置換**する。`OXLINT_DEFAULT_PLUGINS` を spread して追加分を続ける。足したら `scripts/checks/integrity/lint-config.test.ts` の `EXPECTED_PLUGINS` にも足す (ADR-0003)                              |
| `categories`        | `correctness` と `perf` だけを error で入れる。他のカテゴリは丸ごと有効にしない (ADR-0004)                                                                                                                                                              |
| `rules`             | プラグインごとの上流 recommended を基準にした名指しと、合わないルールの `"off"`。`"warn"` は exit code に出ないため `"error"` で書く (ADR-0004)                                                                                                         |
| `overrides`         | テストファイルの型ルール緩和はここに書く (ADR-0004)。`categories` は持てず、`plugins` はトップレベルと違い継承集合へ**追加**する。registry を領域ごと除外する用途では使わない (統制は ADR-0006 の許容リスト)                                            |
| `jsPlugins`         | ESLint プラグインを oxlint 経由で読み込む (ESLint v9+ 互換)。足す前に oxlint ネイティブで代替できないか確認する (JS 実行で lint 時間が伸びる)。エントリは `{ name, specifier }` で書く。採用実績は tailwind 領域の `better-tailwindcss` 1 つ (ADR-0004) |
| `options.typeAware` | 型情報を使う lint ルールを有効化                                                                                                                                                                                                                        |
| `options.typeCheck` | 型検査を lint と同じ実行に含める。走るのは `tsc` ではなく tsgolint (typescript-go) で、診断は `typescript(TS2304)` の形で出る                                                                                                                           |

- 有効でないプラグインのルールを `rules` に書くと、ルール名の誤りと違って無言で無視される。**設定してあることは、その検査が動いていることを意味しない** (ADR-0003)
- lint 設定は `vite.config.ts` の `lint` に集約する。サブディレクトリの `.oxlintrc.json` は `vp lint` が読まず、丸ごと no-op になる (ADR-0003)
- 違反件数を CLI の `-D` で調査するとき、未知のルール名は exit 0 で無視される。0 件を結論にする前に `--print-config` の出力でルール名の実在を確かめる (ADR-0003)
- `-D` は同名ルールを持つプラグインをすべて有効にする (`-D prefer-spread` で eslint と unicorn の両方が鳴る)。`rules` へ接頭辞なしで書いた場合は eslint コアだけへ解決される。件数は診断の `plugin(rule)` 別に数える (ADR-0004)
- ルールを off にするのは、基準にした上流 config が off にしているか、そのルールが前提とする危険が本プロジェクトに存在しないと実測できたときに限る。根拠は ADR-0004 に残す
- 基準が off にするルールでも `correctness` に入っていればカテゴリ側が勝つ。`rules` で明示的に off にしないと有効なまま残る (ADR-0004)
- `correctness` のルールでもオプションは `rules` の名指しで上書きできる。名指ししなければカテゴリ既定のオプションで動く (ADR-0004)
- 上流が eslint コアルールを拡張したルール (extension rule) は `typescript/` 接頭辞で書いてもコアルールへ解決され、診断は `eslint(...)` 名で出る。解決先が `correctness` にあれば名指しは no-op になるので、追加の前後で `--print-config` を比べて実効を確かめる
- 上流が「同じ誤りを TypeScript が既に扱う」を理由に off にするルールは、写す前に probe で実測する。oxlint 側で報告する場面が残っているかはルールごとに違う (ADR-0004)
- 行単位の抑制 (`oxlint-disable-next-line`) は違反が報告される行の直前に置く。`.map()` の行に置いても `key` の行には効かない
- `no-await-in-loop` は順序依存のループにも鳴る。呼び先を読んで並列化して壊れないかを確かめ、逐次でないと壊れるループは `Promise.all` へ倒さず抑制して順序が必要な理由を書く (ADR-0004)

## fmt 設定 (`vite.config.ts` の `fmt` ブロック)

- `sortImports: true` で import 文の並びを Oxfmt に強制させる。Oxlint 側で対応する `eslint/sort-imports` は `style` カテゴリにあり未有効で、有効化すると Oxfmt と領域が重なる (ADR-0004)
- グループは既定の `builtin` → `external` → `[internal, subpath]` → `[parent, sibling, index]` → `style` → `unknown` を使う
- `internalPattern` の既定 `["~/", "@/", "#"]` が `@/*` エイリアスを internal と判定するため、パスエイリアスの追加設定は要らない
- `style` は末尾グループのため、`@/styles.css?url` の import だけ相対 import より後ろに置かれる
- 副作用 import (`import "@/styles.css"` 等) は既定の `sortSideEffects: false` により並べ替えられない。評価順序は保たれる

## staged 設定 (pre-commit hook)

```typescript
staged: {
  "*.{ts,tsx,js,jsx}": [
    "vp fmt --write --no-error-on-unmatched-pattern",
    "vp lint --fix --no-error-on-unmatched-pattern",
  ],
  "*.md": ["vp fmt --write --no-error-on-unmatched-pattern"],
}
```

- `--no-error-on-unmatched-pattern` を外さない。staged 対象が `ignorePatterns` の生成ファイル (`src/routeTree.gen.ts`) だけのコミットで、対象ゼロが error になり commit が止まる
- `vp staged` は `.vite-hooks/pre-commit` から呼ぶ。hook のインストールは `package.json` の `prepare` に置いた `vp config` が行う。自前の skip スクリプトを間に挟まない
- hook を入れたくない環境 (CI のビルドコンテナ等) は `VP_GIT_HOOKS=0` で止める

## 検証コマンド

マージ前検証は `mise run verify` (`vp check` → `vp test run` → `vp build` → `scripts/checks/runtime/security-headers.ts`) を通す。最後の 1 つはビルド成果物を起動して実レスポンスを見るため build のあとに置く。CI は同じ順序を workflow に並べる。`vp run` のタスクへまとめない: Vite Task は親の環境変数を素通しせず、既定で結果をキャッシュするため gate がリプレイされる (ADR-0002)。

`vp <name>` は built-in、`vp run <name>` は `package.json` の script か `vite.config.ts` のタスクを指す。同名でも別物になるため、built-in と同名の script を新設しない (ADR-0002)。

現在ある 3 つの script のうち、この規範に触れるのは `build` だけで、意図的な例外として残してある。
`start` が `node .output/server/index.mjs` を直接起動する形で `vp` を経由しておらず、`build` と対で `pnpm run build` → `pnpm start` の 2 段だけで完結する入口になっているため。
`start` と `prepare` は built-in に同名が無いので規範の対象外 (`prepare` は npm の lifecycle hook で、`vp config` に git hook を入れさせる)。

`vp check` には `vp lint` の `--deny-warnings` に相当するオプションがない。
警告レベルのルール違反を exit code へ反映させているのは `lint.categories` の格上げで、これが外れると検証が警告を素通しする。
`scripts/checks/integrity/lint-config.test.ts` が、解決後設定の `categories` が `deny` であることで機械強制する。

## React Compiler (`vite.config.ts` の `plugins`)

`viteReact({ compiler: { logDiagnostics: true } })` で適用する。実体は optional peer の `oxc-transform-react`。babel は経路に置かず、壊れたときも版を下げて凌ぐ (ADR-0009)。

bail out のログは経路で語彙が違う。`vp dev` は `warning:` が付くので起動ログの定型 grep に掛かるが、`vp build` は `[plugin vite:react-compiler]` だけで `error` も `warn` も含まない。ビルドログを見るときは `react-compiler` で grep する。

`logDiagnostics` を落とすと、Compiler が諦めた箇所がどこにも現れなくなる。`compiler` オプション自体を外した場合も、ビルドもテストも lint も通って最適化だけが silent に落ちる。これを機械で見張るものは無い (ADR-0009)。

## worktree の config 除外

tsconfig / vitest.config / vitest.browser.config / vite.config (lint・fmt) は `.claude/worktrees/**` を除外する。
除外の経路ごとに設定点が別で共通化できないため、1 つ落とすと worktree のコードが片方の走査へ静かに混入する。
機械強制は無い。走査対象を持つ config を新設したら、上記 4 ファイルと同じ除外をその場で書く。

## パッケージ操作

- `vp add <pkg>` / `vp rm <pkg>` を使う。pnpm / npm / yarn の直接実行はしない。機械強制は無いので規範として守る。lockfile の解決経路が Vite+ の catalog 管理から外れ、版のずれに気付けなくなる
- 一回限りの実行は `vp dlx`、devDependency 済みなら `vp exec`
- Vitest / Oxlint / Oxfmt を直接 install しない (Vite+ が内包する)
