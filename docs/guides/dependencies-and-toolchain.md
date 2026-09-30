# 依存と開発環境

依存を足す・上げる・前倒しするとき、ツールや設定を足すときの手順と落とし穴を持つ。

| 決定                                                                                        | ADR      |
| ------------------------------------------------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                           | ADR-0004 |
| 依存更新は待機 3 日で統一し、pin には出口条件を書く                                         | ADR-0005 |
| GitHub Actions の定義は zizmor で検査し、action は commit SHA で固定する                    | ADR-0006 |
| テストの import を重くする依存のバレルは使わず、個別エントリポイントから引き、lint で止める | ADR-0032 |

## how-to

### 手元の環境を用意する

- mise のシェル hook を入れる。hook を入れていない手元では `.mise.toml` の `[env]` が読まれず、`DB_FILE_NAME` が未設定のまま走る。port の導出はタスクの `env` に置いてあるので、hook が無くても `mise run serve` / `mise run storybook` は port を決められる
- 素の `pnpm` が要るなら `corepack enable` を一度実行する。Vite+ が既定で作る shim は `node` / `npm` / `npx` / `corepack` で、`pnpm` を含まない
- `corepack enable` が作る `pnpm` の launcher は PATH に載り、`packageManager` の版に従う。Vite+ の corepack shim が `--install-directory` を Vite+ の bin へ向けるため
- Node.js と pnpm 以外のツールを足すときは、`.mise.toml` の `[tools]` へ宣言する。手元でグローバルに入れたものに依存しない

### Node.js の版を打ち直す

`vp env pin` で `devEngines.runtime` を打ち直したら、`devEngines.runtime.onFail` を `error` へ戻す。`vp env pin` が書き込む既定は `download` で、pnpm もこのフィールドを読む。`download` のままだと pnpm が宣言の runtime を自前で解決して lockfile へ記録し、`node_modules/node` を展開する (2026-09-02 に `vp remove` の再解決で、`node@runtime:24.20.0` と全プラットフォーム分の tarball URL が lockfile に入った)。

### 秘密を足す

秘密が要るようになったら、暗号化した env ファイルと、`dotenvx run --` のような復号の経路を、Vite の env 機構と分けて足す。Vite は既に在る環境変数を `.env` で上書きしないので、復号を先に済ませて `process.env` へ入れる形が噛み合う。Vite の `.env` 読み込みは `envDir: false` で切ってある (ADR-0004)。

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

- lockfile を読んで、宣言された peer の範囲と入っている版の食い違いを数える (pnpm 11.0.0 から)。lockfile を書き換えないので、`pnpm peers check` は直接打っても解決が Vite+ の管理から外れない
- `vp pm` は `peers` を中継しない (`vp pm peers check` は `Command 'peers' not found`。2026-09-28 に vite-plus 1.0.0 で確認)
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
git diff pnpm-workspace.yaml  # catalog に依存が増えていたら .github/dependabot.yml にも足す (この節の catalog の項目)
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
- `vp migrate` が `pnpm-workspace.yaml` の catalog へ依存を足したら、`.github/dependabot.yml` の `vite-plus` グループの `patterns` と、`minor-and-patch` の `exclude-patterns` にも足す。`vitest` のように `vite-plus` と別の日に公開される依存なら、`ignore` にも `dependency-name` だけで足す (ADR-0005)。撤去条件の書き方は「pin を足す」

### pin を足す

pin を足すときは、ADR-0005「pin には出口条件を書く」に従って出口条件を書く。間接的に pin の圏内へ入るパッケージを見つけたら `ignore` へ足し、同じ出口条件を参照させる。出口条件の文字列を grep すれば、pin の全構成要素が見つかる状態を保つ。

### patch を当てる

依存の配布物に patch を当てるときは、`pnpm-workspace.yaml` の `patchedDependencies` へ足し、patch ごとに理由と撤去条件と、外したときの確かめ方をコメントに書く (ADR-0005「pin には出口条件を書く」)。`mise run verify` が捕まえない patch もあるので (`@storybook/addon-vitest` の patch は、外れても viewport が黙って当たらなくなるだけ)、確かめ方が無いと外したあと壊れても気づけない。

- キーは patch を作った版ではなく、その系列の範囲 (`"<pkg>@^<版>"`) にする。版まで固定すると、後続の版では patch が使われず install が落ちる (`allowUnusedPatches` の既定は `false`。[pnpm docs「pnpm patch」][])。Dependabot の更新ではその依存だけが PR から外れ、同じグループで揃えて上がる依存 (storybook の各パッケージは `minor-and-patch` で上がる) の版が割れる ([dependabot-core「group_update_creation.rb」][] の `compile_all_dependency_changes_for` は、グループの依存ごとに `compile_updates_for` と `create_change_for` を呼ぶ。どちらかが失敗すると空の配列か `false` が返り、その依存を飛ばして残りの依存で PR を作る。2026-09-30 にコードで確かめた。Dependabot の実行では観測していない)
- 上流が同じ箇所を直した版へ上がると、範囲のキーの patch は当たらなくなり、install が落ちる。pnpm 11 は patch の失敗を常にエラーにする ([pnpm docs「pnpm patch」][])。Dependabot は install が落ちた依存を飛ばして PR を作るので、揃えて上がるはずの依存が Dependabot の PR から抜けていたら、その patch の撤去条件を確かめる (ADR-0005「pin には出口条件を書く」)
- 既にある patch へ変更を足すときは、`vp pm patch` と `vp pm patch-commit` の結果をそのまま使わない。範囲のキーの patch は編集用のディレクトリに当たらず、`patch-commit` は新しい変更だけで patch を書き出して、版を固定したキーを足す。そのまま使うと元の変更が黙って消える (2026-09-30 に pnpm 11.28.0 で観測。`vp pm patch` に版・範囲・名前のどれを渡しても元の patch は当たらなかった)。`git status --short pnpm-lock.yaml` が空の状態から、次の順で作り直す
  1. `vp pm patch <pkg>@<入っている版> -- --edit-dir <dir>` で編集用のディレクトリを作る。`<dir>` はリポジトリの外 (`mktemp -d` の下) に置く。リポジトリの中のディレクトリでは、`git apply` がパスを飛ばして何も当てずに exit 0 で終わる ([git docs「git-apply」][]: "When running from a subdirectory in a repository, patched paths outside the directory are ignored.")
  2. `<dir>` の中で `git apply -v <元の patch の絶対パス>` を打ち、ファイルごとに `Applied patch <path> cleanly.` が出ることを確かめてから、新しい変更を加える
  3. `vp pm patch-commit <dir>` で patch を書き出す。書き出されたファイルが範囲のキーの指すファイルと違ったら、範囲のキーの値を書き出されたファイルへ向け、古いファイルを消す
  4. `pnpm-workspace.yaml` に足された版を固定したキーを消す。残すと版を固定したキーが優先され ([pnpm docs「pnpm patch」][])、範囲のキーの patch が使われずに install が `ERR_PNPM_UNUSED_PATCH` で落ちる (2026-09-30 に pnpm 11.28.0 で観測)。`pnpm-lock.yaml` を HEAD の内容へ戻してから `vp install` する。`patch-commit` を通った lockfile では、patch を当てた依存の `optionalDependencies` が落ちていた (2026-09-30 に pnpm 11.28.0 で 2 回観測)
  5. `git diff pnpm-lock.yaml` が patch のハッシュの行だけであることと、`node_modules/<pkg>/` の配布物に元の変更と新しい変更の両方があることを grep で確かめる
  6. `mise run verify` を通し、`pnpm-workspace.yaml` のその patch のコメントにある確かめ方も通す

### workflow に action を足す

- 新しい action は `@<SHA> # vX.Y.Z` で書く (ADR-0006)。手元で `zizmor --fix=all` を使うと SHA へ書き換わる。SHA 固定は unsafe fix に分類され、既定の `--fix=safe` では書き換わらない
- zizmor に新しい audit が入ると、action の更新 PR で既存の workflow が落ちうる。その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効にする

### 依存を上げたときに見直すもの

| 上げたもの                                                      | 見直すもの                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite+                                                           | 同梱ツールがまとめて更新される。lint ルールの追加や formatter の整形規則の変更が同じ更新で入りうるので、更新 PR は `mise run verify` の結果まで見て判断する。許可した側の major が上がったら、peer の許可の値を書き換える (「peer の食い違いを数える」)                                                                                                     |
| oxlint (Vite+ 同梱) の minor 以上                               | `docs/guides/lint/configuration.md`「上流 recommended の改訂に追随する」                                                                                                                                                                                                                                                                                    |
| Base UI                                                         | `src/components/parts/form-fields.tsx` の `FormSelectField` の docstring (自己リセットの条件の表)                                                                                                                                                                                                                                                           |
| axe-core                                                        | `docs/guides/accessibility.md`「axe を上げたとき」。あわせて `mise run contrast` の比を axe の `getContrast` と突き合わせ直す (`docs/guides/styling-and-tokens.md`「axe の比と突き合わせる」)                                                                                                                                                               |
| colorjs.io                                                      | `mise run contrast` の比を axe の `getContrast` と突き合わせ直す (`docs/guides/styling-and-tokens.md`「axe の比と突き合わせる」「測り方の限界」)。版が上がると値が変わりうる                                                                                                                                                                                |
| vitest                                                          | assert の予算 (`docs/guides/testing/waiting-and-assertions.md`「assert の予算を分ける理由」) の根拠に使った docs の数字 (browser の `testTimeout` の既定など) を写さず、測り直す。数字は版で動き、上流のメンテナも docs の数字が意図せず変わった可能性に触れている ([vitest-dev/vitest#9157][])                                                             |
| `@types/node` の minor                                          | `package.json` の `engines.node` の下限を、その minor まで上げる (ADR-0004)                                                                                                                                                                                                                                                                                 |
| drizzle-kit                                                     | `pnpm-workspace.yaml` の `overrides` の `drizzle-kit>@esbuild-kit/esm-loader` の撤去条件。キーに版が無いので、条件が成り立っても何も言わずに効かない行として残る。beta の `1.0.0-beta.22` と rc の `1.0.0-rc.4` は依存から外している (2026-09-30 に npm registry で確認)                                                                                    |
| storybook / @storybook/addon-vitest / @storybook/tanstack-react | `pnpm-workspace.yaml` の `peerDependencyRules` と `patchedDependencies` の撤去条件。storybook では、dist が `vite-plus` から import しているものも読み直す (「peer の食い違いを数える」「patch を当てる」)。`@storybook/tanstack-react` では、`docs/guides/vite-configuration.md`「plugin を先頭で import する理由」の、関数を async へ移せる条件も確かめる |
| `RESTRICTED_BARREL_IMPORTS` に載せた依存                        | `exports` に個別エントリポイントが残っているか。消えていれば lint の `message` が案内する import が解決しなくなる。react-day-picker を上げたときは、内部の date-fns の import と `locale/ja` の import が変わったかも見る (ADR-0032 の Consequences の再評価の条件)                                                                                         |

### 走査対象を持つ config を足す

tsconfig / `tooling/test/config.ts` (test。project はここから継承する) / `tooling/lint/config.ts` (lint) / `vite.config.ts` (fmt) は、それぞれ `.claude/worktrees/**` を除外している。走査対象を持つ config を新しく足したら、同じ除外をその場で書く。除外の経路は config ごとに別で共通化できず、1 つ落とすと worktree のコードがその走査へ黙って混ざる。

## explanation

### `typescript` を直接の依存に置かない理由

`vp check` の型検査は oxlint の type-aware パスが担い、その実体は tsgolint と TypeScript Go のツールチェーンである ([Vite+ docs「Check」][])。
`typescript` パッケージは `@voidzero-dev/vite-plus-core` と `oxlint` の推移依存として入るので、直接の依存から外しても install からは消えない。2026-09-02 に `devDependencies` から外した状態で `vp check` を走らせると、型エラー (`TS2322`) を報告した。
直接の依存へ戻すのは、リポジトリのコードが `typescript` を `import` するようになったときだけでよい。リポジトリのコードが使わないパッケージを、直接の依存として宣言しない。

型検査を lint へ合流させる設定 (`options.typeCheck`) は `scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で押さえるが、設定が真のまま tsgolint が黙って動かない場合は捕まえられない。

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
[git docs「git-apply」]: https://git-scm.com/docs/git-apply
[dependabot-core「group_update_creation.rb」]: https://github.com/dependabot/dependabot-core/blob/d4120cab39d50362a51b1c4fb307e818fed15868/updater/lib/dependabot/updater/group_update_creation.rb#L129-L153
