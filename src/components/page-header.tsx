import type { ReactNode } from "react";

/**
 * 画面の見出し行。`title` はページの h1 として描く。
 *
 * 画面ごとに h1 を手書きすると、PageHeader を使う画面に h1 が無い状態が生まれる
 * (見出しジャンプで移動する支援技術が主題に辿り着けない)。見出し階層はこの部品が持ち、
 * 消費側は `title` を渡すだけにする。
 */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    // h-9 (36px) の actions + py-3 (24px) と min-h-15 (60px) を一致させ、actions の有無で等高にする。
    <header className="flex min-h-15 items-center justify-between border-b border-border bg-background px-4 py-3">
      <h1 className="flex items-center text-lg font-semibold text-foreground">{title}</h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
