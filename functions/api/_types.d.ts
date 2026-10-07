export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  /** Optional ntfy.sh topic for new-pin push notifications. */
  NTFY_TOPIC?: string;
  /** Optional address shown on the landing page for people who want to try this instance. */
  CONTACT_EMAIL?: string;
}
