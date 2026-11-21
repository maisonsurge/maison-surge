import { describe, expect, it } from "vitest";
import {
  bpsToPercent,
  csvCell,
  isoToIstanbulLocal,
  istanbulLocalToIso,
  moveItem,
  pageRange,
  parseStockCsv,
  percentToBps,
  toCsv,
  windowState,
} from "@/features/admin/lib/helpers";

describe("Istanbul datetime conversion", () => {
  it("round-trips datetime-local values at UTC+3", () => {
    const iso = istanbulLocalToIso("2026-12-01T10:30");
    expect(iso).toBe("2026-12-01T07:30:00.000Z");
    expect(isoToIstanbulLocal(iso as string)).toBe("2026-12-01T10:30");
  });
  it("handles empty and invalid input", () => {
    expect(istanbulLocalToIso("")).toBeNull();
    expect(istanbulLocalToIso("01.12.2026")).toBe("invalid");
    expect(isoToIstanbulLocal(null)).toBe("");
  });
});

describe("percent ⇄ basis points", () => {
  it("converts without floating point drift", () => {
    expect(percentToBps("10")).toBe(1000);
    expect(percentToBps("20")).toBe(2000);
    expect(percentToBps("1,5")).toBe(150);
    expect(percentToBps("0.01")).toBe(1);
    expect(percentToBps("")).toBeNull();
    expect(percentToBps("101")).toBe("invalid");
    expect(percentToBps("abc")).toBe("invalid");
    expect(bpsToPercent(1000)).toBe("10");
    expect(bpsToPercent(150)).toBe("1,5");
    expect(bpsToPercent(null)).toBe("");
  });
});

describe("stock CSV parsing", () => {
  it("parses rows, skips header/comments, reports bad lines", () => {
    const rows = parseStockCsv("sku,stok\nABC-1,5\n# comment\nabc-2;0\nbad sku,3\nABC-3,-1\nONLYONE");
    expect(rows).toEqual([
      { line: 2, sku: "ABC-1", stock: 5 },
      { line: 4, sku: "ABC-2", stock: 0 },
      { line: 5, error: "Geçersiz SKU", raw: "bad sku,3" },
      { line: 6, error: "Stok 0 veya pozitif tam sayı olmalı", raw: "ABC-3,-1" },
      { line: 7, error: "İki sütun bekleniyor: sku,stok", raw: "ONLYONE" },
    ]);
  });
});

describe("CSV export", () => {
  it("escapes quotes/commas and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["email", "status"], ["x@example.com", "confirmed"]])).toBe("email,status\r\nx@example.com,confirmed\r\n");
  });
});

describe("list helpers", () => {
  it("moves items within bounds", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
  it("computes inclusive PostgREST ranges", () => {
    expect(pageRange(1, 20)).toEqual({ from: 0, to: 19 });
    expect(pageRange(3, 20)).toEqual({ from: 40, to: 59 });
    expect(pageRange(0, 20)).toEqual({ from: 0, to: 19 });
  });
});

describe("windowState", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  it("classifies time windows", () => {
    expect(windowState(null, null, now)).toBe("active");
    expect(windowState("2026-11-22T00:00:00Z", null, now)).toBe("upcoming");
    expect(windowState(null, "2026-11-21T12:00:00Z", now)).toBe("expired");
    expect(windowState("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", now)).toBe("active");
  });
});
