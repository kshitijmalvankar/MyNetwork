/**
 * RFC 4180 CSV. Cells that a spreadsheet would treat as a formula (=, +, -, @)
 * are prefixed with an apostrophe to prevent CSV injection, except values that
 * are only digits and phone punctuation.
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Plain numbers and phone numbers ("+1 415 555 0123") can't carry a formula.
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 (names in other scripts) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
