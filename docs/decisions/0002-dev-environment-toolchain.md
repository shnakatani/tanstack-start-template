# ADR-0002: 開発環境のツールチェーンは mise と Vite+ に寄せる

- Status: Accepted
- Date: 2026-08-17
- Revised: 2026-09-02 (runtime と package manager の版の出所を `package.json` へ一本化し、mise は tasks と環境変数だけを持つようにした。型検査を tsgolint に委ね `typescript` を依存から外した。アプリ名を環境変数からモジュール定数へ戻した)

## Context

クローンした開発者ごとに Node.js とパッケージマネージャのバージョンが違うと、`vp install` の解決結果と型検査の結果が手元ごとに割れる。
バージョンの宣言と、その宣言を実際に効かせる仕組みの両方が要る。

フロントエンドのツールは、bundler と linter と formatter と test runner を個別に選ぶと、それぞれの版と設定の整合を自分で持つことになる。

## Decision

### 採用するツール

| ツール      | 役割                                                                                                | 宣言する場所                                            |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| mise        | タスクランナー、環境変数                                                                            | `.mise.toml` の `[tasks.*]` と `[env]`                  |
| Vite+       | Node.js と pnpm の解決、dev server / build / lint / format / test / パッケージ操作の統一 CLI (`vp`) | `package.json` と `pnpm-workspace.yaml` の `catalog:`   |
| pnpm        | パッケージマネージャ                                                                                | `package.json` の `packageManager`                      |
| drizzle-kit | スキーマからの migration 生成と適用                                                                 | `package.json` と `mise run db:generate` / `db:migrate` |

クローン後の手順は `mise trust && mise install` と `vp install` の 2 段で閉じる。
起動と検証は `mise run serve` と `mise run verify` を入口にする。
CI は mise を要さない。`.mise.toml` の `[tasks.verify]` と同じ順序を workflow へ並べる。
`vp run` のタスクへまとめて 1 箇所にする案は採らない。Vite Task は親の環境変数を素通しせず (`env` / `untrackedEnv` への明示が要る)、既定で結果をキャッシュするため、マージ前の gate がリプレイで済まされる。3 行の重複より、gate が必ず走ることを採る。

### 値の置き場所を 3 つに分ける

| 種別                       | 置き場所                         | 例                          |
| -------------------------- | -------------------------------- | --------------------------- |
| 環境で変わらない値         | モジュール定数                   | `src/lib/app-name.ts`       |
| 環境で変わるが秘密でない値 | `.mise.toml` の `[env]`          | `DEV_PORT` / `DB_FILE_NAME` |
| 秘密                       | 暗号化して commit + 実行時に復号 | 現時点で該当なし            |

アプリ名のように環境ごとに値が変わらないものは環境変数にしない。
初版 (2026-08-17) は `VITE_APP_NAME` を `.mise.toml` の `[env]` に置いていたが、値の定義・型宣言・未設定の検出・CI への受け渡しが芋づるで要り、CI が mise に依存する原因になっていた。

### `envDir: false` で Vite の `.env` 読み込みを切る

秘密を扱う段になったときの前提を先に固定する。
Vite 公式は「`VITE_*` variables should _not_ contain sensitive information」と明記しており、client へ出る値は暗号化しても意味がない。秘密は server 側にしか存在し得ない。

暗号化した `.env` をそのまま commit する方式 (dotenvx は暗号文を `.env` 自身へ書き戻し、秘密鍵だけを `.env.keys` へ出す) は、Vite が `.env` を native に読むと衝突する。暗号文が復号されないまま `import.meta.env` と `process.env` へ流れ込むためで、vitejs/vite#19373 がその報告である。`envDir: false` はその解として Vite へ追加された。

読み込む `.env` が現時点で無いので、いま切っても失うものは無い。逆に、後から `.env` を置いた人が「Vite が勝手に読む」前提でコードを書くのを防げる。

`envDir: false` は `vite.config.ts` / `vitest.config.ts` / `vitest.browser.config.ts` の 3 つへ書く。
Vitest の config は Vite の config を継承せず上書きする (公式が「all options in your `vite.config` will be ignored」と明記)。
`mergeConfig` で引き継ぐ手はあるが採らない。test 用の config を分けているのは `tanstackStart()` を外すためで (TanStack/router#6246 の回避)、全体を継承すると plugin ごと戻る。
片方だけに書くと、暗号化した `.env` を置いた時点でビルドとテストで挙動が割れ、最も切り分けにくい形の不具合になる。

秘密が要るようになったら、暗号化した env ファイルと `dotenvx run --` のような復号経路を Vite の env 機構と分けて足す。Vite は「既に存在する環境変数を `.env` で上書きしない」仕様なので、復号を先に済ませて `process.env` へ入れる形が噛み合う。

### runtime と package manager の版は `package.json` が持つ

Vite+ は managed mode が既定で、`node` / `npm` / package manager の shim をプロジェクトごとに解決する。
解決順は `.node-version` → `devEngines.runtime` → `engines.node` → `.nvmrc` で、`devEngines.runtime` が上に立つのは、それが開発環境の要求を表すのに対し `engines.node` は利用者向けのサポート範囲だからである (Vite+ の `docs/guide/env.md`)。
package manager の版は `packageManager` が決める。`vp env pin` が書き込む先も `devEngines.runtime` で、`engines.node` は書き換えない。

| 宣言                 | 決めるもの                      | 形                |
| -------------------- | ------------------------------- | ----------------- |
| `devEngines.runtime` | 開発時に使う Node.js            | major まで (`24`) |
| `engines.node`       | 利用者に要求する Node.js の範囲 | `>=24`            |
| `packageManager`     | pnpm の版                       | exact             |

Node.js を major までにするのは、minor 差が解決結果を変えないためである。
pnpm を exact にするのは、minor で解決挙動そのものが変わり、`minimumReleaseAge` や `peerDependencyRules` の扱いが動くと lockfile が手元ごとに割れるためである (ADR-0005)。

`devEngines.runtime.onFail` は `error` にする。
pnpm も同じフィールドを読み、`download` だと宣言した runtime を自前で解決して lockfile へ記録し `node_modules` へ展開する。
2026-09-02 の実測では、`vp remove` の再解決で `node@runtime:24.20.0` と全プラットフォーム分の tarball URL が lockfile に入り、`node_modules/node` が生えた。
runtime は Vite+ が同じ宣言から解決して持っているので 2 つ目の実体は要らない。`error` にすると、宣言を満たさない Node.js で pnpm を動かしたときの検査だけが残る。
`vp env pin` が書き込む既定値は `download` なので、pin を打ち直したら戻す。

初版 (2026-08-17) は同じ版を `.mise.toml` の `[tools]` にも宣言していた。
2 つの宣言は別々に解決され、2026-09-02 の実測では mise が 24.12.0、Vite+ が 24.20.0 を選び、`vp env doctor` が PATH 上の `node` を「vp shim ではない」と警告していた。
出所を 1 つにして食い違いを消す。

| 案                                         | 評価                                                                                                                               | 採否     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `package.json` を出所にし Vite+ が解決する | Vite+ が既定で見る場所と一致し、宣言が 1 つになる。`vp env pin` の書き込み先でもある                                               | **採用** |
| `.mise.toml` の `[tools]` を出所にする     | Vite+ は `package.json` を見続けるので二重宣言が残り、食い違いは検出も解消もされない                                               | 却下     |
| mise に `package.json` を読ませる          | 解決するのが mise と Vite+ の 2 つになる。mise が `node` / `pnpm` を PATH へ注入し直すため、`disable_tools` で止めている衝突が戻る | 却下     |
| 両方に宣言し、一致を整合検査で強制する     | 宣言が 2 つある状態は変わらず、検査の維持コストだけが増える                                                                        | 却下     |

### 型検査は tsgolint が担い、`typescript` は依存に持たない

`vp check` の型検査は oxlint の type-aware パスが担い、その実体は tsgolint と TypeScript Go ツールチェーンである (Vite+ の `docs/guide/check.md`)。
`typescript` パッケージを直接の依存に置かなくても動く。2026-09-02 の実測では、`devDependencies` から外した状態で `vp check` が `TS2322` を報告した。
型検査を lint へ合流させる設定 (`options.typeCheck`) は `scripts/checks/integrity/lint-config.test.ts` が解決後設定の値で機械強制する。設定が真のまま tsgolint が黙って動かない場合は捕まえられない。

実体は Vite+ 一族の推移依存として入るため install からは消えない。
直接の依存に戻すのは、リポジトリのコードが `typescript` を `import` するようになったときだけとする。

### mise を選ぶ理由

| 候補      | 対象ツールの網羅       | 学習コスト      | クローン後の手順                    | 備考                                     |
| --------- | ---------------------- | --------------- | ----------------------------------- | ---------------------------------------- |
| **mise**  | ○                      | 低 (TOML)       | `mise trust && mise install`        | タスクランナーを兼ねる                   |
| asdf      | △ プラグイン追加が要る | 低              | プラグイン手動追加 + `asdf install` | mise の下位互換                          |
| proto     | ×                      | 低              | `proto install`                     | moonrepo エコシステム前提                |
| volta     | × Node.js のみ         | 低              | `volta install`                     | pnpm の版を宣言できない                  |
| devbox    | ○                      | 低〜中          | `devbox shell`                      | 裏で Nix を入れる。ディスク消費が大きい  |
| nix flake | ○                      | 最高 (Nix 言語) | `nix develop`                       | 再現性は最も高いが属人化のリスクが大きい |

この表は 2026-08-17 に版の pin も含めて比べたときのものである。
版の解決を Vite+ へ移した後も、タスクランナーと `[env]` の担い手として mise を採る判断は変わらない。

宣言だけでは効かないので、mise のシェル hook を導入手順に含める。
hook を入れていない手元では `[env]` が読まれず、`DEV_PORT` と `DB_FILE_NAME` が未設定のまま走る。

### Vite+ を選ぶ理由

bundler (Vite / Rolldown)、linter (oxlint)、formatter (oxfmt)、test runner (Vitest) の版を 1 パッケージが exact pin して束ねる。
個別に組むと、lint の設定形式・formatter の整形規則・test runner の解決規則がそれぞれ独立に動き、その組み合わせの検証を自分で持つことになる。

代償として、Vite+ が版を管理するパッケージ群は Vite+ のリリース単位でしか動かせない。
この制約が依存更新のゲートに与える影響は ADR-0005 が持つ。

### 検討した選択肢

| 案                                                 | 評価                                                               | 採否     |
| -------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| mise + Vite+                                       | 宣言が 2 ファイルに閉じ、クローン後の手順が最小になる              | **採用** |
| バージョン管理を各自に任せる                       | 手元ごとに解決結果が割れ、再現しない失敗の切り分けに時間を取られる | 却下     |
| Vite / ESLint / Prettier / Vitest を個別に構成する | 4 つの版と設定の整合を自分で持つ。組み合わせの検証も自前になる     | 却下     |

## Consequences

- Node.js と pnpm 以外のツールを足すときは `.mise.toml` の `[tools]` へ宣言する。手元でグローバルに入れたものに依存しない
- 開発者のグローバル mise 設定が `node` や `pnpm` を持っていても、`.mise.toml` の `[settings] disable_tools` がその PATH 注入を止める。2026-09-02 の実測では、設定前は `mise env` の PATH に `installs/node/24/bin` と `installs/pnpm/latest` が `~/.vite-plus/bin` より前に入り、設定後は両方が消えて `node` が vp の shim (24.20.0) に解決した
- Vite+ が既定で作る shim は `node` / `npm` / `npx` / `corepack` で、`pnpm` は含まれない。素の `pnpm` が要るなら `corepack enable` を実行する。Vite+ の corepack shim は `--install-directory` を Vite+ の bin へ向けるので、作られた launcher は PATH に載り `packageManager` の版に従う
- Vite+ の更新は同梱ツールの一括更新になる。lint ルールの追加や formatter の整形規則の変更が同じ更新で入りうるため、更新 PR は `mise run verify` の結果まで見て判断する
- `vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` の script か `vite.config.ts` のタスクを指す。同名でも別物なので、実行前に `package.json` と `vite.config.ts` を確認する

## 出典

- Vite+ の runtime 解決順と `packageManager` による package manager shim、`vp env pin` の書き込み先: `node_modules/vite-plus/docs/guide/env.md`
- npm の `devEngines` 仕様: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines
- mise の `disable_tools` と、設定をローカル config へ置けること: https://mise.jdx.dev/configuration/settings.html
- mise が読む Node.js のバージョンファイル (`devEngines` は idiomatic version file 扱いで既定 off): https://mise.jdx.dev/lang/node.html
