import { ButtonLink } from "@/components/parts/button-link";
import { FullScreenNotice } from "@/components/parts/centered-card";

/**
 * root の not found の表示 (root の `notFoundComponent`)。どの route にも当たらない URL と、`notFoundComponent` を
 * 持つ祖先が無い loader・beforeLoad の `notFound()` を受け、root の component の `<Outlet />` の位置に描かれる (ADR-0044)
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
