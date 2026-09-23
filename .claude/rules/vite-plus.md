---
paths:
  - "vite.config.*"
  - "package.json"
---

# Vite+ ツールチェーン設定

## staged 設定 (pre-commit hook)

- `--no-error-on-unmatched-pattern` を外さない。staged が `ignorePatterns` の生成ファイルだけのコミットで、対象ゼロが error になり commit が止まる
- `vp staged` は `.vite-hooks/pre-commit` から呼び、hook は `package.json` の `prepare` の `vp config` が入れる。自前の skip スクリプトを間に挟まない
- hook を入れたくない環境 (CI のビルドコンテナ等) は `VP_GIT_HOOKS=0` で止める

## script とタスク

- マージ前検証を `vp run` のタスクへまとめない。Vite Task は親の環境変数を素通しせず、結果をキャッシュして gate がリプレイされる (ADR-0002)
- built-in と同名の script を新設しない。`vp <name>` の built-in と `vp run <name>` の script が別物になり取り違える。ただし `build` は `start` と対の入口 (`pnpm run build` → `pnpm start`) として残す
- ビルド成果物を起動する検査は `vp build` の後に置く。CI も同じ順序で workflow に並べる

## React Compiler (`vite.config.ts` の `plugins`)

- `viteReact({ compiler: { logDiagnostics: true } })` の `logDiagnostics` と `compiler` を外さない。外しても全部通り、最適化だけが無言で落ちる (ADR-0009)
- bail out のログは `vp build` では `[plugin vite:react-compiler]` だけで `error` / `warn` を含まない。ビルドログは `react-compiler` で grep する
- babel を経路に置かない。壊れたときも版を下げて凌ぐ (ADR-0009)
