# ADR-0006: GitHub Actions の定義は zizmor で検査し、action は workflow の lockfile で固定する

- Status: Accepted
- Date: 2026-11-23
- 関連: ADR-0005 (依存更新の待機)

## Context

`.github/workflows/` と `.github/dependabot.yml` の誤設定は、lint と型検査が届かない場所にある。token が残る checkout、tag が書き換えられた action の取り込み、権限の広げすぎは、どれも CI が緑のまま入り込む。

`uses:` の tag と branch は後から付け替えられ、GitHub Actions は実行のたびにそのとき指している commit を走らせる。上流の tag が付け替えられると、こちらの差分無しで走る中身が変わる。action が中で使う action (推移の依存) も同じで、`uses:` に commit SHA を書いても、その action が中で tag を使っていれば固定されない。

GitHub Docs「Workflow dependency lockfiles」は、`.github/workflows/actions.lock` に、workflow が使う action を推移の依存まで commit で記録する仕組みを書く (2026-10-28 に GA)。lockfile に載った workflow は、記録された commit を走らせる。

このリポジトリはテンプレートとして配布され、public のまま使われる場合も private で使われる場合もある。

## Decision

**`zizmorcore/zizmor-action` を `.github/workflows/zizmor.yml` で動かし、指摘があれば job を落とす。action は `.github/workflows/actions.lock` で固定し、`uses:` は full semver の tag で書く。lockfile が workflow と合っていることは `.github/workflows/actions-lock.yml` の `gh actions-lock --verify` で検査する。**

| #   | 決定                                                                                                                               | 理由                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | zizmor は `advanced-security: false` で動かし、権限は job の `contents: read` だけにする                                           | 既定のモードは SARIF を Security タブへ上げるだけで job を落とさず、merge を止めるには ruleset が要る。private かつ GHAS 無しのリポジトリではアップロードもできない。`contents: read` は private リポジトリの checkout に要る                                                                                                                                                               |
| 2   | `uses:` は `@vX.Y.Z` で書き、commit は `.github/workflows/actions.lock` に `gh actions-lock` で記録する。lockfile は手で編集しない | GitHub Docs は lockfile を採るリポジトリでは workflow の中の SHA 固定は要らないとする (GitHub Docs「Workflow dependency lockfiles」の「How do lockfiles compare with SHA pinning?」)。lockfile は推移の依存と、上流のリポジトリの同一性 (`owner_id`・`repo_id`) も記録する。`gh actions-lock` は `@v4` のような部分の版を、初めて固定するときに `@v4.2.1` のような full semver へ書き換える |
| 3   | lockfile が届かない参照は、それぞれの形で固定する (下の表)                                                                         | lockfile は step の `uses:` だけを記録する                                                                                                                                                                                                                                                                                                                                                  |
| 4   | `.github/workflows/actions-lock.yml` で `gh actions-lock --verify` を走らせ、lockfile が古ければ job を落とす                      | zizmor の `unpinned-uses` は、workflow が lockfile にあればその workflow の指摘をすべて止め、各 `uses:` が lockfile にあるかを見ない (下の「写しと GitHub の Actions での実測」)。zizmor の lockfile の扱いは experimental である                                                                                                                                                           |
| 5   | verify の job は拡張を `gh extension install github/gh-actions-lock --pin vX.Y.Z` で入れ、版を固定する                             | v0.5.1 の release は immutable release で、tag と asset が変わらない (2026-11-23 に `gh release view` の `isImmutable` で確かめた)。Dependabot は拡張の版を上げないので、手元で lockfile を作る拡張の版に手で合わせる                                                                                                                                                                       |
| 6   | `actions/checkout` には `persist-credentials: false` を渡す                                                                        | 後続の step は push しない。v6 以降の checkout は credential を `$RUNNER_TEMP` のファイルへ書き、同じ job の後続 step から読める                                                                                                                                                                                                                                                            |
| 7   | zizmor 本体の版は指定しない (`version: latest`)                                                                                    | 2026-09-23 に読んだ v0.6.4 の `action.sh` では、action は `latest` を、同梱の `support/versions` にある digest 付きの image へ解決していた。lockfile が action の commit を固定すれば本体の版も固定され、Dependabot の追随と cooldown に乗る                                                                                                                                                |
| 8   | zizmor の設定は `.github/zizmor.yml` に置き、`dependabot-cooldown` の下限を 3 日にする                                             | 待機の日数は ADR-0005 が決める。zizmor 1.30.1 の既定 7 日 (2026-09-23 確認) に合わせると、却下した案を検査が強制する                                                                                                                                                                                                                                                                        |

lockfile が届かない参照と、その固定のしかた。

| 参照                                                                   | 固定のしかた              | 出典                                                                     |
| ---------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| 別のリポジトリの reusable workflow の呼び出し (`jobs.<job_id>.uses`)   | `@<SHA> # vX.Y.Z` で書く  | GitHub Docs「Workflow dependency lockfiles」、github/gh-actions-lock#179 |
| このリポジトリに置く composite action の定義 (`action.yml`) の `uses:` | `@<SHA> # vX.Y.Z` で書く  | gh-actions-lock の README の Limitations、github/gh-actions-lock#183     |
| container image (`docker://`、job の `container:` と `services:`)      | `@sha256:<digest>` で書く | gh-actions-lock の troubleshooting の `container-image`                  |

いずれも zizmor の `unpinned-uses` と `unpinned-images` が lockfile と関係なく指摘する (zizmor docs「Workflow lockfiles」)。

### 検討した選択肢

action の固定のしかた。

| 案                                                              | 評価                                                                                                                                                                                                                                                                  | 採否     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| lockfile で固定し、`uses:` は tag で書く                        | GitHub Docs の Secure use reference が "the strongest protection available" とし、SHA 固定に代わるとする形。`gh actions-lock` の既定の出力もこの形                                                                                                                    | **採用** |
| lockfile で固定し、`uses:` にも SHA を残す                      | `gh actions-lock --no-narrow` で作れるが、`--no-narrow` を付けずに 1 度打つと全部 tag へ書き換わる。`--verify` は SHA ごとに `sha-as-ref` の warning を出す (下の「写しと GitHub の Actions での実測」)。lockfile に載った workflow では SHA が走る commit を変えない | 却下     |
| `uses:` を `@<SHA> # vX.Y.Z` で書き、lockfile を置かない        | 推移の依存と上流のリポジトリの同一性を固定できない。GitHub Docs は lockfile を採れないリポジトリの手段として残す                                                                                                                                                      | 却下     |
| lockfile を置かず、zizmor の `"*": ref-pin` で exact tag を許す | tag の付け替えを防げない                                                                                                                                                                                                                                              | 却下     |

lockfile が古いことの検出。

| 案                                                                                  | 評価                                                                                                                                                                                                      | 採否     |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CI で `gh actions-lock --verify`                                                    | 欠けた entry と、上流で確かめられなくなった commit の両方で落ちる。gh-actions-lock の `verify-lockfile.yml` の形                                                                                          | **採用** |
| zizmor だけに任せる                                                                 | 各 `uses:` が lockfile にあるかを見ない (下の「写しと GitHub の Actions での実測」)                                                                                                                       | 却下     |
| CI で `gh actions-lock --verify-local`                                              | ネットワークを使わず entry の有無だけを見る。記録した commit が上流で確かめられるかは見ない (gh-actions-lock の README の Modes)                                                                          | 却下     |
| `actions-lock.yml` を `run:` だけの workflow にし、lockfile の entry を要らなくする | verify の job が、自分の workflow の entry の欠けで止まらなくなる。代わりに checkout を `run:` で書くことになり、credential を残さない扱い (`persist-credentials: false` の代わり) を別に決める必要がある | 却下     |
| リポジトリの Actions policy の Require lockfile                                     | lockfile に載っていない workflow の実行を止めるが、設定はリポジトリごとの管理者の操作で、テンプレートのファイルでは配れない。Evaluate モードは GitHub Enterprise Cloud だけ                               | 却下     |

zizmor の動かし方。

| 案                                         | 評価                                                                                    | 採否     |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | -------- |
| `advanced-security: false` で job を落とす | どの公開範囲でも同じに動き、PR の check で止まる                                        | **採用** |
| Advanced Security (SARIF)                  | 指摘の triage と状態管理はできるが、merge を止めるには利用者ごとに ruleset の設定が要る | 却下     |
| `version` に zizmor の版を書く             | Dependabot は `with:` の値を更新しないので、手で上げない限り古い版に留まる              | 却下     |

### 写しと GitHub の Actions での実測

2026-11-23 に、このリポジトリの写しで、gh-actions-lock 0.5.1、zizmor 1.32.0 (zizmor-action 0.8.1 の既定)、ローカルの Dependabot (dependabot-cli 1.97.0、updater の commit cbabeb7b) で測った。GitHub の Actions の行は、同じ日に lockfile を書き換えた一時の commit を push して測った。

| 状態                                                                                                  | 結果                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uses:` が tag で、lockfile がある                                                                    | zizmor は指摘 0 件、`gh actions-lock --verify` は exit 0                                                                                                                                                                                                                                  |
| `uses:` が tag で、lockfile が無い                                                                    | zizmor は `unpinned-uses` で exit 14                                                                                                                                                                                                                                                      |
| `uses:` が tag で、`ci.yml` の `actions/checkout` の entry を lockfile から消した                     | zizmor は指摘 0 件で通った。`gh actions-lock --verify-local` は `not-pinned` で exit 1                                                                                                                                                                                                    |
| `--no-narrow` で作り、`uses:` に SHA を残した                                                         | `--verify` は exit 0 で `sha-as-ref` の warning が SHA の数だけ出た。続けて `--no-narrow` 無しで打つと全部 tag へ書き換わった                                                                                                                                                             |
| GitHub の Actions で、lockfile がそろった状態                                                         | `actions-lock`・CI・zizmor の workflow がどれも成功した                                                                                                                                                                                                                                   |
| GitHub の Actions で、lockfile から `voidzero-dev/setup-vp` の entry を外した                         | `setup-vp` を使う CI の workflow は、job を 1 つも始めずに `startup_failure` で止まった。run の画面には "This run likely failed because of a workflow file issue" とだけ出た。`actions-lock` の job は `Not pinned voidzero-dev/setup-vp@v1.22.0` で落ちた。zizmor の workflow は成功した |
| GitHub の Actions で、3 つの workflow がすべて使う `actions/checkout` の entry を lockfile から外した | CI と `actions-lock` の workflow が、どちらも job を始めずに `startup_failure` で止まった。欠けた action はどのログにも出なかった。zizmor の workflow は、変えたファイルが起動の条件に当たらず、run が作られなかった                                                                      |
| `actions/checkout` を v7.0.0 に下げ、Dependabot を走らせた                                            | 1 本の PR が workflow の `uses:` と `actions.lock` の entry を v7.0.1 へ上げ、その結果に `--verify` が exit 0                                                                                                                                                                             |

- Dependabot が lockfile を読むのは、experiment の `github_actions_lockfile` が有効なときである (dependabot-core の `file_fetcher.rb`)。ローカルでは job の定義で有効にして走らせた。GitHub の Dependabot では lockfile も更新されると GitHub Docs と changelog が書く
- Dependabot は同梱の gh-actions-lock を `--no-onboard --no-narrow` で呼ぶ。lockfile に載っていない workflow は載せず、Dependabot が書いた `uses:` の ref をそのまま記録する (dependabot-core の `cli_engine.rb`)
- lockfile の形式の版は `version` が持つ。gh-actions-lock 0.5.1 が書く版は `v0.0.3` だった。Dependabot が受け付けるのは `v0.0.2` と `v0.0.3` で (dependabot-core の `constants.rb`)、Dependabot が同梱する gh-actions-lock 0.4.1 と 0.5.1 は、どちらも `v0.0.3` まで読む `github.com/github/actions-lockfile/go` v0.0.6 で読む。lockfile の `version` が拡張の読める版より新しいと、拡張は exit 2 で止まる (gh-actions-lock の troubleshooting)

## Consequences

- `uses:` を足す・変えるときは、workflow を書き換えたあと `gh actions-lock` を打ち、workflow と `actions.lock` を同じ commit に入れる。手順は `docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」にある
- lockfile に載った workflow が lockfile に entry の無い action を使うと、その workflow は job を 1 つも始めずに `startup_failure` で止まり、run の画面からは原因の action が分からない。原因の action は `actions-lock` の job のログに `Not pinned` で出る (上の「写しと GitHub の Actions での実測」)
- verify の job は、自分の workflow (`actions-lock.yml`) が使う action の entry が欠けると、自分も job を始めずに止まり、欠けを報告できない。どの workflow も job を始めずに止まったら、手元で `gh actions-lock --verify` を打つ。手順は `docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」にある
- Dependabot の action の PR は、workflow と `actions.lock` を一緒に上げる。lockfile に載っていない workflow は、Dependabot が上げても lockfile に載らない
- verify の job の拡張の版は、手元で lockfile を作った拡張の版へ手で上げる
- zizmor の指摘は GitHub の annotation ではなく job のログに出る
- 再評価の条件は、zizmor が lockfile の扱いを experimental から外したとき (zizmorcore/zizmor#2477)、gh-actions-lock が verify 用の action を出したとき (github/gh-actions-lock#293)、lockfile が reusable workflow の呼び出しを記録するようになったとき (github/gh-actions-lock#179)、zizmor-action が stable 版を出したとき (README は後方互換の無い変更がありうると書いている)

## 出典

2026-11-23 に読んだ。

- GitHub Docs: Workflow dependency lockfiles (SHA 固定との比較、届かない参照): https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles 。「How do lockfiles compare with SHA pinning?」に "For repositories that adopt a lockfile, SHA pinning within workflow files is **no longer necessary**." とある
- GitHub Docs: Locking action dependencies in a repository's workflows (`gh actions-lock` の打ち方、実行時の失敗、Dependabot): https://docs.github.com/en/actions/how-tos/secure-your-work/lock-workflow-dependencies
- GitHub Docs: Enforcing lockfiles for action dependencies (verify の job、Require lockfile): https://docs.github.com/en/actions/how-tos/administer/enforce-workflow-lockfiles
- GitHub Docs: Secure use reference (Using third-party actions): https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions 。lockfile を "This is the strongest protection available, and supersedes SHA pinning for repositories that adopt it." とする
- GitHub Docs: Immutable releases: https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases
- GitHub Changelog: GitHub Actions workflow lockfiles are generally available (2026-10-28): https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available/
- gh-actions-lock v0.5.1 の README (Modes、Limitations): https://github.com/github/gh-actions-lock/blob/d68b1a345a0aa02cf870cd0e0d78418d492d280d/README.md
- gh-actions-lock v0.5.1 の troubleshooting (`sha-as-ref`、`container-image`、拡張より新しい lockfile): https://github.com/github/gh-actions-lock/blob/d68b1a345a0aa02cf870cd0e0d78418d492d280d/docs/troubleshooting.md
- gh-actions-lock v0.5.1 の `verify-lockfile.yml`: https://github.com/github/gh-actions-lock/blob/d68b1a345a0aa02cf870cd0e0d78418d492d280d/.github/workflows/verify-lockfile.yml
- `github.com/github/actions-lockfile/go` v0.0.6 の読める版: https://github.com/github/actions-lockfile/blob/ac158834765237ee94c36606cfc7d87316aa49ab/go/pkg/lockfile/compat.go
- dependabot-core の lockfile の扱い (`file_fetcher.rb`、`lockfile/cli_engine.rb`、`constants.rb`): https://github.com/dependabot/dependabot-core/tree/cbabeb7b1671021a093ac3990c9e0ac17dc20fdd/github_actions/lib/dependabot/github_actions
- zizmor docs: Workflow lockfiles: https://docs.zizmor.sh/usage/#workflow-lockfiles
- zizmor の `unpinned-uses` が lockfile を見る処理: https://github.com/zizmorcore/zizmor/blob/0af0be985a4cae71ecfaa64ef574a94b35dc722a/crates/zizmor/src/audit/unpinned_uses.rs
- zizmor-action の README (モード、権限、`version`): https://github.com/zizmorcore/zizmor-action
- zizmor の audit 一覧 (`unpinned-uses`、`unpinned-images`、`artipacked`、`dependabot-cooldown`): https://docs.zizmor.sh/audits/
- actions/checkout v7.0.1 の README (「Checkout v6」の What's new。`persist-credentials` の保存先): https://github.com/actions/checkout/blob/v7.0.1/README.md
