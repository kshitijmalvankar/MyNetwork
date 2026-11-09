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

# Voice notes eval (2026-10-21)

Run with `pnpm eval voice` on the synthetic recordings in `fixtures/voice`, which are 32 kbps mono AAC, the format the recorder uses. Rebuild them with `node scripts/make-voice-fixtures.mjs` (macOS). There are 4 recordings:
- a promise with a relative date ("by next Friday")
- facts only, which must give no follow-ups
- two tasks with different dates
- a Hindi note, whose transcript must stay in Devanagari

A single call returns the transcript, summary, language and dated follow-ups.

| Model | Passed | Cost / note | Average time | Notes |
|---|---|---|---|---|
| **google/gemini-3.1-flash-lite** (reasoning off) | **4/4** (3 runs) | **$0.00045** | 1.6 s | **Default** (`VOICE_MODEL`) |
| google/gemini-3.5-flash-lite (reasoning low) | 4/4 | $0.00053 | 1.6 s | Reasoning can't be turned off |
| google/gemini-3.8-flash (reasoning low) | 4/4 | $0.00133 | 5.2 s | Same accuracy, 3x the cost |

## Findings
- **Format.** OpenRouter accepts m4a and ogg audio but not webm. Chrome, Edge and Safari can record AAC in MP4 (`audio/mp4;codecs=mp4a.40.2`), and Firefox records Opus in Ogg, so no server-side conversion is needed. The server checks the file's actual bytes, not the type the browser claimed.
- **Size.** At 32 kbps a 5-minute note is about 1.2 MB, well under Vercel's 4.5 MB request limit. A 5-minute note costs roughly $0.003.
- **Script.** Without an explicit rule, Hindi was sometimes transliterated into Latin script. Asking for "its own script (Hindi in Devanagari)" in the transcript field's description made it consistent.
- **Typed notes.** Follow-ups use the same rules with the chat model. A keyword check skips the AI call for notes that can't contain a promise ("loves trekking, has two kids").

# Insights summary eval (2026-10-22)

Run with `pnpm eval insights` on the fictional network. It makes five runs on the same statistics. A run passes only if:
- every number it quotes appears in the statistics it was given (percentages included)
- it names no one
- every "ask" action comes with a question

| Model | Passed | Cost / summary | Average time |
|---|---|---|---|
| **anthropic/claude-haiku-5.5** (reasoning off) | **5/5** | **$0.00035** | 3.4 s |

## Findings
- **The model did its own arithmetic and got it wrong** ("28 of your 32 contacts came in since June"; the answer was 32). The useful totals and percentages are now calculated in code and passed in, and the instructions forbid working out new numbers. The eval's "only numbers from the stats" check is what caught this.
- **Each observation now covers one topic**, so the model doesn't link unrelated numbers (for example, which event this month's new people came from).
- **Nothing personal is sent.** The model sees only counts and the names of companies, events, roles, industries and places, never a person's name or details. It can only suggest actions from a fixed list, and the app maps those to links, so it never writes a URL.
- **The statistics are plain SQL and free.** The summary is cached, encrypted, for a week. Rewriting it on request counts as one brief.

# AI cost review (2026-11-01)

Prices checked on OpenRouter the same day. Haiku is $0.10 in and $0.50 out per million tokens, cached input is $0.01, and Sonnet is $2 and $10. An account using its whole free allowance cost about $0.25 a month if no scan escalated, and Ask was about 80% of that.

## Ask

Before the changes, each question used about 11,000 input tokens over two steps. About 4,500 of those per step were the same instructions and tool definitions.

| | Correct | Cost / question | Input tokens | Fixed prompt |
|---|---|---|---|---|
| Before | 20/20 | $0.00132 | 11,062 | about 4,500 tokens |
| After, first question in a while | 19 to 20/20 (see below) | about $0.0009 | about 9,000 | 3,577 tokens |
| After, questions in quick succession | 19 to 20/20 (see below) | about $0.0004 | about 9,000 | 3,577 tokens |

What changed:
- **Caching.** The fixed instructions and tools are marked as cacheable, and the name and date moved into a separate message after them, so the cached part is the same for everyone. Repeats cost a tenth of the price; the first use costs a quarter more. It works on the zero-data-retention route, tested down to 2,700 tokens.
- **Counting moved into `findContacts`,** so the long list of filters is sent once, not twice.
- **Smaller results.** 15 people by default instead of 25, 6 note passages instead of 8, and dates without times. This barely shows on 32 fictional people, but matters on a bigger network.
- **The last step must answer,** and the most steps a question can take went from 6 to 5.

Findings:
- **Answers can still name search noise.** "Who did I meet from Initech?" named unrelated people in one of four runs after the instructions were tightened.
- **A score cutoff for note search doesn't work.** "Initech" scores up to 0.31 on unrelated passages, while the best real match for "warehouse automation" is 0.35 and good second matches are about 0.25. The instructions tell the model to ignore unrelated results instead.
- **Routing to the fastest provider didn't help.** p50 stayed between 4.4 and 5 s, so it isn't used.

## Newer models

| Model | Ask runs (of 4) at 20/20 | Cost / question | p50 | Notes |
|---|---|---|---|---|
| **anthropic/claude-haiku-5.5** | 3 | $0.0004 to $0.0006 | 4.7 s | **Default.** Available from two providers |
| inception/mercury-3 | 3 | $0.0003 | 2.7 s | Refused an email lookup as harmful, and returned broken structured output on Insights |
| inception/mercury-2.5 | 2 | $0.0002 | 2.8 s | Missed people ("Who speaks Japanese?") and answered "Who did I meet in June 2026?" without naming anyone |
| deepseek/deepseek-v4.1-flash | 1 of 1 | $0.0006 | 3.3 s | No saving over Haiku |
| minimax/minimax-m3.1-flash | 0 of 1 | n/a | n/a | Its endpoints can't turn reasoning off |

Mercury 3 is about 2 seconds faster, but refusing to look up an email address is a core failure for a contacts app, and the saving is a fraction of a cent. Worth re-running when it's more mature. Haiku is also cheaper than `gemini-3.1-flash-lite`, so text work shouldn't move to it.

## Scans, briefs and limits

- **Escalation.** Sonnet costs about 17 times as much per card. A low confidence rating on the company or title used to trigger it; now it only asks the user to check that field. A doubtful name, unreadable contact details or no contact details still escalate, and a QR code with contact details counts as having them. The six fixture cards never escalated, so how often real cards did is unknown.
- **Briefs** stay free to reopen for a week instead of until midnight, unless something about the person changes.
- **Per-account cap.** Notes have no monthly allowance, so one account saving notes as fast as the rate limit allows could reach the global $5 a day and pause AI for everyone. `AI_USER_DAILY_USD` (default $1) stops that account first. Tested live.
- **Labels.** `ai_usage` now records follow-ups from notes as `notes` and Insights summaries as `insights`, not `brief`. Their past rows keep the old label.
- **Follow-up keyword check.** It sent 7 of the 17 fixture notes to AI, and words like "next" let through notes with no promise in them. It's left as it is, because one call per note will replace it when notes also feed the graph.

# Reading notes eval (2026-11-09)

Run with `pnpm eval notes`. One call per note now finds follow-ups, who knows whom, past jobs and topics, replacing the follow-ups-only call and its keyword check. The answers come from the generated 500-person network, which knows which notes mention an introduction, a friend, a past employer, a topic or a promise. 95 notes from 37 people, plus the three typed follow-up cases that used to be in the voice eval.

| Model | People (introductions, "knows") | Past jobs | Topics | Follow-ups | Cost / note | p50 |
|---|---|---|---|---|---|---|
| **anthropic/claude-haiku-5.5** (prompt v3) | **100%, none extra** | **100%, none extra** | **89%, no hobbies** | **5/5 promises, 1 invented** | **$0.0002** | 0.9 s |

## Findings
- **The first version invented follow-ups** from lines like "Wants to compare notes again soon": 12 across 95 notes. These are what the other person wants, not something the user promised. The old keyword check never sent those notes to the AI at all. The note instructions now say so, and it fell to 1.
- **"Before the end of the month" lost its date** in the first two versions. A hint fixed it.
- **The voice prompt is unchanged.** It shares the follow-up rules, and voice replays can't be re-recorded while the OpenRouter balance is under $0.50, which audio needs.
- **Topics reuse a list of the network's existing topics**, so the same thing gets the same name and topics can link people.
- **Names are matched to contacts in code, not by the AI.** A first name shared by two contacts is left out rather than guessed.
- **Cost.** Every typed note is now read, about $0.0002 each; voice notes add one call on the transcript. Notes have no monthly allowance, so the per-account daily cap is what bounds this.
