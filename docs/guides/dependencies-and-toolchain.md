# 依存と開発環境

依存を足す・上げる・前倒しするとき、ツールや設定を足すときの手順と落とし穴を持つ。

| 決定                                                                     | ADR      |
| ------------------------------------------------------------------------ | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                        | ADR-0008 |
| 依存更新は待機 3 日で統一し、pin には出口条件を書く                      | ADR-0009 |
| GitHub Actions の定義は zizmor で検査し、action は commit SHA で固定する | ADR-0010 |

## how-to

### 手元の環境を用意する

- mise のシェル hook を入れる。hook を入れていない手元では `.mise.toml` の `[env]` が読まれず、`DB_FILE_NAME` が未設定のまま走る。port の導出はタスクの `env` に置いてあるので、hook が無くても `mise run serve` / `mise run storybook` は port を決められる
- 素の `pnpm` が要るなら `corepack enable` を一度実行する。Vite+ が既定で作る shim は `node` / `npm` / `npx` / `corepack` で、`pnpm` を含まない。Vite+ の corepack shim は `--install-directory` を Vite+ の bin へ向けるので、作られた launcher は PATH に載り、`packageManager` の版に従う
- Node.js と pnpm 以外のツールを足すときは、`.mise.toml` の `[tools]` へ宣言する。手元でグローバルに入れたものに依存しない

### Node.js の版を打ち直す

`vp env pin` で `devEngines.runtime` を打ち直したら、`devEngines.runtime.onFail` を `error` へ戻す。`vp env pin` が書き込む既定は `download` で、pnpm もこのフィールドを読む。`download` のままだと pnpm が宣言の runtime を自前で解決して lockfile へ記録し、`node_modules/node` を展開する (2026-09-02 に `vp remove` の再解決で、`node@runtime:24.20.0` と全プラットフォーム分の tarball URL が lockfile に入った)。

### 秘密を足す

秘密が要るようになったら、暗号化した env ファイルと、`dotenvx run --` のような復号の経路を、Vite の env 機構と分けて足す。Vite は既に在る環境変数を `.env` で上書きしないので、復号を先に済ませて `process.env` へ入れる形が噛み合う。Vite の `.env` 読み込みは `envDir: false` で切ってある (ADR-0008)。

### Dependabot の alerts を有効にする

テンプレートから作ったリポジトリで、Dependabot の alerts と security updates を有効にする (ADR-0009)。この設定はコードに現れない。

```bash
gh api -X PUT /repos/<owner>/<repo>/vulnerability-alerts
gh api -X PUT /repos/<owner>/<repo>/automated-security-fixes
```

### 待機を前倒しする

公開後 3 日を待たずに取り込みたいときは、そのバージョンが公式のリリースパイプラインから出たものかを確かめる (ADR-0009 の決定 3)。

```bash
curl -s https://registry.npmjs.org/<pkg>/<version> | jq '{_npmUser, repository, attestations: .dist.attestations}'
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/<pkg>@<version>"
```

1. `_npmUser` に `trustedPublisher` があれば OIDC による公開である。個人トークンでの公開は、トークンの漏洩が成立経路になるので、前倒しの根拠に足りない
2. attestation の `subject` が対象の package と version に一致し、`workflow.repository` が公式のリポジトリで、`workflow.ref` が既定のブランチかリリースタグであることまで見る
3. `pnpm-workspace.yaml` の `minimumReleaseAgeExclude` へ、バージョンまで固定して (`@scope/pkg@x.y.z`) 追記する

追記したエントリの後始末は `minimumReleaseAgeExcludePrune` (pnpm 11.22.0) が持つ。`vp add` / `update` / `remove` が、lockfile の解決から消えたエントリを自動で消す。`@scope/*` のパターンは常に残るので、Vite+ 一族の恒久除外は刈られない。

### catalog にエントリを足す

`vite-plus` と core (`vite` の alias 先) のように同一リリースで exact pin される対は、Dependabot のグループへ束ねてある (ADR-0009 の決定 5)。

- `pnpm-workspace.yaml` の `catalog:` へエントリを足したら、`.github/dependabot.yml` の `vite-plus` グループの `patterns` にも足す。逆は成り立たない (`patterns` は catalog に現れない推移依存もグロブで拾う)
- グループは `minor-and-patch` より前に置く。Dependabot は先に一致したグループを採るので、後ろに置くと major の更新だけが別の PR に落ちる

### pin を足す

pin には出口条件を書く (ADR-0009 の決定 6)。間接的に pin の圏内へ入るパッケージを見つけたら `ignore` へ足し、同じ出口条件を参照させる。出口条件の文字列を grep すれば、pin の全構成要素が見つかる状態を保つ。

### workflow に action を足す

- 新しい action は `@<SHA> # vX.Y.Z` で書く (ADR-0010)。手元で `zizmor --fix=all` を使うと SHA へ書き換わる。SHA 固定は unsafe fix に分類され、既定の `--fix=safe` では書き換わらない
- zizmor に新しい audit が入ると、action の更新 PR で既存の workflow が落ちうる。その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効にする

### 依存を上げたときに見直すもの

| 上げたもの                        | 見直すもの                                                                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite+                             | 同梱ツールがまとめて更新される。lint ルールの追加や formatter の整形規則の変更が同じ更新で入りうるので、更新 PR は `mise run verify` の結果まで見て判断する                                                           |
| oxlint (Vite+ 同梱) の minor 以上 | `docs/guides/lint.md`「上流 recommended の改訂に追随する」                                                                                                                                                            |
| Base UI                           | `docs/guides/forms-and-inputs.md`「Select の値を解決する」の表                                                                                                                                                        |
| axe-core                          | `docs/guides/accessibility.md`「axe を上げたとき」                                                                                                                                                                    |
| vitest                            | assert の予算 (ADR-0045) の根拠に使った docs の数字 (browser の `testTimeout` の既定など) を写さず、測り直す。数字は版で動き、上流のメンテナも docs の数字が意図せず変わった可能性に触れている (vitest の issue 9157) |

### 走査対象を持つ config を足す

tsconfig / `vitest.config.ts` / `vitest.browser.config.ts` / `vite.config.ts` (lint・fmt) は、それぞれ `.claude/worktrees/**` を除外している。走査対象を持つ config を新しく足したら、同じ除外をその場で書く。除外の経路は config ごとに別で共通化できず、1 つ落とすと worktree のコードがその走査へ黙って混ざる。

## explanation

### `typescript` を直接の依存に置かない理由

`vp check` の型検査は oxlint の type-aware パスが担い、その実体は tsgolint と TypeScript Go のツールチェーンである (Vite+ の `docs/guide/check.md`)。
`typescript` パッケージは Vite+ 一族の推移依存として入るので、直接の依存から外しても install からは消えない。2026-09-02 に `devDependencies` から外した状態で `vp check` を走らせると、型エラー (`TS2322`) を報告した。
直接の依存へ戻すのは、リポジトリのコードが `typescript` を `import` するようになったときだけでよい。リポジトリのコードが使わないパッケージを、直接の依存として宣言しない。

型検査を lint へ合流させる設定 (`options.typeCheck`) は `scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で押さえるが、設定が真のまま tsgolint が黙って動かない場合は捕まえられない。
