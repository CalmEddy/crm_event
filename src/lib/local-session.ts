/**
 * Local servers have no Cursor sign-in, so the browser says which staff
 * member it is with this cookie (set on /sign-in). It is read only for the
 * simulated viewer, which a published app never produces.
 */
export const LOCAL_USER_COOKIE = "greenroom_local_user";

/** The staff id in the cookie's value, or null when nobody has been chosen. */
export function parseLocalUserId(value: string | undefined): number | null {
  return value && /^\d+$/.test(value) ? Number(value) : null;
}
