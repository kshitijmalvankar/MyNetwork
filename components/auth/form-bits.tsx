"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircleIcon, CheckCircle2Icon, EyeIcon, EyeOffIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={cn("h-10 w-full", className)}>
      {pending && <Spinner />}
      {children}
    </Button>
  );
}

export function PasswordInput({
  id,
  name = "password",
  autoComplete,
  invalid,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup className="h-10">
      <InputGroupInput
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        aria-invalid={invalid || undefined}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function Errors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <FieldError errors={errors.map((message) => ({ message }))} />;
}

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <Alert variant={ok ? "default" : "destructive"} className={cn(ok && "border-success/30 text-foreground")}>
      {ok ? <CheckCircle2Icon className="text-success" /> : <AlertCircleIcon />}
      <AlertDescription className={cn(ok && "text-foreground")}>{message}</AlertDescription>
    </Alert>
  );
}
