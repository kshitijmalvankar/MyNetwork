// A fictional network of about 500 people, generated from a fixed seed so it's
// the same on every run. It has a known shape, so later work on groups,
// connectors and similarity can be checked against the answers in `truth`:
// - nine "worlds" (robotics in Mumbai, fintech in London…), each with its own
//   companies, events and topics
// - investors and advisers who meet people across several worlds (connectors)
// - introductions, people who know each other, and former colleagues, some
//   recorded as past jobs and some only mentioned in notes
// - some cards spell their company differently ("Pvt. Ltd.", "Labs", odd
//   capitals), plus look-alike names that are different companies
// Phone numbers use reserved fictional ranges; emails use .example domains.
import type { Fixture } from "./network";

type Region = "IN" | "GB" | "EU" | "US" | "SG" | "ME";
type Place = [city: string, country: string, region: Region];

type World = {
  key: string;
  name: string;
  places: Place[];
  industries: string[];
  suffixes: string[];
  topics: string[];
  roles: [role: string, weight: number][];
  companies: number;
  events: [name: string, location: string][];
};

export type Truth = {
  worldOf: Map<string, string>;
  connectors: Set<string>;
  /**
   * [person, other person, how they're linked, whether it's recorded]. Introductions and
   * "knows" are mentioned in notes, and some are also recorded as links; former colleagues
   * are recorded when the past job is.
   */
  ties: [string, string, "introduced" | "knows" | "former_colleague", boolean][];
  topicsOf: Map<string, string[]>;
  /** Past employers: recorded as past jobs, or only mentioned in a note. */
  pastJobs: { person: string; company: string; recorded: boolean }[];
  /** Spellings of one company, keyed by its main name, and look-alikes that must stay apart. */
  companyVariants: Map<string, string[]>;
  lookAlikes: [string, string][];
};

const IN: Region = "IN";
const PLACES = {
  mumbai: ["Mumbai", "IN", IN],
  pune: ["Pune", "IN", IN],
  bengaluru: ["Bengaluru", "IN", IN],
  delhi: ["Delhi", "IN", IN],
  london: ["London", "GB", "GB"],
  berlin: ["Berlin", "DE", "EU"],
  munich: ["Munich", "DE", "EU"],
  amsterdam: ["Amsterdam", "NL", "EU"],
  copenhagen: ["Copenhagen", "DK", "EU"],
  lisbon: ["Lisbon", "PT", "EU"],
  paris: ["Paris", "FR", "EU"],
  sanFrancisco: ["San Francisco", "US", "US"],
  newYork: ["New York", "US", "US"],
  singapore: ["Singapore", "SG", "SG"],
  dubai: ["Dubai", "AE", "ME"],
} satisfies Record<string, Place>;

const STAFF: [string, number][] = [
  ["Engineering", 3],
  ["Product", 2],
  ["Sales", 2],
  ["Operations", 1.2],
  ["Marketing", 1],
  ["Data", 1],
  ["Design", 0.8],
  ["Finance", 0.5],
  ["HR", 0.3],
];

const WORLDS: World[] = [
  {
    key: "robotics",
    name: "Robotics and automation in western India",
    places: [PLACES.mumbai, PLACES.pune, PLACES.bengaluru],
    industries: ["Robotics", "Manufacturing", "Hardware & electronics"],
    suffixes: ["Robotics", "Automation", "Dynamics", "Machines"],
    topics: ["warehouse automation", "pick-and-place robots", "industrial IoT", "computer vision for quality checks", "ROS navigation", "cobots on assembly lines"],
    roles: [...STAFF, ["Research", 0.8]],
    companies: 12,
    events: [
      ["RoboTech Mumbai 2025", "Mumbai"],
      ["RoboTech Mumbai 2026", "Mumbai"],
    ],
  },
  {
    key: "fintech",
    name: "Fintech in London and Mumbai",
    places: [PLACES.london, PLACES.london, PLACES.mumbai],
    industries: ["Fintech", "Banking", "Insurance"],
    suffixes: ["Pay", "Payments", "Finance", "Credit", "Money"],
    topics: ["open banking", "UPI payments", "fraud detection", "embedded lending", "KYC automation", "cross-border payments"],
    roles: [...STAFF, ["Legal", 0.4]],
    companies: 12,
    events: [
      ["Money20 London 2025", "London"],
      ["FinTech Forum London 2026", "London"],
    ],
  },
  {
    key: "health",
    name: "Health tech in Germany",
    places: [PLACES.berlin, PLACES.munich, PLACES.berlin],
    industries: ["Healthcare", "Biotech & pharma"],
    suffixes: ["Health", "Care", "Medical", "Bio", "Diagnostics"],
    topics: ["AI for radiology triage", "patient data compliance", "remote patient monitoring", "clinical trial recruitment", "diagnostics for rural clinics", "drug discovery with machine learning"],
    roles: [...STAFF, ["Healthcare", 1.5], ["Research", 1]],
    companies: 12,
    events: [
      ["HealthTech Expo Berlin 2025", "Berlin"],
      ["HealthTech Expo Berlin 2026", "Berlin"],
    ],
  },
  {
    key: "climate",
    name: "Climate and energy in northern Europe",
    places: [PLACES.amsterdam, PLACES.copenhagen, PLACES.lisbon],
    industries: ["Energy & climate", "Agriculture"],
    suffixes: ["Energy", "Solar", "Grid", "Carbon", "Power"],
    topics: ["carbon accounting", "rooftop solar financing", "battery storage", "green hydrogen", "regenerative farming", "EV charging networks"],
    roles: [...STAFF, ["Research", 0.6]],
    companies: 11,
    events: [
      ["Climate Week Amsterdam 2025", "Amsterdam"],
      ["Nordic Energy Summit 2026", "Copenhagen"],
    ],
  },
  {
    key: "saas",
    name: "Software in Bengaluru and San Francisco",
    places: [PLACES.bengaluru, PLACES.bengaluru, PLACES.sanFrancisco],
    industries: ["Software", "AI & data", "Cybersecurity"],
    suffixes: ["Cloud", "Software", "Data", "AI", "Security"],
    topics: ["LLM evaluation", "developer tools", "zero-trust security", "data warehouses", "product-led growth", "Kubernetes cost control"],
    roles: STAFF.map(([r, w]) => [r, r === "Engineering" ? 4 : w] as [string, number]),
    companies: 13,
    events: [
      ["SaaSBoomi Bengaluru 2025", "Bengaluru"],
      ["DevCon San Francisco 2026", "San Francisco"],
    ],
  },
  {
    key: "logistics",
    name: "Logistics in Dubai and Singapore",
    places: [PLACES.dubai, PLACES.singapore, PLACES.dubai],
    industries: ["Logistics", "Retail & e-commerce"],
    suffixes: ["Logistics", "Freight", "Cargo", "Shipping", "Express"],
    topics: ["cold-chain logistics", "last-mile delivery", "port automation", "cross-border e-commerce", "fleet electrification", "warehouse management systems"],
    roles: STAFF.map(([r, w]) => [r, r === "Operations" ? 3 : w] as [string, number]),
    companies: 11,
    events: [
      ["Gulf Logistics Week 2025", "Dubai"],
      ["Asia Supply Chain Summit 2026", "Singapore"],
    ],
  },
  {
    key: "consumer",
    name: "Consumer brands in India",
    places: [PLACES.mumbai, PLACES.delhi, PLACES.mumbai],
    industries: ["Food & beverage", "Consumer goods", "Retail & e-commerce"],
    suffixes: ["Foods", "Brands", "Kitchens", "Naturals", "Retail"],
    topics: ["D2C brands", "quick commerce", "plant-based snacks", "sustainable packaging", "retail media", "franchise expansion"],
    roles: STAFF.map(([r, w]) => [r, r === "Marketing" ? 3 : r === "Engineering" ? 1 : w] as [string, number]),
    companies: 11,
    events: [
      ["India Food Forum 2025", "Mumbai"],
      ["D2C Founders Meetup Delhi 2026", "Delhi"],
    ],
  },
  {
    key: "media",
    name: "Education and media in Singapore, London and New York",
    places: [PLACES.singapore, PLACES.newYork, PLACES.london],
    industries: ["Education", "Media & entertainment", "Marketing & advertising"],
    suffixes: ["Learning", "Academy", "Media", "Studios", "Creative"],
    topics: ["online courses", "the creator economy", "brand partnerships", "edtech for schools", "podcast advertising", "upskilling programmes"],
    roles: [...STAFF.map(([r, w]) => [r, r === "Marketing" ? 2.5 : w] as [string, number]), ["Education", 1.5]],
    companies: 11,
    events: [
      ["EdTech Asia Singapore 2025", "Singapore"],
      ["Creator Economy Summit New York 2026", "New York"],
    ],
  },
];

/** Investors and advisers: few per firm, and they meet people in several worlds. */
const BRIDGE_FIRMS: { suffix: string; industry: string; role: string; titles: [string, string][] }[] = [
  { suffix: "Ventures", industry: "Investment", role: "Finance", titles: [["Partner", "C-level/Founder"], ["Principal", "Director"], ["Associate", "Mid"]] },
  { suffix: "Capital", industry: "Investment", role: "Finance", titles: [["General Partner", "C-level/Founder"], ["Investment Director", "Director"], ["Analyst", "Junior"]] },
  { suffix: "Advisory", industry: "Consulting", role: "Consulting", titles: [["Partner", "C-level/Founder"], ["Engagement Manager", "Lead/Manager"], ["Senior Consultant", "Senior"]] },
  { suffix: "Legal", industry: "Legal", role: "Legal", titles: [["Partner", "C-level/Founder"], ["Senior Associate", "Senior"]] },
  { suffix: "Accountants", industry: "Accounting", role: "Finance", titles: [["Partner", "C-level/Founder"], ["Tax Manager", "Lead/Manager"]] },
];
const BRIDGE_PLACES: Place[] = [PLACES.london, PLACES.mumbai, PLACES.singapore, PLACES.sanFrancisco, PLACES.dubai, PLACES.paris];
const CROSS_EVENTS: [string, string][] = [
  ["Founders & Funders Summit 2025", "Singapore"],
  ["Founders & Funders Summit 2026", "Singapore"],
  ["Women in Tech Leadership Forum 2026", "Mumbai"],
  ["Global Climate & Capital Week 2026", "London"],
];

const TITLES: Record<string, [string, string][]> = {
  Engineering: [["Software Engineer", "Mid"], ["Senior Software Engineer", "Senior"], ["Staff Engineer", "Senior"], ["Engineering Manager", "Lead/Manager"], ["Director of Engineering", "Director"], ["VP Engineering", "VP"], ["CTO", "C-level/Founder"]],
  Product: [["Product Manager", "Mid"], ["Senior Product Manager", "Senior"], ["Group Product Manager", "Lead/Manager"], ["Director of Product", "Director"], ["VP Product", "VP"]],
  Design: [["Product Designer", "Mid"], ["Senior Product Designer", "Senior"], ["Design Lead", "Lead/Manager"], ["Head of Design", "Director"]],
  Data: [["Data Analyst", "Mid"], ["Data Scientist", "Mid"], ["Senior Data Scientist", "Senior"], ["Machine Learning Engineer", "Mid"], ["Head of Data", "Director"]],
  Sales: [["Account Executive", "Mid"], ["Senior Account Executive", "Senior"], ["Sales Manager", "Lead/Manager"], ["Head of Sales", "Director"], ["VP Sales", "VP"]],
  Marketing: [["Marketing Manager", "Lead/Manager"], ["Growth Lead", "Lead/Manager"], ["Brand Manager", "Lead/Manager"], ["Head of Marketing", "Director"], ["CMO", "C-level/Founder"]],
  Operations: [["Operations Manager", "Lead/Manager"], ["Supply Chain Manager", "Lead/Manager"], ["Head of Operations", "Director"], ["COO", "C-level/Founder"]],
  Finance: [["Financial Analyst", "Mid"], ["Finance Manager", "Lead/Manager"], ["CFO", "C-level/Founder"]],
  HR: [["Talent Partner", "Mid"], ["Head of People", "Director"]],
  Legal: [["Legal Counsel", "Mid"], ["General Counsel", "Director"]],
  Research: [["Research Scientist", "Mid"], ["Principal Scientist", "Senior"]],
  Healthcare: [["Clinical Lead", "Lead/Manager"], ["Medical Director", "Director"]],
  Education: [["Curriculum Lead", "Lead/Manager"], ["Head of Learning", "Director"]],
};

const FIRST: Record<Region, string[]> = {
  IN: ["Aarav", "Aditi", "Akash", "Ananya", "Arjun", "Divya", "Farhan", "Gauri", "Ishaan", "Kavya", "Kiran", "Meera", "Nikhil", "Neha", "Pooja", "Rahul", "Riya", "Rohan", "Sanjay", "Shreya", "Tanvi", "Varun", "Vikram", "Zoya", "Harsh", "Isha", "Manish", "Nandini", "Pranav", "Sneha"],
  GB: ["Oliver", "Amelia", "Harry", "Isla", "George", "Freya", "Jack", "Grace", "Thomas", "Lily", "James", "Sophie", "William", "Ella", "Henry", "Chloe", "Edward", "Lucy", "Samuel", "Hannah"],
  EU: ["Lukas", "Anna", "Jonas", "Lea", "Finn", "Marie", "Lars", "Ingrid", "Sofia", "Mateo", "Clara", "Emil", "Freja", "Hugo", "Ines", "Lena", "Matteo", "Nora", "Pedro", "Sanne"],
  US: ["Michael", "Jessica", "David", "Emily", "Daniel", "Ashley", "Ryan", "Sarah", "Kevin", "Megan", "Brian", "Lauren", "Jason", "Rachel", "Eric", "Nicole", "Tyler", "Amanda", "Justin", "Olivia"],
  SG: ["Wei", "Jia Hui", "Ming", "Xin Yi", "Jun", "Mei", "Hiroshi", "Yuki", "Kenji", "Aiko", "Min-jun", "Seo-yeon", "Marcus", "Rachel", "Darren", "Clarissa"],
  ME: ["Omar", "Layla", "Yousef", "Fatima", "Khalid", "Noor", "Hassan", "Mariam", "Ali", "Sara", "Tariq", "Huda", "Karim", "Rania", "Ahmed", "Lina"],
};
const LAST: Record<Region, string[]> = {
  IN: ["Agarwal", "Bhatt", "Chopra", "Desai", "Gupta", "Iyer", "Joshi", "Kapoor", "Kulkarni", "Menon", "Mehta", "Nair", "Patel", "Rao", "Reddy", "Saxena", "Shah", "Sharma", "Singh", "Verma", "Banerjee", "Pillai", "Malhotra", "Bose", "Chatterjee", "Hegde"],
  GB: ["Smith", "Taylor", "Brown", "Wilson", "Evans", "Thomas", "Roberts", "Walker", "Wright", "Hughes", "Green", "Hall", "Clarke", "Turner", "Hill", "Cooper", "Ward", "Morris", "Baker", "Harris"],
  EU: ["Müller", "Schmidt", "Fischer", "Weber", "Becker", "Hoffmann", "Jansen", "de Vries", "Bakker", "Visser", "Nielsen", "Jensen", "Hansen", "Silva", "Santos", "Costa", "Rossi", "Moreau", "Dubois", "Novak"],
  US: ["Johnson", "Williams", "Miller", "Davis", "Garcia", "Rodriguez", "Martinez", "Anderson", "Jackson", "White", "Thompson", "Lee", "Clark", "Lewis", "Young", "King", "Scott", "Adams", "Nelson", "Carter"],
  SG: ["Tan", "Lim", "Ng", "Ong", "Wong", "Goh", "Chua", "Koh", "Teo", "Sato", "Suzuki", "Tanaka", "Kim", "Park", "Choi", "Yeo"],
  ME: ["Al Mansouri", "Haddad", "Khan", "Rahman", "Saleh", "Nasser", "Farouk", "Aziz", "Hamdan", "Qureshi", "Siddiqui", "Malik", "Darwish", "Hakim"],
};

// Invented company names; each is used once.
const ROOTS = [
  "Aldmere", "Brightwater", "Corvane", "Dunmore", "Elmstead", "Fernhollow", "Glenrock", "Hartwell", "Ironvale", "Juniper", "Larkspur", "Marlowe",
  "Oakridge", "Pemberly", "Quillon", "Ravenmoor", "Silverline", "Tamberly", "Valemont", "Westbrook", "Yarrow", "Ashgrove", "Bramblewood", "Cinderfield",
  "Driftwood", "Emberly", "Foxglove", "Greystone", "Inkwell", "Jasperline", "Kingsmoor", "Lumenfield", "Meridale", "Nimbusly", "Orchardine", "Pinecrest",
  "Quarrystone", "Redfern", "Sablewood", "Thistledown", "Uplander", "Verityne", "Willowmere", "Yewdale", "Zephyrine", "Amberlane", "Birchwell", "Coppergate",
  "Dovecote", "Eastwold", "Fallowfield", "Goldcrest", "Heathmoor", "Ivybridge", "Kestrelton", "Lindenwood", "Maplecroft", "Northcliff", "Oxbridge", "Primrose",
  "Rosewell", "Saltmarsh", "Tidemark", "Underhill", "Vantagery", "Whitlock", "Alderwick", "Blackthorn", "Cloverly", "Deepwater", "Eldermoor", "Fairhaven",
  "Gallowmere", "Hollowell", "Ingleby", "Kirkwall", "Longmead", "Millbrook", "Netherby", "Oakhurst", "Pondlake", "Quintrell", "Ridgeway", "Stonebridge",
  "Thornbury", "Upperton", "Wexley", "Ashcombe", "Bellmont", "Calderon", "Dunbarrow", "Easterly", "Fieldcrest", "Granfield", "Highmoor", "Ironbridge",
  "Lakemont", "Moorfield", "Newhaven", "Overbrook", "Portwell", "Riverton", "Southmere", "Trentham", "Wakefieldine", "Abbotsley", "Brockwell", "Chesterly",
];

const HOBBIES = ["trekking in the Himalayas", "marathon running", "chess", "sailing", "street photography", "jazz", "cricket", "cycling", "cooking", "bird watching", "rock climbing", "padel"];
const DELIVERABLES = ["our case study", "the pricing deck", "the pilot proposal", "a demo video", "the benchmark report", "our product roadmap", "the partnership one-pager"];
const LEGAL_SUFFIX: Record<string, string> = { IN: "Pvt. Ltd.", GB: "Ltd", US: "Inc.", DE: "GmbH", NL: "BV", SG: "Pte. Ltd.", AE: "LLC" };
const NUMBER_WORDS = ["two", "three", "four", "five", "six", "seven"];
const TODAY = Date.parse("2026-10-21T00:00:00Z");

/** Small, fast and seeded, so every run produces the same network. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)];
  const weighted = <T>(list: readonly [T, number][]) => {
    let r = next() * list.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of list) if ((r -= w) <= 0) return v;
    return list[list.length - 1][0];
  };
  const shuffle = <T>(list: readonly T[]) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick, weighted, shuffle, chance: (p: number) => next() < p };
}

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const daysBefore = (date: string, days: number) => day(Date.parse(`${date}T12:00:00Z`) - days * 86_400_000);

type Company = { name: string; domain: string; industry: string; world: string; place: Place; variants: string[] };
type Person = Fixture["contacts"][number] & { world: string };

export function largeNetwork(seed = 20261021): { fixture: Fixture; truth: Truth } {
  const r = rng(seed);
  // A second stream decides which ties are recorded, so the rest of the network stays as it was.
  const recordTie = rng(seed + 1);
  const roots = r.shuffle(ROOTS);
  const truth: Truth = { worldOf: new Map(), connectors: new Set(), ties: [], topicsOf: new Map(), pastJobs: [], companyVariants: new Map(), lookAlikes: [] };

  // Events: two per world, a year apart, plus a few that bring the worlds together.
  const events: Fixture["events"] = [];
  const eventsOf = new Map<string, Fixture["events"]>();
  const addEvent = (name: string, location: string, world: string) => {
    const year = Number(name.match(/20\d\d/)![0]);
    const startsOn = year === 2025 ? day(Date.UTC(2025, r.int(2, 10), r.int(1, 27))) : day(Date.UTC(2026, r.int(1, 8), r.int(1, 27)));
    const event = { key: slug(name), name, startsOn, location, description: `${name}, in ${location}.` };
    events.push(event);
    eventsOf.set(world, [...(eventsOf.get(world) ?? []), event]);
  };
  for (const w of WORLDS) for (const [name, location] of w.events) addEvent(name, location, w.key);
  for (const [name, location] of CROSS_EVENTS) addEvent(name, location, "cross");

  // Companies, some with other spellings that cards will use.
  const companies: Company[] = [];
  for (const w of WORLDS) {
    for (let i = 0; i < w.companies; i++) {
      const root = roots.pop()!;
      const name = `${root} ${w.suffixes[i % w.suffixes.length]}`;
      const place = r.pick(w.places);
      const variants: string[] = [];
      if (r.chance(0.4)) {
        variants.push(`${name} ${LEGAL_SUFFIX[place[1]] ?? "Ltd"}`);
        if (r.chance(0.5)) variants.push(`${name} ${r.pick(["Technologies", "Labs", "Group"])}`);
        if (r.chance(0.5)) variants.push(name.replace(/^\S+/, (word) => word.toUpperCase()));
        truth.companyVariants.set(name, variants);
      }
      companies.push({ name, domain: `${slug(name)}.example`, industry: i % 3 === 2 && w.industries[1] ? w.industries[1] : w.industries[0], world: w.key, place, variants });
    }
  }
  // Look-alikes: the same core name but different companies, with different websites.
  for (const [a, b] of [
    ["Nova Labs", "Nova Systems"],
    ["Halden Group", "Halden Technologies"],
  ] as const) {
    companies.push({ name: a, domain: `${slug(a)}.example`, industry: "Software", world: "saas", place: PLACES.bengaluru, variants: [] });
    companies.push({ name: b, domain: `${slug(b)}.example`, industry: "Robotics", world: "robotics", place: PLACES.pune, variants: [] });
    truth.lookAlikes.push([a, b]);
  }
  const bridgeFirms = BRIDGE_FIRMS.flatMap((f) =>
    Array.from({ length: f.suffix === "Ventures" || f.suffix === "Capital" ? 4 : 2 }, () => {
      const name = `${roots.pop()} ${f.suffix}`;
      return { ...f, company: { name, domain: `${slug(name)}.example`, industry: f.industry, world: "bridge", place: r.pick(BRIDGE_PLACES), variants: [] } as Company };
    }),
  );
  companies.push(...bridgeFirms.map((f) => f.company));

  // People.
  const people: Person[] = [];
  const usedNames = new Set<string>();
  const usedEmails = new Set<string>();
  let ukPhone = 0;
  let usPhone = 0;
  const makeName = (region: Region) => {
    for (;;) {
      const home = r.chance(0.15) ? r.pick(Object.keys(FIRST) as Region[]) : region;
      const name = `${r.pick(FIRST[home])} ${r.pick(LAST[home])}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
  };
  const emailFor = (name: string, domain: string) => {
    const [first, ...rest] = name.split(" ");
    let local = `${slug(first)}.${slug(rest.join(""))}`;
    for (let n = 2; usedEmails.has(`${local}@${domain}`); n++) local = `${slug(first)}.${slug(rest.join(""))}${n}`;
    usedEmails.add(`${local}@${domain}`);
    return `${local}@${domain}`;
  };
  // Reserved fictional numbers: UK drama numbers (020 7946 0000-0999) and US 555-0100 to 0199.
  const phoneFor = (country: string) =>
    country === "US" && usPhone < 100 ? `+1 555 01${String(usPhone++).padStart(2, "0")}` : ukPhone < 1000 ? `+44 20 7946 ${String(ukPhone++).padStart(4, "0")}` : undefined;

  const addPerson = (p: Omit<Person, "email" | "phone"> & { domain: string; noEmail?: boolean }) => {
    const { domain, noEmail, ...rest } = p;
    const person: Person = { ...rest, email: noEmail ? "" : emailFor(p.name, domain), phone: noEmail || r.chance(0.4) ? phoneFor(p.country) : undefined };
    people.push(person);
    truth.worldOf.set(person.name, person.world);
    return person;
  };

  for (const w of WORLDS) {
    const worldEvents = eventsOf.get(w.key)!;
    for (const c of companies.filter((x) => x.world === w.key)) {
      const size = r.weighted([[2, 1], [3, 2], [4, 3], [5, 3], [6, 2], [7, 1], [8, 1]]);
      for (let i = 0; i < size; i++) {
        const founder = i === 0 && r.chance(0.5);
        const role = founder ? "Founder" : r.weighted(w.roles);
        const [title, seniority] = founder ? (["Co-founder & CEO", "C-level/Founder"] as const) : r.pick(TITLES[role]);
        const place = r.chance(0.8) ? c.place : r.pick(w.places);
        const event = r.pick(worldEvents);
        const met: [string, string][] = [[event.key, event.startsOn]];
        if (r.chance(0.2)) {
          const other = worldEvents.find((e) => e.key !== event.key)!;
          met.push([other.key, other.startsOn]);
        }
        // A card without an email has no domain to match on, so it must match by name.
        const noEmail = r.chance(0.04);
        const company = c.variants.length && r.chance(0.3) ? r.pick(c.variants) : c.name;
        addPerson({
          name: makeName(place[2]),
          title,
          company,
          industry: c.industry,
          role,
          seniority,
          city: place[0],
          country: place[1],
          met,
          world: w.key,
          domain: c.domain,
          noEmail,
        });
      }
    }
  }

  // Investors and advisers meet people in two to four worlds.
  for (const f of bridgeFirms) {
    for (let i = 0; i < r.int(2, 4); i++) {
      const [title, seniority] = f.titles[i % f.titles.length];
      const worlds = r.shuffle(WORLDS).slice(0, r.int(2, 4));
      const met = worlds
        .map((w) => r.pick(eventsOf.get(w.key)!))
        .concat(r.chance(0.6) ? [r.pick(eventsOf.get("cross")!)] : [])
        .map((e) => [e.key, e.startsOn] as [string, string])
        .sort((a, b) => a[1].localeCompare(b[1]));
      const person = addPerson({
        name: makeName(f.company.place[2]),
        title,
        company: f.company.name,
        industry: f.industry,
        role: f.role,
        seniority,
        city: f.company.place[0],
        country: f.company.place[1],
        met,
        world: "bridge",
        domain: f.company.domain,
      });
      truth.connectors.add(person.name);
      truth.topicsOf.set(person.name, worlds.map((w) => r.pick(w.topics)));
    }
  }

  // A few people who left their world's events for a neighbouring one.
  for (const p of r.shuffle(people.filter((x) => x.world !== "bridge")).slice(0, 12)) {
    const other = r.pick(WORLDS.filter((w) => w.key !== p.world));
    const e = r.pick(eventsOf.get(other.key)!);
    p.met.push([e.key, e.startsOn]);
    p.met.sort((a, b) => a[1].localeCompare(b[1]));
    truth.connectors.add(p.name);
  }

  // Independents with no company.
  for (let i = 0; i < 28; i++) {
    const w = r.pick(WORLDS);
    const [title, role, seniority] = r.pick([
      ["Independent consultant", "Consulting", "Senior"],
      ["Freelance product designer", "Design", "Senior"],
      ["Angel investor", "Finance", "C-level/Founder"],
      ["Fractional CFO", "Finance", "Director"],
      ["Executive coach", "HR", "Senior"],
    ] as const);
    const place = r.pick(w.places);
    const e = r.pick(eventsOf.get(w.key)!);
    addPerson({
      name: makeName(place[2]),
      title,
      company: null,
      industry: role === "Finance" ? "Investment" : role === "Design" ? "Design" : "Consulting",
      role,
      seniority,
      city: place[0],
      country: place[1],
      met: [[e.key, e.startsOn]],
      world: w.key,
      domain: "mail.example",
    });
  }

  // Notes: topics, interests, introductions, people they know, past jobs and promises.
  const worldOf = (p: Person) => WORLDS.find((w) => w.key === p.world);
  const named = (p: Person) => p.name.split(" ")[0];
  const sameWorld = (p: Person) => people.filter((q) => q !== p && q.world === p.world);
  const mainName = (name: string | null) => (name ? (companies.find((c) => c.name === name || c.variants.includes(name))?.name ?? name) : null);

  for (const p of people) {
    const notes: string[] = [];
    const w = worldOf(p);
    const topics = truth.topicsOf.get(p.name) ?? (w ? r.shuffle(w.topics).slice(0, r.int(1, 2)) : []);
    truth.topicsOf.set(p.name, topics);
    if (topics.length) {
      notes.push(
        r.pick([
          `Working on ${topics.join(" and ")}. Wants to compare notes again soon.`,
          `Spent most of the conversation on ${topics[0]}.${topics[1] ? ` Also curious about ${topics[1]}.` : ""}`,
          `Interested in pilots for ${topics[0]}. Asked good questions about costs.`,
          p.world === "bridge" ? `Invests in and advises companies working on ${topics.join(", ")}.` : `Leads their work on ${topics[0]}.`,
        ]),
      );
    }
    if (r.chance(0.35)) notes.push(`Outside work: loves ${r.pick(HOBBIES)}.`);

    if (r.chance(0.15)) {
      const introducer = r.chance(0.5) ? r.pick(people.filter((q) => truth.connectors.has(q.name) && q !== p)) : r.pick(sameWorld(p));
      if (introducer) {
        notes.push(`Introduced by ${introducer.name}.`);
        const recorded = recordTie.chance(0.4);
        if (recorded) p.links = [...(p.links ?? []), { to: introducer.name, kind: "introduced_by" }];
        truth.ties.push([p.name, introducer.name, "introduced", recorded]);
      }
    }
    if (r.chance(0.1)) {
      const friend = r.pick(sameWorld(p));
      if (friend) {
        notes.push(`Knows ${friend.name} well; they go back years.`);
        const recorded = recordTie.chance(0.4);
        if (recorded) p.links = [...(p.links ?? []), { to: friend.name, kind: "knows" }];
        truth.ties.push([p.name, friend.name, "knows", recorded]);
      }
    }

    // Past jobs, usually at another company in the same world.
    if (p.company && r.chance(0.16)) {
      const current = mainName(p.company);
      const options = companies.filter((c) => c.world === (p.world === "bridge" ? r.pick(WORLDS).key : p.world) && c.name !== current);
      const past = r.pick(options);
      const years = r.pick(NUMBER_WORDS);
      const recorded = r.chance(0.6);
      if (recorded) p.pastPositions = [{ company: past.name, title: r.pick(TITLES[p.role] ?? TITLES.Operations)[0], until: daysBefore(p.met[0][1], r.int(200, 900)) }];
      else notes.push(`Spent ${years} years at ${past.name} before joining ${current}.`);
      truth.pastJobs.push({ person: p.name, company: past.name, recorded });
      for (const q of people) {
        if (q !== p && mainName(q.company) === past.name) truth.ties.push([p.name, q.name, "former_colleague", recorded]);
      }
    }

    if (r.chance(0.08)) {
      notes.push(`Promised to send ${named(p)} ${r.pick(DELIVERABLES)} next week.`);
      if (r.chance(0.6)) p.reminder = [day(TODAY + r.int(-10, 14) * 86_400_000), `Send ${named(p)} ${r.pick(DELIVERABLES)}`];
    }
    if (notes.length) p.notes = notes;
  }

  // Some people were contacted again after meeting.
  for (const p of people) {
    if (!r.chance(0.3)) continue;
    const after = Math.min(TODAY - 86_400_000, Date.parse(`${p.met[p.met.length - 1][1]}T12:00:00Z`) + r.int(7, 120) * 86_400_000);
    p.met.push([r.pick(["email", "call", "meeting", "message"]), day(after)]);
  }

  return {
    fixture: {
      events,
      contacts: people.map(({ world, ...p }) => {
        void world;
        return p;
      }),
    },
    truth,
  };
}
