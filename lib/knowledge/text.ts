// Turns contacts, notes and events into the plain-text chunks that get
// embedded for "Ask my network". Pure functions, so they're easy to test.

export const MAX_CHUNK_CHARS = 1200;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export type ProfileInput = {
  fullName: string;
  nameNative?: string | null;
  title?: string | null;
  company?: string | null;
  industry?: string | null;
  roleFamily?: string | null;
  seniority?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  pastPositions?: { company: string | null; title: string | null; until: string }[];
  meetings?: { type: string; on: string; event?: string | null; location?: string | null }[];
  reminders?: { due: string; note?: string | null }[];
};

const join = (parts: (string | null | undefined | false)[], sep: string) => parts.filter(Boolean).join(sep);

/** One-line identity used in the profile and as context on every note. */
export function contactHeadline(p: Pick<ProfileInput, "fullName" | "title" | "company">): string {
  const role = join([p.title, p.company && `at ${p.company}`], " ");
  return role ? `${p.fullName} (${role})` : p.fullName;
}

const MEETING_LABEL: Record<string, string> = { met: "Met", email: "Emailed", call: "Call", meeting: "Meeting", message: "Messaged" };

export function profileText(p: ProfileInput): string {
  const lines = [
    join([p.fullName, p.nameNative && p.nameNative !== p.fullName && `(${p.nameNative})`], " "),
    join([p.title, p.company && `at ${p.company}`], " "),
    join(
      [p.industry && `Industry: ${p.industry}`, p.roleFamily && `Role: ${p.roleFamily}`, p.seniority && `Seniority: ${p.seniority}`],
      " · ",
    ),
    (p.city || p.country) && `Location: ${join([p.city, countryName(p.country)], ", ")}`,
    p.website && `Website: ${p.website}`,
  ];
  if (p.pastPositions?.length) {
    lines.push(
      `Previously: ${p.pastPositions
        .slice(0, 5)
        .map((pp) => join([pp.title, pp.company && `at ${pp.company}`, `(until ${pp.until})`], " "))
        .join("; ")}`,
    );
  }
  if (p.meetings?.length) {
    lines.push(
      `History: ${p.meetings
        .slice(0, 10)
        .map((m) => join([MEETING_LABEL[m.type] ?? m.type, m.event && `at ${m.event}`, m.location && `in ${m.location}`, `on ${m.on}`], " "))
        .join("; ")}`,
    );
  }
  for (const r of (p.reminders ?? []).slice(0, 5)) lines.push(join([`Follow-up due ${r.due}`, r.note], ": "));
  return lines.filter(Boolean).join("\n");
}

export function eventText(e: { name: string; startsOn?: string | null; location?: string | null; description?: string | null }): string {
  return [
    `Event: ${e.name}`,
    e.startsOn && `Date: ${e.startsOn}`,
    e.location && `Location: ${e.location}`,
    e.description && `About: ${e.description}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CHUNK_CHARS * 2);
}

/**
 * Splits long text on paragraph, then sentence, then word boundaries so each
 * piece stays under `max` characters.
 */
export function splitText(text: string, max = MAX_CHUNK_CHARS): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];

  const pieces: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };
  const units = clean.split(/\n{2,}/).flatMap((para) => (para.length <= max ? [para] : para.split(/(?<=[.!?])\s+/)));
  for (const unit of units) {
    const words = unit.length <= max ? [unit] : unit.split(/\s+/);
    for (const word of words) {
      const sep = current ? (words.length > 1 ? " " : "\n\n") : "";
      if (current.length + sep.length + word.length > max) push();
      current += (current ? sep : "") + word.slice(0, max);
    }
  }
  push();
  return pieces;
}

/** Each piece of a note carries who (or which event) it is about. */
export function noteChunks(about: string, createdOn: string, body: string): string[] {
  const header = `Note about ${about}, written ${createdOn}:`;
  return splitText(body, MAX_CHUNK_CHARS - header.length - 1).map((piece) => `${header}\n${piece}`);
}
