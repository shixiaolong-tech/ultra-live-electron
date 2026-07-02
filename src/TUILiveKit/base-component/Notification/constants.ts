// Pure leaf module for shared constants.
//
// Why this file exists:
// `index.ts` is a barrel that imports `./Notification.vue`, while
// `Notification.vue` originally imported `NOTIFICATION_CONTAINER_ID` back
// from `./index`. That forms a circular dependency between the barrel and
// its child SFC. After the demo's secondary bundling re-splits chunks,
// the cross-chunk evaluation order is no longer guaranteed, which can
// trigger TDZ errors like:
//   Uncaught ReferenceError: Cannot access 'X' before initialization
//
// To prevent this class of issues, every constant that the child SFC
// needs to read back from the barrel must live in this leaf file. The
// barrel re-exports it, so the public API is unchanged.
//
// Do NOT move these constants back into `index.ts`.
export const NOTIFICATION_CONTAINER_ID = 'notification-container'
