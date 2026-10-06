/**
 * automationAuth.ts — the token-check decision for the automation API
 * (Stream Deck/Companion). Pure: webRemote.ts reads the actual header/query
 * param off the real request and the configured token off settings, and
 * hands them here rather than embedding this logic inline where it can't be
 * unit-tested without a real IncomingMessage.
 */

/** No configured token means the endpoint is open — same zero-friction
 *  default the phone remote's own /command endpoint has always had. Once a
 *  token is set, either the header or the query param matching it is
 *  enough (a macro pad's WebSocket feedback config is commonly
 *  query-string-only, so both have to work). */
export function automationRequestAuthorized(
  configuredToken: string | null,
  suppliedHeaderToken: string | undefined,
  suppliedQueryToken: string | null
): boolean {
  if (!configuredToken) return true
  return suppliedHeaderToken === configuredToken || suppliedQueryToken === configuredToken
}
