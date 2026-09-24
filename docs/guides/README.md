# 設計ガイド

部品をまたいで守る作法について、なぜその形か (explanation) と、その作法で組む手順・落とし穴への対処 (how-to) を主題ごとに置く。
決定と、決定で比べた案は `docs/decisions/` の ADR が持ち、ガイドは ADR を番号で指す。作法の選び方で比べた案は、ガイドの explanation が持つ。Claude が作業中に読む規範は `.claude/rules/` が持ち、出典としてガイドの節を指す (ADR-0001)。

## 書き方

書き方の全体と理由は `docs/guides/writing-docs.md`「ガイドを書く」「ガイドの書き方を選んだ理由」にある。要点は次のとおり。

- 1 本に 1 主題。主題の中を how-to の節と explanation の節に分ける
- コードはファイルパスで指し、貼らない。ADR の決定は言い換えず `ADR-NNNN` で指す
- 経緯を書かない。コードと決定が変わったら、その場で書き換える
- 節を他の文書から指すときは `docs/guides/<file>.md「<見出し>」` の形にする。見出しを変えたら `git grep` で指している側を直す

## 主題

| ファイル                                                               | 主題                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [writing-docs.md](writing-docs.md)                                     | ドキュメントの書き方 (ADR・rules・AGENTS.md・ガイドの書き方、比の洗い出し)                                                                                                             |
| [lint/configuration.md](lint/configuration.md)                         | lint の設定 (解決後の設定での確かめ方、ルールとプラグインの足し方、testing-library の範囲、variant、off の条件とテストの緩和、抑制、設定の落とし穴)                                    |
| [lint/tailwind-and-shadcn.md](lint/tailwind-and-shadcn.md)             | Tailwind と shadcn の lint (`require-static-classes` の範囲、variant 関数の宣言、`@shadcn/lint` の発火の確かめ方)                                                                      |
| [lint/custom-rules.md](lint/custom-rules.md)                           | 自前の lint ルール (書き方、2 通りに壊して確かめる、JS plugin の落とし穴)                                                                                                              |
| [placement.md](placement.md)                                           | 配置と境界 (route の中の置き場、route ファイルの組み方、features か route か、importProtection の落とし穴)                                                                             |
| [updates-and-data.md](updates-and-data.md)                             | React の更新とデータ取得 (ハンドラ、Action 層と mutation、完了点の組み方、楽観表示、認可、部分一致の検索、手動メモ化の判定)                                                            |
| [lists-and-search.md](lists-and-search.md)                             | 一覧・絞り込み・検索 (一覧テーブル、URL の絞り込み条件、検索の入力欄)                                                                                                                  |
| [forms-and-inputs.md](forms-and-inputs.md)                             | フォームと入力部品 (スキーマ、数値の入力欄、fieldComponents、Select の値の解決、高さのあるダイアログ、placeholder)                                                                     |
| [styling-and-tokens.md](styling-and-tokens.md)                         | スタイルとトークン (色の当て方、外見の配り方、トークンの作り直し、比の測り方、scan と `theme(static)`、間隔)                                                                           |
| [accessibility.md](accessibility.md)                                   | アクセシビリティ (層ごとの役割、axe の緑と incomplete の読み方、a11y の tag、抑制の書き方、通知の文言)                                                                                 |
| [testing/waiting-and-assertions.md](testing/waiting-and-assertions.md) | テストの待機と assert (待つ口、同期読みの書き換え、否定を肯定で書く、assert の予算、viewport、状態と通知)                                                                              |
| [testing/user-interactions.md](testing/user-interactions.md)           | テストのユーザー操作 (クリックの発火、animation を戻すテスト、入力部品、debounce)                                                                                                      |
| [testing/route-wrappers.md](testing/route-wrappers.md)                 | route の wrapper のテスト                                                                                                                                                              |
| [testing/check-scripts.md](testing/check-scripts.md)                   | 検査スクリプトの置き方                                                                                                                                                                 |
| [storybook.md](storybook.md)                                           | Storybook (story の置き方と書き方、カタログと play の範囲、framework と telemetry、自動構成の外、play の書き方と移し方、CLI の使い方と MCP を入れない理由)                             |
| [registry.md](registry.md)                                             | registry との付き合い方 (部品の足し方、baseline の取り直しと 3-way の取り込み、台帳との突き合わせ、公式のノブ)。乖離の台帳は `docs/registry-deviations.md`                             |
| [dependencies-and-toolchain.md](dependencies-and-toolchain.md)         | 依存と開発環境 (手元の環境、秘密の足し方、待機の前倒し、catalog と pin、action の足し方、依存を上げたときに見直すもの、config の worktree 除外、typescript を直接の依存に置かない理由) |
