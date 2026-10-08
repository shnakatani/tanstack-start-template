# ADR-0004: 開発環境のツールチェーンは mise と Vite+ に寄せる

- Status: Accepted
- Date: 2026-10-09
- 関連: ADR-0005 (依存更新の待機)

## Context

クローンした開発者ごとに Node.js とパッケージマネージャのバージョンが違うと、`vp install` の解決結果と型検査の結果が手元ごとに割れる。
バージョンの宣言と、その宣言を実際に効かせる仕組みの両方が要る。

フロントエンドのツールは、bundler と linter と formatter と test runner を個別に選ぶと、それぞれの版と設定の整合を自分で持つことになる。

## Decision

### 採用するツール

| ツール      | 役割                                                                                                | 宣言する場所                                            |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| mise        | タスクランナー、環境変数、dev server と Storybook の port                                           | `.mise.toml` の `[tasks.*]` と `[env]` と `[daemons.*]` |
| Vite+       | Node.js と pnpm の解決、dev server / build / lint / format / test / パッケージ操作の統一 CLI (`vp`) | `package.json` と `pnpm-workspace.yaml` の `catalog:`   |
| pnpm        | パッケージマネージャ                                                                                | `package.json` の `packageManager`                      |
| drizzle-kit | スキーマからの migration 生成と適用                                                                 | `package.json` と `mise run db:generate` / `db:migrate` |

クローン後の手順は `mise trust && mise install` と `vp install` の 2 段で閉じる。
起動と検証は `mise run serve` と `mise run verify` を入口にする。
CI は mise を要さない。`.mise.toml` の `[tasks.verify]` と同じ順序を workflow へ並べる。例外は `pnpm peers check` で、install が要らないので別のジョブに置き、verify と並列に走らせる。
`vp run` のタスクへまとめて 1 箇所にする案は採らない。Vite Task は親の環境変数を素通しせず (`env` / `untrackedEnv` への明示が要る)、既定で結果をキャッシュするため、マージ前の gate がリプレイで済まされる。手順の重複より、gate が必ず走ることを採る。

### 値の置き場所を 3 つに分ける

| 種別                       | 置き場所                         | 例                    |
| -------------------------- | -------------------------------- | --------------------- |
| 環境で変わらない値         | モジュール定数                   | `src/lib/app-name.ts` |
| 環境で変わるが秘密でない値 | `.mise.toml` の `[env]`          | `DB_FILE_NAME`        |
| 秘密                       | 暗号化して commit + 実行時に復号 | 現時点で該当なし      |

アプリ名のように環境ごとに値が変わらないものは環境変数にしない。
`VITE_APP_NAME` を `.mise.toml` の `[env]` に置くと、値の定義・型宣言・未設定の検出・CI への受け渡しが芋づるで要り、CI が mise に依存する原因になる。

毎回の解決にコストがかかる値も `[env]` へ置かない。mise が env を解決するたび (シェル hook の下ではディレクトリへ入るたび) にその処理が走る。

### dev server と Storybook の port は mise の daemons の自動 port で worktree ごとに決める

`.mise.toml` の `[daemons.serve]` と `[daemons.storybook]` を、同名のタスクを走らせる daemon として宣言し、`port = { auto = true, base = 3000 }` (Storybook は `6006`) を置く。mise は設定を読む時点で port を決め、`SERVE_PORT` と `STORYBOOK_PORT` として出す (mise docs「Ports, URLs, and worktrees」の Automatic ports と Port variables)。タスクはこの値を `--port` に渡すので、`mise run serve` で前面に起動しても、`mise daemons start serve` で常駐させても同じ port になる。

2026-10-09 に mise 2026.9.18 で確かめた振る舞いは次のとおりである。

| 場所                                     | port                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| git の primary checkout                  | `3000` / `6006`                                        |
| linked worktree                          | パスから決まる別の値 (`3001`〜`3511` / `6007`〜`6517`) |
| 同じ port での 2 つ目の `mise run serve` | `Port <port> is already in use` で終了する             |

- daemons は experimental で、`[settings]` の `experimental = true` が要る (mise docs「Daemons」の Requirements)。このフラグは daemons のほかに、既定になる前の振る舞いも有効にする (mise docs の settings の `experimental`: "Some new behavior also ships behind this flag before it becomes the default")
- 自動 port は mise v2026.9.12 から使える。`min_version` は確かめた版の `2026.9.18` にし、それより古い mise を設定の読み込みで止める
- mise は bad port を避けない。ブラウザは WHATWG Fetch の bad port への接続を拒むが、server は起動するので、使用中かを見るフラグでは気づけない (2026-10-04 に port 3659 で起動した dev server へ、curl は 200 を返し、Playwright 1.63.0 の Chromium は `net::ERR_UNSAFE_PORT` で開けなかった)。`base` を変えるときは、`base` から `base + 511` に bad port が入らない値を選ぶ。`3000`〜`3511` と `6006`〜`6517` には無い (whatwg/fetch の e9460d1、2026-10-06)

| 案                                                      | 評価                                                                                                                                                              | 採否     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| mise の daemons の自動 port                             | primary checkout で base、worktree ごとに別の port、重なったら終了、を mise の宣言だけで持てる。experimental なので `experimental = true` と `min_version` が要る | **採用** |
| worktree の名前のハッシュから自前の script で導出する   | 同じ振る舞いを、primary checkout の判定と bad port の表ごと自前で持つ                                                                                             | 却下     |
| 割り当てを記録して重なりをなくす (workz、devports など) | lock と、消えた worktree の割り当ての回収を自前で持つ                                                                                                             | 却下     |

自動 port は別の worktree や別のプロジェクトの port と重なりうる。mise も重なった port をずらさない (mise docs「Ports, URLs, and worktrees」の Port conflicts)。使用中なら次の port へずらさず終了させる (`serve` は `--strictPort`、`storybook` は `--exact-port`)。
Vite は使用中なら次の空き port へずらし (Vite docs の `server.port`: "if the port is already being used, Vite will automatically try the next available port")、Storybook も環境変数 `CI` があると尋ねずにずらす (2026-10-04 に storybook@10.6.0 で実測)。
ずれると、worktree ごとに決まった port を指す側が別のサーバーへつながる。

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
| **mise**  | ○                      | 低 (TOML)       | `mise trust && mise install`        | タスクランナーを兼ねる                   |
| asdf      | △ プラグイン追加が要る | 低              | プラグイン手動追加 + `asdf install` | mise の下位互換                          |
| proto     | ×                      | 低              | `proto install`                     | moonrepo エコシステム前提                |
| volta     | × Node.js のみ         | 低              | `volta install`                     | pnpm の版を宣言できない                  |
| devbox    | ○                      | 低〜中          | `devbox shell`                      | 裏で Nix を入れる。ディスク消費が大きい  |
| nix flake | ○                      | 最高 (Nix 言語) | `nix develop`                       | 再現性は最も高いが属人化のリスクが大きい |

この表は 2026-08-17 に、版の pin も mise に持たせる前提で比べたものである。
版の解決は Vite+ が持つが、タスクランナーと `[env]` の担い手としての比較はそのまま成り立つ。

宣言だけでは効かないので、mise のシェル hook を導入手順に含める (`docs/guides/dependencies-and-toolchain.md`「手元の環境を用意する」)。

### Vite+ を選ぶ理由

bundler (Vite / Rolldown)、linter (oxlint)、formatter (oxfmt)、test runner (Vitest) の版を 1 パッケージが exact pin して束ねる。
個別に組むと、lint の設定形式・formatter の整形規則・test runner の解決規則がそれぞれ独立に動き、その組み合わせの検証を自分で持つことになる。

代償として、Vite+ が版を管理するパッケージ群は Vite+ のリリース単位でしか動かせない。
この制約が依存更新のゲートに与える影響は ADR-0005 が持つ。

### built-in と同名の script は `start` と対の `build` だけを置く

Vite+ の `docs/guide/local-cli.md`「Best Practices」は、`vp` を呼ぶ scripts を `package.json` に置くことを、global の CLI と併用する場合も含めて勧める ("whether you use both CLIs or only the project-local CLI")。例は `dev` / `check` / `test` / `build` の 4 つで、どれも中身が `vp <name>` である。script の中の `vp` は `node_modules/.bin` から解決する。
勧める利点は、例のコードブロックのあとに置かれた、節の最後の段落にある: "After installing the project's dependencies, contributors can run these scripts through their package manager, such as `pnpm run dev` or `npm run dev`, without being required to install the global CLI." global の CLI を入れていない環境でも、package manager から走らせられることである。

- 開発者の入口 (`check` / `test` / `dev`) は足さない。このリポジトリの開発者は README のセットアップで global の `vp` を入れ、`vp install` も `.mise.toml` のタスクもそれを前提にするので、上の利点が当てはまらない。足すと `vp <name>` を打つたびに stderr に note が出る (Consequences)
- `dev` には別の理由もある。起動の入口は worktree ごとに port を導出する `mise run serve` である。`"dev": "vp dev"` は Vite の既定の port で起動し、使用中なら Vite が次の空き port へずらす (Vite docs の `server.port`: "if the port is already being used, Vite will automatically try the next available port")。`mise run serve` が worktree ごとに決める port から外れ、起動した順で port が変わる
- `build` は `start` と対の入口 (`pnpm run build` → `pnpm start`) として残す。global の `vp` を入れない環境 (本番の Node サーバーなど) がこの 2 つで走らせる。公式が勧める利点がそのまま当てはまる場面である。代償として、`vp build` を打つたびに note が出る (Consequences)

| 案                                                   | 評価                                                                                                                                                                                                                                                                                                           | 採否     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 開発者の入口は足さず、`build` を `start` と対で残す  | global の `vp` の無い環境は `pnpm run build` → `pnpm start` で走らせられる。開発者は `vp check` / `vp test` をそのまま打つ。note は `vp build` でだけ出る                                                                                                                                                      | **採用** |
| built-in と同名の script を置かない (`build` も外す) | `vp build` の note も消えるが、`pnpm start` と対の `pnpm run build` が無くなる。global の `vp` の無い環境は `pnpm exec vp build` と打つことになる (`docs/guide/local-cli.md` の "Without the global CLI, prefix interactive commands with your package manager's local-binary executor, such as `pnpm exec`.") | 却下     |
| 公式の例のうち `check` / `test` も足す               | `pnpm run check` のように package manager からも打てるが、開発者は global の `vp` を入れるので使い道が無い。`vp check` / `vp test` を打つたびに note が出る                                                                                                                                                    | 却下     |
| 公式の例の 4 つをすべて置く                          | 上に加え、`pnpm run dev` が `mise run serve` の port から外れ、起動した順で port が変わる                                                                                                                                                                                                                      | 却下     |

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
- 使用中の port を Vite が次の空き port へずらすこと: https://vite.dev/config/server-options#server-port
- 使用中の port なら Vite を終了させる `server.strictPort`: https://vite.dev/config/server-options#server-strictport
- 使用中の port なら Storybook を終了させる `--exact-port`: https://storybook.js.org/docs/api/cli-options
- ブラウザが接続を拒む bad port の表: https://fetch.spec.whatwg.org/#port-blocking
- mise の daemons と experimental の要件: https://mise.jdx.dev/daemons.html
- mise の daemons の自動 port と port の重なり: https://mise.jdx.dev/daemons/worktrees.html
- mise の `experimental` の設定: https://mise.jdx.dev/configuration/settings.html#experimental
- mise の `min_version`: https://mise.jdx.dev/configuration.html#minimum-mise-version
- npm の `devEngines` 仕様: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines
- mise の `disable_tools` と、設定をローカル config へ置けること: https://mise.jdx.dev/configuration/settings.html
- mise が読む Node.js のバージョンファイル (`devEngines` は idiomatic version file 扱いで既定 off): https://mise.jdx.dev/lang/node.html
