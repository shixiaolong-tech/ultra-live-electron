<template>
  <!--
    PK overlay layer for the cover window. Mirrors the kit's BattleDecorate
    (`ui-component/packages/uikit-component-vue3-electron/src/components/LiveView/
     CoreViewDecorate/BattleDecorate.vue`) one-for-one in markup and gating, but
    the data source is the IPC-pushed snapshot instead of `useBattleState`.

    Outer wrapper is sized to the union bounding box of all seat regions so
    that the absolutely-positioned children (score bar, countdown badge,
    start animation, result animation) sit on top of the actual stream area
    rather than the entire cover window.
  -->
  <div
    v-if="showBattleDecorate"
    class="cover-battle-decorate"
    :style="wrapperStyle"
  >
    <div v-if="showPkBar" class="battle-score-container">
      <div
        v-for="(user, key) in battleUsers"
        :key="user.userId"
        class="battle-score-item"
        :style="battleStyle[user.userId]"
      >
        <span class="battle-score-value">{{ battleScoreMap.get(user.userId) || 0 }}</span>
        <div v-if="key === 1" class="battle-score-icon">
          <IconPK size="18" />
        </div>
      </div>
    </div>
    <div :class="['battle-time-container', { 'more-top': showPkBar }]">
      <div class="battle-time-background"></div>
      <div class="battle-time-content">
        <IconTime size="16" />
        <span class="battle-time">{{ time }}</span>
      </div>
    </div>
    <div
      v-if="showBattleStart"
      :class="['battle-start-container', { disappearing: showBattleStartDisappearAnimation }]"
    >
      <img :src="redBkgSvg" alt="red-bkg" class="red-bkg" />
      <img :src="blueBkgSvg" alt="blue-bkg" class="blue-bkg" />
      <img :src="vSvg" alt="v" class="letter-v" />
      <img :src="sSvg" alt="s" class="letter-s" />
    </div>
    <div :class="['battle-result-container', showBattleResult ? 'show' : '']">
      <img :src="battleResultImg" alt="battle-result" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, type Ref } from 'vue';
import { IconPK, IconTime, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { CoHostLayoutTemplate } from 'tuikit-atomicx-vue3-electron';
import type { TUIUserSeatStreamRegion } from '../../types';
import { useCoverBattleState } from './coverBattleState';
import defeatResult from '../../assets/battle/img/defeat.png';
import victoryResult from '../../assets/battle/img/victory.png';
import drawResult from '../../assets/battle/img/draw.png';
import redBkgSvg from '../../assets/battle/svg/redBkg.svg';
import blueBkgSvg from '../../assets/battle/svg/blueBkg.svg';
import vSvg from '../../assets/battle/svg/v.svg';
import sSvg from '../../assets/battle/svg/s.svg';

const props = defineProps<{
  /**
   * Seat stream regions reported by the main window through
   * `IPCMessageType.UPDATE_USER_ON_SEAT`. Each region's `rect` is in cover
   * window pixel coordinates, so we can use them as-is to size the wrapper.
   */
  seatRegions: Array<TUIUserSeatStreamRegion>;
  /**
   * Live owner userId. Used to determine victory / defeat / draw against the
   * battle score map, mirroring kit's `currentLive.value?.liveOwner.userId`.
   */
  liveOwnerUserId: string;
  /**
   * Current liveId. Empty when no live is running; we use it to clean up
   * lingering animations after the host ends the live.
   */
  liveId: string;
}>();

const { t } = useUIKit();
const { snapshot, battleId, layoutTemplate, battleScoreMap } = useCoverBattleState();

const battleUsers = computed(() => snapshot.value.battleUsers);

// Wrapper bounding box: union of all seat regions, in cover window pixels.
const wrapperRect = computed(() => {
  if (!props.seatRegions || props.seatRegions.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  for (const region of props.seatRegions) {
    const rect = region?.rect;
    if (!rect) continue;
    if (rect.left < minLeft) minLeft = rect.left;
    if (rect.top < minTop) minTop = rect.top;
    if (rect.right > maxRight) maxRight = rect.right;
    if (rect.bottom > maxBottom) maxBottom = rect.bottom;
  }
  if (minLeft === Infinity) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  return {
    left: minLeft,
    top: minTop,
    width: Math.max(0, maxRight - minLeft),
    height: Math.max(0, maxBottom - minTop),
  };
});

const wrapperStyle = computed(() => ({
  left: `${wrapperRect.value.left}px`,
  top: `${wrapperRect.value.top}px`,
  width: `${wrapperRect.value.width}px`,
  height: `${wrapperRect.value.height}px`,
}));

const showBattleDecorate = ref(false);
// Show PK bar only when exactly 2 hosts are battling on a layout that renders them side-by-side.
// - HostDynamicGrid (600): portrait grid, 2 of 9 seats occupied -> classic 1v1 PK
// - HostVideoLandscapeFixed2Seats (400): landscape 1v1, 2 fixed seats -> landscape PK
const showPkBar = computed(() => {
  const isSupportedLayout = layoutTemplate.value === CoHostLayoutTemplate.HostDynamicGrid
    || layoutTemplate.value === CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats;
  return isSupportedLayout
    && battleUsers.value.length === 2
    && snapshot.value.connectedSeatCount === 2;
});

const showBattleStart = ref(false);
const showBattleStartDisappearAnimation = ref(false);
const showBattleResult = ref(false);
const battleResultImg = ref(drawResult);

let battleStartHideTimer: ReturnType<typeof setTimeout> | null = null;
let battleStartFinishTimer: ReturnType<typeof setTimeout> | null = null;
let battleResultHideTimer: ReturnType<typeof setTimeout> | null = null;
let countdownTimer: ReturnType<typeof setTimeout> | null = null;

const clearBattleStartTimers = () => {
  if (battleStartHideTimer) {
    clearTimeout(battleStartHideTimer);
    battleStartHideTimer = null;
  }
  if (battleStartFinishTimer) {
    clearTimeout(battleStartFinishTimer);
    battleStartFinishTimer = null;
  }
};

const stopCountdown = () => {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
};

// `currentTime` is owned by `startCountdown()` / its self-rescheduling
// `setTimeout` chain (see `scheduleCountdownTick`): the `watch(battleId, ...)`
// below runs synchronously with `immediate: true` on setup and on every
// battle start, calling `startCountdown()` which sets `currentTime.value =
// Date.now()` before any template read. We therefore do NOT lazy-initialize
// it inside the `leftBattleTime` computed — keeping computeds pure
// side-effect-free is a Vue best-practice.
const currentTime = ref(0);

const leftBattleTime = computed(() => {
  if (!snapshot.value.battleId) return 0;
  return snapshot.value.battleDuration - (Math.floor(currentTime.value / 1000) - snapshot.value.startTime);
});

// Schedule the next countdown tick to land on the next absolute second
// boundary (i.e. when `Date.now() % 1000` becomes 0). Using a self-
// rescheduling setTimeout instead of `setInterval(1000)` self-corrects
// drift caused by event-loop jitter (e.g. SDK IPC bursts, GPU process
// hand-off): each tick computes its delay from the current wall-clock
// position, so a slow tick at t=1050ms re-aligns the next one at t=2000ms
// instead of accumulating offset. This also prevents the "skip-second"
// visual bug (e.g. 03:01 -> 02:58) where a single delayed tick crosses
// two second boundaries: even on a stalled event loop, every visible
// second still gets exactly one render frame because we never miss a
// boundary by more than the stall duration itself.
const scheduleCountdownTick = () => {
  const nextBoundaryDelay = 1000 - (Date.now() % 1000);
  countdownTimer = setTimeout(() => {
    currentTime.value = Date.now();
    scheduleCountdownTick();
  }, nextBoundaryDelay);
};

const startCountdown = () => {
  stopCountdown();
  currentTime.value = Date.now();
  scheduleCountdownTick();
};

const convertToTwoDigits = (value: number) => value.toString().padStart(2, '0');

// Local helper that mirrors the kit's `convertSecondsToHMS`. Inlined here
// because the demo utils module does not expose it.
function convertSecondsToHMS(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  const safeTotal = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeTotal / 3600);
  const minutes = Math.floor((safeTotal % 3600) / 60);
  const seconds = safeTotal % 60;
  return { hours, minutes, seconds };
}

const time = computed(() => {
  const { minutes, seconds } = convertSecondsToHMS(leftBattleTime.value);
  if (minutes <= 0 && seconds <= 0) {
    return t('LiveView.BattleEnded');
  }
  return `${convertToTwoDigits(minutes)}:${convertToTwoDigits(seconds)}`;
});

const battleStyle: Ref<Record<string, { width: string }>> = ref({});

// Recompute the proportional widths of the two score bars whenever the score
// map changes. Mirrors the kit's `watch(battleScore, ...)`.
watch(
  () => snapshot.value.battleScore,
  (entries) => {
    if (!entries) return;
    const totalScore = entries.reduce((acc, [, score]) => acc + score, 0) || 0;
    const next: Record<string, { width: string }> = {};
    for (const [userId, score] of entries) {
      next[userId] = {
        width: totalScore > 0 ? `${(score / totalScore) * 100}%` : '50%',
      };
    }
    battleStyle.value = next;
  },
  { immediate: true, deep: true },
);

// Maximum elapsed seconds since `snapshot.startTime` for which we still play
// the 2s "VS" intro animation. If cover joins later than this (typical
// Windows path: cover is a separate BrowserWindow that may mount or hot-
// reload while a PK is already in progress on the main window), we skip the
// intro and jump straight to the running state to avoid a jarring replay.
const PK_START_ANIMATION_GRACE_SECONDS = 5;

// Trigger PK start animation + countdown when battleId becomes non-empty,
// and clear lingering UI when liveId becomes empty.
watch(
  battleId,
  (newId, oldId) => {
    if (newId) {
      // A new battle is starting. Cancel any timer left over from the previous
      // battle's `handleBattleEndedLocally` (the 5s result-hide timer in
      // particular); otherwise that stale timer fires mid-battle and forces
      // `showBattleDecorate = false`, hiding THIS battle's decorate even though
      // the snapshot state is still correct. This is the root cause of
      // "PK animation / decorate disappears after rapid start -> accept ->
      // end PK cycles" on Windows, and mirrors the kit BattleDecorate fix.
      if (battleResultHideTimer) {
        clearTimeout(battleResultHideTimer);
        battleResultHideTimer = null;
      }
      showBattleResult.value = false;
      showBattleDecorate.value = true;
      startCountdown();

      // Decide whether this is a fresh PK start (play full intro) or a
      // mid-battle join (skip intro). `snapshot.startTime` is the SDK-
      // provided unix-second when the battle began on the server.
      const startTimeSec = snapshot.value.startTime || 0;
      const elapsedSec = startTimeSec > 0
        ? Math.floor(Date.now() / 1000) - startTimeSec
        : Infinity;
      const isFreshStart = elapsedSec <= PK_START_ANIMATION_GRACE_SECONDS;

      if (isFreshStart) {
        showBattleStart.value = true;
        showBattleStartDisappearAnimation.value = false;
        clearBattleStartTimers();
        battleStartHideTimer = setTimeout(() => {
          showBattleStartDisappearAnimation.value = true;
          battleStartFinishTimer = setTimeout(() => {
            showBattleStart.value = false;
            showBattleStartDisappearAnimation.value = false;
          }, 300);
        }, 2000);
      } else {
        // Mid-battle join: ensure no stale intro state leaks through.
        showBattleStart.value = false;
        showBattleStartDisappearAnimation.value = false;
        clearBattleStartTimers();
      }
      return;
    }
    // battleId went from non-empty to empty: a battle just tore down. Only play
    // the result animation when the main window flagged this as a genuine
    // `onBattleEnded` (countdown timeout / remaining members <= 1). For a 3+
    // host PK where THIS host actively quits, the state layer fires only
    // `onUserExitBattle` and `battleEndedNormally` stays false, so we skip the
    // animation — matching the Mac / Web kits, which animate solely on
    // `onBattleEnded`.
    if (oldId && snapshot.value.battleEndedNormally) {
      handleBattleEndedLocally();
    }
  },
  { immediate: true },
);

watch(
  () => props.liveId,
  (newLiveId, oldLiveId) => {
    if (oldLiveId && !newLiveId) {
      stopCountdown();
      clearBattleStartTimers();
      if (battleResultHideTimer) {
        clearTimeout(battleResultHideTimer);
        battleResultHideTimer = null;
      }
      showBattleDecorate.value = false;
      showBattleStart.value = false;
      showBattleStartDisappearAnimation.value = false;
      showBattleResult.value = false;
    }
  },
  { immediate: true },
);

// Cover does not subscribe to `BattleEvent.onBattleEnded` because it has no
// access to the kit's event bus. Instead the main window latches a
// `battleEndedNormally` flag when that event fires and ships it in the
// snapshot; the `watch(battleId)` above plays this animation only when
// `battleId` goes from non-empty to empty AND that flag is set. At that moment
// the score map still carries the final values pushed by the main window (the
// snapshot watcher coalesces all state changes within the same flush), so the
// result can be computed correctly without any cross-process event subscription.
function handleBattleEndedLocally() {
  stopCountdown();
  showBattleResult.value = true;
  const scores = [...battleScoreMap.value.values()];
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const minScore = scores.length ? Math.min(...scores) : 0;
  const selfScore = battleScoreMap.value.get(props.liveOwnerUserId) || 0;
  if (maxScore === minScore) {
    battleResultImg.value = drawResult;
  } else if (selfScore === maxScore) {
    battleResultImg.value = victoryResult;
  } else if (selfScore === minScore) {
    battleResultImg.value = defeatResult;
  }
  if (battleResultHideTimer) {
    clearTimeout(battleResultHideTimer);
  }
  battleResultHideTimer = setTimeout(() => {
    showBattleResult.value = false;
    showBattleDecorate.value = false;
  }, 5000);
}

onBeforeUnmount(() => {
  stopCountdown();
  clearBattleStartTimers();
  if (battleResultHideTimer) {
    clearTimeout(battleResultHideTimer);
    battleResultHideTimer = null;
  }
});
</script>

<style scoped lang="scss">
.cover-battle-decorate {
  position: absolute;
  pointer-events: none;
  z-index: 100;
}

.battle-score-container {
  display: flex;
  align-items: center;
  width: 100%;
  height: 14px;

  .battle-score-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    transition: width 0.3s ease;

    &:nth-child(1) {
      background-color: #1c66e5;
      justify-content: flex-start;
      padding: 0 18px 0 8px;
    }

    &:nth-child(2) {
      background-color: #f15065;
      justify-content: flex-end;
      padding: 0 8px 0 18px;
    }

    .battle-score-value {
      color: #fff;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: 20px;
    }
  }

  .battle-score-icon {
    position: absolute;
    top: -2px;
    left: 0;
    transform: translateX(-50%);
  }
}

.battle-time-container {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 24px;

  &.more-top {
    top: 14px;
  }

  .battle-time-background {
    width: 100%;
    height: 100%;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    background-color: var(--bg-color-mask, rgba(0, 0, 0, 0.55));
    transform: perspective(50px) rotateX(-20deg) rotateY(0deg) translateZ(0);
  }

  .battle-time-content {
    // Cover overlay layer is pointer-event-transparent overall; the timer
    // pendant explicitly disables pointer events too because the cover does
    // not need any click feedback for this decoration.
    pointer-events: none;
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    text-align: center;
    color: var(--text-color-primary, rgba(255, 255, 255, 0.9));
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: 20px;
    gap: 4px;
    transform: translateY(-2px);
  }
}

.battle-result-container {
  position: absolute;
  top: 50%;
  left: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  transform-origin: center center;
  transition:
    transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    opacity 0.3s ease-out;

  &.show {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.5);
    animation: coverBattleResultBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
}

.battle-start-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1.5);
  width: 218px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);

  &.disappearing {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }

  .red-bkg {
    position: absolute;
    width: 118px;
    height: 50px;
    left: 0;
    top: 0;
    animation: coverSlideInFromLeft 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .blue-bkg {
    position: absolute;
    width: 118px;
    height: 50px;
    right: 0;
    bottom: 0;
    animation: coverSlideInFromRight 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .letter-v {
    position: absolute;
    width: 40px;
    height: 40px;
    left: calc(50% - 30px);
    top: 50%;
    transform: translateX(-50%) translateY(-50%) scale(0);
    animation: coverScaleInFromCenter 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.5s forwards;
  }

  .letter-s {
    position: absolute;
    width: 40px;
    height: 40px;
    left: calc(50% - 10px);
    top: 50%;
    transform: translateX(-50%) translateY(-50%) scale(0);
    animation: coverScaleInFromCenter 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.5s forwards;
  }
}

@keyframes coverSlideInFromLeft {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }

  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes coverSlideInFromRight {
  0% {
    transform: translateX(100%);
    opacity: 0;
  }

  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes coverScaleInFromCenter {
  0% {
    transform: translateY(-50%) scale(0);
    opacity: 0;
  }

  50% {
    transform: translateY(-50%) scale(1.2);
    opacity: 0.8;
  }

  100% {
    transform: translateY(-50%) scale(1);
    opacity: 1;
  }
}

@keyframes coverBattleResultBounce {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }

  50% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0.8;
  }

  70% {
    transform: translate(-50%, -50%) scale(1.8);
    opacity: 1;
  }

  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 1;
  }
}
</style>
