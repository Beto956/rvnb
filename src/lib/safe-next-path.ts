/**
 * Validate an internal "return to" path used after sign-in.
 *
 * Only same-origin, absolute-path URLs are allowed. Anything that could be
 * interpreted by a browser as an external/protocol-relative/authority URL is
 * rejected and `fallback` is returned instead. This prevents open-redirect
 * abuse via the `?next=` parameter.
 *
 * Rejected examples:
 *   - "https://evil.com"          (no leading single slash)
 *   - "//evil.com"                (protocol-relative)
 *   - "/\\evil.com" or "/\/evil"  (backslash -> browser normalizes to "//")
 *   - "/%2f%2fevil.com"           (encoded protocol-relative)
 *   - control characters / whitespace tricks
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/listings"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const value = raw.trim();
  // Must begin with exactly one forward slash.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  // Reject backslashes anywhere (browsers treat "\" as "/" in URLs, enabling "//host").
  if (value.includes("\\")) return fallback;
  // Reject any percent-encoded slash/backslash or control chars that could smuggle "//".
  if (/%[0-9a-f]{2}/i.test(value)) {
    const decoded = (() => { try { return decodeURIComponent(value); } catch { return ""; } })();
    if (!decoded || decoded.includes("\\") || decoded.startsWith("//") || !decoded.startsWith("/")) return fallback;
  }
  // Reject ASCII control characters and spaces embedded in the path.
  if (/[\x00-\x1f\x7f]/.test(value)) return fallback;
  return value;
}
