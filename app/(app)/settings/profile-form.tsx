"use client";

import { useMemo } from "react";
import { Errors, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { SearchableSelect } from "@/components/searchable-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfile } from "./actions";

function regionOptions() {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const codes: string[] = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) codes.push(String.fromCharCode(a, b));
  return codes
    .map((code) => {
      try {
        const label = names.of(code);
        return label && label !== code ? { value: code, label, hint: code } : null;
      } catch {
        return null;
      }
    })
    .filter((o): o is { value: string; label: string; hint: string } => o !== null)
    .sort((x, y) => x.label.localeCompare(y.label));
}

export function ProfileForm(props: { email: string; displayName: string; timezone: string; phoneRegion: string }) {
  const [state, action] = useAuthAction(updateProfile);
  const errors = state.fieldErrors ?? {};
  const timezones = useMemo(
    () => ["UTC", ...Intl.supportedValuesOf("timeZone")].map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") })),
    [],
  );
  const regions = useMemo(() => regionOptions(), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Signed in as {props.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup className="max-w-md">
            <FormMessage ok={state.ok} message={state.message} />
            <Field data-invalid={Boolean(errors.displayName) || undefined}>
              <FieldLabel htmlFor="displayName">Name</FieldLabel>
              <Input id="displayName" name="displayName" defaultValue={props.displayName} className="h-10" autoComplete="name" />
              <Errors errors={errors.displayName} />
            </Field>
            <Field data-invalid={Boolean(errors.timezone) || undefined}>
              <FieldLabel htmlFor="timezone">Time zone</FieldLabel>
              <SearchableSelect id="timezone" name="timezone" options={timezones} defaultValue={props.timezone} searchPlaceholder="Search time zones…" />
              <FieldDescription>Used for reminder times.</FieldDescription>
              <Errors errors={errors.timezone} />
            </Field>
            <Field data-invalid={Boolean(errors.phoneRegion) || undefined}>
              <FieldLabel htmlFor="phoneRegion">Home country</FieldLabel>
              <SearchableSelect id="phoneRegion" name="phoneRegion" options={regions} defaultValue={props.phoneRegion} searchPlaceholder="Search countries…" />
              <FieldDescription>Phone numbers on cards without a country code are read as local to this country.</FieldDescription>
              <Errors errors={errors.phoneRegion} />
            </Field>
            <SubmitButton className="w-fit px-5">Save changes</SubmitButton>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
