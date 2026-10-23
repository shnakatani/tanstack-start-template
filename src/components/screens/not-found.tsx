import { ButtonLink } from "@/components/parts/button-link";
import { RouteFailureScreen } from "@/components/screens/route-failure-screen";

/**
 * router の既定 404 表示。`RouteErrorContent` と対にして router.tsx から切り出してある
 * (inline 定義のままだと export されずレイアウトの回帰ガードを書けないため)。
 * 見出しの行と失敗の見出しの level、枠の大きさは `RouteFailureScreen` が失敗の位置から決める
 */
export function NotFoundContent() {
  return (
    <RouteFailureScreen kind="notFound" title="ページが見つかりません">
      <p className="text-sm text-muted-foreground">
        お探しのページは存在しないか、移動された可能性があります。
      </p>
      <ButtonLink to="/" className="w-full">
        ホームへ戻る
      </ButtonLink>
    </RouteFailureScreen>
  );
}
