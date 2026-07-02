// Pure leaf module for shared constants.
//
// Same rationale as `../Notification/constants.ts`: keeping the container id
// in a leaf module avoids a circular dependency between the barrel (`index.ts`)
// and the child SFCs, which can otherwise trigger cross-chunk TDZ errors after
// the demo's secondary bundling.
//
// Do NOT move this constant back into `index.ts`.
export const MESSAGE_TOAST_CONTAINER_ID = 'message-toast-container'
