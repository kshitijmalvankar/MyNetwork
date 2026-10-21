"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MicIcon, RotateCcwIcon, SquareIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const MAX_SECONDS = 300;
// Formats the transcription model accepts, best first. Chrome, Edge and Safari
// record AAC in MP4; Firefox records Opus in Ogg.
const TYPES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus"];

type State = { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "saving" } | { kind: "failed"; message: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Records a voice note for a contact. Nothing leaves the device until you stop. */
export function VoiceRecorder({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pending = useRef<{ blob: Blob; seconds: number } | null>(null);
  const cancelled = useRef(false);

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => release, []);

  const upload = async () => {
    if (!pending.current) return;
    setState({ kind: "saving" });
    const { blob, seconds } = pending.current;
    const form = new FormData();
    form.append("audio", blob, blob.type.includes("ogg") ? "voice.ogg" : "voice.m4a");
    form.append("seconds", String(seconds));
    try {
      const res = await fetch(`/api/contacts/${contactId}/voice`, { method: "POST", body: form });
      if (!res.ok) return setState({ kind: "failed", message: (await res.text()) || "Something went wrong. Please try again." });
      const data = (await res.json()) as { suggestions: unknown[] };
      pending.current = null;
      setState({ kind: "idle" });
      toast.success(
        data.suggestions.length
          ? `Voice note saved. Found ${data.suggestions.length === 1 ? "a follow-up" : `${data.suggestions.length} follow-ups`} to review.`
          : "Voice note saved",
      );
      router.refresh();
    } catch {
      setState({ kind: "failed", message: "Couldn't reach the server. Check your connection and try again." });
    }
  };

  const start = async () => {
    const mimeType = typeof MediaRecorder !== "undefined" ? TYPES.find((t) => MediaRecorder.isTypeSupported(t)) : undefined;
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) {
      return void toast.error("This browser can't record voice notes. Try Chrome, Safari or Edge.");
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return void toast.error("Allow microphone access to record a voice note.");
    }
    chunks.current = [];
    cancelled.current = false;
    const rec = new MediaRecorder(stream.current, { mimeType, audioBitsPerSecond: 32_000 });
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      release();
      if (cancelled.current) return setState({ kind: "idle" });
      pending.current = { blob: new Blob(chunks.current, { type: mimeType.split(";")[0] }), seconds };
      void upload();
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start(1000);
    setState({ kind: "recording", seconds: 0 });
    timer.current = setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      if (seconds >= MAX_SECONDS) recorder.current?.stop();
      else setState({ kind: "recording", seconds });
    }, 250);
  };

  const stop = (discard = false) => {
    cancelled.current = discard;
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  if (state.kind === "recording") {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5" role="status">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-medium tabular-nums">{clock(state.seconds)}</span>
        <span className="text-xs text-muted-foreground">/ {clock(MAX_SECONDS)}</span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => stop(true)}>
            <XIcon data-icon="inline-start" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => stop()}>
            <SquareIcon data-icon="inline-start" className="fill-current" />
            Stop
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "saving") {
    return (
      <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner /> Transcribing your voice note…
      </p>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-sm">
        <span className="flex-1 text-destructive">{state.message}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            pending.current = null;
            setState({ kind: "idle" });
          }}
        >
          Discard
        </Button>
        <Button size="sm" variant="outline" onClick={() => void upload()}>
          <RotateCcwIcon data-icon="inline-start" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => void start()}>
      <MicIcon data-icon="inline-start" />
      Record
    </Button>
  );
}
