"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  CameraIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  FlipHorizontal2Icon,
  ImagePlusIcon,
  InboxIcon,
  RotateCcwIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUploader, type CardUpload } from "./use-uploader";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

function FileButton({
  children,
  capture,
  multiple,
  onFiles,
  variant = "outline",
  className,
}: {
  children: React.ReactNode;
  capture?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  variant?: "default" | "outline";
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        capture={capture ? "environment" : undefined}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <Button type="button" variant={variant} size="lg" className={cn("h-12", className)} onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  );
}

function StatusBadge({ item }: { item: CardUpload }) {
  switch (item.status) {
    case "queued":
      return <Badge variant="secondary">Ready</Badge>;
    case "preparing":
    case "uploading":
      return (
        <Badge variant="secondary" className="gap-1">
          <Spinner className="size-3" /> {item.status === "preparing" ? "Preparing" : "Uploading"}
        </Badge>
      );
    case "done":
      return (
        <Badge className="gap-1 bg-success/15 text-success">
          <CheckCircle2Icon className="size-3" /> Reading…
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <CircleAlertIcon className="size-3" /> Failed
        </Badge>
      );
  }
}

function UploadList({
  items,
  onRemove,
}: {
  items: CardUpload[];
  onRemove: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.key} className="group relative overflow-hidden rounded-xl border bg-card">
          {/* Local preview of the user's own photo (blob: URL). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.preview} alt="" className="aspect-[7/4] w-full object-cover" />
          <div className="flex items-center justify-between gap-2 p-2">
            <StatusBadge item={item} />
            {item.back && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FlipHorizontal2Icon className="size-3" /> 2 sides
              </span>
            )}
          </div>
          {item.error && <p className="px-2 pb-2 text-xs text-destructive">{item.error}</p>}
          {(item.status === "queued" || item.status === "error") && (
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label="Remove"
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-background/90 shadow-sm"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function SingleCard({ onReady }: { onReady: (card: { front: File; back?: File }) => void }) {
  const [front, setFront] = useState<{ file: File; url: string } | null>(null);
  const [back, setBack] = useState<{ file: File; url: string } | null>(null);

  const pick = (setter: typeof setFront) => (files: File[]) => setter({ file: files[0], url: URL.createObjectURL(files[0]) });
  const clear = () => {
    if (front) URL.revokeObjectURL(front.url);
    if (back) URL.revokeObjectURL(back.url);
    setFront(null);
    setBack(null);
  };

  if (!front) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed bg-muted/30 px-4 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
          <CameraIcon className="size-8" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Photograph the front of the card</p>
          <p className="text-sm text-muted-foreground">Lay it flat in good light and fill most of the frame.</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <FileButton capture onFiles={pick(setFront)} variant="default" className="bg-brand text-brand-foreground hover:bg-brand/90">
            <CameraIcon /> Take photo
          </FileButton>
          <FileButton onFiles={pick(setFront)}>
            <ImagePlusIcon /> Choose a photo
          </FileButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={front.url} alt="Front of card" className="aspect-[7/4] w-full rounded-xl border object-cover" />
          <figcaption className="text-xs text-muted-foreground">Front</figcaption>
        </figure>
        {back ? (
          <figure className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={back.url} alt="Back of card" className="aspect-[7/4] w-full rounded-xl border object-cover" />
            <figcaption className="text-xs text-muted-foreground">Back</figcaption>
          </figure>
        ) : (
          <div className="flex aspect-[7/4] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">Details on the back too?</p>
            <div className="flex flex-wrap justify-center gap-2">
              <FileButton capture onFiles={pick(setBack)} className="h-9">
                <CameraIcon /> Photograph back
              </FileButton>
              <FileButton onFiles={pick(setBack)} className="h-9">
                <ImagePlusIcon /> Choose
              </FileButton>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={clear}>
          <RotateCcwIcon /> Start over
        </Button>
        <Button
          size="lg"
          className="h-11 bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={() => {
            onReady({ front: front.file, back: back?.file });
            setFront(null);
            setBack(null);
          }}
        >
          <UploadCloudIcon /> Read this card
        </Button>
      </div>
    </div>
  );
}

function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) onFiles(files);
      }}
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-muted/30 px-4 py-12 text-center transition-colors",
        over && "border-brand bg-brand-subtle",
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
        <UploadCloudIcon className="size-8" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">
          <span className="hidden sm:inline">Drop card photos here, or </span>choose several at once
        </p>
        <p className="text-sm text-muted-foreground">JPEG, PNG or WebP · up to 6 MB each</p>
      </div>
      <FileButton multiple onFiles={onFiles}>
        <ImagePlusIcon /> Choose photos
      </FileButton>
    </div>
  );
}

export function CardCapture({ remaining }: { remaining: number }) {
  const { items, running, add, addAndUpload, remove, reset, start } = useUploader();
  const [pairSides, setPairSides] = useState(false);

  const queued = items.filter((i) => i.status === "queued" || i.status === "error").length;
  const done = items.filter((i) => i.status === "done").length;
  const allDone = items.length > 0 && done === items.length;

  const addBatch = (files: File[]) => {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (pairSides) {
      const cards: { front: File; back?: File }[] = [];
      for (let i = 0; i < sorted.length; i += 2) cards.push({ front: sorted[i], back: sorted[i + 1] });
      add(cards);
    } else {
      add(sorted.map((front) => ({ front })));
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="single">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="single">One card</TabsTrigger>
          <TabsTrigger value="batch">Many cards</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="pt-4">
          <SingleCard onReady={(card) => addAndUpload([card])} />
        </TabsContent>
        <TabsContent value="batch" className="space-y-4 pt-4">
          <Dropzone onFiles={addBatch} />
          <div className="flex items-center gap-3">
            <Switch id="pair" checked={pairSides} onCheckedChange={setPairSides} />
            <Label htmlFor="pair" className="text-sm font-normal">
              Cards have a back: pair photos in order (1st front, 2nd back, …)
            </Label>
          </div>
          {queued > 0 && (
            <Button size="lg" className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto" disabled={running} onClick={start}>
              {running ? <Spinner /> : <UploadCloudIcon />}
              Upload {queued} {queued === 1 ? "card" : "cards"}
            </Button>
          )}
        </TabsContent>
      </Tabs>

      {items.length > 0 && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {done} of {items.length} uploaded{allDone ? ". They're being read now." : ""}
              </p>
              <div className="flex gap-2">
                {allDone && (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Clear
                  </Button>
                )}
                {done > 0 && (
                  <Button asChild size="sm">
                    <Link href="/review">
                      <InboxIcon /> Review cards
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <UploadList items={items} onRemove={remove} />
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {remaining} scans left this month · Photos are encrypted before they&apos;re stored.
      </p>
    </div>
  );
}
