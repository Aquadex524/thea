/** True when the request carries the share token (or no token is configured, e.g. local dev). */
export function isAuthorized(req: Request): boolean {
  const token = process.env.THEA_SHARE_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}
