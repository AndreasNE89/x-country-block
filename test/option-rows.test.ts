import { describe, expect, it } from "vitest";
import { visibleOptionRows } from "../src/popup/option-rows.ts";

function row(id: string, label: string, aliases: string[] = []) {
  return { id, label, code: id, codes: [id.toLowerCase()], keys: [label.toLowerCase(), ...aliases] };
}

const rows = [
  row("DE", "Germany"),
  row("IN", "India"),
  row("US", "United States", ["usa"]),
  row("ZA", "South Africa"),
];

describe("visibleOptionRows", () => {
  it("should put selected rows first when opening the list", () => {
    const shown = visibleOptionRows(rows, ["ZA", "IN"], "");
    expect(shown.map((item) => item.id)).toEqual(["IN", "ZA", "DE", "US"]);
  });

  it("should keep selected rows first after a search filter", () => {
    const shown = visibleOptionRows(rows, ["US"], "s");
    expect(shown.map((item) => item.id)).toEqual(["US", "ZA"]);
  });

  it("should keep A-Z order when nothing is selected", () => {
    expect(visibleOptionRows(rows, [], "").map((item) => item.id)).toEqual([
      "DE",
      "IN",
      "ZA",
      "US",
    ]);
  });

  it("should put an exact code or alias match above a selected partial match", () => {
    expect(visibleOptionRows(rows, ["IN"], "usa").map((item) => item.id)).toEqual(["US"]);
    expect(visibleOptionRows(rows, ["ZA"], "us").map((item) => item.id)).toEqual(["US"]);
    expect(visibleOptionRows(rows, ["ZA"], "in").map((item) => item.id)).toEqual(["IN"]);
  });

  it("should not change the input array", () => {
    const copy = [...rows];
    visibleOptionRows(rows, ["US"], "");
    expect(rows).toEqual(copy);
  });
});
