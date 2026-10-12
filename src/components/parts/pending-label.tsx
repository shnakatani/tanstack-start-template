import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";

import { HoldSize } from "./hold-size";

interface PendingLabelProps {
  isPending: boolean;
  children: ReactNode;
  /** 包むボタンが `aria-labelledby` で指す id。label は pending 中に不可視になるので、名前はこの参照か `aria-label` が保つ */
  id?: string;
}

/**
 * ボタン (`Button` / `ButtonLink`) の中身。pending の間は label の幅を保ったまま `Spinner` (`aria-hidden`) を
 * 中央に重ねる (ADR-0042)。Spinner に `data-icon` を付けない。`buttonVariants` の `has-data-[icon=inline-start]:pl-*` が
 * padding を詰め、幅が変わる。
 */
export function PendingLabel({ isPending, children, id }: PendingLabelProps): ReactNode {
  return (
    <HoldSize id={id} align="center" overlay={isPending ? <Spinner aria-hidden /> : null}>
      {children}
    </HoldSize>
  );
}
