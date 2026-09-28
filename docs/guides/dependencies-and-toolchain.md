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
- 素の `pnpm` が要るなら `corepack enable` を一度実行する。Vite+ が既定で作る shim は `node` / `npm` / `npx` / `corepack` で、`pnpm` を含まない。Vite+ の corepack shim は `--install-directory` を Vite+ の bin へ向けるので、作られた launcher は PATH に載り、`packageManager` の版に従う
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

公開後 3 日を待たずに取り込みたいときは、そのバージョンが公式のリリースパイプラインから出たものかを確かめる (ADR-0005 の決定 3)。

```bash
curl -s https://registry.npmjs.org/<pkg>/<version> | jq '{_npmUser, repository, attestations: .dist.attestations}'
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/<pkg>@<version>"
```

1. `_npmUser` に `trustedPublisher` があれば OIDC による公開である。個人トークンでの公開は、トークンの漏洩が成立経路になるので、前倒しの根拠に足りない
2. attestation の `subject` が対象の package と version に一致し、`workflow.repository` が公式のリポジトリで、`workflow.ref` が既定のブランチかリリースタグであることまで見る
3. `pnpm-workspace.yaml` の `minimumReleaseAgeExclude` へ、バージョンまで固定して (`@scope/pkg@x.y.z`) 追記する

追記したエントリの後始末は `minimumReleaseAgeExcludePrune` (pnpm 11.22.0) が持つ。`vp add` / `update` / `remove` が、lockfile の解決から消えたエントリを自動で消す。`@scope/*` のパターンは常に残るので、Vite+ 一族の恒久除外は刈られない。

### peer の食い違いを数える

```bash
pnpm peers check
```

- lockfile を読んで、宣言された peer の範囲と入っている版の食い違いを数える (pnpm 11.0.0 から)。lockfile を書き換えないので、AGENTS.md の「pnpm を直接打たない」の理由 (解決が Vite+ の管理から外れる) には当たらない
- `vp pm` は `peers` を中継しない (`vp pm peers check` は `Command 'peers' not found`。2026-09-28 に vite-plus 1.0.0 で確認)
- `vp install` の出力が静かでも、食い違いが無いとは限らない。lockfile が最新なら install は解決を走らせず、peer の食い違いを報告しない ([pnpm の PR 14114][])
- 許可を外すだけでは lockfile が変わらないので、`--force` を付けても `strictPeerDependencies: true` にしても install は通る (2026-09-29、pnpm 11.28.0)。`pnpm peers check` だけが食い違いを出す
- 食い違いを許すなら、`pnpm-workspace.yaml` の `peerDependencyRules.allowedVersions` に親つきのキー (`"<親>><peer>": "<確かめた版の major>"`) で書き、理由と撤去条件をコメントに残す (pin の出口条件と同じ扱い。ADR-0005 の決定 6)。`*` や親なしのキーにすると、版が上がって新しく食い違っても見えなくなる
- キーの親に版を付けない (`"<親>@<版>><peer>"` にしない)。pnpm 11 の `pnpm peers check` は親の版を捨て、名前だけで照合する。install は親の版を見るので、2 つの判定が割れる (2026-09-29 に 11.28.0 で実測。12.6.0 の `pnpm peers check` は親の版を見る)
- 許可した側の major を上げると、許可の範囲を外れて `pnpm peers check` に再び食い違いとして出る。新しい major で動くことを確かめ直してから、値を書き換える
- 親を上げたら、そのエントリの撤去条件を見る。どのエントリが何を待っているかは `pnpm-workspace.yaml` のコメントが持つ
- `vite` と `vitest` の許可は例外で、`vp migrate` が管理する (理由は `pnpm-workspace.yaml` のコメント)

### 依存をバレルの禁止の対象に足す

対象に足すかは ADR-0032 の基準で決める。手順は次のとおり。実例は `vite.config.ts` の `RESTRICTED_BARREL_IMPORTS` の date-fns の 2 行。

1. 依存の `package.json` の `exports` を読み、個別エントリポイントがあるかと、バレルがどれか (ルートの `.`、`./locale` のようなまとめ) を確かめる。個別エントリポイントが無い依存は対象にできない
2. バレルから 1 つだけ import するテストと、同じものを個別エントリポイントから import するテストを 1 ファイルずつ `src/lib/` に一時的に置く。Node で読むなら `.test.ts`、ブラウザで読むなら `.test.tsx`
3. 1 ファイルずつ `vp test run --project <unit か browser> <ファイル> --experimental.importDurations.print --experimental.importDurations.limit=10` を複数回実行し、`Duration` の `import` と、内訳が出れば `Total import time` の self を回ごとに控える。`Total import time` の total は入れ子の import を二重に数えるので使わない (ADR-0032 の「調査結果」)。browser project は 1 回目に依存の事前バンドルが走りうるので、比較から外す
4. 比較する回の中央値の差が、両者の最大と最小の差の和を超えるかを見る。超えなければ足さない
5. 足すなら `RESTRICTED_BARREL_IMPORTS` に `{ name, message }` を 1 つずつ足す。`name` は specifier の完全一致で、サブパス (`date-fns/format`) は止めない。`message` には個別エントリポイントの例と `(ADR-0032)` を書く
6. `vp lint -f unix src scripts .storybook` で、足した依存のバレルを import している箇所を洗い出し、個別エントリポイントへ直す
7. 一時的に置いたテストを消す

- 依存の中の import (ある依存が別の依存のバレルを読む経路) は lint が届かない。テストを遅くしているかは、その依存を描くテストを同じ手順で測る
- `RESTRICTED_BARREL_IMPORTS` はトップレベルとテスト専用コードの import 禁止の override の両方へ渡っている。片方だけに書き足さない (`docs/guides/lint/configuration.md`「設定の落とし穴」)

### catalog にエントリを足す

`vite-plus` と core (`vite` の alias 先) のように同一リリースで exact pin される対は、Dependabot のグループへ束ねてある (ADR-0005 の決定 5)。

- `pnpm-workspace.yaml` の `catalog:` へエントリを足したら、`.github/dependabot.yml` の `vite-plus` グループの `patterns` にも足す。逆は成り立たない (`patterns` は catalog に現れない推移依存もグロブで拾う)
- グループは `minor-and-patch` より前に置く。Dependabot は先に一致したグループを採るので、後ろに置くと major の更新だけが別の PR に落ちる

### pin を足す

pin には出口条件を書く (ADR-0005 の決定 6)。間接的に pin の圏内へ入るパッケージを見つけたら `ignore` へ足し、同じ出口条件を参照させる。出口条件の文字列を grep すれば、pin の全構成要素が見つかる状態を保つ。

### workflow に action を足す

- 新しい action は `@<SHA> # vX.Y.Z` で書く (ADR-0006)。手元で `zizmor --fix=all` を使うと SHA へ書き換わる。SHA 固定は unsafe fix に分類され、既定の `--fix=safe` では書き換わらない
- zizmor に新しい audit が入ると、action の更新 PR で既存の workflow が落ちうる。その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効にする

### 依存を上げたときに見直すもの

| 上げたもの                               | 見直すもの                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite+                                    | 同梱ツールがまとめて更新される。lint ルールの追加や formatter の整形規則の変更が同じ更新で入りうるので、更新 PR は `mise run verify` の結果まで見て判断する。major が上がったら peer の許可の値を書き換える (「peer の食い違いを数える」)                                                     |
| oxlint (Vite+ 同梱) の minor 以上        | `docs/guides/lint/configuration.md`「上流 recommended の改訂に追随する」                                                                                                                                                                                                                      |
| Base UI                                  | `src/components/parts/form-fields.tsx` の `FormSelectField` の docstring (自己リセットの条件の表)                                                                                                                                                                                             |
| axe-core                                 | `docs/guides/accessibility.md`「axe を上げたとき」。あわせて `mise run contrast` の比を axe の `getContrast` と突き合わせ直す (`docs/guides/styling-and-tokens.md`「axe の比と突き合わせる」)                                                                                                 |
| colorjs.io                               | `mise run contrast` の比を axe の `getContrast` と突き合わせ直す (`docs/guides/styling-and-tokens.md`「axe の比と突き合わせる」「測り方の限界」)。版が上がると値が変わりうる                                                                                                                  |
| vitest                                   | assert の予算 (`docs/guides/testing/waiting-and-assertions.md`「assert の予算を分ける理由」) の根拠に使った docs の数字 (browser の `testTimeout` の既定など) を写さず、測り直す。数字は版で動き、上流のメンテナも docs の数字が意図せず変わった可能性に触れている ([vitest の issue 9157][]) |
| storybook / @storybook/addon-vitest      | `pnpm-workspace.yaml` の `peerDependencyRules` と `patchedDependencies` の撤去条件 (「peer の食い違いを数える」)                                                                                                                                                                              |
| `RESTRICTED_BARREL_IMPORTS` に載せた依存 | `exports` に個別エントリポイントが残っているか。消えていれば lint の `message` が案内する import が解決しなくなる。react-day-picker を上げたときは、内部の date-fns の import と `locale/ja` の import が変わったかも見る (ADR-0032 の Consequences の再評価の条件)                           |

### 走査対象を持つ config を足す

tsconfig / `vitest.config.ts` / `vitest.browser.config.ts` / `vite.config.ts` (lint・fmt) は、それぞれ `.claude/worktrees/**` を除外している。走査対象を持つ config を新しく足したら、同じ除外をその場で書く。除外の経路は config ごとに別で共通化できず、1 つ落とすと worktree のコードがその走査へ黙って混ざる。

## explanation

### `typescript` を直接の依存に置かない理由

`vp check` の型検査は oxlint の type-aware パスが担い、その実体は tsgolint と TypeScript Go のツールチェーンである ([Vite+ docs「Check」][])。
`typescript` パッケージは Vite+ 一族の推移依存として入るので、直接の依存から外しても install からは消えない。2026-09-02 に `devDependencies` から外した状態で `vp check` を走らせると、型エラー (`TS2322`) を報告した。
直接の依存へ戻すのは、リポジトリのコードが `typescript` を `import` するようになったときだけでよい。リポジトリのコードが使わないパッケージを、直接の依存として宣言しない。

型検査を lint へ合流させる設定 (`options.typeCheck`) は `scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で押さえるが、設定が真のまま tsgolint が黙って動かない場合は捕まえられない。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[vitest の issue 9157]: https://github.com/vitest-dev/vitest/issues/9157
[pnpm の PR 14114]: https://github.com/pnpm/pnpm/pull/14114
[Vite+ docs「Check」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/check.md
