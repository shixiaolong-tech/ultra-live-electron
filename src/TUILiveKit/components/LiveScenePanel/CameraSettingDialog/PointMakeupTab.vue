<template>
  <!--
    Point makeup / 单点美妆. Split into independent parts (lipstick / blush /
    eyebrow …). Each part shows a color-card grid; the user picks ONE option per
    part and many parts can be active at once. A picked option with a numeric
    range additionally shows a strength slider.

    Interaction maps to the store's pointMakeup APIs:
      - pick(partKey, option | null)  -> pickMakeupOption
      - intensity-change(option, val) -> setMakeupIntensity
    `partKey` is the part node's stable `labelKey`. Independent tab; the tile
    grid itself is the shared PickGrid atom.
  -->
  <div class="point-makeup-tab">
    <template v-for="(part, idx) in parts" :key="part.labelKey || idx">
      <div v-if="part && Array.isArray(part.options) && part.options.length > 0" class="makeup-part">
        <div class="makeup-part-title">{{ resolveLabel(part) }}</div>
        <PickGrid :items="part.options" @pick="(opt) => onPick(part, opt)" />
        <div v-if="pickedOption(part) && hasIntensity(pickedOption(part))" class="picked-intensity">
          <div class="picked-intensity-divider" />
          <IntensityRow
            :detail="pickedOption(part)"
            :value="pickedValue(part)"
            @change="(v) => onIntensityChange(pickedOption(part), v)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import PickGrid from './PickGrid.vue';
import IntensityRow from './IntensityRow.vue';
import { useEffectLabel } from './useEffectLabel';

/* eslint-disable @typescript-eslint/no-explicit-any */

const resolveLabel = useEffectLabel();

defineProps<{
  /** effectConstant.makeup.details — parts, each { labelKey, label, options }. */
  parts: Array<Record<string, any>>;
}>();

const emit = defineEmits<{
  /** Pick / clear a color-card option under one part. */
  (e: 'pick', partKey: string, option: Record<string, any> | null): void;
  /** Change the strength of an already-selected option. */
  (e: 'intensity-change', option: Record<string, any>, value: number): void;
}>();

function partKeyOf(part: Record<string, any>): string {
  return String(part?.labelKey ?? '');
}

function pickedOption(part: Record<string, any>): Record<string, any> | null {
  const opts = part?.options;
  if (!Array.isArray(opts)) return null;
  return opts.find((o: Record<string, any>) => o.isSelected) ?? null;
}

function pickedValue(part: Record<string, any>): number {
  const opt = pickedOption(part);
  if (!opt) return 0;
  const min = typeof opt.minValue === 'number' ? opt.minValue : 0;
  const v = opt.effValue;
  return typeof v === 'number' ? v : min;
}

function hasIntensity(option: Record<string, any> | null): boolean {
  return !!option && typeof option.minValue === 'number' && typeof option.maxValue === 'number';
}

// PickGrid already resolves "none / re-click" to a null payload, so we just
// forward whatever it emits keyed by this part.
const onPick = (part: Record<string, any>, option: Record<string, any> | null) => {
  emit('pick', partKeyOf(part), option);
};

const onIntensityChange = (option: Record<string, any> | null, v: number) => {
  if (!option) return;
  emit('intensity-change', option, v);
};
</script>

<style lang="scss" scoped>
.point-makeup-tab {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 4px 0 12px;
}

.makeup-part {
  flex-shrink: 0;
  margin-top: 8px;
}

.makeup-part-title {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: var(--bg-color-operate, #1f1f1f);
  color: var(--text-color-secondary);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px;
}

.picked-intensity {
  flex-shrink: 0;
  padding: 8px 12px 12px;
}

.picked-intensity-divider {
  height: 1px;
  background-color: var(--stroke-color-module);
  margin-bottom: 8px;
}
</style>
