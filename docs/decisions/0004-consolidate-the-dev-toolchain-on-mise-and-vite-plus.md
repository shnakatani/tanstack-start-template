# ADR-0004: 開発環境のツールチェーンは mise と Vite+ に寄せる

- Status: Accepted
- Date: 2026-10-14
- 関連: ADR-0005 (依存更新の待機)

## Context

クローンした開発者ごとに Node.js とパッケージマネージャのバージョンが違うと、`vp install` の解決結果と型検査の結果が手元ごとに割れる。
バージョンの宣言と、その宣言を実際に効かせる仕組みの両方が要る。

フロントエンドのツールは、bundler と linter と formatter と test runner を個別に選ぶと、それぞれの版と設定の整合を自分で持つことになる。

## Decision

### 採用するツール

| ツール      | 役割                                                                                                                    | 宣言する場所                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| mise        | Node.js と pnpm 以外のツール、環境変数、dev server と Storybook の port                                                 | `.mise.toml` の `[tools]` と `[env]` と `[daemons.*]` と `[tasks.*]`                   |
| Vite+       | Node.js と pnpm の解決、dev server / build / lint / format / test / パッケージ操作の統一 CLI (`vp`)、タスク (Vite Task) | `package.json` と `pnpm-workspace.yaml` の `catalog:`、`vite.config.ts` の `run.tasks` |
| pnpm        | パッケージマネージャ                                                                                                    | `package.json` の `packageManager`                                                     |
| drizzle-kit | スキーマからの migration 生成と適用                                                                                     | `package.json` と `vp run db:generate` / `db:migrate`                                  |

クローン後の手順は `mise trust && mise install` と `vp install` の 2 段で閉じる。
起動は `mise run serve`、検証は `vp run verify` を入口にする。

### タスクは Vite Task に置き、worktree の port は mise のタスクが渡す

タスクは `vite.config.ts` の `run.tasks` に置く。Vite Task のタスクは worktree を知らず、`serve` と `storybook` は Vite と Storybook の既定の port で起動する。
worktree ごとの port は、`.mise.toml` の同名のタスク (`[tasks.serve]`、`[tasks.storybook]`) が `vp run serve --port $SERVE_PORT` のように引数で足す。mise のタスクは port のほかにコマンドを持たない。
mise は、Node.js と pnpm 以外のツール (`[tools]`)、環境変数 (`[env]`)、dev server と Storybook の port (`[daemons.*]` と、それを渡す `[tasks.*]`) を持つ。

- コマンドは `vite.config.ts` だけが持つ。CI は mise を入れずに、手元と同じタスクを `vp run` で走らせられる
- mise の値は、`mise exec` で打ったコマンド、mise のタスク、mise を activate したシェルに届く (mise v2026.9.18 の docs/environments/index.md の冒頭: "mise supplies them to commands run with `mise exec`, tasks, and activated interactive shells.")。mise のタスクなら mise が必ず値を入れるが、Vite Task のタスクには、mise の環境を読んだシェルか `mise x --` から打ったときに届く
- port は引数で渡すので、hook の無いシェルからも `mise run serve` で worktree の port に起動する。`vp run` は、タスク名の後ろの引数をコマンドに渡す (Vite+ の `docs/guide/run.md`「Additional Arguments」: "Arguments after the task name are passed through to the task command")。2026-10-14 に mise 2026.10.3、vite-plus 1.1.0 で、hook の無いシェルから打った `mise run serve` と `mise run storybook` が `$ vp dev --strictPort --port 3465` と `$ vp exec storybook dev --no-open --exact-port --port 6471` を走らせ、その port で起動した
- mise の値を読むタスクは、値が届いていなければ止まる形にする。黙って別の DB で動くと、worktree ごとに分けた DB が混ざる
- `vp run serve` を直に打つと、worktree の中でも既定の port で起動する。使用中なら、次の port へずれずに止まる (「dev server と Storybook の port は mise の daemons の自動 port で worktree ごとに決める」)
- mise のタスクに `interactive = true` を置く。mise のタスクは既定で stdin をつながず (mise v2026.10.3 の docs/tasks/task-configuration.md「interactive」: "Connects the task directly to the shell's stdin/stdout/stderr"。既定は `false`)、Vite のキーボードのショートカットが効かない。2026-10-14 に tty のある端末で、`mise run serve` の下で `h` が効いた。docs が書く interactive の排他の lock は、別のプロセスの `mise run` を止めなかった (同日に mise 2026.10.3 で、前面の `mise run serve` と `mise run storybook`、`serve` の daemon と前面の `mise run storybook` が、それぞれ同時に起動した)
- 前面の `mise run serve` は Ctrl-C で止まる。2026-10-14 に mise 2026.10.3、vite-plus 1.1.0 で、`mise run serve` と `mise run storybook` を job として起動し、job のプロセスグループに SIGINT を送ると (Ctrl-C と同じ届き方)、5 秒後にはその port を LISTEN するソケットも、テンプレートのプロセスも残っていなかった

| タスク                                               | 読む mise の値                                      | 届いていないとき (2026-10-14、vite-plus 1.1.0 で実測)                                               |
| ---------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `serve`                                              | dev server が `createDb()` で `DB_FILE_NAME` を読む | dev server は起動し、DB を開くリクエストで `createDb()` が `DB_FILE_NAME is not set.` で throw する |
| `db:generate`、`db:migrate`、`db:seed`               | `[env]` の `DB_FILE_NAME`                           | `drizzle.config.ts` と `createDb()` が `DB_FILE_NAME is not set.` で throw する                     |
| `storybook`、`verify`、`contrast`、`a11y:incomplete` | 無い                                                | 該当しない                                                                                          |

- 代償として、mise の hook が走らないシェル (エージェントのシェル、hook の無い IDE のタスク) からは、`db:*` を `mise x -- vp run <タスク>` で打つ。前面でサーバーを持ち続けられないエージェントのシェルでは、dev server と Storybook を `mise daemons start` で起動する
- 前面の起動では、`vite.config.ts` を評価した `vp run` のランナーが dev server の親として常駐し、その上に `mise run` の mise が載る (2026-10-14 に vite-plus 1.1.0 で、`sleep` のタスクを打ったランナーの node が約 200MB。import が無く tasks を式で組む `vite.config.ts` では約 109MB で、差は `vite.config.ts` が先頭で読み込むモジュール (plugin と `tooling/` の設定) の分。mise 2026.10.3 の `mise run serve` は約 40MB)

| 案                                                                                                               | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 採否     |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| タスクは `vite.config.ts` に置き、worktree の port は `.mise.toml` のタスクが `vp run` に引数で渡す              | コマンドは `vite.config.ts` だけが持ち、CI と手元が同じタスクを走らせる。hook の無いシェルからも `mise run serve` で worktree の port に起動する。前面の起動に `mise run` の層が 1 つ載る。`vp run serve` を直に打つと既定の port で起動する                                                                                                                                                                                                                                                                           | **採用** |
| すべてのタスクを `vite.config.ts` に置き、`serve` と `storybook` が daemons の port を `${SERVE_PORT:?…}` で読む | 入口が `vp run` の 1 つになる。Vite Task のタスクが worktree を知る。hook の無いシェルからは `mise x -- vp run serve` が要り、`vp run serve` だけでは `/bin/sh: SERVE_PORT: …` で止まる                                                                                                                                                                                                                                                                                                                                | 却下     |
| mise の値を読むタスクだけ `.mise.toml` に置く                                                                    | hook が無くても `mise run` で値が届く。`serve` と `storybook` を mise のタスクから `vp dev` と `vp exec storybook dev` で起動すれば、config を評価するランナーは常駐しない (親の node は残るが、2026-10-14 に vite-plus 1.1.0 で `vp dev` の側の node は約 65MB だった)。コマンドが `.mise.toml` に移り、`vp run serve` が無くなる。`db:*` を移すと、本番で手で渡す `DB_FILE_NAME` を `mise x` が開発用のパスで上書きする (下の行の実測)。タスクが mise の値を読み始めるたびに置き場所が変わる                         | 却下     |
| `serve` と `storybook` の command の中で `mise x -- sh -c '…'` を呼び、値を取らせる                              | hook の無いシェルからも `vp run serve` だけで動く (2026-10-14 に mise 2026.10.3 で、daemons の port で起動して 200 を返した)。Vite Task のタスクが mise を呼ぶことになり、JS と npm のスクリプトに閉じた層の外へ依存する。`db:*` には使えない。mise の無いホストでは `mise` が見つからず止まり、mise のあるホストでは手で渡した `DB_FILE_NAME` を `mise x` が開発用のパスで上書きする (2026-10-14 に mise 2026.10.3 で、`DB_FILE_NAME=/override mise x -- printenv DB_FILE_NAME` が `.data/dev.sqlite` のパスを出した) | 却下     |
| すべてのタスクを `.mise.toml` に置く                                                                             | CI は mise を要さないために、`verify` の各コマンドを workflow へ写して持つ。手元と CI でコマンドが食い違っても検出されない                                                                                                                                                                                                                                                                                                                                                                                             | 却下     |
| `package.json` の script に置く (Vite+ の `docs/guide/local-cli.md`「Best Practices」が勧める形)                 | global の `vp` が無くても `pnpm run verify` で走る。この利点は、global の `vp` を入れる前提のこのリポジトリには当てはまらない (「built-in と同名の script は `start` と対の `build` だけを置く」)。JSON はコメントを持てず、手順ごとの理由を書けない                                                                                                                                                                                                                                                                   | 却下     |

### Vite Task のキャッシュは `run.cache: false` で切る

Vite Task は `vite.config.ts` のタスクを既定でキャッシュする (Vite+ の `docs/guide/cache.md`「When Is Caching Enabled?」)。キャッシュが効くと、マージ前の gate が入力の変わらない 2 回目にリプレイで済まされる。また、キャッシュが効くタスクには 1 回目から、親の環境変数のうち `PATH`・`HOME`・`CI` などの既定の組と `cache.env`・`cache.untrackedEnv` に挙げたもの以外が届かない (同「Environment Variables」)。
`vite.config.ts` の `run.cache` を `false` にし、すべてのタスクのキャッシュを切る。

| 切り方                        | 書き忘れ                                                   | `vp run --cache <task>`                                                                                | 採否     |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| 全体の `run.cache: false`     | 足したタスクも既定でキャッシュしない                       | キャッシュが戻り、2 回目がリプレイになる。親の環境変数も届かなくなる                                   | **採用** |
| タスクごとの `cache: false`   | 足したタスクに書き忘れると、そのタスクだけキャッシュされる | 外れない ("This cannot be overridden by any other cache control flag"、同「When Is Caching Enabled?」) | 却下     |
| 両方を書く                    | 全体の設定が書き忘れを防ぐ                                 | 外れない                                                                                               | 却下     |
| `--no-cache` を打つ側に任せる | 打ち忘れた 2 回目がリプレイになる                          | 該当しない                                                                                             | 却下     |

- 全体の設定を選ぶのは、書き忘れは気づかれないまま起き、`--cache` は打った人が選んで付けるからである。両方を書く案は、`--cache` を付けた打ち方まで止めるために、どのタスクにも同じ行を足すことになる
- 2026-10-14 に vite-plus 1.1.0 で、一時のタスクを 2 回続けて打って確かめた振る舞いは次のとおりである

| 設定と打ち方                                         | 2 回目                              | 親の環境変数 (`FOO=bar`) |
| ---------------------------------------------------- | ----------------------------------- | ------------------------ |
| 全体の `run.cache: false`、`vp run <task>`           | 実際に走る (`⊘ cache disabled`)     | 届く                     |
| 全体の `run.cache: false`、`vp run --cache <task>`   | リプレイ (`◉ cache hit, replaying`) | 届かない                 |
| タスクごとの `cache: false`、`vp run --cache <task>` | 実際に走る                          | 届く                     |

- キャッシュを切ったタスクに親の環境変数がすべて届くことは、Vite+ の docs に書かれていない。vite-plus 1.1.0 が pin する vite-task の `plan_task_as_execution_node` は、子の環境を親の環境の全体から作り、キャッシュの設定があるときだけ絞る。キャッシュを切ると、`effective_cache_config` がキャッシュの設定を持たせない
- キャッシュを切ったタスクは stdin・stdout・stderr を親から継ぐ (vite-task の `docs/stdio.md`「stdio by Mode」)。各コマンドの前に `$ <command> ⊘ cache disabled` の行が出る

### CI は `verify` の手順を 1 つずつ別の step で打つ

`vite.config.ts` は `verify` の手順を `verify:peers` などのタスクとして `verifySteps` に持ち、`verify` はそれを `vp run <タスク>` の配列で順に打つ。
CI は mise を要さず、同じタスクを同じ順に、1 つずつ別の step で `vp run` する。コマンドは `vite.config.ts` だけが持ち、workflow にはタスクの名前と順序だけが写る。

- GitHub は失敗した step を自動で開き、ログの検索も開いた step だけを対象にする (GitHub Docs「Using workflow run logs」: "Any failed steps are automatically expanded to display the results." と "When you search logs, only expanded steps are included in the results.")。step が 1 つだと、全手順の出力が開いた中から落ちた手順を探すことになる
- Vite+ の docs の CI の例も、コマンドやタスクごとに step を分ける (`docs/guide/ci.md` の `- run: vp check`・`- run: vp test`・`- run: vp build`、`docs/guide/github-actions-cache.md` の `- run: vp run lint`・`- run: vp run build`)
- 代償として、`verifySteps` に手順を足したら workflow にも step を足す。足し忘れても CI は落ちず、その手順が CI で走らないだけになる
- `command` の配列は `&&` でつないだのと同じに順に走り (Vite+ の `docs/config/run.md` の `command`)、Vite Task は command の中の `vp run` を別のタスクとして展開する (Vite+ の `docs/guide/run.md`「Nested `vp run`」)。途中の手順が落ちると後続は走らず、`vp run verify` は非 0 で終わる (2026-10-14 に vite-plus 1.1.0 で、`vp run <タスク>` を 3 つ並べて 2 つ目を exit 3 で落とす一時のタスクを、配列と `&&` の両方で打った。どちらも 3 つ目は走らず、exit code 3 で終わった)
- 手順を `dependsOn` で並べない。`dependsOn` に並べたタスクは並列で走る (2026-10-14 に vite-plus 1.1.0 で、`dependsOn` に並べた 2 つの 2 秒のタスクが 5ms 差で始まった。同時に走る数の既定の上限は 4 で、Vite+ の `docs/guide/run.md`「Concurrency」にある)。順序を付けるために各手順へ 1 つ前の手順を `dependsOn` させると、CI の step の `vp run verify:build` が前の手順まで走らせ直す
- `pnpm peers check` も `verify` の手順に入れ、別のジョブに分けない。分けると、install を待たずに並列で走る代わりに、`verify` と CI の手順が食い違う。課金はジョブごとに分単位で切り上がる (GitHub Docs「Actions runner pricing」) ので、分けたジョブは 1 分として数えられる
- Vitest の HTML report は、`verify:test` の step が落ちたときだけ上げる。テンプレートから作ったリポジトリが private だと、artifact はプランごとの枠を使う (GitHub Docs「GitHub Actions billing」の「How use of GitHub Actions is measured」: "For **private repositories**, each GitHub account receives a quota of free minutes, artifact storage, and cache storage for use with GitHub-hosted runners, depending on the account's plan.")。`verify:time-zones` の step では上げない。TZ ごとのテストは並列に走り、どれも同じ report を書き直すので、上げても落ちた TZ のものとは限らない

| 案                                                                                                   | 落ちた手順の見え方                                                                                                                | 手順の持ち方                                                                              | 採否     |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| 手順ごとのタスクを、別の step で `vp run` する                                                       | 落ちた step を GitHub が開き、step の名前で分かる                                                                                 | コマンドは `vite.config.ts` だけが持つ。workflow はタスクの名前と順序を写す               | **採用** |
| `vp run verify` を 1 つの step で打つ                                                                | 全手順の出力が 1 つの step に開く。`vp run -v` なら末尾の要約で落ちたコマンドに `✗` が付く (2026-10-14 に vite-plus 1.1.0 で実測) | `vite.config.ts` だけが持つ                                                               | 却下     |
| コマンドを workflow に直に並べる                                                                     | 採用案と同じ                                                                                                                      | コマンドが `vite.config.ts` と workflow の 2 か所に入り、食い違っても検出されない         | 却下     |
| 1 つの step のまま、手順ごとにログを折り畳む (GitHub Docs「Workflow commands」の `::group::{title}`) | GitHub は失敗した step を開くが、その中の折り畳みを開くかは GitHub Docs に書かれていない                                          | Vite Task は `::group::` を出さない (vite-task 7d69d657 に無い)。各コマンドを包む形が要る | 却下     |

### 値の置き場所を 3 つに分ける

| 種別                       | 置き場所                         | 例                    |
| -------------------------- | -------------------------------- | --------------------- |
| 環境で変わらない値         | モジュール定数                   | `src/lib/app-name.ts` |
| 環境で変わるが秘密でない値 | `.mise.toml` の `[env]`          | `DB_FILE_NAME`        |
| 秘密                       | 暗号化して commit + 実行時に復号 | 現時点で該当なし      |

アプリ名のように環境ごとに値が変わらないものは環境変数にしない。
`VITE_APP_NAME` を `.mise.toml` の `[env]` に置くと、値の定義・型宣言・未設定の検出・CI への受け渡しが芋づるで要り、CI が mise に依存する原因になる。

毎回の解決にコストがかかる値も `[env]` へ置かず、読むタスクの command かスクリプトの中で導出する。`[env]` に置くと、mise が env を解決するたび (シェル hook の下ではディレクトリへ入るたび) にその処理が走る。2026-09-20 に、git のサブプロセスで値を導出する処理をトップレベルの `[env]` に置くと `mise hook-env` は 70ms、`[env]` から外すと 28ms だった。

### dev server と Storybook の port は mise の daemons の自動 port で worktree ごとに決める

`.mise.toml` の `[daemons.serve]` と `[daemons.storybook]` を、同名の mise のタスクを `task = "serve"` で走らせる daemon として宣言し、`port = { auto = true, base = 3000 }` (Storybook は `6006`) を置く (mise v2026.10.3 の docs/daemons.md「Daemons that run a task」: "Use `task` when the long-running command is already defined as a mise task")。pitchfork の proxy は使わないので、`proxy = false` で URL の変数 (`SERVE_URL` など) を出さない (mise v2026.9.18 の docs/daemons.md「Per-daemon proxy settings」)。

- mise は設定を読む時点で port を決め、`SERVE_PORT` と `STORYBOOK_PORT` として出す (同「Ports across git worktrees」「Port environment variables」)。mise のタスクがこの値を `--port` で `vp run` に渡す (「タスクは Vite Task に置き、worktree の port は mise のタスクが渡す」)。daemon と前面の `mise run serve` が同じタスクを走らせるので、port の引数は 1 か所にしか書かない
- docs は daemon の環境にも同じ変数が入ると書く (同「Port environment variables」の "the daemon's mise environment")。2026-10-14 に mise 2026.10.3 で、`mise daemons start serve` で起動した dev server が同じ port で応答した
- 常駐は `mise daemons stop <name>` で止まる。2026-10-14 に mise 2026.10.3、pitchfork 2.30.1、vite-plus 1.1.0 で、`mise daemons start` で起動した `serve` と `storybook` に `mise daemons stop` を打つと、exit 0 で終わり、5 秒後にはその port を LISTEN するソケットも、テンプレートのプロセスも残っていなかった (起動中は `serve` が 2 つ、`storybook` が 6 つ)。タスクの `interactive = true` は、tty の無い pitchfork の下でも起動と停止を変えなかった
- pitchfork は `.mise.toml` の `[tools]` に major まで (`2`) で宣言する。mise の daemons の docs は pitchfork を先に入れておく前提で書かれている (mise v2026.10.3 の docs/daemons.md の冒頭)。宣言を外すと、mise の shim のディレクトリが PATH にあるシェルから打った `mise daemons stop` が失敗する (2026-10-14 に mise 2026.10.3 で、`No version is set for shim: pitchfork` で終わった)。仕組みは次の 2 点である
  - mise は、設定が pitchfork を宣言していなければ、`start`・`restart`・`register` のときだけ pitchfork を toolset に足し、`stop` では足さない (mise v2026.10.3 の `src/cli/daemons.rs` の `install` と、`src/daemons/runtime.rs` の `toolset_resolved`)
  - mise は pitchfork の実体を PATH から探し、見つからないときだけ起動時に記録した実体へ戻る (同 `src/daemons/runtime.rs` の `Runtime::from_toolset`)。mise の shim のディレクトリが PATH にあると、`stop` は shim を拾い、shim は版を決める宣言が無いので失敗する
- `2` の宣言は pitchfork の下限を表せない。mise は `start` のときに、プロジェクトの設定を pitchfork の外部の設定として登録する (mise v2026.10.3 の `src/daemons/runtime.rs` の `supports_external_config` と `prepare`)。pitchfork がこの機能を持ったのは 2.25.0 からで (pitchfork の CHANGELOG の 2.25.0: "attach external config files to projects")、それより古い 2.x では `start` が失敗する。ここまでの仕組み (`install` の判定、`toolset_resolved`、`Runtime::from_toolset`、`supports_external_config`) は、`min_version` の mise v2026.9.18 のソースでも同じである
- mise v2026.10.3 は、タスクを走らせる daemon をシェルを通さずに起動し、それに pitchfork 2.28.0 以上を求める (同 `src/daemons/runtime.rs` の `supports_argv_run`: "runs a task, which needs pitchfork 2.28.0 or later"。pitchfork の CHANGELOG の 2.28.0: "accept an argv array for run to start a daemon without a shell")。mise の版の書き方は前方一致だけで、下限を書けない (mise v2026.10.3 の docs/configuration.md)。`2` には手元にある最新の 2.x が選ばれるので、それが 2.28.0 より古いと `start` が失敗する

| 案                                                     | 評価                                                                                                                                                           | 採否     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `[tools]` に major まで (`pitchfork = "2"`) で宣言する | `mise install` で入り、`stop` も宣言した版を PATH から引く。major を上げるときは宣言を書き換える。手元にある最新の 2.x が 2.28.0 より古いと `start` が失敗する | **採用** |
| 宣言せず、`mise daemons start` が入れるのに任せる      | `start` は動くが、shim のディレクトリが PATH にある環境では `stop` が失敗する                                                                                  | 却下     |
| `[tools]` に `latest` で宣言する                       | `stop` は動く。pitchfork が入っていない環境や `mise upgrade` では、pitchfork の major が上がると、daemons との組み合わせを確かめないまま新しい major が入る    | 却下     |
| `[tools]` に exact で宣言する                          | `stop` は動く。patch の版が出るたびに宣言を書き換える                                                                                                          | 却下     |

2026-10-09 に mise 2026.9.18 で確かめた振る舞いは次のとおりである。

| 場所                    | port                                                   |
| ----------------------- | ------------------------------------------------------ |
| git の primary checkout | `3000` / `6006`                                        |
| linked worktree         | パスから決まる別の値 (`3001`〜`3511` / `6007`〜`6517`) |

- daemons は experimental で、`[settings]` の `experimental = true` が要る (mise v2026.9.18 の docs/daemons.md の冒頭)。このフラグは daemons のほかに、試験中の振る舞いも有効にする (mise v2026.9.18 の settings の `experimental`: "New functionality that I want to test with a smaller subset of users I will often push out under experimental mode even if it's not related to an experimental feature.")
- 自動 port は mise v2026.9.12 から使える。`min_version` は確かめた版の `2026.9.18` にし、それより古い mise を設定の読み込みで止める
- mise は bad port を避けない。ブラウザは WHATWG Fetch の bad port への接続を拒むが、server は起動するので、使用中かを見るフラグでは気づけない (2026-10-04 に port 3659 で起動した dev server へ、curl は 200 を返し、Playwright 1.63.0 の Chromium は `net::ERR_UNSAFE_PORT` で開けなかった)。`base` を変えるときは、`base` から `base + 511` に bad port が入らない値を選ぶ。`3000`〜`3511` と `6006`〜`6517` には無い (whatwg/fetch の e9460d1、2026-10-06)

| 案                                                      | 評価                                                                                                                                                                         | 採否     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| mise の daemons の自動 port                             | primary checkout で base、worktree ごとに別の port を mise の宣言だけで持て、重なっても port をずらさない。experimental なので `experimental = true` と `min_version` が要る | **採用** |
| worktree の名前のハッシュから自前の script で導出する   | 同じ振る舞いを、primary checkout の判定と bad port の表ごと自前で持つ                                                                                                        | 却下     |
| 割り当てを記録して重なりをなくす (workz、devports など) | ツールが 1 つ増え、worktree を消すたびにそのツールで割り当てを外す操作が要る                                                                                                 | 却下     |

自動 port は別の worktree や別のプロジェクトの port と重なりうる。mise も重なった port をずらさない (mise v2026.9.18 の docs/daemons.md「Port conflicts」)。使用中なら次の port へずらさず終了させる (`serve` は `--strictPort`、`storybook` は `--exact-port`)。
Vite は使用中なら次の空き port へずらし (Vite docs の `server.port`: "if the port is already being used, Vite will automatically try the next available port")、Storybook も環境変数 `CI` があると尋ねずにずらす (2026-10-04 に storybook@10.6.0 で実測)。
ずれると、worktree ごとに決まった port を指す側が別のサーバーへつながる。2026-10-09 に vite-plus 1.0.0 で、同じ port での 2 つ目の `vp dev --port 3129 --strictPort` が `Port 3129 is already in use` で終わることを確かめた。

| 案                                                                 | 評価                                                                                                                      | 採否     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 使用中なら終了させる (`--strictPort` / `--exact-port`)             | port が worktree で決まる。2 つの worktree が同じ port になったときは後の側が起動しない                                   | **採用** |
| 次の空き port へずらす (Vite の既定、Storybook の `CI` があるとき) | 重なっても両方が起動するが、port が起動した順で決まる。決まった port を指す側が、黙って別の worktree のサーバーへつながる | 却下     |

### `envDir: false` で Vite の `.env` 読み込みを切る

秘密を扱う段になったときの前提を先に固定する。
Vite 公式は「`VITE_*` variables should _not_ contain sensitive information」と明記しており、client へ出る値は暗号化しても意味がない。秘密は server 側にしか存在し得ない。

暗号化した `.env` をそのまま commit する方式 (dotenvx は暗号文を `.env` 自身へ書き戻し、秘密鍵だけを `.env.keys` へ出す) は、Vite が `.env` を native に読むと衝突する。暗号文が復号されないまま `import.meta.env` と `process.env` へ流れ込むためで、vitejs/vite#19373 がその報告である。`envDir: false` はその解として Vite へ追加された。

読み込む `.env` が現時点で無いので、いま切っても失うものは無い。逆に、後から `.env` を置いた人が「Vite が勝手に読む」前提でコードを書くのを防げる。

`envDir: false` は `vite.config.ts` に 1 つだけ書く。
テストの project は `vite.config.ts` の設定を継承するので (ADR-0037)、ビルドとテストで値が割れない。

秘密が要るようになったときの足し方は `docs/guides/dependencies-and-toolchain.md`「秘密を足す」にある。

### runtime と package manager の版は `package.json` が持つ

Vite+ は managed mode が既定で、`node` / `npm` / package manager の shim をプロジェクトごとに解決する。
解決順は `.node-version` → `devEngines.runtime` → `engines.node` → `.nvmrc` で、`devEngines.runtime` が上に立つのは、それが開発環境の要求を表すのに対し `engines.node` は利用者向けのサポート範囲だからである (Vite+ の `docs/guide/env.md`)。
package manager の版は `packageManager` が決める。`vp env pin` が書き込む先も `devEngines.runtime` で、`engines.node` は書き換えない。

| 宣言                 | 決めるもの                      | 形                                                                              |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `devEngines.runtime` | 開発時に使う Node.js            | major まで (`24`)                                                               |
| `engines.node`       | 利用者に要求する Node.js の範囲 | `^24.<下限の minor>.0`。下限の決め方は次の段落と比較表、現在値は `package.json` |
| `packageManager`     | pnpm の版                       | exact                                                                           |

Node.js を major までにするのは、minor 差が解決結果を変えないためである。
`engines.node` は、`devEngines.runtime` の major (24) のうち Vite+ の CLI が動き、`@types/node` が型を持つ API がある範囲に絞る。下限は、`vite-plus` の `engines` の 24 系の下限 (vite-plus 1.0.0 で `^22.18.0 || ^24.11.0 || >=26.0.0`、2026-09-28 に確認) と `@types/node` の minor の高いほうにする。

| 案 (`engines.node`)                                                              | 評価                                                                                                | 採否     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 24 に絞り、下限を Vite+ の 24 系の下限と `@types/node` の minor の高いほうにする | Vite+ が動き、型検査を通った API が下限の Node にある範囲だけを許す                                 | **採用** |
| 24 に絞り、下限を Vite+ の 24 系の下限だけにする (`@types/node` を見ない)        | 型検査を通ったコードが、下限の Node に無い API を呼ぶ                                               | 却下     |
| 24 の全体を許す (`^24.0.0`)                                                      | Vite+ が動かない版 (24.10 以前) を利用者に許す                                                      | 却下     |
| 24 の範囲に `>=26.0.0` を足す                                                    | 24 の `@types/node` が型を持つ API を 26 のどの minor から持つかが決まらず、26 の側の下限を書けない | 却下     |

pnpm を exact にするのは、minor で解決挙動そのものが変わり、`minimumReleaseAge` や `peerDependencyRules` の扱いが動くと lockfile が手元ごとに割れるためである (ADR-0005)。

`devEngines.runtime.onFail` は `error` にする。pnpm も同じフィールドを読み、`download` だと宣言した runtime を自前で解決して lockfile へ記録するためで、runtime は Vite+ が同じ宣言から解決して持っているので 2 つ目の実体は要らない。`vp env pin` の後に戻す手順と実測は `docs/guides/dependencies-and-toolchain.md`「Node.js の版を打ち直す」にある。

同じ版を `.mise.toml` の `[tools]` にも宣言すると、2 つの宣言は別々に解決される。
2026-09-02 の実測では mise が 24.12.0、Vite+ が 24.20.0 を選び、`vp env doctor` が PATH 上の `node` を「vp shim ではない」と警告した。
出所を 1 つにして食い違いを消す。

| 案                                         | 評価                                                                                                                               | 採否     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `package.json` を出所にし Vite+ が解決する | Vite+ が既定で見る場所と一致し、宣言が 1 つになる。`vp env pin` の書き込み先でもある                                               | **採用** |
| `.mise.toml` の `[tools]` を出所にする     | Vite+ は `package.json` を見続けるので二重宣言が残り、食い違いは検出も解消もされない                                               | 却下     |
| mise に `package.json` を読ませる          | 解決するのが mise と Vite+ の 2 つになる。mise が `node` / `pnpm` を PATH へ注入し直すため、`disable_tools` で止めている衝突が戻る | 却下     |
| 両方に宣言し、一致を整合検査で強制する     | 宣言が 2 つある状態は変わらず、検査の維持コストだけが増える                                                                        | 却下     |

### mise を選ぶ理由

| 候補      | 対象ツールの網羅       | 学習コスト      | クローン後の手順                    | 備考                                     |
| --------- | ---------------------- | --------------- | ----------------------------------- | ---------------------------------------- |
| **mise**  | ○                      | 低 (TOML)       | `mise trust && mise install`        | 環境変数と daemons を兼ねる              |
| asdf      | △ プラグイン追加が要る | 低              | プラグイン手動追加 + `asdf install` | mise の下位互換                          |
| proto     | ×                      | 低              | `proto install`                     | moonrepo エコシステム前提                |
| volta     | × Node.js のみ         | 低              | `volta install`                     | pnpm の版を宣言できない                  |
| devbox    | ○                      | 低〜中          | `devbox shell`                      | 裏で Nix を入れる。ディスク消費が大きい  |
| nix flake | ○                      | 最高 (Nix 言語) | `nix develop`                       | 再現性は最も高いが属人化のリスクが大きい |

この表は 2026-08-17 に、版の pin も mise に持たせる前提で比べたものである。
版の解決は Vite+、タスクは Vite Task が持つが、Node.js と pnpm 以外のツールと `[env]` の担い手としての比較はそのまま成り立つ。

宣言だけでは効かないので、mise のシェル hook を導入手順に含める (`docs/guides/dependencies-and-toolchain.md`「手元の環境を用意する」)。

### Vite+ を選ぶ理由

bundler (Vite / Rolldown)、linter (oxlint)、formatter (oxfmt)、test runner (Vitest) の版を 1 パッケージが exact pin して束ねる。
個別に組むと、lint の設定形式・formatter の整形規則・test runner の解決規則がそれぞれ独立に動き、その組み合わせの検証を自分で持つことになる。

代償として、Vite+ が版を管理するパッケージ群は Vite+ のリリース単位でしか動かせない。
この制約が依存更新のゲートに与える影響は ADR-0005 が持つ。

### built-in と同名の script は `start` と対の `build` だけを置く

Vite+ の `docs/guide/local-cli.md`「Best Practices」は、`vp` を呼ぶ scripts を `package.json` に置くことを、global の CLI と併用する場合も含めて勧める ("whether you use both CLIs or only the project-local CLI")。例は `dev` / `check` / `test` / `build` の 4 つで、どれも中身が `vp <name>` である。script の中の `vp` は `node_modules/.bin` から解決する。
勧める利点は、例のコードブロックのあとに置かれた、節の最後の段落にある: "After installing the project's dependencies, contributors can run these scripts through their package manager, such as `pnpm run dev` or `npm run dev`, without being required to install the global CLI." global の CLI を入れていない環境でも、package manager から走らせられることである。

- 開発者の入口 (`check` / `test` / `dev`) は足さない。このリポジトリの開発者は README のセットアップで global の `vp` を入れ、`vp install` も `vp run` のタスクも `.mise.toml` のタスクの `run` もそれを前提にするので、上の利点が当てはまらない。足すと `vp <name>` を打つたびに stderr に note が出る (Consequences)
- `dev` には別の理由もある。`"dev": "vp dev"` は `--strictPort` を持たず、使用中なら Vite が次の空き port へずらす (Vite docs の `server.port`: "if the port is already being used, Vite will automatically try the next available port")。`serve` のタスクは同じ既定の port で起動し、使用中なら止まる。`dev` を置くと、起動した順で port が変わる入口が 1 つ増える
- `build` は `start` と対の入口 (`pnpm run build` → `pnpm start`) として残す。global の `vp` を入れない環境 (本番の Node サーバーなど) がこの 2 つで走らせる。公式が勧める利点がそのまま当てはまる場面である。代償として、`vp build` を打つたびに note が出る (Consequences)

| 案                                                   | 評価                                                                                                                                                                                                                                                                                                           | 採否     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 開発者の入口は足さず、`build` を `start` と対で残す  | global の `vp` の無い環境は `pnpm run build` → `pnpm start` で走らせられる。開発者は `vp check` / `vp test` をそのまま打つ。note は `vp build` でだけ出る                                                                                                                                                      | **採用** |
| built-in と同名の script を置かない (`build` も外す) | `vp build` の note も消えるが、`pnpm start` と対の `pnpm run build` が無くなる。global の `vp` の無い環境は `pnpm exec vp build` と打つことになる (`docs/guide/local-cli.md` の "Without the global CLI, prefix interactive commands with your package manager's local-binary executor, such as `pnpm exec`.") | 却下     |
| 公式の例のうち `check` / `test` も足す               | `pnpm run check` のように package manager からも打てるが、開発者は global の `vp` を入れるので使い道が無い。`vp check` / `vp test` を打つたびに note が出る                                                                                                                                                    | 却下     |
| 公式の例の 4 つをすべて置く                          | 上に加え、`pnpm run dev` は使用中の port から次の空き port へずれ、起動した順で port が変わる                                                                                                                                                                                                                  | 却下     |

### 検討した選択肢

| 案                                                 | 評価                                                               | 採否     |
| -------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| mise + Vite+                                       | 宣言が 2 ファイルに閉じ、クローン後の手順が最小になる              | **採用** |
| バージョン管理を各自に任せる                       | 手元ごとに解決結果が割れ、再現しない失敗の切り分けに時間を取られる | 却下     |
| Vite / ESLint / Prettier / Vitest を個別に構成する | 4 つの版と設定の整合を自分で持つ。組み合わせの検証も自前になる     | 却下     |

## Consequences

- Node.js と pnpm 以外のツールは `.mise.toml` の `[tools]` へ宣言する (`docs/guides/dependencies-and-toolchain.md`「手元の環境を用意する」)
- 開発者のグローバル mise 設定が `node` や `pnpm` を持っていても、`.mise.toml` の `[settings] disable_tools` がその PATH 注入を止める。2026-09-02 の実測では、設定前は `mise env` の PATH に `installs/node/24/bin` と `installs/pnpm/latest` が `~/.vite-plus/bin` より前に入り、設定後は両方が消えて `node` が vp の shim (24.20.0) に解決した
- Vite+ の shim は `pnpm` を含み、素の `pnpm` は `packageManager` の版に解決される (Vite+ の `docs/guide/env.md`。2026-10-02 に vp 1.0.0 の `~/.vite-plus/bin` で確認)。corepack などで別に入れなくてよい (`docs/guides/dependencies-and-toolchain.md`「手元の環境を用意する」)
- Vite+ の更新は同梱ツールの一括更新になる。更新 PR で見るものは `docs/guides/dependencies-and-toolchain.md`「依存を上げたときに見直すもの」にある
- `vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` の script か `vite.config.ts` のタスクを指す。同名の script の中身が `vp <name>` でなければ、両者は別のものを走らせる (`docs/guide/run.md`「Built-in Commands vs Scripts」)。実行前に `package.json` と `vite.config.ts` を確認する
- `build` の script があるので、`vp build` を打つたびに stderr に ``note: You are running `vp build` as a Vite+ built-in command. If you meant to run the build npm script, use `vpr build` instead.`` が出る (2026-10-02 に vp 1.0.0 で観測)。`build` を `start` と対で残す代償である。`check` / `test` を足すと、`vp check` / `vp test` でも同じ note が出る

## 出典

- Vite+ の runtime 解決順と `packageManager` による package manager shim、`vp env pin` の書き込み先: `node_modules/vite-plus/docs/guide/env.md`
- Vite+ が勧める `package.json` の scripts の形: `node_modules/vite-plus/docs/guide/local-cli.md`「Best Practices」(https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/local-cli.md#best-practices)
- built-in と `vp run` の script の違い: `node_modules/vite-plus/docs/guide/run.md`「Built-in Commands vs Scripts」(https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/run.md)
- command の中の `vp run` の展開、タスクの並列、タスクへの引数: `node_modules/vite-plus/docs/guide/run.md`「Nested `vp run`」「Concurrency」「Additional Arguments」(https://github.com/voidzero-dev/vite-plus/blob/v1.1.0/docs/guide/run.md)
- Vite+ の CI の例: `node_modules/vite-plus/docs/guide/ci.md`「GitHub Actions」(https://github.com/voidzero-dev/vite-plus/blob/v1.1.0/docs/guide/ci.md)、`node_modules/vite-plus/docs/guide/github-actions-cache.md` (https://github.com/voidzero-dev/vite-plus/blob/v1.1.0/docs/guide/github-actions-cache.md)
- 失敗した step が自動で開くこと: https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs
- ログを折り畳む `::group::`: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
- 使用中の port を Vite が次の空き port へずらすこと: https://vite.dev/config/server-options#server-port
- 使用中の port なら Vite を終了させる `server.strictPort`: https://vite.dev/config/server-options#server-strictport
- 使用中の port なら Storybook を終了させる `--exact-port`: https://storybook.js.org/docs/api/cli-options
- ブラウザが接続を拒む bad port の表: https://fetch.spec.whatwg.org/#port-blocking
- Vite Task のタスクの定義、`command` の配列、`cache`、`run.cache`: `node_modules/vite-plus/docs/config/run.md` (https://github.com/voidzero-dev/vite-plus/blob/v1.1.0/docs/config/run.md)
- キャッシュの有効化の優先順位と、キャッシュが効くタスクの環境変数: `node_modules/vite-plus/docs/guide/cache.md`「When Is Caching Enabled?」「Environment Variables」(https://github.com/voidzero-dev/vite-plus/blob/v1.1.0/docs/guide/cache.md)
- キャッシュを切ったタスクの環境変数 (`plan_task_as_execution_node` と `effective_cache_config`、vite-plus 1.1.0 の `Cargo.toml` が pin する rev): https://github.com/voidzero-dev/vite-task/blob/7d69d6577ecf6bd83deee32186de59918a712873/crates/vt_plan/src/plan.rs
- キャッシュを切ったタスクの stdio: https://github.com/voidzero-dev/vite-task/blob/7d69d6577ecf6bd83deee32186de59918a712873/docs/stdio.md
- ジョブごとの課金の切り上げ: https://docs.github.com/en/billing/reference/actions-runner-pricing
- private のリポジトリで artifact がプランの枠を使うこと: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- mise の `[env]` の値が届く経路: https://github.com/jdx/mise/blob/v2026.9.18/docs/environments/index.md
- mise の daemons (experimental の要件、自動 port、port の変数、port の重なり、proxy): https://github.com/jdx/mise/blob/v2026.9.18/docs/daemons.md
- mise の daemons の前に pitchfork を入れておくこと、タスクを走らせる daemon (「Daemons that run a task」): https://github.com/jdx/mise/blob/v2026.10.3/docs/daemons.md
- mise のタスクの `interactive`: https://github.com/jdx/mise/blob/v2026.10.3/docs/tasks/task-configuration.md
- mise の daemons が pitchfork を toolset に足すサブコマンドを `start`・`restart`・`register` に絞る判定 (`install`): https://github.com/jdx/mise/blob/v2026.10.3/src/cli/daemons.rs
- mise の daemons が pitchfork を toolset に足す条件 (`toolset_resolved`)、PATH から実体を探す順序 (`Runtime::from_toolset`)、pitchfork の下限 (`supports_external_config`、`supports_argv_run`): https://github.com/jdx/mise/blob/v2026.10.3/src/daemons/runtime.rs
- mise のツールの版の書き方 (前方一致と `prefix:`): https://github.com/jdx/mise/blob/v2026.10.3/docs/configuration.md
- pitchfork が外部の設定の登録を持った版: https://github.com/jdx/pitchfork/blob/v2.25.0/CHANGELOG.md
- pitchfork が daemon をシェルを通さずに起動できるようになった版: https://github.com/jdx/pitchfork/blob/v2.28.0/CHANGELOG.md
- mise の `experimental` の設定: https://github.com/jdx/mise/blob/v2026.9.18/settings.toml
- mise の `min_version` (「Minimum mise version」): https://github.com/jdx/mise/blob/v2026.9.18/docs/configuration.md
- npm の `devEngines` 仕様: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines
- mise の `disable_tools` と、設定をローカル config へ置けること: https://mise.jdx.dev/configuration/settings.html
- mise が読む Node.js のバージョンファイル (`devEngines` は idiomatic version file 扱いで既定 off): https://mise.jdx.dev/lang/node.html
