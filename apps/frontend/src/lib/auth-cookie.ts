const COOKIE_NAME = 'reconcile_token';

export function setAuthCookie(token: string): void {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
