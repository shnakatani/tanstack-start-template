# ADR-0005: 依存更新は待機 3 日で統一し、pin には出口条件を書く

- Status: Accepted
- Date: 2026-09-29
- 関連: ADR-0004 (Vite+ が版を管理する制約)、ADR-0014 (React Compiler が要求する依存)

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
この設定はコードに現れないため、本 ADR がその記録を持つ。有効にするコマンドは `docs/guides/dependencies-and-toolchain.md`「Dependabot の alerts を有効にする」にある。

alerts / security updates / version updates の 3 機能は private リポジトリでも追加費用がかからない。

### 2. 待機を 3 日に統一する

| 層                                  | 場所                 | 責務                                                     |
| ----------------------------------- | -------------------- | -------------------------------------------------------- |
| リポジトリ設定 (Web / API のトグル) | GitHub 側 (コード外) | 脆弱性の検知と修正 PR の起動                             |
| `.github/dependabot.yml`            | リポジトリ           | bot が PR を作る側のゲート (`cooldown: default-days: 3`) |
| `pnpm-workspace.yaml`               | リポジトリ           | 開発者の手元でのゲート (`minimumReleaseAge: 4320` 分)    |

**2 つの値は対で持つ。片方だけ変えない。** 単位が違う (分と日) ので、変更時は両ファイルの相互参照コメントを辿って揃える。

`.github/zizmor.yml` の `rules.dependabot-cooldown.config.days: 3` は、`cooldown` がこの待機を下回ったら CI を落とす下限である (ADR-0006)。zizmor 1.30.1 の既定は 7 日 (2026-09-23 確認) だが、7 日案は下の「検討した選択肢」で却下しているので、下限を待機に合わせる。待機を変えるときはこの値も揃える。

`minimumReleaseAge` は明示設定すると pnpm が strict 挙動を既定 true にする。
範囲内に成熟版がないとき未成熟版を黙って解決する fallback が閉じ、非 TTY (CI やエージェントのシェル実行) では即エラーになる。

セキュリティ修正は待機をバイパスする。
Dependabot security updates は cooldown の対象外で、手元では `vp pm audit --fix` が `minimumReleaseAgeExclude` に修正版を自動追記する。

### 3. 前倒しは provenance を確認してから

3 日待たずに取り込みたいときは、そのバージョンが公式のリリースパイプラインから出たものであることを確認する。

確かめ方 (`_npmUser` の `trustedPublisher`、attestation の `subject` と `workflow`) は `docs/guides/dependencies-and-toolchain.md`「待機を前倒しする」にある。個人トークンでの公開は、トークン漏洩が成立経路になるため前倒しの根拠には足りない。

**追記は必ずバージョンまで固定する** (`@scope/pkg@x.y.z`)。
パッケージ名だけを書くと、そのパッケージの全バージョンが恒久的に待機の対象外になる。バージョンを固定しておけば次のリリースで待機が自動的に復活し、エントリの消し忘れが穴として残らない。

### 4. Vite+ が書く恒久除外は上流の出力を受け入れる

`vp migrate` は `minimumReleaseAge` を持つリポジトリに対し、Vite+ が版を管理するパッケージ群を `minimumReleaseAgeExclude` へ書き込む。抑止する手段はない。

**この出力を編集せず、一覧を本 ADR にも写さない。** 写すと `vp migrate` の再実行のたびに実体とずれ、どちらが正かを読み手が判断できなくなる。現在の一覧は `pnpm-workspace.yaml` が持つ。

受け入れるのは、逆らうと `vp install` が壊れるからである。Vite+ は自身が抱えるパッケージを exact pin し、公開直後の版を指すことがある。

失うものを明記する。この除外は名前とグロブで書かれるため、前節の「バージョンまで固定する」を満たさない。待機は将来のバージョンにも復活せず、`vp install` が新版を公開直後に取り込みうる。残る防御は alerts と security updates で、これは待機とは独立に働く。

bot 側の待機は外さない。`cooldown: default-days: 3` は全パッケージに掛け続ける。version updates は新版の通知経路であって、`vp install` の成否とは無関係だからである。

`vp install` が待機で止まったら、こちらで一覧へ足すのではなく上流へ報告する。

### 5. vite-plus と同梱の依存は 1 つのグループで受け取り、vitest は bot に上げさせず vp migrate で揃える

core (`vite` の alias 先)・`vitest`・`@vitest/*` の版は、`vite-plus` のリリースが同梱する版で決まる。
Vite+ の docs は、`vite-plus` を上げたあと `vp migrate` で残りを揃える手順を推奨する (Vite+ docs「Update Vite+」)。

`.github/dependabot.yml` の `vite-plus` グループは、`vite-plus`・`vite`・`@voidzero-dev/vite-plus-*`・`vitest`・`@vitest/*` を束ねる。Vite+ が docs に載せる予定の Dependabot の設定例 (vite-plus の PR 2463、2026-09-29 に draft) に、alias の `vite` を足した形である。グループへ束ねても版は揃わない。

- `vitest` が `vite-plus` と別の日に出ると、`vitest` を同梱の版より先へ上げる PR ができる (vite-plus の issue 2356)。2026-09-09 から 09-28 に 6 本来た
- `vite-plus` を上げた PR に `vite` の alias 先は含まれなかった (2026-09-16、09-21 の 2 本)

グループの PR は閉じても版を ignore しないので、`vitest` だけの PR は次の実行で作り直される (2026-09-29 に Dependabot が PR に書いた案内)。止めるには `@dependabot ignore <依存>` のコメントか設定ファイルの `ignore` が要る (GitHub Docs「Dependabot pull request comment commands」)。そのため `vitest` と `@vitest/*` は、`dependency-name` だけで `ignore` に入れ、グループの `patterns` には残す (実測した構成を保ち、`minor-and-patch` の `exclude-patterns` と対にするため)。`vite-plus` の PR は、そのブランチで `vp migrate` を打って core・`vitest`・`@vitest/*` を同梱の版へ揃えてから取り込む。手順は `docs/guides/dependencies-and-toolchain.md`「Vite+ を上げる」にある。

`vite-plus` は `@vitest/browser-playwright` を exact な optional peer に持ち、pnpm 11 は optional な peer の食い違いも unmet として報告する (2026-09-29、pnpm 11.28.0 で実測)。Dependabot の docs は peer の扱いを書いていない (2026-09-29 時点) ので、ignore した peer と食い違う `vite-plus` の版に PR が作られるかを実測した。`vite-plus` 0.2.9・`@vitest/browser-playwright` 4.1.10 の構成に上のグループを置き、`ignore` を `update-types` の 3 つを並べる形と `dependency-name` だけの形で 1 回ずつ試した。どちらも Dependabot の `pnpm --filter . peers check` は exit 1 だったが、`vite-plus` を 0.3.3 へ上げる PR が作られた (2026-09-29、pnpm 11.28.0、実験用の private リポジトリで観測)。この食い違いは exact な peer の patch の差 (4.1.10 と 4.1.11) で、major の差では確かめていない。

`vitest` の脆弱性は security updates の PR ではなく alert で知り、下の「pin には出口条件を書く」のトリガ A で扱う。

core と、core が同梱する vite・rolldown・tsdown の脆弱性の alert は、`vite-plus` の名前で届いたものだけが頼りになる。依存グラフは core を `@voidzero-dev/vite-plus-core` として記録し、`vite` の名前を持たないので、`vite` 宛ての advisory は照合先が無い。core が同梱する 3 つの版も記録されない。rolldown は別の依存から入った版だけが載る (2026-09-29 に依存グラフの SBOM で確認)。VoidZero は `vite` の advisory に `vite-plus` を足すことがあるが (GHSA-fx2h-pf6j-xcff)、足していない advisory もある (GHSA-v2wj-q39q-566r)。

### 6. pin には出口条件を書く

依存を pin する (exact pin または Dependabot の `ignore`) ときは、次をセットで課す。

- **出口条件のない pin を作らない。** pin を外せる条件 (上流の修正マージやリリース) を、pin を構成する全箇所 (`overrides` / `ignore` / `patchedDependencies`) のコメントへ書く。根拠が ADR にあるならその番号を参照する
- **追従は定期でなくトリガ駆動で行う**

| トリガ | 発火                          | やること                                                        |
| ------ | ----------------------------- | --------------------------------------------------------------- |
| A      | pin 対象への Dependabot alert | 修正版への追随か pin 撤去の前倒しをその場で判断する             |
| B      | Dependabot PR の処理時        | pin の出口条件 (上流 issue の状態) を確認し、成立していたら外す |

トリガ A が成立するのは、**alerts は `ignore` と独立に発火する**ためである。`dependency-name` だけで書いた `ignore` は version updates と security updates の PR をどちらも止める (GitHub Docs「Controlling which dependencies are updated」)。`update-types` を付けた `ignore` が security updates に効くかは docs に記述が無い (2026-09-29 時点)。pin 中の修正は alert を見て手で当てる。pin 中でも「既知脆弱性が出たことを知る」経路は生きている。

独立した定期チェックは設けない。忘れられる運用を作らない。

- **連鎖 pin は同じ出口条件へ束ねる。** 束ね方は `docs/guides/dependencies-and-toolchain.md`「pin を足す」にある

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

| 案                                                                                                                                  | 評価                                                                                                                         | 採否     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| 待機を 3 日に統一                                                                                                                   | 緩和効果と更新追従の遅延のバランスが取れ、bot の既定とも一致                                                                 | **採用** |
| 待機を 1 日に統一                                                                                                                   | bot 側の待機を短縮する方向で、緩和窓が縮む                                                                                   | 却下     |
| 待機を 7 日に統一                                                                                                                   | weekly の更新サイクルに対して過剰で、バグ修正への追従が遅れる                                                                | 却下     |
| Dependabot PR の auto-merge                                                                                                         | マージ判断はローカルの検証が前提のため成立しない                                                                             | 却下     |
| 定期的に pin を見直す                                                                                                               | advisory が無い間は確認コストを払うだけで利得が無い                                                                          | 却下     |
| `vite-plus`・core・`vitest`・`@vitest/*` を 1 つのグループへ束ね、`vitest` と `@vitest/*` を `dependency-name` だけで `ignore` する | `vitest` だけが先へ進む PR も security updates の PR も来ない。`vite-plus` の PR は peer の食い違いがあっても作られた (実測) | **採用** |
| `vite-plus` も含めてすべて `ignore` する                                                                                            | Vite+ の新版に気付く経路が無くなる                                                                                           | 却下     |
| 採用案から `ignore` を外す (Vite+ の設定例 PR 2463 の形)                                                                            | `vitest` だけが先へ進む PR が毎週作り直され、そのたびに `vp migrate` で揃えて閉じることになる                                | 却下     |
| グループの PR に `@dependabot ignore vitest` とコメントする                                                                         | 条件が設定ファイルに現れない。GitHub Docs は複数人のリポジトリでは設定ファイルに書くよう勧める                               | 却下     |
| `peerDependencyRules` で `vite-plus>@vitest/browser-playwright` を許す                                                              | `ignore` だけで `vite-plus` の PR が作られたので要らない。手元の peer の食い違いも黙らせる                                   | 却下     |

## Consequences

- 公開 3 日未満の新版へ意図的に上げたい場面では、3 日待つか provenance を確認して `minimumReleaseAgeExclude` へ追記するかを明示的に判断する
- 追記したエントリの後始末は `minimumReleaseAgeExcludePrune` が持つ (`docs/guides/dependencies-and-toolchain.md`「待機を前倒しする」)
- Dependabot の version updates PR は weekly スケジュールと 3 日 cooldown の合成で、リリースから最長 1 週間強遅れて届く
- pin のリスクは「advisory が出てから対応するまでの遅延」に限定される。検知は自動のまま残るので、無検知の放置は起きない
- Dependabot PR の処理が「依存更新の取り込み」と「pin の出口確認」を兼ねる。手順が 1 段増えるが、独立した定期タスクを管理するより忘れにくい
- 再評価の条件は、GitHub が cooldown の既定値を変えたとき、pnpm のメジャー更新で strict 挙動の既定が変わったとき、Vite+ が自身の抱えるパッケージの exact pin をやめたとき、Vite+ が bot 向けの設定例を docs に載せたとき (vite-plus の PR 2463、2026-09-29 に draft)、vite の alias と CLI の版のずれを検知して `vp` を止めるようになったとき (vite-plus の PR 2462、2026-09-29 に draft)。`vitest` 系の `ignore` は、`vite-plus` の新しい版が npm の latest に載り、cooldown を過ぎたあとの Dependabot の実行でも `vite-plus` の PR ができないときにも見直す。Dependabot の PR を処理するとき (トリガ B) に、`docs/guides/dependencies-and-toolchain.md`「Vite+ を上げる」の手順で確かめる
- `package.json` の `playwright` は caret で持つ。`*` にして版追随を `@vitest/browser-playwright` へ委任する形は成り立たない。その peer 自身が `playwright: "*"` (`optional: false`) で何も制約しておらず、委任先が存在しない (2026-09-02 実測)。実際に版を決めているのは lockfile と待機ゲートで、そこは caret でも変わらない。caret にすると major が Dependabot の別 PR になり判断が挟まる。exact pin ではないため出口条件は無い
- `package.json` の `nitro` は nitro 3 の beta 版に exact pin する。TanStack Start の hosting ガイドが使う `nitro/vite` の plugin は nitro 3 にしかなく、nitro 3 は使える stable 版が出ていない (2026-09-27 に `npm view nitro dist-tags` の `latest` は `3.0.260903-beta`。`3.0.0` は公開されているが非推奨)。出口条件は nitro 3 の stable 版が `latest` に載ること。そのとき範囲指定か `catalog:` へ移せるかを見直す

## 出典

- pnpm: Mitigating supply chain attacks: https://pnpm.io/supply-chain-security
- pnpm update が宣言レンジを書き換える仕様と `catalog:` の例外、`--no-save`: https://pnpm.io/cli/update
- `pnpm audit --fix` が修正版を `minimumReleaseAgeExclude` へ追記する仕様: https://pnpm.io/cli/audit
- GitHub Blog: The case for a cooldown: https://github.blog/security/supply-chain-security/the-case-for-a-cooldown-why-dependabot-now-waits-before-issuing-version-updates/
- GitHub Docs: Configuring Dependabot alerts: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts
- vite-plus と core を別々に上げると未リリースの組み合わせになり、vitest は同梱の版より先へ上がる件: https://github.com/voidzero-dev/vite-plus/issues/2356
- Vite+ docs「Update Vite+」(`vite-plus` を上げたあと `vp migrate` で揃える): https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/upgrade-project.md
- GitHub Docs: `ignore` が version updates と security updates の両方に効く: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/controlling-dependencies-updated
- Vite+ が docs に載せる予定の Dependabot の設定例: https://github.com/voidzero-dev/vite-plus/pull/2463
- Vite+ の CLI が vite の alias との版のずれで止まる変更: https://github.com/voidzero-dev/vite-plus/pull/2462
- GitHub Docs: Dependabot pull request comment commands: https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-pull-request-comment-commands
- GitHub Docs: 設定ファイルで ignore を定義する推奨: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/managing-pull-requests-for-dependency-updates
- TanStack Start の hosting ガイド (nitro/vite の plugin): https://tanstack.com/start/latest/docs/framework/react/guide/hosting
