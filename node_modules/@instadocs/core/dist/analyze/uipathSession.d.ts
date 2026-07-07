export interface UiPathSession {
    token?: string;
    /** Cloud base, e.g. https://cloud.uipath.com (or a staging/alpha host). */
    baseHost?: string;
    /** Organization LOGICAL NAME (e.g. "my-org") — used in the gateway URL path. */
    organization?: string;
    /** Tenant name (e.g. "DefaultTenant"). */
    tenant?: string;
}
/**
 * Resolve the UiPath session: prefer explicit environment variables, then the
 * `uip` CLI's `.auth` file. Returns whatever pieces are available.
 */
export declare function resolveUiPathSession(): UiPathSession;
/**
 * Proactively refresh the signed-in `uip` session token by invoking
 * `uip login refresh`, then re-read the session. Best-effort: returns the
 * refreshed session on success, or undefined if the CLI is unavailable / not
 * logged in. The token is never printed (stdout is discarded).
 */
export declare function refreshUiPathSession(): UiPathSession | undefined;
