# AGENTS.md - tanstack-start-template

プロジェクト概要・技術スタック・セットアップ・差し替え口・ドキュメント一覧は `README.md` を参照。

## コマンド（クイックリファレンス）

```bash
mise run serve    # dev server を起動する
mise run verify   # vp check → vp test run → vp build → ビルド成果物のヘッダ検査
```

## 開発上の注意

- コミット前に `vp check --fix` 必須
- `vp test` を複数並行で走らせない。orphan 化した runner が残ると、後続の実行が collection エラーで巻き添えになる
- テストの full run が普段の所要を大きく超えたら、完走を待たずに異常として止める。パイプ越しに実行していないか、orphan の runner が残っていないかを確認してから再実行する。切り分けの手順は `.claude/rules/testing.md`「実行」
- **worktree のパスに `+` を含めない**。vitest browser が URL 上で `+` をスペースと解釈してテストファイルを取得できず、browser mode が無言でハングする。unit と scripts は通るため気付きにくい。Claude Code の `EnterWorktree` は名前のスラッシュを `+` へ変換するので、`/` を含まない名前を渡す
- ブラウザテスト用の chromium は `vp install` では入らない（`playwright` が install スクリプトを持たない）。`vp exec playwright install chromium --only-shell` で取得する
- 依存の追加と更新には公開後 3 日の待機が効く（`pnpm-workspace.yaml` の `minimumReleaseAge`）。前倒しの条件は ADR-0005

## 仕様書・設計判断

- `docs/decisions/` - ADR（インフラ・ツールチェーン等の構造変更に着手する前に必ず参照）
- `.claude/rules/` - 実装時に引く規範（`paths` フロントマターに一致するファイルを触るときにロードされる）

<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `vp dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `vp dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
