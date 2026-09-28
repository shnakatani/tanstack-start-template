import { describe, expect, it } from "vite-plus/test";

import { shouldAnnounceNavigation } from "./route-announcement";

const location = { pathname: "/" };

describe("shouldAnnounceNavigation", () => {
  it("path が変わる遷移を伝える", () => {
    expect(shouldAnnounceNavigation({ fromLocation: location, pathChanged: true })).toBe(true);
  });

  // 検索条件だけの変化で focus を動かすと、検索の入力欄から focus が外れる
  it("path が変わらない遷移 (検索条件だけの変化) は伝えない", () => {
    expect(shouldAnnounceNavigation({ fromLocation: location, pathChanged: false })).toBe(false);
  });

  // 最初のページはブラウザが読む。クライアントで描くと pathChanged が true で来るので fromLocation で除く
  it("最初のページ (fromLocation が無い) は伝えない", () => {
    expect(shouldAnnounceNavigation({ fromLocation: undefined, pathChanged: true })).toBe(false);
  });
});
