"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "./graphql/errors";

/** The field an API validation error points at, or null. */
export function errorField(error: unknown): string | null {
  if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
    const field = error.details.field;
    return typeof field === "string" ? field : null;
  }
  return null;
}

/** Turns an error from the API into text in the current language. */
export function useApiErrorText() {
  const t = useTranslations("errors");
  const tf = useTranslations("fields");
  return (error: unknown): string => {
    if (!(error instanceof ApiError)) return t("UNKNOWN");
    const field = errorField(error);
    if (field && tf.has(field)) {
      return t("VALIDATION_FIELD", { field: tf(field) });
    }
    return t.has(error.code) ? t(error.code) : t("UNKNOWN");
  };
}
