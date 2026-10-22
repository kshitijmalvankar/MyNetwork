import "server-only";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
  SharedV4FileData,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";

// Record and replay for end-to-end tests. In record mode every model response
// is saved under fixtures/ai, keyed by its request; in mock mode those
// responses are played back instead of calling a model. A test account gets
// new ids and dates on every run, so keys ignore them, and replayed responses
// have the recorded ids swapped for the matching ones in the new request.

type Recorded = {
  content: LanguageModelV4Content[];
  finishReason: LanguageModelV4FinishReason;
  usage: LanguageModelV4Usage;
};

type Fixture = {
  model: string;
  settings: Record<string, unknown>;
  recordedOn: string;
  key: string;
  looseKey: string;
  /** Ids in the recorded request, in order, so replay can map them to the new ones. */
  ids: string[];
  /** The request as it was keyed, for working out why a recording no longer matches. */
  request: unknown;
  response: Recorded;
};

type RequestKeys = { model: string; settings: Record<string, unknown>; key: string; looseKey: string; ids: string[]; normalized: string };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const DAY = /\b\d{4}-\d{2}-\d{2}\b/g;

// File access below is marked turbopackIgnore: these paths are only used in
// test modes, and tracing them would bundle the whole project into the server.
const fixturesDir = () => process.env.AI_FIXTURES_DIR ?? path.join(process.cwd(), "fixtures", "ai");
const missesDir = () => path.join(process.cwd(), "test-results", "ai-misses");
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Replaces what changes from run to run (ids, dates, weekdays) with placeholders. */
export function normalizeText(text: string) {
  return text
    .replace(UUID, "<id>")
    .replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, "<date>")
    .replace(/\b\d{4}-\d{2}\b/g, "<month>")
    .replace(/\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/g, "<weekday>")
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b/g, "<date>");
}

/** A file's contents as a short hash (bytes, base64 or text), or its address. */
function fileData(file: SharedV4FileData) {
  switch (file.type) {
    case "data":
      return sha(typeof file.data === "string" ? Buffer.from(file.data, "base64") : Buffer.from(file.data));
    case "url":
      return file.url.href;
    case "text":
      return sha(file.text);
    default:
      return sha(JSON.stringify(file));
  }
}

/** The prompt as JSON, with each attached file replaced by its hash (exact) or just its kind (loose). */
function serializePrompt(prompt: LanguageModelV4Prompt, files: "hash" | "kind") {
  return JSON.stringify(prompt, (key, value) => {
    if (key === "providerOptions") return undefined;
    if (value && typeof value === "object" && value.type === "file" && "data" in value) {
      return { type: "file", mediaType: value.mediaType, data: files === "hash" ? fileData(value.data as SharedV4FileData) : String(value.mediaType).split("/")[0] };
    }
    return value;
  });
}

/**
 * Two keys per request. The exact key covers everything that shapes the
 * answer. The loose key also ignores numbers and file contents, so a request
 * still finds its recording when counts drift with the calendar, or when a
 * recording made in the browser has different bytes each time.
 */
export function requestKeys(model: string, settings: Record<string, unknown>, options: Pick<LanguageModelV4CallOptions, "prompt" | "tools" | "responseFormat">): RequestKeys {
  const tools = (options.tools ?? []).map((t) => (t.type === "function" ? { name: t.name, description: t.description, inputSchema: t.inputSchema } : { name: t.name }));
  const normalized = normalizeText(serializePrompt(options.prompt, "hash"));
  const loose = normalizeText(serializePrompt(options.prompt, "kind")).replace(/\d+/g, "#");
  return {
    model,
    settings,
    key: sha({ model, settings, prompt: normalized, tools, format: options.responseFormat ?? null }).slice(0, 32),
    looseKey: sha({ model, settings, prompt: loose, tools: tools.map((t) => t.name), format: options.responseFormat?.type ?? null }).slice(0, 32),
    ids: (serializePrompt(options.prompt, "kind").match(UUID) ?? []).map((id) => id.toLowerCase()),
    normalized,
  };
}

function shiftDay(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A recorded response, fitted to a new request: ids the recording got from its
 * request become the ids at the same positions in the new one, and dates move
 * by the days since it was recorded (so "by next Friday" stays next Friday).
 */
export function adaptResponse(fixture: Pick<Fixture, "ids" | "recordedOn" | "response">, ids: string[], today = todayUtc()): Recorded {
  const map = new Map<string, string>();
  fixture.ids.forEach((old, i) => {
    if (ids[i] && !map.has(old)) map.set(old, ids[i]);
  });
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${fixture.recordedOn}T12:00:00Z`)) / 86_400_000);
  const json = JSON.stringify(fixture.response)
    .replace(UUID, (id) => map.get(id.toLowerCase()) ?? id)
    .replace(DAY, (day) => (days ? shiftDay(day, days) : day));
  return JSON.parse(json) as Recorded;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let loaded: { exact: Map<string, Fixture>; loose: Map<string, Fixture[]> } | undefined;

function remember(fixture: Fixture) {
  loaded ??= { exact: new Map(), loose: new Map() };
  loaded.exact.set(fixture.key, fixture);
  loaded.loose.set(fixture.looseKey, [...(loaded.loose.get(fixture.looseKey) ?? []).filter((f) => f.key !== fixture.key), fixture]);
}

function recordings() {
  if (!loaded) {
    loaded = { exact: new Map(), loose: new Map() };
    let files: string[] = [];
    try {
      files = readdirSync(/*turbopackIgnore: true*/ fixturesDir()).filter((f) => f.endsWith(".json"));
    } catch {}
    for (const name of files) {
      const file = path.join(/*turbopackIgnore: true*/ fixturesDir(), name);
      remember(JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Fixture);
    }
  }
  return loaded;
}

function parseOrKeep(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function save(keys: RequestKeys, response: Recorded) {
  const fixture: Fixture = {
    model: keys.model,
    settings: keys.settings,
    recordedOn: todayUtc(),
    key: keys.key,
    looseKey: keys.looseKey,
    ids: keys.ids,
    request: parseOrKeep(keys.normalized),
    response: {
      // Only what the app reads: answers and tool calls, without provider metadata.
      content: response.content.flatMap((c): LanguageModelV4Content[] =>
        c.type === "text" ? [{ type: "text", text: c.text }] : c.type === "tool-call" ? [{ type: "tool-call", toolCallId: c.toolCallId, toolName: c.toolName, input: c.input }] : [],
      ),
      finishReason: response.finishReason,
      usage: { inputTokens: response.usage.inputTokens, outputTokens: response.usage.outputTokens },
    },
  };
  mkdirSync(/*turbopackIgnore: true*/ fixturesDir(), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ path.join(fixturesDir(), `${keys.key}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
  remember(fixture);
}

function replay(keys: RequestKeys): Recorded {
  const { exact, loose } = recordings();
  const fixture = exact.get(keys.key) ?? loose.get(keys.looseKey)?.at(-1);
  if (!fixture) {
    mkdirSync(/*turbopackIgnore: true*/ missesDir(), { recursive: true });
    const file = path.join(missesDir(), `${keys.key}.json`);
    writeFileSync(/*turbopackIgnore: true*/ file, `${JSON.stringify({ model: keys.model, settings: keys.settings, request: parseOrKeep(keys.normalized) }, null, 2)}\n`);
    throw new Error(`No recorded AI response for this ${keys.model} request. Record one with \`pnpm test:e2e:record\`. The request is in ${path.relative(process.cwd(), file)}.`);
  }
  return adaptResponse(fixture, keys.ids);
}

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

function toStream(response: Recorded): ReadableStream<LanguageModelV4StreamPart> {
  const parts: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }];
  response.content.forEach((c, i) => {
    if (c.type === "text") {
      const id = `text-${i}`;
      parts.push({ type: "text-start", id });
      for (const delta of c.text.match(/[\s\S]{1,24}/g) ?? []) parts.push({ type: "text-delta", id, delta });
      parts.push({ type: "text-end", id });
    } else if (c.type === "tool-call") {
      parts.push(c);
    }
  });
  parts.push({ type: "finish", finishReason: response.finishReason, usage: response.usage });
  return simulateReadableStream({ chunks: parts, chunkDelayInMs: 5 });
}

/** Rebuilds a response from the live stream as it passes through. Null if the stream failed. */
async function collect(stream: ReadableStream<LanguageModelV4StreamPart>): Promise<Recorded | null> {
  const content: LanguageModelV4Content[] = [];
  const texts = new Map<string, { type: "text"; text: string }>();
  let finish: { finishReason: LanguageModelV4FinishReason; usage: LanguageModelV4Usage } | undefined;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === "text-start") {
      const text = { type: "text" as const, text: "" };
      texts.set(value.id, text);
      content.push(text);
    } else if (value.type === "text-delta") {
      const text = texts.get(value.id);
      if (text) text.text += value.delta;
    } else if (value.type === "tool-call") {
      content.push(value);
    } else if (value.type === "finish") {
      finish = { finishReason: value.finishReason, usage: value.usage };
    } else if (value.type === "error") {
      return null;
    }
  }
  return finish ? { content, ...finish } : null;
}

/**
 * A language model that replays recordings (mock mode), or calls `live` and
 * records what it returns (record mode).
 */
export function recordedModel(modelId: string, settings: Record<string, unknown>, live?: LanguageModelV4): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: live ? `${live.provider} (recording)` : "recorded",
    modelId,
    supportedUrls: live?.supportedUrls ?? {},
    async doGenerate(options) {
      const keys = requestKeys(modelId, settings, options);
      if (!live) return { ...replay(keys), warnings: [] };
      const result = await live.doGenerate(options);
      save(keys, result);
      return result;
    },
    async doStream(options) {
      const keys = requestKeys(modelId, settings, options);
      if (!live) return { stream: toStream(replay(keys)) };
      const result = await live.doStream(options);
      const [forCaller, forRecording] = result.stream.tee();
      void collect(forRecording).then((response) => response && save(keys, response));
      return { ...result, stream: forCaller };
    },
  };
}
