# ADR-0005: 依存更新は待機 3 日で統一し、pin には出口条件を書く

- Status: Accepted
- Date: 2026-08-17
- Revised: 2026-09-02 (`playwright` の範囲を `*` から caret へ改め、`minimumReleaseAgeExcludePrune` を有効にした)
- 関連: ADR-0002 (Vite+ が版を管理する制約)、ADR-0009 (React Compiler が要求する依存)

## Context

新しいバージョンがコードベースに入る入口は「開発者の手元での解決」と「Dependabot の PR」の 2 つある。
待機の設定はそれぞれ別のファイルにあり、既定値も違うため、揃えないと片方の入口だけ緩い状態になる。

公開直後のバージョンを待つのは supply-chain 攻撃の緩和策である。
侵害されたリリースの多くは公開後数時間で検出・撤回されるため、待つだけで大半を避けられる。

version updates は「新しいバージョンが出た」ことしか教えない。
「使用中のバージョンに既知脆弱性があるか」は Dependabot alerts がないと見えない。

## Decision

### 1. alerts と security updates を有効化する

リポジトリ設定の Dependabot alerts と Dependabot security updates を有効にする。
この設定はコードに現れないため、本 ADR がその記録を持つ。

```bash
gh api -X PUT /repos/<owner>/<repo>/vulnerability-alerts
gh api -X PUT /repos/<owner>/<repo>/automated-security-fixes
```

alerts / security updates / version updates の 3 機能は private リポジトリでも追加費用がかからない。

### 2. 待機を 3 日に統一する

| 層                                  | 場所                 | 責務                                                     |
| ----------------------------------- | -------------------- | -------------------------------------------------------- |
| リポジトリ設定 (Web / API のトグル) | GitHub 側 (コード外) | 脆弱性の検知と修正 PR の起動                             |
| `.github/dependabot.yml`            | リポジトリ           | bot が PR を作る側のゲート (`cooldown: default-days: 3`) |
| `pnpm-workspace.yaml`               | リポジトリ           | 開発者の手元でのゲート (`minimumReleaseAge: 4320` 分)    |

**2 つの値は対で持つ。片方だけ変えない。** 単位が違う (分と日) ので、変更時は両ファイルの相互参照コメントを辿って揃える。

`minimumReleaseAge` は明示設定すると pnpm が strict 挙動を既定 true にする。
範囲内に成熟版がないとき未成熟版を黙って解決する fallback が閉じ、非 TTY (CI やエージェントのシェル実行) では即エラーになる。

セキュリティ修正は待機をバイパスする。
Dependabot security updates は cooldown の対象外で、手元では `vp pm audit --fix` が `minimumReleaseAgeExclude` に修正版を自動追記する。

### 3. 前倒しは provenance を確認してから

3 日待たずに取り込みたいときは、そのバージョンが公式のリリースパイプラインから出たものであることを確認する。

```bash
curl -s https://registry.npmjs.org/<pkg>/<version> | jq '{_npmUser, repository, attestations: .dist.attestations}'
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/<pkg>@<version>"
```

`_npmUser` に `trustedPublisher` があれば OIDC による公開である。個人トークンでの公開は、トークン漏洩が成立経路になるため前倒しの根拠には足りない。
attestation の `subject` が対象の package と version に一致し、`workflow.repository` が公式リポジトリで、`workflow.ref` が既定ブランチかリリースタグであることまで見る。

**追記は必ずバージョンまで固定する** (`@scope/pkg@x.y.z`)。
パッケージ名だけを書くと、そのパッケージの全バージョンが恒久的に待機の対象外になる。バージョンを固定しておけば次のリリースで待機が自動的に復活し、エントリの消し忘れが穴として残らない。

### 4. Vite+ 一族の恒久除外は上流の出力を受け入れる

`vp migrate` は `minimumReleaseAge` を持つリポジトリに対し、Vite+ が版を管理するパッケージ群を `minimumReleaseAgeExclude` へ書き込む。抑止する手段はない。

**この出力を編集せず、一覧を本 ADR にも写さない。** 写すと `vp migrate` の再実行のたびに実体とずれ、どちらが正かを読み手が判断できなくなる。現在の一覧は `pnpm-workspace.yaml` が持つ。

受け入れるのは、逆らうと `vp install` が壊れるからである。Vite+ は自身が抱えるパッケージを exact pin し、公開直後の版を指すことがある。

失うものを明記する。この一族は名前とグロブで書かれるため、前節の「バージョンまで固定する」を満たさない。待機は将来のバージョンにも復活せず、`vp install` が新版を公開直後に取り込みうる。残る防御は alerts と security updates で、これは待機とは独立に働く。

bot 側の待機は外さない。`cooldown: default-days: 3` は全パッケージに掛け続ける。version updates は新版の通知経路であって、`vp install` の成否とは無関係だからである。

`vp install` が待機で止まったら、こちらで一覧へ足すのではなく上流へ報告する。

### 5. 同一リリースで動く対はグループへ束ねる

`vite-plus` と core (`vite` の alias 先) は同一リリースで exact pin される対だが、bot からは無関係な別パッケージに見える。
別々の PR に割れると、どちらをマージしてもリリースされたことのない組み合わせになる。

- `.github/dependabot.yml` の `groups` に `vite-plus` グループを置く
- `pnpm-workspace.yaml` の `catalog:` へエントリを足したら `patterns` にも足す。逆は成り立たない (`patterns` は catalog に現れない推移依存もグロブで拾う)
- グループは `minor-and-patch` より前に置く。Dependabot は先に一致したグループを採るため、後ろに置くと major 更新だけが別 PR に落ちる

### 6. pin には出口条件を書く

依存を pin する (exact pin または Dependabot の `ignore`) ときは、次をセットで課す。

- **出口条件のない pin を作らない。** pin を外せる条件 (上流の修正マージやリリース) を、pin を構成する全箇所 (`overrides` / `ignore` / `patchedDependencies`) のコメントへ書く。根拠が ADR にあるならその番号を参照する
- **追従は定期でなくトリガ駆動で行う**

| トリガ | 発火                          | やること                                                        |
| ------ | ----------------------------- | --------------------------------------------------------------- |
| A      | pin 対象への Dependabot alert | 修正版への追随か pin 撤去の前倒しをその場で判断する             |
| B      | Dependabot PR の処理時        | pin の出口条件 (上流 issue の状態) を確認し、成立していたら外す |

トリガ A が成立するのは、`ignore` が止めるのが version updates の PR 作成だけで、**alerts は `ignore` と独立に発火する**ためである。pin 中でも「既知脆弱性が出たことを知る」経路は生きている。

独立した定期チェックは設けない。忘れられる運用を作らない。

- **連鎖 pin は同じ出口条件へ束ねる。** 間接的に pin 圏へ入るパッケージを見つけたら `ignore` へ追記し、同じ出口条件を参照させる。出口条件の文字列を grep すれば pin の全構成要素が見つかる状態を保つ

### 7. 宣言レンジは `pnpm update` が書き換える

`pnpm update` は解決した版を宣言レンジへ書き戻す。pnpm 公式は「the range is moved onto the resolved version while the operator the dependency already declared is kept」と説明しており、仕様である。
例外は `catalog:` で、「A dependency declared through the `catalog:` protocol is not rewritten in `package.json`. The catalog entry it points at is updated instead」となる。書き換えを止めるなら `--no-save` を渡す。

この性質があるため、`package.json` に書いた宣言レンジは「更新のたびに解決版へ寄る」ことを前提に選ぶ。
operator を持たない `*` は operator ごと書き換えられるので、意図として維持できない。

| 案                                        | 評価                                                                                                                           | 採否     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `playwright` を caret にする              | `pnpm update` を通しても安定し、major は Dependabot の別 PR になって判断が挟まる                                               | **採用** |
| `*` を維持し `vp update --no-save` を使う | 宣言は守れるが、フラグを付け忘れると壊れる。強制する仕組みが無い                                                               | 却下     |
| `playwright` を `package.json` から外す   | `@vitest/browser-playwright` の必須 peer なので install はされるが、root から解決できず `vp exec` の経路が上流の仕様に依存する | 却下     |
| `*` であることを整合検査で固定する        | 根拠 (peer への委任) が成り立っていないものを機械強制することになる                                                            | 却下     |

### 検討した選択肢

| 案                               | 評価                                                             | 採否     |
| -------------------------------- | ---------------------------------------------------------------- | -------- |
| 待機を 3 日に統一                | 緩和効果と更新追従の遅延のバランスが取れ、bot の既定とも一致     | **採用** |
| 待機を 1 日に統一                | bot 側の待機を短縮する方向で、緩和窓が縮む                       | 却下     |
| 待機を 7 日に統一                | weekly の更新サイクルに対して過剰で、バグ修正への追従が遅れる    | 却下     |
| Dependabot PR の auto-merge      | マージ判断はローカルの検証が前提のため成立しない                 | 却下     |
| 定期的に pin を見直す            | advisory が無い間は確認コストを払うだけで利得が無い              | 却下     |
| pin せず更新のたびに手動レビュー | `patchedDependencies` はバージョン束縛で、exact pin が技術的前提 | 却下     |

## Consequences

- 公開 3 日未満の新版へ意図的に上げたい場面では、3 日待つか provenance を確認して `minimumReleaseAgeExclude` へ追記するかを明示的に判断する
- 追記したエントリの後始末は `minimumReleaseAgeExcludePrune` (pnpm 11.22.0) が持つ。`vp add` / `update` / `remove` が、lockfile の解決から消えたエントリを自動で削除する。`@scope/*` のパターンは常に残るため、Vite+ 一族の恒久除外は刈られない
- Dependabot の version updates PR は weekly スケジュールと 3 日 cooldown の合成で、リリースから最長 1 週間強遅れて届く
- pin のリスクは「advisory が出てから対応するまでの遅延」に限定される。検知は自動のまま残るので、無検知の放置は起きない
- Dependabot PR の処理が「依存更新の取り込み」と「pin の出口確認」を兼ねる。手順が 1 段増えるが、独立した定期タスクを管理するより忘れにくい
- 再評価の条件は、GitHub が cooldown の既定値を変えたとき、pnpm のメジャー更新で strict 挙動の既定が変わったとき、Vite+ が自身の抱えるパッケージの exact pin をやめたとき
- `package.json` の `playwright` は caret で持つ。2026-08-17 の初版は `*` にして「版追随を `@vitest/browser-playwright` へ委任する」と書いたが、その peer 自身が `playwright: "*"` (`optional: false`) で何も制約しておらず、委任先が存在しなかった (2026-09-02 実測)。実際に版を決めているのは lockfile と待機ゲートで、そこは caret でも変わらない。caret にすると major が Dependabot の別 PR になり判断が挟まる。exact pin ではないため出口条件は無い

## 出典

- pnpm: Mitigating supply chain attacks: https://pnpm.io/supply-chain-security
- pnpm update が宣言レンジを書き換える仕様と `catalog:` の例外、`--no-save`: https://pnpm.io/cli/update
- `pnpm audit --fix` が修正版を `minimumReleaseAgeExclude` へ追記する仕様: https://pnpm.io/cli/audit
- GitHub Blog: The case for a cooldown: https://github.blog/security/supply-chain-security/the-case-for-a-cooldown-why-dependabot-now-waits-before-issuing-version-updates/
- GitHub Docs: Configuring Dependabot alerts: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts
- vite-plus と core を別々に上げると未リリースの組み合わせになる件: https://github.com/voidzero-dev/vite-plus/issues/2356
