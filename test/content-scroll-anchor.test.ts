import { describe, expect, it, vi } from "vitest";
import { captureAnchor, holdAnchor, restoreAnchor } from "../src/content/scroll-anchor.ts";

/** A column of boxes whose layout is driven by the test: tops come from a shared table. */
function column(heights: number[]) {
  document.body.innerHTML = heights.map((_, i) => `<div id="b${i}"></div>`).join("");
  const boxes = heights.map((_, i) => document.getElementById(`b${i}`) as HTMLElement);
  const state = { scrollY: 0, heights: [...heights] };
  boxes.forEach((box, i) => {
    box.getBoundingClientRect = () => {
      const top = state.heights.slice(0, i).reduce((a, b) => a + b, 0) - state.scrollY;
      const height = state.heights[i]!;
      return { top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON() {} } as DOMRect;
    };
  });
  const win = {
    innerHeight: 800,
    get scrollY() {
      return state.scrollY;
    },
    scrollBy: vi.fn((_x: number, y: number) => {
      state.scrollY += y;
    }),
  } as unknown as Window;
  return { boxes, state, win };
}

describe("scroll anchor (F52)", () => {
  it("holds the post being read when a card above the viewport collapses", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    state.scrollY = 450; // b0 is above, b1 is cut at the top, b2 starts at 150
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win);
    expect(anchor?.el).toBe(boxes[2]);
    state.heights[0] = 0; // b0 hidden
    expect(restoreAnchor(anchor!, win)).toBe(-300);
    expect(boxes[2]!.getBoundingClientRect().top).toBe(150);
  });

  it("does not fight the user's own scrolling", () => {
    const { boxes, state, win } = column([300, 300, 300]);
    const anchor = captureAnchor(boxes, new Set(), null, win)!;
    state.scrollY = 120;
    expect(restoreAnchor(anchor, win)).toBe(0);
    expect(win.scrollBy).not.toHaveBeenCalled();
  });

  it("corrects a shift that X applies a frame later", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    state.scrollY = 450;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    const frames: (() => void)[] = [];
    holdAnchor(anchor, win, (cb) => frames.push(cb));
    expect(win.scrollBy).not.toHaveBeenCalled();
    state.heights[0] = 0; // X re-lays out after the hide
    frames.shift()!();
    expect(boxes[2]!.getBoundingClientRect().top).toBe(150);
    frames.shift()!();
    expect(win.scrollBy).toHaveBeenCalledTimes(1);
  });

  it("finds no anchor when nothing stable is in view", () => {
    const { boxes, win } = column([300, 300]);
    expect(captureAnchor(boxes, new Set(boxes), null, win)).toBeNull();
  });
});
