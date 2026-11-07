// The free trial a restaurant starts by signing itself up (lib/signup.ts):
// every feature, but TRIAL_TABLES tables and TRIAL_STAFF logins besides the
// manager, for TRIAL_DAYS. A restaurant is on trial while it has a trial end
// date and no contract; adding a contract ends the trial for good.
// No database here: the staff screens' client code imports this file.

export const TRIAL_DAYS = 7;
export const TRIAL_TABLES = 1;
/** Staff logins a trial may add besides the manager who signed up. */
export const TRIAL_STAFF = 2;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** The shortest password an owner may pick at sign-up or reset. (Staff passwords, set by their manager: MIN_PASSWORD.) */
export const OWNER_MIN_PASSWORD = 8;

/** Where an ended trial's manager can message us. Empty until tapndine's Facebook Page is up; the button hides meanwhile. */
export const MESSENGER_URL = "";

/** SQL, true while the restaurant aliased `b` is on trial (ended or not). */
export const ON_TRIAL = `(b.trial_ends_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.business_id = b.id))`;
/** SQL, true when the restaurant aliased `b` may serve guests: switched on, and not a trial that has ended. */
export const SERVING = `(b.disabled_at IS NULL AND NOT (${ON_TRIAL} AND b.trial_ends_at <= CAST(strftime('%s', 'now') AS INTEGER) * 1000))`;

/** Whole days left, counting today: 7 on the day of sign-up, 1 on the last day, 0 once over. */
export const daysLeft = (endsAt: number, now = Date.now()) => Math.max(0, Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000)));
