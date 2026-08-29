const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
export const WAITLIST_SOURCES = ["subscribe", "landing", "footer"] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];
const DEFAULT_WAITLIST_SOURCE: WaitlistSource = "subscribe";

export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;

export type WaitlistResult =
  | { ok: true; value: { name: string; email: string; source: WaitlistSource } }
  | { ok: false; errors: string[] };

function toSource(value: unknown): WaitlistSource {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (WAITLIST_SOURCES as readonly string[]).includes(raw)
    ? (raw as WaitlistSource)
    : DEFAULT_WAITLIST_SOURCE;
}

export function validateWaitlist(body: unknown): WaitlistResult {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) return { ok: false, errors: ["body"] };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) errors.push("name");

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH) errors.push("email");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, source: toSource(b.source) } };
}
