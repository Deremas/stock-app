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
};

export function FormFeedback<TFieldValues extends FieldValues>({
  errors,
  submitError,
  showValidationSummary = false,
}: FormFeedbackProps<TFieldValues>) {
  const validationMessages = showValidationSummary
    ? getFormErrorMessages(errors)
    : [];

  if (!submitError && validationMessages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}
      {validationMessages.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">Check the missing or invalid details below.</p>
              <ul className="list-disc space-y-1 pl-4">
                {validationMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
