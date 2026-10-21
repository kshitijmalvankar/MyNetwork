"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { requestReindex } from "@/lib/knowledge/indexer";
import { rateLimit } from "@/lib/ratelimit";
import { toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export type EventResult = { ok: true; id?: string } | { ok: false; message: string };

const eventSchema = z.object({
  name: z.string().trim().min(1, "Give the event a name").max(200),
  startsOn: z.union([z.iso.date(), z.literal("")]).optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
});

export type EventInput = z.input<typeof eventSchema>;

async function prepare(input: EventInput, eventId: string) {
  const user = await requireUser();
  if (!(await rateLimit("edit", user.id)).success) return { error: "Slow down a little and try again." } as const;
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" } as const;
  const dek = parsed.data.description ? await getUserDataKey(user.id) : null;
  return {
    user,
    row: {
      name: parsed.data.name,
      starts_on: parsed.data.startsOn || null,
      location: parsed.data.location || null,
      description_enc:
        dek && parsed.data.description
          ? toBytea(sealField(dek, parsed.data.description, { userId: user.id, table: "events", column: "description_enc", rowId: eventId }))
          : null,
    },
  } as const;
}

async function contactsMetAt(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string) {
  const { data } = await supabase.from("interactions").select("contact_id").eq("event_id", eventId);
  return (data ?? []).map((i) => i.contact_id);
}

export async function createEvent(input: EventInput): Promise<EventResult> {
  const id = randomUUID();
  const prep = await prepare(input, id);
  if ("error" in prep) return { ok: false, message: prep.error! };
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({ id, user_id: prep.user.id, ...prep.row });
  if (error) return { ok: false, message: "Couldn't create the event." };
  await requestReindex(supabase, prep.user.id, { eventIds: [id] });
  revalidatePath("/events");
  return { ok: true, id };
}

export async function updateEvent(eventId: string, input: EventInput): Promise<EventResult> {
  if (!z.uuid().safeParse(eventId).success) return { ok: false, message: "Invalid event" };
  const prep = await prepare(input, eventId);
  if ("error" in prep) return { ok: false, message: prep.error! };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(prep.row).eq("id", eventId).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't save the event." };
  // People met there mention the event in their profile, so they change too.
  await requestReindex(supabase, prep.user.id, { eventIds: [eventId], contactIds: await contactsMetAt(supabase, eventId) });
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  return { ok: true, id: eventId };
}

export async function deleteEvent(eventId: string): Promise<EventResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const metThere = await contactsMetAt(supabase, eventId);
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't delete the event." };
  await requestReindex(supabase, user.id, { contactIds: metThere });
  revalidatePath("/events");
  revalidatePath("/contacts");
  return { ok: true };
}
