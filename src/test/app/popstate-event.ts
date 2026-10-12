/**
 * 戻る・進むで出る `popstate` を作る。`hasUAVisualTransition` は、ブラウザが自分で遷移のアニメーションを出したか
 * (MDN「PopStateEvent: hasUAVisualTransition」)。単体テストが走る Node には `PopStateEvent` が無いので、
 * `Event` に値を足して作る
 */
export function createPopstateEvent({
  hasUAVisualTransition,
}: {
  hasUAVisualTransition: boolean;
}): Event {
  return Object.assign(new Event("popstate"), { hasUAVisualTransition });
}
