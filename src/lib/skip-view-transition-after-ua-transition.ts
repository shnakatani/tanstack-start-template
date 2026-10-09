/**
 * router の `defaultViewTransition.types` に渡す関数を返す。ブラウザが自分で遷移のアニメーションを
 * 出したナビゲーション (Safari のスワイプで戻る・進むなど) では `false` を返して View Transition を飛ばす
 * (MDN「NavigateEvent: hasUAVisualTransition」、ADR-0040)。router は history のイベントで動くので、
 * Navigation API の `navigate` イベントで直前のナビゲーションを記録する。`navigate` は router の
 * `pushState` でも出るので、値はナビゲーションのたびに上書きされる
 */
export function skipViewTransitionAfterUATransition(
  navigation: EventTarget,
): () => string[] | false {
  let uaTransition = false;
  navigation.addEventListener("navigate", (event) => {
    uaTransition = "hasUAVisualTransition" in event && event.hasUAVisualTransition === true;
  });
  return () => (uaTransition ? false : []);
}
