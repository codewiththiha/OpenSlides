import { LruMap } from "./lru-map";

const CHAR_WIDTH_MAX = 32;
const charWidthCache = new LruMap<string, number>(CHAR_WIDTH_MAX);

export function measureCharWidth(
  container: HTMLElement,
  fontSize: number,
  fontFamily: string,
): number {
  const key = `${fontSize}|${fontFamily}`;
  const cached = charWidthCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const test = document.createElement("span");
  test.style.position = "absolute";
  test.style.visibility = "hidden";
  test.style.whiteSpace = "pre";
  test.style.fontSize = `${fontSize}px`;
  test.style.fontFamily = fontFamily;
  test.style.lineHeight = "1";
  test.textContent = "xxxxxxxxxx";
  container.appendChild(test);
  const width = test.getBoundingClientRect().width / 10;
  container.removeChild(test);

  charWidthCache.set(key, width);
  return width;
}
