import { describe, expect, it } from "vitest";
import { MAX_TOPICS, mergeTopics, normalizeTopic } from "@/lib/topics";

describe("topics", () => {
  it("keeps short lowercase phrases", () => {
    expect(normalizeTopic("  Warehouse   Automation! ")).toBe("warehouse automation");
    expect(normalizeTopic("x")).toBeNull();
    expect(normalizeTopic("a".repeat(41))).toBeNull();
  });

  it("merges without repeats and stops at the limit", () => {
    expect(mergeTopics(["open banking"], ["Open Banking", "fraud detection"])).toEqual(["open banking", "fraud detection"]);
    expect(mergeTopics([], Array.from({ length: 20 }, (_, i) => `topic ${i}`))).toHaveLength(MAX_TOPICS);
  });
});
