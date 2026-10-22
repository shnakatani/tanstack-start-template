import { createFileRoute } from "@tanstack/react-router";

import { ButtonLink } from "@/components/parts/button-link";
import { RoutePageHeader } from "@/components/screens/route-page-header";
import { APP_NAME } from "@/lib/app-name";
import { pageHead } from "@/lib/page-title";

export const Route = createFileRoute("/")({
  // ホームのページ名はアプリ名。title はアプリ名を重ねず、アプリ名だけになる (pageTitle)
  staticData: { pageName: APP_NAME },
  head: pageHead,
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* 見出しは RoutePageHeader が route の pageName から h1 として描く。画面ごとに書くと寸法と階層が画面間でずれる */}
      <RoutePageHeader />
      {/* landmark は __root.tsx の <main> が 1 つだけ持つ。ここで入れ子にしない */}
      <div className="flex flex-col gap-4 p-4">
        {/* flex-col の既定 (align-items: stretch) を打ち消し、ボタン幅を内容に合わせる */}
        <ButtonLink to="/notes" className="self-start">
          メモ一覧へ
        </ButtonLink>
      </div>
    </div>
  );
}
