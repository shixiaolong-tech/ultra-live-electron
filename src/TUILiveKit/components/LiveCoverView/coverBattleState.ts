/**
 * Cover-window battle / co-host state.
 *
 * The cover window is a separate Electron BrowserWindow that does not have
 * any atomicx state of its own, so it cannot consume `useBattleState` /
 * `useLiveSeatState` / `useCoHostState` directly. Instead, the main window
 * aggregates the relevant slice of those states into a `BattleStateSnapshot`
 * and forwards it via `IPCMessageType.SYNC_BATTLE_STATE`. This module owns
 * a single reactive snapshot ref and the IPC subscription that keeps it in
 * sync, and exposes a few derived computeds that mirror the kit's
 * `BattleDecorate` / `BattleUserDecorate` gating logic 1:1.
 *
 * The snapshot itself is exposed read-only; cover components must not mutate
 * it because the source of truth always lives on the main window.
 */
import { ref, computed, readonly, type Ref } from 'vue';
import { ipcBridge } from '../../ipc/IPCBridge';
import { IPCMessageType, BattleStateSnapshot } from '../../ipc';

const EMPTY_SNAPSHOT: BattleStateSnapshot = {
  battleId: '',
  battleDuration: 0,
  startTime: 0,
  battleUsers: [],
  battleScore: [],
  layoutTemplate: 0,
  connectedSeatCount: 0,
  connectedHostCount: 0,
  battleEndedNormally: false,
};

/** Singleton snapshot ref shared by all cover components. */
const snapshot: Ref<BattleStateSnapshot> = ref({ ...EMPTY_SNAPSHOT });

const handleSyncBattleState = (payload: BattleStateSnapshot) => {
  // Defensive normalization: structured-clone may turn arrays into proxies on
  // some Electron versions; spread/copy ensures predictable reactivity.
  snapshot.value = {
    battleId: payload?.battleId || '',
    battleDuration: payload?.battleDuration || 0,
    startTime: payload?.startTime || 0,
    battleUsers: Array.isArray(payload?.battleUsers) ? payload.battleUsers.slice() : [],
    battleScore: Array.isArray(payload?.battleScore)
      ? (payload.battleScore.map(item => [item[0], item[1]]) as Array<[string, number]>)
      : [],
    layoutTemplate: payload?.layoutTemplate ?? 0,
    connectedSeatCount: payload?.connectedSeatCount || 0,
    connectedHostCount: payload?.connectedHostCount || 0,
    battleEndedNormally: payload?.battleEndedNormally === true,
  };
};

// Eagerly attach the IPC listener at module load.
//
// Why eager: the cover window's main entry imports this module before any
// Vue component mounts. If we deferred attachment until the first
// `useCoverBattleState()` call (composable lazy-attach pattern), any
// `SYNC_BATTLE_STATE` frame the main window pushes between cover ready and
// the first child component setup would be silently dropped. Eager attach
// closes that race.
//
// The cover window's lifetime equals this module's lifetime in production
// (Electron BrowserWindow), so there is no need for unsubscribe in normal
// teardown. The HMR dispose hook below handles dev-time module replacement.
ipcBridge.on(IPCMessageType.SYNC_BATTLE_STATE, handleSyncBattleState);

// HMR cleanup: when this module is hot-replaced during dev (Webpack HMR via
// Vue CLI), detach the listener registered above so the OLD module instance
// stops receiving snapshots. Without this, every save would leak another
// handler onto `ipcBridge.handlers[SYNC_BATTLE_STATE]`, eventually causing
// duplicate snapshot writes and console noise.
//
// `module.hot` is provided by Webpack at runtime; we use a minimal local
// type assertion here because `@types/webpack-env` is referenced from
// `tsconfig.json` but not actually installed in this demo's node_modules.
// The optional chaining keeps this a no-op in the production bundle where
// Webpack strips `module.hot` to undefined.
type WebpackHotModule = { hot?: { dispose(cb: () => void): void } };
(module as unknown as WebpackHotModule).hot?.dispose(() => {
  ipcBridge.off(IPCMessageType.SYNC_BATTLE_STATE, handleSyncBattleState);
});

// Module-level derived refs. These are created ONCE at module load and shared
// across every `useCoverBattleState()` call, mirroring the singleton style of
// kit's `useBattleState()` / `useCoHostState()`. Without this, each consumer
// component would build its own private chain of `computed`s on top of the
// same `snapshot`, which is wasteful and obscures the singleton intent.
//
// `readonly()` is applied here to the writable `snapshot` ref so consumers
// cannot mutate it; the four computeds below are inherently read-only refs
// (Vue warns on `.value = ...`) and don't need an extra `readonly()` wrap.
const snapshotReadonly = readonly(snapshot) as Readonly<Ref<BattleStateSnapshot>>;
const battleId: Readonly<Ref<string>> = computed(() => snapshot.value.battleId);
const layoutTemplate: Readonly<Ref<number>> = computed(() => snapshot.value.layoutTemplate);
const battleScoreMap: Readonly<Ref<Map<string, number>>> = computed(
  () => new Map<string, number>(snapshot.value.battleScore),
);
const scoreRanking: Readonly<Ref<number[]>> = computed(
  () => snapshot.value.battleScore.map(([, score]) => score).sort((a, b) => b - a),
);

export interface UseCoverBattleStateReturn {
  /** Read-only snapshot ref. */
  snapshot: Readonly<Ref<BattleStateSnapshot>>;
  /** Derived: current battleId (empty string when no battle is active). */
  battleId: Readonly<Ref<string>>;
  /** Derived: layoutTemplate of currentLive. */
  layoutTemplate: Readonly<Ref<number>>;
  /**
   * Derived: live `Map<userId, score>` rebuilt from the serialized snapshot.
   * Cover components should treat this as read-only.
   */
  battleScoreMap: Readonly<Ref<Map<string, number>>>;
  /** Derived: descending list of battle scores, used to compute ranking. */
  scoreRanking: Readonly<Ref<number[]>>;
}

/**
 * Composable that exposes the cover-window battle snapshot.
 *
 * The IPC subscription is set up eagerly at module load (see top of file),
 * so this function is purely a thin accessor around module-level singletons.
 * Components don't need to manage their own subscription.
 */
export function useCoverBattleState(): UseCoverBattleStateReturn {
  return {
    snapshot: snapshotReadonly,
    battleId,
    layoutTemplate,
    battleScoreMap,
    scoreRanking,
  };
}
