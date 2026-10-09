/**
 * router の `defaultViewTransition.types` に渡す関数を返す。ブラウザが自分で遷移のアニメーションを
 * 出した戻る・進む (Safari のスワイプなど) では `false` を返して View Transition を飛ばす
 * (MDN「PopStateEvent: hasUAVisualTransition」、ADR-0040)。router が戻る・進むで聞く `popstate` で記録し、
 * `types` が 1 回読んだら戻す。push と replace では `popstate` が出ないので、読まずに残すと次の遷移まで飛ばす
 */
export function skipViewTransitionAfterUATransition(target: EventTarget): () => string[] | false {
  let uaTransition = false;
  target.addEventListener("popstate", (event) => {
    uaTransition = "hasUAVisualTransition" in event && event.hasUAVisualTransition === true;
  });
  return () => {
    if (!uaTransition) {
      return [];
    }
    uaTransition = false;
    return false;
  };
}
