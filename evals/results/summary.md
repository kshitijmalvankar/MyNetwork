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
