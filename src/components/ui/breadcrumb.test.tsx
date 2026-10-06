import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

/**
 * 状態のカタログは `breadcrumb.stories.tsx` が持つ。ここに残すのは、registry から動かした
 * `BreadcrumbEllipsis` の代替の文字が支援技術に届くことだけ (docs/registry-deviations.md の breadcrumb.tsx の行)
 */
describe("BreadcrumbEllipsis", () => {
  // 畳んだ階層があることは代替の文字でしか伝わらない (WCAG 2.2 SC 1.1.1)
  it("畳んだ階層の代替の文字がアクセシビリティツリーに出る", async () => {
    const screen = await render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>現在のページ</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    // aria-hidden の祖先があると、sr-only の文字ごとアクセシビリティツリーから消える
    await expect
      .poll(() => screen.getByText("More").element().closest('[aria-hidden="true"]'))
      .toBeNull();
  });
});
