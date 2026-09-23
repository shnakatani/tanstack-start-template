import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * 既定の story が描かない tint の組み合わせを実テキストとして描き、`parameters.a11y.test` の
 * axe に判定させる (ADR-0033「リポジトリが持つ検算は実描画と axe で行い、比を計算する story を持たない」)。この story は比を計算しない。計算を持たせると、描画では
 * なく計算のほうを検査することになり、story が描いた色と判定がずれても気づけない。比を数で
 * 知りたいときは `mise run contrast` を使う (docs/guides/styling-and-tokens.md「比を測る」)。
 *
 * hover を実際に当てる形は採らない。`transition-colors` が効いている間は下地と混ざった途中の
 * 色が出ており、axe がそこを測ると最終的な配色には存在しない比が報告される。代わりに hover で
 * 現れる utility を、prefix を外した形で静的に描く。
 *
 * ブラウザテスト側がマウスを退避させるのは別の理由による (`src/test/park-mouse.ts`)。全体 run で
 * 前のファイルの click 位置が残り、開状態の検証が hover の配色と交絡するのを防ぐためで、
 * story の実行経路には関わらない。
 *
 * light と dark は project が分かれており (`vitest.config.ts`)、`vp test run` と
 * `mise run verify` では同じ story が両方で走る。片方でしか現れない不透明度も両方で描かれる。
 * Storybook 経由の実行 (test panel / `storybook tools test run`) は light だけなので、
 * dark 側を確かめるときは `vp test run` で回す (ADR-0038)。2026-09-21 時点では
 * どちらのテーマでも 4.5:1 を満たす。いちばん狭いのは light 側で描いた
 * `bg-destructive-surface/30` で、トークンを動かすと画面に存在しない対で落ちうる。そのときは
 * 落ちた対がそのテーマで現れるかを先に確かめる。同じ色なら `mise run contrast` と axe の比は
 * 一致するが、axe は画面の面の重なりまで畳むので、渡す面が違えば値も違う (docs/guides/styling-and-tokens.md「測り方の限界」)。
 *
 * 1 つの面に複数の文字色が乗る組み合わせ (`bg-muted/50`) は、文字色ごとに 1 行を置く。
 * 面だけを描いても、その上に何が乗るかで通るか割るかが変わる。
 *
 * 対象は下地と合成される面 (`/N`) に限る。不透明な対はトークン同士の比がそのまま出るので、
 * 合成を確かめるこの story の役目には当たらない。
 *
 * 一覧は手で保つ。対象を数え直すコマンド:
 *
 * ```
 * grep -rhoE '(bg|hover:bg|dark:bg|dark:hover:bg|aria-expanded:bg|focus:bg|has-data-checked:bg|dark:has-data-checked:bg)-[a-z0-9-]+/[0-9]+' \
 *   src/components/ui src/components/parts src/components/action --include='*.tsx' \
 *   | grep -v stories | sort | uniq -c
 * ```
 *
 * 出力のうち `bg-black/10` は dialog / alert-dialog / sheet の scrim で、`fixed inset-0` の面に
 * 文字が載らないため行を持たない。それ以外は下の 2 つの story がすべて描く。
 */
/**
 * 1 行 = 面と文字色の 1 対。`className` は呼び出し側がリテラルで渡す。
 *
 * ここを `["bg-x/10", ...].map()` に畳まない。`@shadcn/lint` から配列の中身ごと見えなくなり
 * (`no-raw-colors` / `no-unknown-classes` が無反応になる)、この story の主題であるクラス名が
 * 検査から外れる。2026-09-21 に架空クラスを 11 形態で仕込んで実測した結果、読まれなかったのは
 * `.map()` のコールバック引数・補間のあるテンプレートリテラル・`args: { className: "..." }`
 * の 3 つ。Storybook が案内する `args` への共通化を採らないのもこれが理由である。
 * 残る 8 形態 (`className` への直置き、`cn()` の文字列・配列・object・論理式・入れ子配列、
 * `const` へ切り出した文字列、補間の無いテンプレートリテラル) は読まれるので、畳み方は
 * そこから選ぶ。
 */
function Row({ className, children }: { className: string; children: ReactNode }) {
  return <p className={cn("rounded px-3 py-2 text-sm", className)}>{children}</p>;
}

const meta = {} satisfies Meta;

export default meta;

/** `--background` の上。button / badge の tint がここに出る */
export const OnBackground: StoryObj = {
  render: () => (
    <div className="bg-background flex flex-col gap-2 p-4">
      <Row className="bg-destructive-surface/10 text-destructive">
        破壊の既定 bg-destructive-surface/10
      </Row>
      <Row className="bg-destructive-surface/20 text-destructive">
        破壊の hover bg-destructive-surface/20
      </Row>
      <Row className="bg-destructive-surface/30 text-destructive">
        破壊の hover (dark) bg-destructive-surface/30
      </Row>
      <Row className="bg-primary/80 text-primary-foreground">主操作の hover bg-primary/80</Row>
      <Row className="bg-primary/5 text-primary">破線ボタンの hover bg-primary/5</Row>
      <Row className="bg-primary/5 text-foreground">
        選択済み ChoiceCard bg-primary/5 + text-foreground
      </Row>
      <Row className="bg-primary/5 text-muted-foreground">
        選択済み ChoiceCard の説明 bg-primary/5 + text-muted-foreground
      </Row>
      <Row className="bg-primary/10 text-foreground">
        選択済み ChoiceCard (dark) bg-primary/10 + text-foreground
      </Row>
      <Row className="bg-primary/10 text-muted-foreground">
        選択済み ChoiceCard の説明 (dark) bg-primary/10 + text-muted-foreground
      </Row>
      <Row className="bg-muted/50 text-muted-foreground">
        淡色行の hover bg-muted/50 + text-muted-foreground
      </Row>
      <Row className="bg-muted/50 text-foreground">
        淡色行の hover bg-muted/50 + text-foreground
      </Row>
      <Row className="bg-secondary/80 text-secondary-foreground">
        副操作の hover bg-secondary/80
      </Row>
      <Row className="bg-input/30 text-foreground">入力欄の面 (dark) bg-input/30</Row>
      <Row className="bg-input/30 text-muted-foreground">
        select の空状態 (dark) bg-input/30 + text-muted-foreground
      </Row>
      <Row className="bg-input/50 text-foreground">入力欄の hover (dark) bg-input/50</Row>
    </div>
  ),
};

/** `--card` / `--popover` の上。dropdown-menu の破壊項目がここに出る */
export const OnCard: StoryObj = {
  render: () => (
    <div className="bg-card flex flex-col gap-2 rounded-lg p-4">
      <Row className="bg-destructive-surface/10 text-destructive">
        メニューの破壊項目 bg-destructive-surface/10
      </Row>
      <Row className="bg-destructive-surface/20 text-destructive">
        メニューの破壊項目 bg-destructive-surface/20
      </Row>
      <Row className="bg-destructive-surface/30 text-destructive">
        メニューの破壊項目 bg-destructive-surface/30
      </Row>
    </div>
  ),
};
