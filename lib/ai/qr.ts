/** Contact details found in a QR code on the card (vCard or MECARD). */
export type QrContact = {
  fullName?: string;
  title?: string;
  company?: string;
  emails: string[];
  phones: string[];
  website?: string;
  url?: string;
};

function unescape(v: string) {
  return v.replace(/\\([,;:\\])/g, "$1").replace(/\\n/gi, " ").trim();
}

function parseVCard(text: string): QrContact {
  const out: QrContact = { emails: [], phones: [] };
  // Unfold continuation lines, then read "KEY;params:value" lines.
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  let structuredName: string | undefined;
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(";")[0].toUpperCase().replace(/^ITEM\d+\./, "");
    const value = unescape(line.slice(idx + 1));
    if (!value) continue;
    if (key === "FN") out.fullName = value;
    else if (key === "N") {
      const [last, first, middle] = value.split(";");
      structuredName = [first, middle, last].filter(Boolean).join(" ");
    } else if (key === "TITLE") out.title = value;
    else if (key === "ORG") out.company = value.split(";")[0];
    else if (key === "EMAIL") out.emails.push(value.toLowerCase());
    else if (key === "TEL") out.phones.push(value);
    else if (key === "URL") out.website = value;
  }
  out.fullName ??= structuredName;
  return out;
}

function parseMeCard(text: string): QrContact {
  const out: QrContact = { emails: [], phones: [] };
  for (const part of text.replace(/^MECARD:/i, "").split(/(?<!\\);/)) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const key = part.slice(0, idx).toUpperCase();
    const value = unescape(part.slice(idx + 1));
    if (!value) continue;
    if (key === "N") out.fullName = value.includes(",") ? value.split(",").reverse().join(" ").trim() : value;
    else if (key === "ORG") out.company = value;
    else if (key === "TITLE") out.title = value;
    else if (key === "EMAIL") out.emails.push(value.toLowerCase());
    else if (key === "TEL") out.phones.push(value);
    else if (key === "URL") out.website = value;
  }
  return out;
}

/** Parses whatever a QR code held. Plain URLs (e.g. a LinkedIn profile) are kept as `url`. */
export function parseQrPayload(text: string): QrContact | null {
  const trimmed = text.trim().slice(0, 4000);
  if (/^BEGIN:VCARD/i.test(trimmed)) return parseVCard(trimmed);
  if (/^MECARD:/i.test(trimmed)) return parseMeCard(trimmed);
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { emails: [], phones: [], url: trimmed };
  if (/^mailto:/i.test(trimmed)) return { emails: [trimmed.slice(7).split("?")[0].toLowerCase()], phones: [] };
  if (/^tel:/i.test(trimmed)) return { emails: [], phones: [trimmed.slice(4)] };
  return null;
}
