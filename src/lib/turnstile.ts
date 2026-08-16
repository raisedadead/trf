export const TURNSTILE_TEST_SITEKEY = "1x00000000000000000000AA";

export const TURNSTILE_ACTION = "waitlist_signup";

export function resolveSitekey(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error(
      "PUBLIC_TURNSTILE_SITEKEY is unset. Set it in the build environment — an unset value used to bake in Cloudflare's always-pass test sitekey, which made the Worker reject every signup.",
    );
  }
  return value;
}

export function getSitekey(): string {
  return resolveSitekey(import.meta.env.PUBLIC_TURNSTILE_SITEKEY);
}
