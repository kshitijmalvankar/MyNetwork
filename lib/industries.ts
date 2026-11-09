// One list of industries, so the same kind of business always gets the same
// label, whether the AI read it from a card or the user picked it. Each
// industry belongs to a sector, which groups related ones (Fintech and Banking
// are both Finance). Client-safe.

export const SECTORS = ["Technology", "Finance", "Health", "Industry", "Consumer", "Services", "Media & education", "Public sector"] as const;
export type Sector = (typeof SECTORS)[number];

const SECTOR_OF = {
  Software: "Technology",
  "AI & data": "Technology",
  Cybersecurity: "Technology",
  "Hardware & electronics": "Technology",
  Robotics: "Technology",
  Telecom: "Technology",
  Fintech: "Finance",
  Banking: "Finance",
  Insurance: "Finance",
  Investment: "Finance",
  Accounting: "Finance",
  Healthcare: "Health",
  "Biotech & pharma": "Health",
  Manufacturing: "Industry",
  Logistics: "Industry",
  Automotive: "Industry",
  "Energy & climate": "Industry",
  "Aerospace & defence": "Industry",
  "Construction & real estate": "Industry",
  Agriculture: "Industry",
  "Retail & e-commerce": "Consumer",
  "Consumer goods": "Consumer",
  "Food & beverage": "Consumer",
  "Travel & hospitality": "Consumer",
  Consulting: "Services",
  Legal: "Services",
  "Marketing & advertising": "Services",
  Design: "Services",
  "Recruiting & HR": "Services",
  "Media & entertainment": "Media & education",
  Education: "Media & education",
  Government: "Public sector",
  "Non-profit": "Public sector",
} as const satisfies Record<string, Sector>;

export type Industry = keyof typeof SECTOR_OF;
export const INDUSTRIES = Object.keys(SECTOR_OF) as [Industry, ...Industry[]];

export const isIndustry = (value: string | null | undefined): value is Industry => Boolean(value && value in SECTOR_OF);
export const sectorOf = (industry: string | null | undefined): Sector | null => (isIndustry(industry) ? SECTOR_OF[industry] : null);
export const industriesIn = (sector: Sector) => INDUSTRIES.filter((i) => SECTOR_OF[i] === sector);

const simplify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+-]+/g, " ")
    .trim();

const BY_NAME = new Map(INDUSTRIES.map((i) => [simplify(i), i]));

// Checked in order, so the more specific words come first ("biotech" before "tech").
const KEYWORDS: [RegExp, Industry][] = [
  [/\b(bio ?tech\w*|pharma\w*|life sciences?|drugs?|vaccines?|genomics)\b/, "Biotech & pharma"],
  [/\b(health ?tech|digital health|health ?care|health|hospitals?|clinics?|medical|med ?tech|wellness|fitness)\b/, "Healthcare"],
  [/\b(ed ?tech|education\w*|e-?learning|schools?|universit\w*|colleges?|training|learning)\b/, "Education"],
  [/\b(insur\w*)\b/, "Insurance"],
  [/\b(fin ?tech|payments?|reg ?tech|crypto\w*|blockchain|web3|neobanks?)\b/, "Fintech"],
  [/\b(investment banking|banks?|banking|lending|credit|financ\w*)\b/, "Banking"],
  [/\b(venture\w*|vc|private equity|asset management|invest\w*|capital|funds?|family office|wealth management)\b/, "Investment"],
  [/\b(accounting|accountants?|audit\w*|tax\w*|bookkeep\w*)\b/, "Accounting"],
  [/\b(cyber\w*|security|infosec)\b/, "Cybersecurity"],
  [/\b(ai|artificial intelligence|machine learning|ml|data|big data|analytics)\b/, "AI & data"],
  [/\b(robot\w*|automation|drones?)\b/, "Robotics"],
  [/\b(aerospace|aviation|defen[cs]e|space)\b/, "Aerospace & defence"],
  [/\b(semiconductors?|chips?|electronics?|hardware|iot|internet of things|devices?)\b/, "Hardware & electronics"],
  [/\b(telecom\w*|telco|networking|wireless|5g)\b/, "Telecom"],
  [/\b(logistics?|supply chain|shipping|freight|transport\w*|cold ?chain|warehous\w*|couriers?|delivery|trucking)\b/, "Logistics"],
  [/\b(automotive|auto|vehicles?|ev|evs|mobility|cars?)\b/, "Automotive"],
  [/\b(energy|climate|clean ?tech|renewables?|solar|wind|oil|gas|utilit\w*|power|sustainab\w*|carbon|environment\w*)\b/, "Energy & climate"],
  [/\b(real estate|property|properties|prop ?tech|construction|architecture|infrastructure|buildings?)\b/, "Construction & real estate"],
  [/\b(agri\w*|ag ?tech|farm\w*)\b/, "Agriculture"],
  [/\b(manufactur\w*|industrial|chemicals?|materials?|steel|metals?|mining|textiles?)\b/, "Manufacturing"],
  [/\b(e-?commerce|retail|d2c|dtc|marketplaces?|shopping)\b/, "Retail & e-commerce"],
  [/\b(fmcg|cpg|consumer goods|consumer products|beauty|cosmetics|fashion|apparel|luxury)\b/, "Consumer goods"],
  [/\b(food\w*|beverages?|f and b|restaurants?|drinks?|catering)\b/, "Food & beverage"],
  [/\b(travel|tourism|hospitality|hotels?|airlines?)\b/, "Travel & hospitality"],
  [/\b(consult\w*|advisory|strategy|professional services)\b/, "Consulting"],
  [/\b(legal|law|lawyers?|attorneys?|solicitors?)\b/, "Legal"],
  [/\b(marketing|advertis\w*|ad ?tech|mar ?tech|pr|public relations|branding|agency|communications)\b/, "Marketing & advertising"],
  [/\b(design\w*|ux|creative)\b/, "Design"],
  [/\b(recruit\w*|staffing|talent|hr|human resources|hr ?tech|payroll)\b/, "Recruiting & HR"],
  [/\b(media|entertainment|gaming|games?|film|music|publish\w*|news|broadcast\w*|streaming|sports?)\b/, "Media & entertainment"],
  [/\b(government|public sector|ministry|municipal\w*|civil service)\b/, "Government"],
  [/\b(non-?profit|ngos?|charit\w*|foundations?|social enterprise)\b/, "Non-profit"],
  [/\b(software|saas|cloud|it|information technology|internet|tech\w*|digital|platforms?|apps?|web)\b/, "Software"],
];

/** The list's label for a free-text industry ("FinTech", "Payments" → Fintech), or null if nothing fits. */
export function canonicalIndustry(value: string | null | undefined): Industry | null {
  const simple = value ? simplify(value) : "";
  if (!simple) return null;
  return BY_NAME.get(simple) ?? KEYWORDS.find(([pattern]) => pattern.test(simple))?.[1] ?? null;
}
