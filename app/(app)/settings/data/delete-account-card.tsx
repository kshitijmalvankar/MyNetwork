"use client";

import { startTransition, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Errors, FormMessage } from "@/components/auth/form-bits";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { needsStepUp, useStepUp } from "@/components/security/step-up";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DELETE_CONFIRMATION } from "@/lib/account/confirm";
import { deleteAccount } from "../actions";

export function DeleteAccountCard() {
  const { withStepUp, expire } = useStepUp();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useAuthAction(async (prev, formData) => {
    const res = await deleteAccount(prev, formData);
    if (needsStepUp(res)) {
      expire();
      setOpen(false);
      toast.error("Please confirm it's you again, then try once more.");
    }
    return res;
  });
  const confirmed = typed.trim().toLowerCase() === DELETE_CONFIRMATION;

  return (
    <Card className="ring-destructive/25">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently deletes your account and everything in it: contacts, notes, voice notes, card photos, chats and
          settings. This can&apos;t be undone, so download your contacts first if you want to keep them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={() =>
            withStepUp(() => {
              setTyped("");
              setOpen(true);
            })
          }
        >
          <Trash2Icon /> Delete account
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              startTransition(() => action(formData));
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything is deleted straight away and you&apos;ll be signed out. Encrypted copies in our database
                backups are removed as those backups expire, within 30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <FormMessage message={needsStepUp(state) ? undefined : state.message} />
            <Field data-invalid={Boolean(state.fieldErrors?.confirm) || undefined}>
              <FieldLabel htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold">{DELETE_CONFIRMATION}</span> to confirm
              </FieldLabel>
              <Input
                id="delete-confirm"
                name="confirm"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.confirm) || undefined}
              />
              <Errors errors={state.fieldErrors?.confirm} />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
                {pending && <Spinner />} Delete everything
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
