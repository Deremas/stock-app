"use client";

import { AlertCircle } from "lucide-react";
import type { FieldErrors, FieldValues } from "react-hook-form";

function collectMessages(
  value: unknown,
  messages: Set<string>,
) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  ) {
    const message = (value as { message: string }).message.trim();

    if (message) {
      messages.add(message);
    }
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectMessages(item, messages));
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    if (key === "message" || key === "ref" || key === "type") {
      return;
    }

    collectMessages(nested, messages);
  });
}

export function getFormErrorMessages<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
) {
  const messages = new Set<string>();
  collectMessages(errors, messages);
  return [...messages];
}

type FormFeedbackProps<TFieldValues extends FieldValues> = {
  errors: FieldErrors<TFieldValues>;
  submitError?: string | null;
  showValidationSummary?: boolean;
  success?: {
    title: string;
    message: string;
    nextSteps?: { label: string; href: string; icon?: typeof AlertCircle }[];
  } | null;
};

export function FormFeedback<TFieldValues extends FieldValues>({
  errors,
  submitError,
  showValidationSummary = false,
  success,
}: FormFeedbackProps<TFieldValues>) {
  const validationMessages = showValidationSummary
    ? getFormErrorMessages(errors)
    : [];

  if (success) {
    return (
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="mb-2 text-lg font-bold tracking-tight text-foreground">
          {success.title}
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {success.message}
        </p>
        {success.nextSteps ? (
          <div className="flex flex-wrap justify-center gap-3">
            {success.nextSteps.map((step) => (
              <a
                key={step.href}
                href={step.href}
                className="inline-flex h-9 items-center justify-center rounded-full bg-background px-4 text-xs font-bold shadow-sm ring-1 ring-border transition hover:bg-accent hover:text-accent-foreground"
              >
                {step.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (!submitError && validationMessages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </div>
      ) : null}
      {validationMessages.length > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div className="space-y-3">
              <p className="text-base font-bold tracking-tight">
                Please fix the missing fields to continue.
              </p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {validationMessages.map((message) => (
                  <li key={message} className="flex items-center gap-2 text-xs font-medium text-amber-800/80">
                    <span className="h-1 w-1 rounded-full bg-amber-400" />
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
