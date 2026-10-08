const DISABLED = ":disabled, [aria-disabled='true']";

/**
 * 表の行の中の操作 `control` に対し、別の行の同じ列の同じ位置 (セルの中で同じタグの何番目か) にある操作を返す。
 * 後ろの行を近い順に探し、無ければ前の行を近い順に探す。その位置に操作が無い行と、無効な操作
 * (`disabled` か `aria-disabled="true"`) は飛ばす。`control` が表の行の中に無いか、移せる行が無ければ null。
 */
export function findSiblingRowControl(control: Element): HTMLElement | null {
  const cell = control.closest("td, th");
  const row = cell?.parentElement;
  const section = row?.parentElement;
  if (
    !(cell instanceof HTMLTableCellElement) ||
    !(row instanceof HTMLTableRowElement) ||
    !(section instanceof HTMLTableSectionElement)
  ) {
    return null;
  }
  const position = sameTagIn(cell, control).indexOf(control);
  const rows = Array.from(section.rows);
  const index = rows.indexOf(row);
  const candidates = [...rows.slice(index + 1), ...rows.slice(0, index).toReversed()];
  for (const candidate of candidates) {
    const peerCell = candidate.cells.item(cell.cellIndex);
    const peer = peerCell === null ? undefined : sameTagIn(peerCell, control)[position];
    if (peer instanceof HTMLElement && !peer.matches(DISABLED)) {
      return peer;
    }
  }
  return null;
}

function sameTagIn(cell: HTMLTableCellElement, control: Element): Element[] {
  return Array.from(cell.querySelectorAll(control.localName));
}
