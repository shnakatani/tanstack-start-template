# ADR-0007: GitHub Actions の定義は zizmor で検査し、action は commit SHA で固定する

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0006 (依存更新の待機)

## Context

`.github/workflows/` と `.github/dependabot.yml` の誤設定は、lint と型検査が届かない場所にある。token が残る checkout、tag が書き換えられた action の取り込み、権限の広げすぎは、どれも CI が緑のまま入り込む。

tag と branch は後から付け替えられる。GitHub の security hardening guide は、action を不変に固定する方法は commit SHA だけだとしている。tag で固定していると、上流の tag が付け替えられたときにこちらの差分無しで中身が変わる。

このリポジトリはテンプレートとして配布され、public のまま使われる場合も private で使われる場合もある。

## Decision

**`zizmorcore/zizmor-action` を `.github/workflows/zizmor.yml` で動かし、指摘があれば job を落とす。action はすべて commit SHA で固定する。**

| #   | 決定                                                                           | 理由                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `advanced-security: false` で動かし、権限は job の `contents: read` だけにする | 既定のモードは SARIF を Security タブへ上げるだけで job を落とさず、merge を止めるには ruleset が要る。private かつ GHAS 無しのリポジトリではアップロードもできない。`contents: read` は private リポジトリの checkout に要る |
| 2   | `uses:` は `@<SHA> # vX.Y.Z` の形で書く                                        | zizmor の `unpinned-uses` の既定方針 (全 action に SHA 固定を求める) に従う。Dependabot は SHA とバージョンコメントの組を更新する                                                                                             |
| 3   | `actions/checkout` には `persist-credentials: false` を渡す                    | 後続の step は push しない。v6 以降の checkout は credential を `$RUNNER_TEMP` のファイルへ書き、同じ job の後続 step から読める                                                                                              |
| 4   | zizmor 本体の版は指定しない (`version: latest`)                                | action は `latest` を、同梱の `support/versions` にある digest 付きの image へ解決する (v0.6.4 の `action.sh`)。action の SHA を固定すれば本体の版も固定され、Dependabot の追随と cooldown に乗る                             |
| 5   | 設定は `.github/zizmor.yml` に置き、`dependabot-cooldown` の下限を 3 日にする  | 待機の日数は ADR-0006 が決める。zizmor 1.30.1 の既定 7 日 (2026-09-23 確認) に合わせると、却下した案を検査が強制する                                                                                                          |

### 検討した選択肢

| 案                                         | 評価                                                                                    | 採否     |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | -------- |
| `advanced-security: false` で job を落とす | どの公開範囲でも同じに動き、PR の check で止まる                                        | **採用** |
| Advanced Security (SARIF)                  | 指摘の triage と状態管理はできるが、merge を止めるには利用者ごとに ruleset の設定が要る | 却下     |
| `"*": ref-pin` で exact tag を許す         | tag の付け替えを防げない                                                                | 却下     |
| `version` に zizmor の版を書く             | Dependabot は `with:` の値を更新しないので、手で上げない限り古い版に留まる              | 却下     |

## Consequences

- 新しい action を足すときは `@<SHA> # vX.Y.Z` で書く。手元で `zizmor --fix=all` を使うと SHA へ書き換わる (SHA 固定は unsafe fix に分類され、既定の `--fix=safe` では書き換わらない)
- zizmor に新しい audit が入ると、action の更新 PR で既存の workflow が落ちうる。その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効化する
- 指摘は GitHub の annotation ではなく job のログに出る
- 再評価の条件は、zizmor-action が stable 版を出したとき (README は後方互換の無い変更がありうると書いている)、GitHub が action の tag を不変にする仕組みを既定にしたとき

## 出典

- zizmor-action の README (モード、権限、`version`): https://github.com/zizmorcore/zizmor-action
- zizmor の audit 一覧 (`unpinned-uses`、`artipacked`、`dependabot-cooldown`): https://docs.zizmor.sh/audits/
- GitHub Docs: Secure use reference (Using third-party actions): https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions
- GitHub Docs: Dependabot がコメントのバージョンを更新する条件、`uses:` 以外を更新しないこと: https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories
- actions/checkout v7.0.1 の README (`persist-credentials` の保存先): https://github.com/actions/checkout
