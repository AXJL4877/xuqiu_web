/** 在 textarea 内替换选区，返回新全文 */
export function replaceTextareaRange(
  full: string,
  start: number,
  end: number,
  replacement: string,
): string {
  return full.slice(0, start) + replacement + full.slice(end);
}

/** 根据选区终点估算屏幕坐标（用于悬浮菜单位置） */
export function getTextareaCaretClientRect(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number } {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement("div");
  const props = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "MozTabSize",
  ] as const;

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";

  for (const prop of props) {
    const key = prop as keyof CSSStyleDeclaration;
    const val = style[key];
    if (val != null) {
      (div.style as unknown as Record<string, string>)[prop] = String(val);
    }
  }

  div.style.width = `${textarea.clientWidth}px`;
  const textBefore = textarea.value.substring(0, position);
  div.textContent = textBefore;
  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const textareaRect = textarea.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  document.body.removeChild(div);

  const top =
    textareaRect.top +
    (spanRect.top - divRect.top) -
    textarea.scrollTop;
  const left =
    textareaRect.left +
    (spanRect.left - divRect.left) -
    textarea.scrollLeft;

  return { top, left };
}

export function clampToolbarPosition(
  x: number,
  y: number,
  toolbarWidth: number,
  toolbarHeight: number,
): { x: number; y: number } {
  const pad = 8;
  const maxX = window.innerWidth - toolbarWidth - pad;
  const maxY = window.innerHeight - toolbarHeight - pad;
  return {
    x: Math.max(pad, Math.min(x, maxX)),
    y: Math.max(pad, Math.min(y, maxY)),
  };
}
