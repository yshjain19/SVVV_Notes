/**
 * emailDomainBlock.js
 * -----------------------------------------------
 * Centralized blocked-email-domain enforcement.
 *
 * Configuration: Set BLOCKED_EMAIL_DOMAINS in your .env file as a
 * comma-separated list of exact lowercase domains, e.g.:
 *   BLOCKED_EMAIL_DOMAINS=liondapt.com,example.com
 *
 * The check is:
 *  - case-insensitive
 *  - exact domain match (not substring)
 *  - whitespace-trimmed
 *  - works for all auth flows: register, login, Google OAuth, password reset, OTP
 */

// Parse blocked domains from environment variable, defaulting to liondapt.com
const BLOCKED_EMAIL_DOMAINS = (process.env.BLOCKED_EMAIL_DOMAINS || "liondapt.com")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

/**
 * Returns true if the email's domain is on the blocklist.
 * @param {string} email - Raw email address (may be mixed case)
 * @returns {boolean}
 */
function isBlockedEmailDomain(email) {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex === -1) return false;
  const domain = normalized.slice(atIndex + 1);
  return BLOCKED_EMAIL_DOMAINS.includes(domain);
}

/**
 * Logs a security event when a blocked domain is used.
 * Logs only: event type, timestamp, normalized domain, request type.
 * Never logs passwords or tokens.
 * @param {string} email - The email that was attempted
 * @param {string} requestType - e.g. "register", "login", "google-oauth", "password-reset"
 */
function logBlockedDomainAttempt(email, requestType) {
  const normalized = (email || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  const domain = atIndex !== -1 ? normalized.slice(atIndex + 1) : "unknown";
  console.warn(
    `[SECURITY] BLOCKED_EMAIL_DOMAIN_ATTEMPT | event=BLOCKED_EMAIL_DOMAIN_ATTEMPT | type=${requestType} | domain=${domain} | timestamp=${new Date().toISOString()}`
  );
}

module.exports = { isBlockedEmailDomain, logBlockedDomainAttempt, BLOCKED_EMAIL_DOMAINS };
