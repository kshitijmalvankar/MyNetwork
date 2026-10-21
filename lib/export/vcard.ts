export type VCardInput = {
  fullName: string;
  title?: string | null;
  company?: string | null;
  emails?: string[];
  phones?: string[];
  website?: string | null;
  address?: string | null;
  note?: string | null;
};

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Folds lines longer than 75 octets, as RFC 6350 requires. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** vCard 3.0, which phones and mail apps import most reliably. */
export function toVCard(c: VCardInput): string {
  const [first, ...rest] = c.fullName.trim().split(/\s+/);
  const last = rest.pop() ?? "";
  const middle = rest.join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first ?? "")};${esc(middle)};;`,
    `FN:${esc(c.fullName)}`,
    c.company ? `ORG:${esc(c.company)}` : null,
    c.title ? `TITLE:${esc(c.title)}` : null,
    ...(c.emails ?? []).map((e, i) => `EMAIL;TYPE=INTERNET${i === 0 ? ",PREF" : ""}:${esc(e)}`),
    ...(c.phones ?? []).map((p, i) => `TEL;TYPE=VOICE${i === 0 ? ",PREF" : ""}:${esc(p)}`),
    c.website ? `URL:${esc(/^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`)}` : null,
    c.address ? `ADR;TYPE=WORK:;;${esc(c.address)};;;;` : null,
    c.note ? `NOTE:${esc(c.note)}` : null,
    "END:VCARD",
  ].filter((l): l is string => l !== null);
  return lines.map(fold).join("\r\n") + "\r\n";
}
