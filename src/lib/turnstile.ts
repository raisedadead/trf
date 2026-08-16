export const TURNSTILE_TEST_SITEKEY = "1x00000000000000000000AA";

export const TURNSTILE_ACTION = "waitlist_signup";

export function resolveSitekey(value: string | undefined, allowTestKey: boolean): string {
  if (value === undefined || value.length === 0) {
    throw new Error(
      "PUBLIC_TURNSTILE_SITEKEY is unset. Set it in the build environment — an unset value used to bake in Cloudflare's always-pass test sitekey, which made the Worker reject every signup.",
    );
  }
  if (value === TURNSTILE_TEST_SITEKEY && !allowTestKey) {
    throw new Error(
      "PUBLIC_TURNSTILE_SITEKEY is Cloudflare's always-pass test sitekey. A deployed build that uses it rejects every signup, because the Worker verifies tokens with the real secret. Set PUBLIC_ALLOW_TEST_SITEKEY=true for a local preview or a CI build.",
    );
  }
  return value;
}

export function getSitekey(): string {
  return resolveSitekey(
    import.meta.env.PUBLIC_TURNSTILE_SITEKEY,
    import.meta.env.PUBLIC_ALLOW_TEST_SITEKEY === "true",
  );
}
