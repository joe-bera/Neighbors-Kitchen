/**
 * Returns `value` when it is a path inside this app (like "/account?tab=orders"),
 * otherwise `fallback`. Stops a crafted link such as /login?redirect=https://evil.example
 * from sending people to another site after they log in.
 */
export function getSafeRedirect(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  return value
}
