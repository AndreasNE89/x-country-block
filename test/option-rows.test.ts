import { describe, expect, it } from "vitest";
import { visibleOptionRows } from "../src/popup/option-rows.ts";

const rows = [
  { id: "DE", label: "Germany (DE)" },
  { id: "IN", label: "India (IN)" },
  { id: "US", label: "United States (US)" },
  { id: "ZA", label: "South Africa (ZA)" },
];

describe("visibleOptionRows", () => {
  it("should put selected rows first when opening the list", () => {
    const shown = visibleOptionRows(rows, ["ZA", "IN"], "");
    expect(shown.map((row) => row.id)).toEqual(["IN", "ZA", "DE", "US"]);
  });

  it("should keep selected rows first after a search filter", () => {
    const shown = visibleOptionRows(rows, ["US"], "s");
    expect(shown.map((row) => row.id)).toEqual(["US", "ZA"]);
  });

  it("should keep A-Z order when nothing is selected", () => {
    expect(visibleOptionRows(rows, [], "").map((row) => row.id)).toEqual([
      "DE",
      "IN",
      "ZA",
      "US",
    ]);
  });
});
