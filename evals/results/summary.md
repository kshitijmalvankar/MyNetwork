# Extraction eval: model choice (2026-10-21)

Run with `pnpm eval` on the 6 synthetic fixture cards in `fixtures/cards`. Covered cases:
- clean English card with a QR code
- tilted phone photo
- double-sided card
- Japanese card
- Hindi/English bilingual card
- dark card photographed at an angle

All candidates were restricted to zero-data-retention endpoints that support structured output.

| Model | Field accuracy | Cost / card | p50 latency | Notes |
|---|---|---|---|---|
| **anthropic/claude-haiku-5.5** | **100%** | **$0.00051** | 3.9 s | **Default** (`VISION_MODEL`) |
| anthropic/claude-sonnet-5.5 | 100% | $0.00865 | 6.4 s | **Escalation** (`VISION_MODEL_STRONG`), used only when validators flag a reading |
| google/gemma-3-27b-it | 98.2% | $0.00016 | 9.9 s | Cheaper but much slower |
| mistralai/mistral-small-3.2-24b-instruct | 91.1% | $0.00019 | 12.8 s | Weak role tagging, slow |
| qwen/qwen3-vl-30b-a3b-instruct | 66% | $0.00020 | 10.2 s | Dropped schema responses (first round) |

## Findings
- Claude endpoints reject `temperature`. Because requests set `require_parameters`, OpenRouter refuses to route any request that includes it, so the extraction call doesn't set one.
- Without explicit rules, every model defaulted seniority to "Mid". The extraction prompt now spells out the seniority rules.
- Haiku's latency varies by provider (1.8–5 s per call). It has reasoning off by default, so turning reasoning off doesn't help.

# Ask eval: chat model choice (2026-10-21)

Run with `pnpm eval ask` against the fictional network in `fixtures/network.json`. Load it into the local test account with `pnpm seed:network` first. There are 20 questions with known answers:
- people at a company, in a kind of role, in a city, or met at an event or in a month
- topics found only in notes ("who is hiring Rust developers?")
- follow-ups, contact details, counts and "which company has the most people"
- a company that isn't in the network, which must produce no names

A question passes only if every expected name or fact is in the answer, no made-up person appears, and every person link points to a real contact.

| Model | Correct | Cost / question | p50 (full answer) | Notes |
|---|---|---|---|---|
| **anthropic/claude-haiku-5.5**, reasoning off | **20/20** | **$0.0013** | 3.4 s | **Default** (`CHAT_MODEL`) |
| anthropic/claude-haiku-5.5, default reasoning | 20/20 | $0.0017 | 5.0 s | Same accuracy, slower |
| qwen/qwen3-235b-a22b-2507 | 20/20 | $0.0009 | 19.5 s | Accurate but about 4x slower |
| deepseek/deepseek-v4.1-flash | 19/20 | $0.0012 | 4.2 s | Missed "which company has the most people" |
| openai/gpt-oss-120b | 16/20 | $0.0001 | 7.8 s | Missed people in role and topic questions |
| openai/gpt-5-nano | 2/20 | $0.0013 | 69 s | Mostly timed out or answered without looking |

Haiku is the fastest model that answered every question correctly. Qwen is about half the price, but waiting about 20 seconds for an answer is too long for a chat. Worth re-running when cheaper fast models appear: `EVAL_CHAT_MODELS=a/b,c/d pnpm eval ask`.

Embeddings use `openai/text-embedding-3-small` (1536 dimensions), served by Azure with zero data retention, at about $0.02 per million tokens. Indexing all 32 test contacts with their notes and events cost under $0.0001.

## Findings
- Answers start streaming after the lookups, usually 2–4 s in. The lookup steps appear on screen straight away.
- Search is exact over the user's own chunks, with no approximate index. A shared approximate index filtered by user can silently drop results, and one person's network is small enough to scan.
- Giving the model a structured people search (company, role, place, event, dates) plus note search was enough. No question needed more than three lookups.

# Briefs and drafts eval (2026-10-21)

Run with `pnpm eval brief` on the same fictional network. There are 8 cases:
- 4 meeting briefs: a person with notes, a person with an open follow-up, a person with no notes, and a brief tailored to a meeting topic
- 4 follow-up drafts: email and message, three tones, with and without an instruction

Each case checks for:
- required facts
- a length limit
- links only to real, related people
- no placeholders like "[Your Name]"
- a subject line for emails only, and a sign-off with the sender's name
- no wrong relative dates

| Model | Passed | Cost / item | Average time |
|---|---|---|---|
| **anthropic/claude-haiku-5.5** (reasoning off) | **8/8** | **$0.0003** | 1.9 s |

## Findings
- **Hidden reasoning cut answers short.** Haiku used up to the whole output-token limit on reasoning that isn't shown, so briefs stopped mid-sentence. The portable `reasoning` option isn't passed through by the OpenRouter provider, so `chatModel(id, { reasoning: "none" })` sets OpenRouter's own `reasoning.effort` instead.
- **Ask with reasoning off** still scored 20/20, and it was faster (p50 3.4 s, down from 5.0 s) and cheaper ($0.0013 per question, down from $0.0017). Ask now runs with reasoning off too.
- **Drafts need today's date.** Without it, the model wrote "last month" for a call three months earlier.
- **Drafts must read as if a person wrote them.** They now refer to time naturally and never mention notes, reminders or the app.
