/** Transient storage for the short-lived, single-purpose challenge token passed
 * between login steps (password-change-required / mfa-enrollment-required /
 * mfa-required). sessionStorage, not localStorage — cleared when the tab closes,
 * and these tokens are already short-TTL and single-purpose server-side. */
const KEY = "scv_challenge_token";

export function setChallengeToken(token: string): void {
  sessionStorage.setItem(KEY, token);
}

export function getChallengeToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearChallengeToken(): void {
  sessionStorage.removeItem(KEY);
}
