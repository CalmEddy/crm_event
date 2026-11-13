/** Detect Postgres unique violations, including drizzle-wrapped errors. */
export function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message =
    "message" in error ? String((error as { message?: unknown }).message) : "";
  const cause =
    "cause" in error && error.cause && typeof error.cause === "object"
      ? (error.cause as {
          code?: unknown;
          message?: unknown;
          constraint?: unknown;
        })
      : null;
  const causeCode = cause?.code != null ? String(cause.code) : "";
  const causeMessage = cause?.message != null ? String(cause.message) : "";
  const constraint =
    cause?.constraint != null ? String(cause.constraint) : "";
  return (
    code === "23505" ||
    causeCode === "23505" ||
    constraint === "users_email_idx" ||
    message.includes("users_email_idx") ||
    causeMessage.includes("users_email_idx") ||
    message.toLowerCase().includes("duplicate key") ||
    causeMessage.toLowerCase().includes("duplicate key")
  );
}
