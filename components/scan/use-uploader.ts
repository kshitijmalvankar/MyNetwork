"use client";

import { useCallback, useRef, useState } from "react";
import { compressImage } from "@/lib/client/compress";

export type CardUpload = {
  key: string;
  front: File;
  back?: File;
  preview: string;
  status: "queued" | "preparing" | "uploading" | "done" | "error";
  scanId?: string;
  error?: string;
};

const CONCURRENCY = 3;

/** Compresses and uploads cards, a few at a time, tracking each card's status. */
export function useUploader() {
  const [items, setItems] = useState<CardUpload[]>([]);
  const [running, setRunning] = useState(false);
  const batchId = useRef<string>(crypto.randomUUID());

  const update = (key: string, patch: Partial<CardUpload>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const toItems = (cards: { front: File; back?: File }[]): CardUpload[] =>
    cards.map((c) => ({
      key: crypto.randomUUID(),
      front: c.front,
      back: c.back,
      preview: URL.createObjectURL(c.front),
      status: "queued" as const,
    }));

  const add = useCallback((cards: { front: File; back?: File }[]) => {
    setItems((list) => [...list, ...toItems(cards)]);
  }, []);

  const remove = useCallback((key: string) => {
    setItems((list) => {
      const item = list.find((i) => i.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return list.filter((i) => i.key !== key);
    });
  }, []);

  const reset = useCallback(() => {
    setItems((list) => {
      list.forEach((i) => URL.revokeObjectURL(i.preview));
      return [];
    });
    batchId.current = crypto.randomUUID();
  }, []);

  const uploadOne = async (item: CardUpload) => {
    try {
      update(item.key, { status: "preparing", error: undefined });
      const [front, back] = await Promise.all([compressImage(item.front), item.back ? compressImage(item.back) : null]);
      update(item.key, { status: "uploading" });
      const body = new FormData();
      body.set("front", front, "front.jpg");
      if (back) body.set("back", back, "back.jpg");
      body.set("batchId", batchId.current);
      const res = await fetch("/api/scans", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; code?: string };
      if (!res.ok || !data.id) {
        update(item.key, { status: "error", error: data.error ?? "Upload failed" });
        return data.code === "quota" ? "stop" : "continue";
      }
      update(item.key, { status: "done", scanId: data.id });
    } catch {
      update(item.key, { status: "error", error: "Network error. Check your connection." });
    }
    return "continue";
  };

  const run = async (queue: CardUpload[]) => {
    setRunning(true);
    let stop = false;
    const worker = async () => {
      while (!stop) {
        const next = queue.shift();
        if (!next) return;
        if ((await uploadOne(next)) === "stop") stop = true;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  };

  /** Upload everything still waiting (or that failed). */
  const start = () => run(items.filter((i) => i.status === "queued" || i.status === "error"));

  /** Add cards and upload them straight away (single-card flow). */
  const addAndUpload = (cards: { front: File; back?: File }[]) => {
    const fresh = toItems(cards);
    setItems((list) => [...list, ...fresh]);
    void run([...fresh]);
  };

  return { items, running, add, addAndUpload, remove, reset, start };
}
