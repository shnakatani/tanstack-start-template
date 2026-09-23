# AGENTS.md - tanstack-start-template

プロジェクト概要・技術スタック・セットアップ・差し替え口・ドキュメント一覧は `README.md` を参照。

## コマンド（クイックリファレンス）

```bash
mise run serve    # dev server を起動する
mise run verify   # マージ前に通す: vp check → vp test run → vp build → ビルド成果物のヘッダ検査
```

## 開発上の注意

- 実装中は 1 ファイル目を `vp check --fix` まで通してから横展開する
- パッケージは `vp add` / `vp rm` で操作し、pnpm / npm / yarn を直接打たない (lockfile の解決が Vite+ の管理から外れる)。一回限りの実行は `vp dlx`、devDependency 済みなら `vp exec`。Vitest / Oxlint / Oxfmt は Vite+ が内包するので install しない
- **worktree のパスに `+` を含めない**。vitest browser が URL 上の `+` をスペースと解釈し、browser mode が無言でハングする。`EnterWorktree` は名前の `/` を `+` へ変換するので、`/` を含まない名前を渡す
- 依存の追加と更新には公開後 3 日の待機が効く（`pnpm-workspace.yaml` の `minimumReleaseAge`）。前倒しの条件は ADR-0006

## テストの実行

- テストを書き始める前に `.claude/rules/testing.md` を読む (TDD の手順、置き場所)。テストを新規作成するだけでは paths の rules は読み込まれない
- `vp test run <path>` で 1 回実行する (`vp test` は watch モード)
- `vp test` を複数並行で走らせない。orphan の runner が残ると後続が collection エラーで巻き添えになる。kill 後は `ps` で残存を確かめる
- background で走らせるときはパイプを付けない。buffering で完了まで出力が見えず、ハングと実行中を区別できない
- full run が普段の所要を大きく超えたら止めて切り分ける。`ps -o pid,etime,time -p <pid>` で CPU 時間が伸びていなければ待っても終わらない
- worktree では中へ cd してから `vp install` と `vp test run` を打つ。`--root <worktree>` は依存を二重に解決し、collection が全滅する
- `vp check` がコードを変えずに 2 回続けて結果が割れたら、上流の非決定的な発火 (`typescript/no-unnecessary-type-assertion`、oxc-project/oxc#21752) を疑う。`--threads=1` でも再現する (2026-09-02 に vite-plus 0.3.0 / oxlint 1.79.0 で観測)

## Storybook の skill と tools

UI と story を触る前に `vp exec storybook skills` を実行し、`stories` skill の手順に従う。ただし play を書く範囲は skill の「Simulate key user flows」ではなく ADR-0044 に従い、操作で状態が変わる部品にだけ書く。この節は、CLI が `--help` に出ないので、AGENTS.md を削るときも消さない。**`vp exec storybook --help` の一覧に `skills` と `tools` は出ない**ので、見落としやすい。

- 部品の props・API・使い方は `vp exec storybook tools docs list` / `docs show` で答える。ソースや型定義から答えない
- `vp exec storybook tools stories find-by-component` は Storybook を起動してから `--port` で指す。未起動でも走るが結果が空で返り、story が無いのと区別が付かない
- MCP (`@storybook/addon-mcp`) は入れない。MCP の登録は URL を 1 つしか持てず、worktree ごとに変わる Storybook の port へ配れない

## 仕様書・設計判断

- `docs/decisions/` - ADR（インフラ・ツールチェーン等の構造変更に着手する前に必ず参照）

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
