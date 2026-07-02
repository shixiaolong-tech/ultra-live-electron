/**
 * Default timeout (in seconds) for outbound co-host connection invitations.
 * Used as the `timeoutSec` value in IPC `requestConnection` payloads sent
 * from the child window back to the main window's `CoHostButton.vue`,
 * which in turn forwards it to `requestHostConnection({ timeout, ... })`
 * and mirrors it into `extensionInfo.timeout` so the invitee shows a
 * matching countdown.
 *
 * Mirrors `COHOST_REQUEST_TIMEOUT_SECONDS` in the kit's CoHostPanel.
 */
export const COHOST_REQUEST_TIMEOUT_SECONDS = 30;

/**
 * Default timeout (in seconds) for outbound battle (PK) invitations sent
 * over IPC `requestBattle` payloads. Kept as a separate constant from
 * `COHOST_REQUEST_TIMEOUT_SECONDS` so the two flows can diverge later
 * without affecting each other.
 *
 * Mirrors `BATTLE_REQUEST_TIMEOUT_SECONDS` in the kit's CoHostPanel.
 */
export const BATTLE_REQUEST_TIMEOUT_SECONDS = 30;
