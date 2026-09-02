import { ButtonLink } from "@/components/button-link";
import { FullScreenNotice } from "@/components/full-screen-card";

/**
 * router の既定 404 表示。`RouteErrorContent` と対にして router.tsx から切り出してある
 * (inline 定義のままだと export されずレイアウトの回帰ガードを書けないため)。
 */
export function NotFoundContent() {
  return (
    <FullScreenNotice
      title="ページが見つかりません"
      description="お探しのページは存在しないか、移動された可能性があります。"
    >
      <ButtonLink to="/" className="w-full">
        ホームへ戻る
      </ButtonLink>
    </FullScreenNotice>
  );
}
