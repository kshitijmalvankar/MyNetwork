"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { editContact } from "@/app/(app)/contacts/actions";
import { ListEditor } from "@/components/review/list-editor";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ROLE_FAMILIES, SENIORITIES, type RoleFamily, type Seniority } from "@/lib/ai/card-schema";
import type { ContactDetail } from "@/lib/contacts/queries";

export function EditContactSheet({ contact }: { contact: ContactDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const initial = () => ({
    fullName: contact.fullName,
    nameNative: contact.nameNative ?? "",
    title: contact.title ?? "",
    company: contact.company?.name ?? "",
    industry: contact.company?.industry ?? "",
    industryOverride: contact.industryOverride ?? "",
    emails: contact.emails,
    phones: contact.phones,
    website: contact.website ?? "",
    address: contact.address ?? "",
    city: contact.city ?? "",
    country: contact.country ?? "",
    roleFamily: (contact.roleFamily ?? "Other") as RoleFamily,
    seniority: (contact.seniority ?? "Mid") as Seniority,
  });
  const [form, setForm] = useState(initial);
  const set = <K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () =>
    startTransition(async () => {
      const res = await editContact(contact.id, {
        ...form,
        emails: form.emails.filter((e) => e.trim()),
        phones: form.phones.filter((p) => p.trim()),
        country: form.country.toUpperCase(),
        // The old company's industry only applies if the company is unchanged.
        industry: form.company.trim() === (contact.company?.name ?? "") ? form.industry : "",
      });
      if (!res.ok) return void toast.error(res.message);
      toast.success("Saved");
      setOpen(false);
      router.refresh();
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(initial());
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline">
          <PencilIcon /> Edit
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit contact</SheetTitle>
          <SheetDescription>Changing the company keeps the old job in their history.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="e-name">Name</FieldLabel>
              <Input id="e-name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-native">Name as written</FieldLabel>
              <Input id="e-native" value={form.nameNative} onChange={(e) => set("nameNative", e.target.value)} className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-title">Job title</FieldLabel>
              <Input id="e-title" value={form.title} onChange={(e) => set("title", e.target.value)} className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-company">Company</FieldLabel>
              <Input id="e-company" value={form.company} onChange={(e) => set("company", e.target.value)} className="h-10" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="e-role">Role</FieldLabel>
                <Select value={form.roleFamily} onValueChange={(v) => set("roleFamily", v as RoleFamily)}>
                  <SelectTrigger id="e-role" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_FAMILIES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="e-seniority">Seniority</FieldLabel>
                <Select value={form.seniority} onValueChange={(v) => set("seniority", v as Seniority)}>
                  <SelectTrigger id="e-seniority" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIORITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="e-industry">Industry (this person)</FieldLabel>
              <Input
                id="e-industry"
                value={form.industryOverride}
                placeholder={form.industry || "Same as company"}
                onChange={(e) => set("industryOverride", e.target.value)}
                className="h-10"
              />
            </Field>
            <FieldSeparator />
            <Field>
              <FieldLabel htmlFor="e-email">Email</FieldLabel>
              <ListEditor id="e-email" type="email" values={form.emails} onChange={(v) => set("emails", v)} addLabel="Add email" placeholder="name@company.com" />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-phone">Phone</FieldLabel>
              <ListEditor id="e-phone" type="tel" values={form.phones} onChange={(v) => set("phones", v)} addLabel="Add phone" placeholder="+1 555 0100" />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-website">Website</FieldLabel>
              <Input id="e-website" value={form.website} onChange={(e) => set("website", e.target.value)} className="h-10" inputMode="url" />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-address">Address</FieldLabel>
              <Input id="e-address" value={form.address} onChange={(e) => set("address", e.target.value)} className="h-10" />
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-4">
              <Field>
                <FieldLabel htmlFor="e-city">City</FieldLabel>
                <Input id="e-city" value={form.city} onChange={(e) => set("city", e.target.value)} className="h-10" />
              </Field>
              <Field>
                <FieldLabel htmlFor="e-country">Country</FieldLabel>
                <Input id="e-country" value={form.country} maxLength={2} onChange={(e) => set("country", e.target.value.toUpperCase())} className="h-10 uppercase" />
              </Field>
            </div>
          </FieldGroup>
        </div>
        <SheetFooter className="border-t">
          <Button onClick={save} disabled={pending || !form.fullName.trim()} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {pending && <Spinner />} Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
