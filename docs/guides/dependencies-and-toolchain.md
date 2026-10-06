# 依存と開発環境

依存を足す・上げる・前倒しするとき、ツールや設定を足すとき、commit hook を止めるときの手順と落とし穴を持つ。

| 決定                                                                                        | ADR      |
| ------------------------------------------------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                           | ADR-0004 |
| 依存更新は待機 3 日で統一し、pin には出口条件を書く                                         | ADR-0005 |
| GitHub Actions の定義は zizmor で検査し、action は commit SHA で固定する                    | ADR-0006 |
| テストの import を重くする依存のバレルは使わず、個別エントリポイントから引き、lint で止める | ADR-0032 |

## how-to

### 手元の環境を用意する

- mise のシェル hook を入れる。hook を入れていない手元では `.mise.toml` の `[env]` が読まれず、`DB_FILE_NAME` が未設定のまま走る。port の導出はタスクの `env` に置いてあるので、hook が無くても `mise run serve` / `mise run storybook` は port を決められる
- 素の `pnpm` は corepack などで別に入れない。Vite+ の shim が `packageManager` の版の `pnpm` を用意する ([Vite+ docs「Environment」][]。確かめた結果は「入口を `vp` にそろえる理由」)
- Node.js と pnpm 以外のツールを足すときは、`.mise.toml` の `[tools]` へ宣言する。手元でグローバルに入れたものに依存しない

### commit hook を扱う

commit のたびに、`vp staged` が `vite.config.ts` の `staged` のコマンドを staged のファイルへ当てる。`vp staged` は `.vite-hooks/pre-commit` から呼び、hook のディスパッチャ (`.vite-hooks/_`) は `package.json` の `prepare` の `vp config` が入れる ([Vite+ docs「Commit Hooks」][])。

- `vp staged` と hook の間に、自前の skip のスクリプトを挟まない。止める手段は、Vite+ が入れた hook 自身が実行のたびに確かめる ([Vite+ docs「Commit Hooks」][]: "The installed hooks check the environment on every run, so you can disable them per machine or per process without uninstalling anything.")
- hook を止めるときは、止める範囲で [Vite+ docs「Commit Hooks」][] の手段を選ぶ。CI のビルドコンテナのように環境ごと止めるなら `VP_GIT_HOOKS=0` を設定する。`prepare` の `vp config` が hook を入れず、入っている hook も何もせずに終わる (Environment variable の節)。コミットするプロセスがシェルの環境を受け継がない (デーモンなど) なら、マシンごとの init script (`~/.config/vite-plus/hooks-init.sh`) で `VP_GIT_HOOKS=0` を export する (Init script の節)。1 つの clone で止めるなら `vp hooks disable` を打つ (Removing commit hooks の節)
- `staged` のコマンドに付けた `--no-error-on-unmatched-pattern` を外さない。staged のファイルが `ignorePatterns` に当たるもの (`src/routeTree.gen.ts` など) だけのコミットでは対象が 0 件になり、`vp fmt` と `vp lint` が error で終わって commit が止まる。`vp lint --help` はこのフラグを "Do not exit with an error when no files are selected for linting (for example, after applying ignore patterns)" と説明する。2026-10-06 に vite-plus 1.0.0 で `src/routeTree.gen.ts` だけを渡すと、`vp fmt --write` は exit 2 (`Expected at least one target file`)、`vp lint` は exit 1 で終わり、このフラグを付けるとどちらも 0 で終わった

### 依存を足す・外す

- 依存は `vp add` / `vp remove` で足し外す ([Vite+ docs「Package Management」][] の「Add and Remove」)。素の `pnpm` / `npm` / `yarn` で足し外さない。理由は「入口を `vp` にそろえる理由」にある
- `vp` が中継しないサブコマンドだけは素の `pnpm` で打つ。`pnpm peers check` がこれに当たる (「peer の食い違いを数える」)

### Node.js の版を打ち直す

`vp env pin` で `devEngines.runtime` を打ち直したら、`devEngines.runtime.onFail` を `error` へ戻す。`vp env pin` が書き込む既定は `download` で、pnpm もこのフィールドを読む。`download` のままだと pnpm が宣言の runtime を自前で解決して lockfile へ記録し、`node_modules/node` を展開する (2026-09-02 に `vp remove` の再解決で、`node@runtime:24.20.0` と全プラットフォーム分の tarball URL が lockfile に入った)。

### 秘密を足す

秘密が要るようになったら、暗号化した env ファイルと、`dotenvx run --` のような復号の経路を、Vite の env 機構と分けて足す。Vite は既に在る環境変数を `.env` で上書きしないので、復号を先に済ませて `process.env` へ入れる形が噛み合う。Vite の `.env` 読み込みは `envDir: false` で切ってある (ADR-0004)。

- 暗号化した env ファイルは `.gitignore` の `.env` か `.env.*` に当たる。commit するファイルは `!.env.production` のような行で外し、その行を、同じファイルに当たるどの行よりも後ろに置く。同じ `.gitignore` の中では最後に当たった行が効くので、ツールの init が後から末尾に足した行が当たると、`!` の行は打ち消される ([gitignore(5)][])
- 秘密鍵の `.env.keys` は `.env.*` が覆う。dotenvx が ignore を求めるのはこのファイルである ([dotenvx README][])

### Dependabot の alerts を有効にする

テンプレートから作ったリポジトリで、Dependabot の alerts と security updates を有効にする (ADR-0005)。この設定はコードに現れない。

```bash
gh api -X PUT /repos/<owner>/<repo>/vulnerability-alerts
gh api -X PUT /repos/<owner>/<repo>/automated-security-fixes
```

### 待機を前倒しする

公開後 3 日を待たずに取り込みたいときは、そのバージョンが公式のリリースパイプラインから出たものかを確かめる (ADR-0005「前倒しは provenance を確認してから」)。

```bash
curl -s https://registry.npmjs.org/<pkg>/<version> | jq '{_npmUser, repository, attestations: .dist.attestations}'
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/<pkg>@<version>"
```

1. `_npmUser` に `trustedPublisher` があれば OIDC による公開である。個人トークンでの公開は、トークンの漏洩が成立経路になるので、前倒しの根拠に足りない
2. attestation の `subject` が対象の package と version に一致し、`workflow.repository` が公式のリポジトリで、`workflow.ref` が既定のブランチかリリースタグであることまで見る
3. `pnpm-workspace.yaml` の `minimumReleaseAgeExclude` へ、バージョンまで固定して (`@scope/pkg@x.y.z`) 追記する

追記したエントリの後始末は `minimumReleaseAgeExcludePrune` (pnpm 11.22.0) が持つ。`vp add` / `update` / `remove` が、lockfile の解決から消えたエントリを自動で消す。`@scope/*` のパターンは常に残る。`vite-plus` のような名前だけの行は、lockfile が解決しなくなれば消える。

### peer の食い違いを数える

```bash
pnpm peers check
```

- lockfile を読んで、宣言された peer の範囲と入っている版の食い違いを数える (pnpm 11.0.0 から)。lockfile は書き換えない
- 素の `pnpm` で打つ。`vp pm` は `peers` を中継しない (`vp pm peers check` は `Command 'peers' not found`。2026-09-28 に vite-plus 1.0.0 で確認)
- `vp install` の出力が静かでも、食い違いが無いとは限らない。lockfile が最新なら install は解決を走らせず、peer の食い違いを報告しない ([pnpm/pnpm#14114][])
- 許可を外すだけでは lockfile が変わらないので、`--force` を付けても `strictPeerDependencies: true` にしても install は通る (2026-09-29、pnpm 11.28.0)。`pnpm peers check` だけが食い違いを出す
- 食い違いを許すなら、`pnpm-workspace.yaml` の `peerDependencyRules.allowedVersions` に親つきのキー (`"<親>><peer>": "<確かめた版の major>"`) で書き、理由と撤去条件をコメントに残す。`*` や親なしのキーにすると、版が上がって新しく食い違っても見えなくなる
- 撤去条件は、pin の出口条件と同じく上流の修正かリリースで書き、Dependabot の PR を処理するときに確かめる (ADR-0005「pin には出口条件を書く」)
- Vite+ を上げたら、`vite-plus/versions` の export が残っているかを確かめる。`storybook>vite-plus` の許可は値を major にしたので、export が消えても `pnpm peers check` は鳴らない
- storybook を上げたら、dist が `vite-plus` から import しているものを読み直す。`storybook>vite-plus` の許可は、storybook が `vite-plus/versions` だけを読むことを前提にしている (`storybook@10.6.0` の dist で確認)
- キーの親に版を付けない (`"<親>@<版>><peer>"` にしない)。pnpm 11 の `pnpm peers check` は親の版を捨て、名前だけで照合する。install は親の版を見るので、2 つの判定が割れる (2026-09-29 に 11.28.0 で実測。12.6.0 の `pnpm peers check` は親の版を見る)
- 許可した側の major を上げると、許可の範囲を外れて `pnpm peers check` に再び食い違いとして出る。新しい major で動くことを確かめ直してから、値を書き換える
- 親を上げたら、そのエントリの撤去条件を見る。どのエントリが何を待っているかは `pnpm-workspace.yaml` のコメントが持つ
- `@vitejs/plugin-react` と `oxc-transform-react` は、`.github/dependabot.yml` の `react-compiler` グループで 1 本の PR にする。plugin-react は optional peer の oxc-transform-react を呼び出す。その peer の範囲は `pnpm-workspace.yaml` の `peerDependencyRules.allowedVersions` の `"@vitejs/plugin-react>oxc-transform-react"` で許しているので、install は食い違いを止めない。別々の PR に割れると、上流が試していない組み合わせが片方ずつ入る
- `vite` と `vitest` の `allowAny` と `allowedVersions` の行は例外で、`vp migrate` が書き、消しても書き戻す (2026-09-28、vite-plus 1.0.0 で実測)
- `vitest` の行は効いていない。`overrides` の `vitest@*` は `catalog:` を指し、catalog を指す override は peer の宣言も置き換える ([pnpm docs「Overriding peer dependencies」][])。`vitest` の peer の食い違いは `pnpm peers check` に出ない
- `vite` の行は効いている。`vite@*` の catalog の値は `npm:` の alias で、このとき peer の宣言は置き換わらず、行を消すと `pnpm peers check` が食い違いを出す (2026-09-28、pnpm 11.28.0 で実測。pnpm の docs はこの場合を書いていない)

### 依存をバレルの禁止の対象に足す

対象に足すかは ADR-0032 の基準で決める。手順は次のとおり。実例は `tooling/lint/config.ts` の `RESTRICTED_BARREL_IMPORTS` の date-fns の 2 行。

1. 依存の `package.json` の `exports` を読み、個別エントリポイントがあるかと、バレルがどれか (ルートの `.`、`./locale` のようなまとめ) を確かめる。個別エントリポイントが無い依存は対象にできない
2. バレルから 1 つだけ import するテストと、同じものを個別エントリポイントから import するテストを 1 ファイルずつ `src/lib/` に一時的に置く。Node で読むなら `.test.ts`、ブラウザで読むなら `.test.tsx`
3. 1 ファイルずつ `vp test run --project <unit か browser> <ファイル> --experimental.importDurations.print --experimental.importDurations.limit=10` を複数回実行し、`Duration` の `import` と、内訳が出れば `Total import time` の self を回ごとに控える。`Total import time` の total は入れ子の import を二重に数えるので使わない (ADR-0032 の「調査結果」)。browser project は 1 回目に依存の事前バンドルが走りうるので、比較から外す
4. 比較する回の中央値の差が、両者の最大と最小の差の和を超えるかを見る。超えなければ足さない
5. 足すなら `RESTRICTED_BARREL_IMPORTS` に `{ name, message }` を 1 つずつ足す。`name` は specifier の完全一致で、サブパス (`date-fns/format`) は止めない。`message` には個別エントリポイントの例と `(ADR-0032)` を書く
6. `vp lint -f unix src scripts .storybook` で、足した依存のバレルを import している箇所を洗い出し、個別エントリポイントへ直す
7. 一時的に置いたテストを消す

- 依存の中の import (ある依存が別の依存のバレルを読む経路) は lint が届かない。テストを遅くしているかは、その依存を描くテストを同じ手順で測る
- `RESTRICTED_BARREL_IMPORTS` はトップレベルとテスト専用コードの import 禁止の override の両方へ渡っている。片方だけに書き足さない (`docs/guides/lint/configuration.md`「設定の落とし穴」)

### Vite+ を上げる

Dependabot は `vite-plus` の更新を `vite-plus` グループの PR にする。`vitest` と `@vitest/*` は `ignore` してあり、bot は上げない。脆弱性は alert で届く (ADR-0005)。`vite-plus` の PR が来たら、そのブランチで次を打つ。

```bash
gh pr checkout <PR 番号>
vp install
vp exec vp migrate --no-interactive
mise run verify
git diff pnpm-workspace.yaml  # catalog に依存が増えていたら、この節の catalog の項目で .github/dependabot.yml を見直す
git add -A
git commit -m "vp migrate で core と vitest を vite-plus の同梱の版へ揃える"
git push
```

- `vp migrate` は、打った CLI が同梱する版へ core と `vitest` を揃える ([Vite+ docs「Update Vite+」][])。直接の依存にある `@vitest/*` も `vitest` の版へ揃える ([Vite+ docs「Migration Rules」][])。先に `vp install` で PR の版の `vite-plus` を `node_modules` へ入れ、`vp exec` でその CLI を打つ
- `vp migrate` は変えたファイルを `vp fmt` で整える。migrate の前から変更のあったファイルは整えない ([Vite+ docs「Migration Rules」][])。キーの順序とコメント、テンプレートが足したキーと行は残る (2026-09-29、vite-plus 1.0.0 で確認)
- `pnpm peers check` の食い違いと、`storybook>vite-plus` の許可が頼る `vite-plus/versions` の export は「peer の食い違いを数える」で確かめる
- push したあとは、Dependabot がその PR を rebase しなくなる ([GitHub Docs「Managing pull requests for dependency updates」][])。`main` が進んだら手で取り込む
- Dependabot の PR を処理するときは、`vite-plus` の PR が止まっていないかを確かめる (ADR-0005)。`npm view vite-plus time --json` で latest の公開日時を見て、cooldown (`.github/dependabot.yml`) を過ぎたあとの Dependabot の実行 (`gh run list --workflow 'Dependabot Updates'`) で `vite-plus` の PR ができていなければ、その実行のログで判定を見る。`gh run view <run の ID> --log | grep -E "Updating vite-plus from|No update needed for vite-plus"`
- `minor-and-patch` は `exclude-patterns` で `vite-plus` と `react-compiler` のグループの依存を除く。patterns を持たないグループは、他のグループに入った依存も抱え込む (2026-09-29 時点、[dependabot/dependabot-core#14576][])。2026-09-28 には `vitest` が両方のグループの PR に載った
- `vp migrate` が `pnpm-workspace.yaml` の catalog に、`.github/dependabot.yml` の `vite-plus` グループの `patterns` に当たらない依存を足したら、その `patterns` と `minor-and-patch` の `exclude-patterns` にも足す
- `vp migrate` が catalog に足した依存が、`vitest` のように `vite-plus` と別の日に公開され、既存の `ignore` に当たらないなら、`ignore` にも `dependency-name` だけで足す (ADR-0005)。撤去条件の書き方は「pin を足す」

### pin を足す

pin を足すときは、ADR-0005「pin には出口条件を書く」に従って出口条件を書く。間接的に pin の圏内へ入るパッケージを見つけたら `ignore` へ足し、同じ出口条件を参照させる。出口条件の文字列を grep すれば、pin の全構成要素が見つかる状態を保つ。

### patch を当てる

依存の配布物に patch を当てるときは、`vp pm patch <pkg>` を版を付けずに打つ。`pnpm-workspace.yaml` の `patchedDependencies` にパッケージ名だけのキー (`"<pkg>"`) で足され、どの版にも当たる (「patch のキーをパッケージ名だけにする理由」)。そのキーの直前のコメントに、理由と撤去条件 (ADR-0005「pin には出口条件を書く」) と、効いていることの確かめ方を書く。`mise run verify` が捕まえない patch もあるので、確かめ方が無いと壊れても気づけない。

- 作り直すときも版を付けずに打つ。既にある patch を当てた編集用のディレクトリができ、`vp pm patch-commit` は同じキーと同じファイルへ書き戻す。版を付けると既にある patch が当たらず、`patch-commit` は版を固定したキーを足して `ERR_PNPM_UNUSED_PATCH` で落ちる。その案内どおりにパッケージ名だけのキーを消すと、元の変更が黙って消える (2026-10-01 に pnpm 11.28.0 で観測)
- `vp pm patch-commit` したあとは、初めて作ったときも作り直したときも、`pnpm-lock.yaml` を HEAD の内容へ戻してから `vp install` する。`patch-commit` を通った lockfile では、patch を当てた依存の `optionalDependencies` が落ちていた (2026-10-01 に pnpm 11.28.0 で観測)

### workflow に action を足す

- 新しい action は `@<SHA> # vX.Y.Z` で書く (ADR-0006)。手元で `zizmor --fix=all` を使うと SHA へ書き換わる。SHA 固定は unsafe fix に分類され、既定の `--fix=safe` では書き換わらない
- zizmor に新しい audit が入ると、action の更新 PR で既存の workflow が落ちうる。その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効にする

### 依存を上げたときに見直すもの

| 上げたもの                                                      | 見直すもの                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite+                                                           | 「Vite+ を上げる」の手順で上げる。同梱ツールがまとめて更新される。lint ルールの追加や formatter の整形規則の変更が同じ更新で入りうるので、更新 PR は `mise run verify` の結果まで見て判断する。許可した側の major が上がったら、peer の許可の値を書き換える (「peer の食い違いを数える」)             |
| oxlint (Vite+ 同梱) の minor 以上                               | `docs/guides/lint/configuration.md`「上流 recommended の改訂に追随する」                                                                                                                                                                                                                              |
| Base UI                                                         | `src/components/parts/form-fields.tsx` の `FormSelectField` の docstring (自己リセットの条件の表)                                                                                                                                                                                                     |
| axe-core                                                        | `docs/guides/accessibility.md`「axe を上げたとき」。あわせて `mise run contrast` の比を axe の `getContrast` と突き合わせ直す (`docs/guides/styling-and-tokens.md`「axe の比と突き合わせる」)                                                                                                         |
| colorjs.io                                                      | `mise run contrast` の比を axe の `getContrast` と突き合わせ直す (`docs/guides/styling-and-tokens.md`「axe の比と突き合わせる」「測り方の限界」)。版が上がると値が変わりうる                                                                                                                          |
| vitest                                                          | assert の予算 (`docs/guides/testing/waiting-and-assertions.md`「assert の予算を分ける理由」) の根拠に使った docs の数字 (browser の `testTimeout` の既定など) を写さず、測り直す。数字は版で動き、上流のメンテナも docs の数字が意図せず変わった可能性に触れている ([vitest-dev/vitest#9157][])       |
| `@types/node` の minor                                          | `package.json` の `engines.node` の下限を、その minor まで上げる (ADR-0004)                                                                                                                                                                                                                           |
| drizzle-kit                                                     | `pnpm-workspace.yaml` の `overrides` の `drizzle-kit>@esbuild-kit/esm-loader` の撤去条件。キーに版が無いので、条件が成り立っても何も言わずに効かない行として残る。beta の `1.0.0-beta.22` と rc の `1.0.0-rc.4` は `@esbuild-kit/esm-loader` を依存から外している (2026-09-30 に npm registry で確認) |
| storybook / @storybook/addon-vitest / @storybook/tanstack-react | `pnpm-workspace.yaml` の `peerDependencyRules` と `patchedDependencies` の撤去条件。patch はコメントの確かめ方を通す。storybook では、dist が `vite-plus` から import しているものも読み直す (「peer の食い違いを数える」「patch を当てる」)                                                          |
| `RESTRICTED_BARREL_IMPORTS` に載せた依存                        | `exports` に個別エントリポイントが残っているか。消えていれば lint の `message` が案内する import が解決しなくなる。react-day-picker を上げたときは、内部の date-fns の import と `locale/ja` の import が変わったかも見る (ADR-0032 の Consequences の再評価の条件)                                   |

### 走査対象を持つ config を足す

tsconfig / `tooling/test/config.ts` (test。project はここから継承する) / `tooling/lint/config.ts` (lint) / `vite.config.ts` (fmt) は、それぞれ `.claude/worktrees/**` を除外している。走査対象を持つ config を新しく足したら、同じ除外をその場で書く。除外の経路は config ごとに別で共通化できず、1 つ落とすと worktree のコードがその走査へ黙って混ざる。

### `git status` に出ないファイルを調べる

作ったファイルが `git status` に出ないときは、`git check-ignore -v <パス>` で、当たった `.gitignore` の行を見る。

- `.gitignore` の、先頭と途中に `/` を含まない行 (`out`、`pids`、`.cache` など) は、どの深さの同じ名前のディレクトリにも当たる ([gitignore(5)][])。そこに作ったファイルは、`git add .` では何も言われずに飛ばされ、パスを名指しした `git add` では拒まれる ([git-add(1)][])
- 外すときは、`.gitignore` の末尾に `!src/routes/out/` のように、当たったディレクトリのパスを足す。親のディレクトリが除外されていると、中のファイルを名指しした `!` は効かない ([gitignore(5)][])。当たった行が使わないツールのもの (Next.js の `out` など) なら、行ごと消してもよい

## explanation

### `typescript` を直接の依存に置かない理由

`vp check` の型検査は oxlint の type-aware パスが担い、その実体は tsgolint と TypeScript Go のツールチェーンである ([Vite+ docs「Check」][])。
`typescript` パッケージは `@voidzero-dev/vite-plus-core` と `oxlint` の推移依存として入るので、直接の依存から外しても install からは消えない。2026-09-02 に `devDependencies` から外した状態で `vp check` を走らせると、型エラー (`TS2322`) を報告した。
直接の依存へ戻すのは、リポジトリのコードが `typescript` を `import` するようになったときだけでよい。リポジトリのコードが使わないパッケージを、直接の依存として宣言しない。

型検査を lint へ合流させる設定 (`options.typeCheck`) は `scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で押さえるが、設定が真のまま tsgolint が黙って動かない場合は捕まえられない。

### patch のキーをパッケージ名だけにする理由

版まで固定したキーは、上げた版には使われず、install が `ERR_PNPM_UNUSED_PATCH` で落ちる (`allowUnusedPatches` の既定は `false`。[pnpm docs「pnpm patch」][])。この失敗は、lockfile だけを更新するとき (`install --lockfile-only`) にも起きる (2026-10-01 に pnpm 11.28.0 で観測)。Dependabot は pnpm を `--lockfile-only` で走らせ ([dependabot-core「pnpm_lockfile_updater.rb」][])、失敗した依存を飛ばして残りで PR を作る ([dependabot-core「group_update_creation.rb」][]) ので、その依存だけが黙って PR から抜け、揃えて上がる依存の版が割れる。範囲のキー (`"<pkg>@^<版>"`) も、範囲の外へ上げた版には使われないので同じことになる。

パッケージ名だけのキーは、どの版にも当てる ([pnpm docs「pnpm patch」][])。当たらなければ通常の install が `ERR_PNPM_PATCH_FAILED` で落ち、`--lockfile-only` では落ちない (2026-10-01 に pnpm 11.28.0 で観測) ので、Dependabot の PR は作られ、その PR の CI で気づける。Dependabot の振る舞いはコードで確かめ、実行では観測していない。同じ docs には、名前だけのキーは当たらない失敗を無視すると読める記述もあるが、v11 では当たらない失敗は常にエラーになる (同じ docs の `allowUnusedPatches` の注記)。

作り直しの手順も短くなる。`vp pm patch` を版を付けずに打つと、パッケージ名だけのキーの patch を編集用のディレクトリに当て、`patch-commit` は同じキーと同じファイルへ書き戻す。範囲のキーの patch は `vp pm patch` が当てず、`patch-commit` は範囲のキーとは別のキーとファイルを足すので、作り直すたびに元の patch を当て直し、キーとファイルを手で直すことになる (2026-10-01 に pnpm 11.28.0 で、両方のキーについて観測)。

### 入口を `vp` にそろえる理由

- [Vite+ docs「Package Management」][] は、`vp` がプロジェクトの package manager を見分けて走らせ、`vp install` / `vp add` / `vp remove` を package manager をまたいだ共通の入口にする ("Instead of switching between `pnpm install`, `npm install`, `yarn install`, and `bun install`, you can keep using `vp install`, `vp add`, `vp remove`")。打つ側がプロジェクトの package manager を覚えなくてよい
- `npm` と `yarn` は pnpm に翻訳されない (同 docs: "Mismatched tools are not translated; `npm` in a `pnpm` project still resolves as npm.")。このリポジトリの `package.json` は `catalog:` を使うので、npm は依存を解決できない。2026-10-02 に npm 11.19.0 で、このリポジトリの `package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml`・`patches` を写した場所で `npm install is-odd@3.0.1 --package-lock-only` を打つと、`npm error code EUNSUPPORTEDPROTOCOL` (`Unsupported URL Type "catalog:"`) で止まり、`package-lock.json` を作らず `pnpm-lock.yaml` も変わらなかった。`yarn` は測っていない
- 素の `pnpm` は結果を変えない。shim が `packageManager` の版 (pnpm 11.28.0) に解決する ([Vite+ docs「Environment」][])。2026-10-02 に vp 1.0.0 で、`~/.vite-plus/bin` の `pnpm` / `pn` / `pnpx` / `pnx` は `vp` への symlink で、リポジトリで `pnpm --version` は 11.28.0 を返した。同日に、このリポジトリの `package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml`・`patches` を写した場所で `vp add is-number@7.0.0 --lockfile-only` と `pnpm add is-number@7.0.0 --lockfile-only` を打つと、同じ `package.json` と `pnpm-lock.yaml` を作った。`pnpm` も止めるのは lockfile のためではなく、入口を `vp` の 1 つにそろえるためである

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[pnpm/pnpm#14114]: https://github.com/pnpm/pnpm/pull/14114
[Vite+ docs「Update Vite+」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/upgrade-project.md
[Vite+ docs「Migration Rules」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/migrate-rules.md
[GitHub Docs「Managing pull requests for dependency updates」]: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs
[dependabot/dependabot-core#14576]: https://github.com/dependabot/dependabot-core/issues/14576
[vitest-dev/vitest#9157]: https://github.com/vitest-dev/vitest/issues/9157
[Vite+ docs「Check」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/check.md
[pnpm docs「Overriding peer dependencies」]: https://pnpm.io/settings/dependency-resolution#overriding-peer-dependencies
[pnpm docs「pnpm patch」]: https://pnpm.io/cli/patch
[dependabot-core「group_update_creation.rb」]: https://github.com/dependabot/dependabot-core/blob/d4120cab39d50362a51b1c4fb307e818fed15868/updater/lib/dependabot/updater/group_update_creation.rb#L129-L153
[dependabot-core「pnpm_lockfile_updater.rb」]: https://github.com/dependabot/dependabot-core/blob/d4120cab39d50362a51b1c4fb307e818fed15868/npm_and_yarn/lib/dependabot/npm_and_yarn/file_updater/pnpm_lockfile_updater.rb#L285-L295
[gitignore(5)]: https://git-scm.com/docs/gitignore
[git-add(1)]: https://git-scm.com/docs/git-add
[dotenvx README]: https://github.com/dotenvx/dotenvx/blob/v2.32.3/README.md
[Vite+ docs「Package Management」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/install.md
[Vite+ docs「Environment」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/env.md
[Vite+ docs「Commit Hooks」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/commit-hooks.md
