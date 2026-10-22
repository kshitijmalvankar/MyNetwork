"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, KeyRoundIcon, PlusIcon, ShieldAlertIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Errors, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { OtpField } from "@/components/auth/otp-field";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { formatInstant } from "@/lib/dates";
import { confirmTotpEnrollment, removeTotpFactor, startTotpEnrollment } from "../actions";
import { needsStepUp, useStepUp } from "@/components/security/step-up";

type Factor = { id: string; name: string; createdAt: string };
type Enrollment = { factorId: string; qrCode: string; secret: string };

export function TwoFactorCard({ factors }: { factors: Factor[] }) {
  const router = useRouter();
  const { withStepUp, expire } = useStepUp();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [starting, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  const begin = () =>
    withStepUp(() =>
      startTransition(async () => {
        const name = factors.length === 0 ? "Phone" : `Backup ${factors.length}`;
        const res = await startTotpEnrollment(name);
        if (res.ok) setEnrollment(res);
        else {
          expire();
          toast.error(res.message);
        }
      }),
    );

  const remove = (factorId: string) =>
    withStepUp(async () => {
      setRemoving(factorId);
      const res = await removeTotpFactor(factorId);
      setRemoving(null);
      if (needsStepUp(res)) {
        expire();
        toast.error("Please confirm it's you again.");
      } else if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  const enabled = factors.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-factor authentication
          {enabled ? (
            <Badge className="bg-success/15 text-success">On</Badge>
          ) : (
            <Badge variant="secondary">Off</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) when you sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors.map((f) => (
          <Item key={f.id} variant="outline">
            <ItemMedia variant="icon">
              <KeyRoundIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{f.name}</ItemTitle>
              <ItemDescription>Added {formatInstant(f.createdAt)}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="ghost" size="sm" onClick={() => remove(f.id)} disabled={removing === f.id}>
                {removing === f.id ? <Spinner /> : <Trash2Icon />} Remove
              </Button>
            </ItemActions>
          </Item>
        ))}

        {factors.length === 1 && (
          <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <span className="font-medium">Add a backup authenticator.</span> There are no recovery codes, so if you
              lose this phone you&apos;ll need a second device to sign in.
            </p>
          </div>
        )}

        <Button onClick={begin} disabled={starting} variant={enabled ? "outline" : "default"}>
          {starting ? <Spinner /> : enabled ? <PlusIcon /> : <ShieldCheckIcon />}
          {enabled ? "Add backup authenticator" : "Turn on two-factor"}
        </Button>
      </CardContent>

      <Dialog open={enrollment !== null} onOpenChange={(o) => !o && setEnrollment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan with your authenticator</DialogTitle>
            <DialogDescription>Then enter the 6-digit code it shows.</DialogDescription>
          </DialogHeader>
          {enrollment && (
            <EnrollForm
              enrollment={enrollment}
              onDone={() => {
                setEnrollment(null);
                toast.success("Two-factor authentication is on.");
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EnrollForm({ enrollment, onDone }: { enrollment: Enrollment; onDone: () => void }) {
  const [state, action] = useAuthAction(async (prev, formData) => {
    const res = await confirmTotpEnrollment(prev, formData);
    if (res.ok) onDone();
    return res;
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <FieldGroup>
        <FormMessage message={state.message} />
        <div className="mx-auto rounded-xl border bg-white p-3">
          {/* Supabase returns the QR code as an SVG data URI. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="QR code for your authenticator app" className="size-44" />
        </div>
        <Field>
          <FieldLabel htmlFor="totp-secret">Can&apos;t scan? Enter this key</FieldLabel>
          <div className="flex gap-2">
            <Input id="totp-secret" readOnly value={enrollment.secret} className="h-10 font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Copy key"
              onClick={() => navigator.clipboard.writeText(enrollment.secret).then(() => toast.success("Copied"))}
            >
              <CopyIcon />
            </Button>
          </div>
        </Field>
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <Field data-invalid={Boolean(errors.code) || undefined} className="items-center">
          <OtpField key={state.attempt} invalid={Boolean(errors.code)} />
          <Errors errors={errors.code} />
        </Field>
        <SubmitButton>Verify and turn on</SubmitButton>
      </FieldGroup>
    </form>
  );
}
