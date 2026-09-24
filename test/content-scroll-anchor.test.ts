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

  it("does not correct again when the browser already held the post (native scroll anchoring)", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    state.scrollY = 450;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    state.heights[0] = 0;
    state.scrollY -= 300; // the browser compensates in the same layout
    expect(restoreAnchor(anchor, win)).toBe(0);
    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(boxes[2]!.getBoundingClientRect().top).toBe(150);
  });

  it("does not correct again when X re-lays out and scrolls in the same later frame", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    state.scrollY = 450;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    const frames: (() => void)[] = [];
    holdAnchor(anchor, win, (cb) => frames.push(cb));
    state.heights[0] = 0;
    state.scrollY -= 300;
    while (frames.length) frames.shift()!();
    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(boxes[2]!.getBoundingClientRect().top).toBe(150);
  });

  it("keeps the user's own scroll when a card above collapses while they scroll", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    state.scrollY = 450;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    state.heights[0] = 0;
    state.scrollY += 50; // the user scrolls down in the same frame
    expect(restoreAnchor(anchor, win)).toBe(-300);
    expect(boxes[2]!.getBoundingClientRect().top).toBe(100);
  });

  it("does not fight the user scrolling during the held frames", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    state.scrollY = 450;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    const frames: (() => void)[] = [];
    holdAnchor(anchor, win, (cb) => frames.push(cb));
    while (frames.length) {
      state.scrollY += 40;
      frames.shift()!();
    }
    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(state.scrollY).toBe(450 + 4 * 40);
  });

  it("corrects a shift once when two holds overlap (passes in consecutive frames)", () => {
    const { boxes, state, win } = column([300, 300, 300, 300, 300]);
    state.scrollY = 450;
    const first = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    const second = captureAnchor(boxes, new Set([boxes[0]!, boxes[2]!]), null, win)!;
    expect(second.el).toBe(boxes[3]);
    state.heights[0] = 0;
    expect(restoreAnchor(first, win)).toBe(-300);
    expect(restoreAnchor(second, win)).toBe(0);
    expect(win.scrollBy).toHaveBeenCalledTimes(1);
    expect(boxes[2]!.getBoundingClientRect().top).toBe(150);
  });

  it("corrects the nested scroller, not the window", () => {
    document.body.innerHTML = `<div id="panel"><div id="p0"></div><div id="p1"></div><div id="p2"></div></div>`;
    const panel = document.getElementById("panel") as HTMLElement;
    const heights = [300, 300, 300];
    panel.getBoundingClientRect = () => ({ top: 100, bottom: 700, height: 600 }) as DOMRect;
    const boxes = heights.map((_, i) => {
      const box = document.getElementById(`p${i}`) as HTMLElement;
      box.getBoundingClientRect = () => {
        const top = 100 + heights.slice(0, i).reduce((a, b) => a + b, 0) - panel.scrollTop;
        return { top, bottom: top + heights[i]!, height: heights[i]! } as DOMRect;
      };
      return box;
    });
    panel.scrollTop = 350;
    const win = { innerHeight: 800, scrollY: 0, scrollBy: vi.fn() } as unknown as Window;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), panel, win)!;
    expect(anchor.el).toBe(boxes[2]);
    heights[0] = 0;
    expect(restoreAnchor(anchor, win)).toBe(-300);
    expect(panel.scrollTop).toBe(50);
    expect(win.scrollBy).not.toHaveBeenCalled();
  });

  it("corrects from a ResizeObserver in the frame X re-lays out, then lets go", () => {
    const { boxes, state, win } = column([300, 300, 300, 300]);
    const observers: { cb: () => void; targets: Element[]; disconnect: ReturnType<typeof vi.fn> }[] = [];
    (win as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      entry: (typeof observers)[number];
      constructor(cb: () => void) {
        this.entry = { cb, targets: [], disconnect: vi.fn() };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.targets.push(target);
      }
      disconnect() {
        this.entry.disconnect();
      }
    };
    state.scrollY = 450;
    const anchor = captureAnchor(boxes, new Set([boxes[0]!]), null, win)!;
    const frames: (() => void)[] = [];
    holdAnchor(anchor, win, (cb) => frames.push(cb), 2, [boxes[0]!]);
    expect(observers[0]!.targets).toEqual([boxes[0]]);
    state.heights[0] = 0; // X's own observer moves the cells, then ours runs
    observers[0]!.cb();
    expect(win.scrollBy).toHaveBeenCalledTimes(1);
    expect(boxes[2]!.getBoundingClientRect().top).toBe(150);
    while (frames.length) frames.shift()!();
    expect(win.scrollBy).toHaveBeenCalledTimes(1);
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it("finds no anchor when nothing stable is in view", () => {
    const { boxes, win } = column([300, 300]);
    expect(captureAnchor(boxes, new Set(boxes), null, win)).toBeNull();
  });
});
