import { describe, expect, it } from "vite-plus/test";

import { isDialogToggle, shouldAnnounceNavigation } from "./route-announcement";

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

  it("fromLocation が無く path も変わらないときは伝えない", () => {
    expect(shouldAnnounceNavigation({ fromLocation: undefined, pathChanged: false })).toBe(false);
  });
});

const root = { routeId: "__root__", pathname: "/", staticData: {} };
const home = { routeId: "/", pathname: "/", staticData: {} };
const list = { routeId: "/items", pathname: "/items", staticData: {} };
const dialog = {
  routeId: "/items/$itemId/edit",
  pathname: "/items/1/edit",
  staticData: { dialogRoute: true },
};

describe("isDialogToggle", () => {
  it("ページからその上のダイアログを開く遷移に当たる", () => {
    expect(isDialogToggle([root, list], [root, list, dialog])).toBe(true);
  });

  it("ダイアログを閉じてページへ戻る遷移に当たる", () => {
    expect(isDialogToggle([root, list, dialog], [root, list])).toBe(true);
  });

  it("同じページの上で別の項目のダイアログへ移る遷移に当たる", () => {
    const other = { ...dialog, pathname: "/items/2/edit" };
    expect(isDialogToggle([root, list, dialog], [root, list, other])).toBe(true);
  });

  // ページが変わるので、見出しへ移して読み上げる
  it("ダイアログから別のページへ移る遷移には当たらない", () => {
    expect(isDialogToggle([root, list, dialog], [root, home])).toBe(false);
  });

  it("別のページからダイアログを直接開く遷移には当たらない", () => {
    expect(isDialogToggle([root, home], [root, list, dialog])).toBe(false);
  });

  it("ダイアログを含まない遷移には当たらない", () => {
    expect(isDialogToggle([root, home], [root, list])).toBe(false);
  });
});
