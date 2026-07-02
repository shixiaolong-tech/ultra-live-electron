<template>
  <!--
    Per-seat ranking badge / live score overlay for the cover window.
    Mirrors the kit's BattleUserDecorate (`ui-component/packages/
    uikit-component-vue3-electron/src/components/LiveView/CoreViewDecorate/
    BattleUserDecorate.vue`) one-for-one in markup and gating.

    Each badge is absolutely positioned over the corresponding seat region in
    cover-window pixel coordinates, and the parent container fills the entire
    cover window so the badges line up with the underlying StreamCover overlay.
  -->
  <div v-if="showBattleUserDecorate" class="cover-battle-user-decorate-container">
    <div
      v-for="region in props.seatRegions"
      :key="region.userId"
      class="cover-battle-user-region"
      :style="getRegionStyle(region)"
    >
      <div v-if="getBattleLevel(region.userId) > 0" class="battle-decorate">
        <span v-if="!battleScoreMap.has(region.userId)" class="battle-score-value">
          {{ t('LiveView.Connecting') }}
        </span>
        <template v-else>
          <div
            class="battle-badge-container"
            :class="getBattleLevel(region.userId) === 1 ? 'top-badge' : 'ordinary-badge'"
          >
            <img
              :src="getBattleLevel(region.userId) === 1 ? BattleTopBadge : BattleOrdinaryBadge"
              alt="battle-badge"
              class="battle-badge"
            />
            <span class="battle-level">{{ getBattleLevel(region.userId) }}</span>
          </div>
          <span class="battle-score-value">{{ battleScoreMap.get(region.userId) || 0 }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { CoHostLayoutTemplate } from 'tuikit-atomicx-vue3-electron';
import type { TUIUserSeatStreamRegion } from '../../types';
import { useCoverBattleState } from './coverBattleState';
import BattleTopBadge from '../../assets/battle/svg/BattleTopBadge.svg';
import BattleOrdinaryBadge from '../../assets/battle/svg/BattleOrdinaryBadge.svg';

const props = defineProps<{
  /**
   * Seat stream regions from `IPCMessageType.UPDATE_USER_ON_SEAT`. Each rect
   * is in cover window pixel coordinates and is reused as-is for absolute
   * positioning.
   */
  seatRegions: Array<TUIUserSeatStreamRegion>;
}>();

const { t } = useUIKit();
const { snapshot, battleId, layoutTemplate, battleScoreMap, scoreRanking } = useCoverBattleState();

// Mirrors kit's local `isInBattle`: true while a battle is in progress, and
// remains true for an extra 5s after the battle ends so the final ranking /
// score stays visible (matching kit's UX).
const isInBattle = ref(false);
let battleEndedHideTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  battleId,
  (newId) => {
    if (newId) {
      if (battleEndedHideTimer) {
        clearTimeout(battleEndedHideTimer);
        battleEndedHideTimer = null;
      }
      isInBattle.value = true;
      return;
    }
    if (battleEndedHideTimer) return;
    battleEndedHideTimer = setTimeout(() => {
      isInBattle.value = false;
      battleEndedHideTimer = null;
    }, 5000);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (battleEndedHideTimer) {
    clearTimeout(battleEndedHideTimer);
    battleEndedHideTimer = null;
  }
});

const showBattleUserDecorate = computed(() => {
  // Per-seat badges only appear in 9-grid / 1v6 layouts and only when the
  // host has more than two co-hosts on stage; otherwise the kit shows the
  // shared score bar instead. Same gating as BattleUserDecorate.
  const isGrid = layoutTemplate.value === CoHostLayoutTemplate.HostDynamicGrid;
  const is1v6 = layoutTemplate.value === CoHostLayoutTemplate.HostDynamic1v6;
  const layoutAllowed = isGrid || is1v6;
  return (
    props.seatRegions.length > 0
    && isInBattle.value
    && layoutAllowed
    // useCoHostState().connected.length > 2 — equivalent to host + ≥2 co-hosts.
    // The snapshot exposes this directly so the cover does not need its own
    // co-host state.
    && snapshot.value.connectedHostCount > 2
  );
});

function getBattleLevel(userId: string): number {
  return scoreRanking.value.indexOf(battleScoreMap.value.get(userId) || 0) + 1;
}

function getRegionStyle(region: TUIUserSeatStreamRegion) {
  const rect = region?.rect;
  if (!rect) {
    return { display: 'none' };
  }
  return {
    position: 'absolute' as const,
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.right - rect.left}px`,
    height: `${rect.bottom - rect.top}px`,
  };
}
</script>

<style scoped lang="scss">
.cover-battle-user-decorate-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 100;
}

.cover-battle-user-region {
  // Each region acts as a positioning context for the upper-left badge.
  pointer-events: none;
}

.battle-decorate {
  position: absolute;
  top: 8px;
  left: 8px;
  height: 24px;
  min-width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  background-color: rgba(15, 16, 20, 0.4);
  border-radius: 24px;
  color: var(--text-color-primary);

  .battle-badge-container {
    display: flex;
    align-items: center;
    justify-content: center;

    &.top-badge {
      .battle-level {
        color: #ff772e;
      }
    }

    &.ordinary-badge {
      .battle-level {
        color: #8490b8;
      }
    }

    .battle-badge {
      width: 20px;
      height: 20px;
    }

    .battle-level {
      position: absolute;
      transform: translateY(-1px);
      font-family: 'Test Söhne Schmal';
      font-size: 10px;
      font-style: normal;
      font-weight: 800;
      line-height: 10px;
      text-transform: uppercase;
    }
  }

  .battle-score-value {
    font-size: 12px;
    font-weight: 500;
  }
}
</style>
