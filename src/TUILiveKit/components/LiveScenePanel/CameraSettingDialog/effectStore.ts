/**
 * Reactive store for the camera dialog's beauty effect state.
 *
 * Design (rewritten for beautyLevel-driven dynamic categories):
 * The plugin's `getEffectConstant()` now returns a variable set of top-level
 * groups depending on the active beautyLevel. Each group falls into one of a
 * few interaction "kinds" (see GROUP_KIND). The store therefore indexes its
 * state by the top-level groupKey (string) rather than by the numeric effect
 * category — this is required because several groups can share one category
 * (e.g. `advancedMakeup` and `lightMakeup` are both Makeup=5), which a
 * category-keyed map could not disambiguate.
 *
 * State indexes:
 *   - intensities: Record<effKey, number>
 *     Slider values for pure intensity groups (beauty / imageQuality /
 *     advancedBeauty / bodyBeauty). Multiple effKeys can be non-zero so effects
 *     stack and preview in real time.
 *   - picks: Record<groupKey, PickedItem>
 *     Single selection per group for pick-class groups (lut / advancedMakeup /
 *     lightMakeup / motion / segment / beautyTemplate). The picked detail's own
 *     `effValue` carries its intensity (mutated in place), so groups that share
 *     an effKey across items — like lut — don't clobber each other.
 *   - makeupParts: Record<partKey, EffectDetail>
 *     Point-makeup ("makeup" group): each part (lipstick / blush / ...) picks
 *     one color-card option whose own `effValue` is its strength. Many parts
 *     can be active simultaneously.
 *
 * `getProperties()` walks all three indexes and produces the FULL set of
 * plugin properties the main window should apply. Empty list means "no effect".
 *
 * All mutators route through `commitChange()` which RAF-throttles emissions.
 */
import { ref, type Ref } from 'vue';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - the xmagic plugin ships JS without .d.ts
import { TRTCXmagicEffectCategory, TRTCXmagicFactory } from '../../../utils/beauty';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A single entry in `effectConstant[group].details[]` (or an option). */
export type EffectDetail = Record<string, any>;

/** Raw plugin parameter dictated by buildEffectProperty. */
export type EffectProperty = Record<string, any>;

/** Interaction form of a top-level group, derived from its groupKey. */
export type GroupKind =
  | 'intensity'      // per-item sliders (beauty / imageQuality / advancedBeauty / bodyBeauty)
  | 'pickIntensity'  // icon grid pick + picked-item strength slider (lut / advancedMakeup / lightMakeup)
  | 'pointMakeup'    // parts list, each part picks a color card + strength (makeup)
  | 'motion'         // 2D/3D/hand sub-groups, single cross-group pick (motion)
  | 'pick'           // pure single pick (segment)
  | 'template';      // preset pick that expands to multiple effects (beautyTemplate)

const GROUP_KIND: Record<string, GroupKind> = {
  beauty: 'intensity',
  imageQuality: 'intensity',
  advancedBeauty: 'intensity',
  bodyBeauty: 'intensity',
  lut: 'pickIntensity',
  advancedMakeup: 'pickIntensity',
  lightMakeup: 'pickIntensity',
  makeup: 'pointMakeup',
  motion: 'motion',
  segment: 'pick',
  beautyTemplate: 'template',
};

/** Resolve a group's interaction kind; unknown keys default to intensity. */
export function getGroupKind(groupKey: string): GroupKind {
  return GROUP_KIND[groupKey] ?? 'intensity';
}

/**
 * Default applied strength when an item in a pick + intensity group is first
 * selected. Built-in items ship with effValue 0 (= invisible), so picking would
 * otherwise show nothing. Values mirror the mobile SDK presets: light makeup
 * applies at 50, while filters / full makeup apply at full (maxValue).
 */
const DEFAULT_PICK_STRENGTH: Record<string, number> = {
  lightMakeup: 50,
};

/**
 * Default filter(lut) strength carried by a light-makeup preset until the user
 * tunes the dedicated "滤镜强度" slider. Surfaced to native as
 * `makeupLutStrength`, which scales ONLY the bundle's lut component (the rest
 * of the bundle uses the overall effValue strength).
 */
const DEFAULT_LIGHT_MAKEUP_LUT_STRENGTH = 50;

export interface PickedItem {
  effKey: string;
  detail: EffectDetail;
}

export interface EffectStoreOptions {
  effectConstant: Record<string, any> | null;
  /**
   * Emitted on every (throttled) change. `delta` is the INCREMENTAL set to push
   * to the native plugin this tick (changed/added props + 0-clears for props
   * that disappeared since the previous emit); `full` is the complete deduped
   * snapshot (for the main-window per-camera cache + camera-switch migration).
   * Sending only `delta` to `setParameter` keeps the native log to the effects
   * that actually changed, instead of re-dumping the whole set each tick.
   */
  onChange: (delta: EffectProperty[], full: EffectProperty[]) => void;
}

export interface EffectStore {
  readonly effectConstant: Ref<Record<string, any> | null>;
  /** Intensity-class slider change (and pickIntensity picked-item strength). */
  setIntensity(detail: EffectDetail, value: number): void;
  /** Pick / unpick for pickIntensity / motion / pick / template groups. */
  pickItem(groupKey: string, detail: EffectDetail | null): void;
  getPicked(groupKey: string): PickedItem | undefined;
  /** Point-makeup: select / clear a color-card option under a part. */
  pickMakeupOption(partKey: string, option: EffectDetail | null): void;
  getMakeupOption(partKey: string): EffectDetail | undefined;
  /** Point-makeup: change the strength of an already-selected option. */
  setMakeupIntensity(option: EffectDetail, value: number): void;
  /**
   * Light-makeup: change the filter(lut)-only strength of the picked preset.
   * Stored on the picked detail as `lutStrength` and surfaced to native as
   * `makeupLutStrength` (scales only the bundle's lut component).
   */
  setMakeupLutStrength(detail: EffectDetail, value: number): void;
  /** Reset one group / everything. */
  clearCategory(groupKey: string): void;
  clearAll(): void;
  /** Full deduped property snapshot right now (no throttle, no IPC trigger). */
  getProperties(): EffectProperty[];
  /**
   * Reset the incremental baseline to `full` (what is now considered applied).
   * Called after a forced full apply (e.g. camera switch) so subsequent deltas
   * are computed against the new camera's freshly-applied state.
   */
  markBaseline(full: EffectProperty[]): void;
}

function deepClone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

/** Whether an intensity value contributes (xmagic default is always 0). */
function isContributingIntensity(value: number | undefined): boolean {
  return typeof value === 'number' && value !== 0;
}

/**
 * Seed the three indexes from the (possibly back-filled) effectConstant. In
 * edit mode the plugin has already merged historical effValue / isSelected into
 * the tree, so we just read those.
 */
function seedFromConstant(
  constant: Record<string, any>,
  intensities: Record<string, number>,
  picks: Record<string, PickedItem>,
  makeupParts: Record<string, EffectDetail>,
) {
  for (const [groupKey, group] of Object.entries(constant) as Array<[string, any]>) {
    if (!group) continue;
    const kind = getGroupKind(groupKey);
    const items = group?.details;

    if (kind === 'motion') {
      if (!Array.isArray(items)) continue;
      for (const sub of items) {
        if (!Array.isArray(sub?.details)) continue;
        for (const item of sub.details) {
          if (item?.isSelected) picks[groupKey] = { effKey: String(item.effKey ?? ''), detail: item };
        }
      }
      continue;
    }

    if (kind === 'pointMakeup') {
      if (!Array.isArray(items)) continue;
      for (const part of items) {
        const partKey = String(part?.labelKey ?? '');
        const opts = part?.options;
        if (!Array.isArray(opts)) continue;
        for (const opt of opts) {
          if (opt?.isSelected) makeupParts[partKey] = opt;
        }
      }
      continue;
    }

    if (!Array.isArray(items)) continue;

    if (kind === 'intensity') {
      for (const item of items) {
        if (isContributingIntensity(item?.effValue)) {
          intensities[String(item.effKey ?? '')] = item.effValue as number;
        }
      }
      continue;
    }

    // pickIntensity / pick / template
    for (const item of items) {
      if (item?.isSelected) {
        picks[groupKey] = { effKey: String(item.effKey ?? ''), detail: item };
      }
    }
  }
}

/** Reset effValue/isSelected inside one top-level group. Mutates in place. */
function clearGroupVisuals(constant: Record<string, any>, groupKey: string) {
  const group = constant[groupKey];
  if (!group) return;
  const kind = getGroupKind(groupKey);

  const resetItem = (item: any) => {
    if (item == null) return;
    if (typeof item.effValue === 'number') item.effValue = 0;
    item.isSelected = false;
  };

  if (kind === 'motion') {
    if (Array.isArray(group.details)) {
      for (const sub of group.details) {
        if (Array.isArray(sub?.details)) sub.details.forEach(resetItem);
      }
    }
    return;
  }

  if (kind === 'pointMakeup') {
    if (Array.isArray(group.details)) {
      for (const part of group.details) {
        if (Array.isArray(part?.options)) part.options.forEach(resetItem);
      }
    }
    return;
  }

  if (Array.isArray(group.details)) group.details.forEach(resetItem);
}

export function createEffectStore(opts: EffectStoreOptions): EffectStore {
  const cloned = opts.effectConstant ? deepClone(opts.effectConstant) : null;
  const constantRef = ref<Record<string, any> | null>(cloned);

  const intensities: Record<string, number> = {};
  const picks: Record<string, PickedItem> = {};
  const makeupParts: Record<string, EffectDetail> = {};

  // Incremental baseline: the full deduped snapshot last handed to onChange.
  // Keyed by effKey. commitChange diffs the new snapshot against this to emit
  // only what changed (+ 0-clears for keys that disappeared).
  let lastSnapshot = new Map<string, EffectProperty>();

  if (cloned) seedFromConstant(cloned, intensities, picks, makeupParts);

  // ---- Throttle ---------------------------------------------------------
  let scheduled = false;
  function commitChange() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try {
        const full = getProperties();
        const delta = computeDelta(full);
        lastSnapshot = snapshotMap(full);
        // Nothing actually changed since the last emit → skip, so we don't push
        // an empty beautySetting (which would still cost one native log line).
        if (delta.length === 0) return;
        opts.onChange(delta, full);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[effectStore] onChange callback threw', e);
      }
    });
  }

  // ---- Incremental diff helpers ----------------------------------------
  /** Index a property list by effKey (assumes already deduped). */
  function snapshotMap(list: EffectProperty[]): Map<string, EffectProperty> {
    const map = new Map<string, EffectProperty>();
    for (const p of list) {
      const k = String(p?.effKey ?? '');
      if (k) map.set(k, p);
    }
    return map;
  }

  /** Keep only the last occurrence of each effKey, preserving relative order. */
  function dedupeByEffKey(list: EffectProperty[]): EffectProperty[] {
    const lastIndex = new Map<string, number>();
    list.forEach((p, i) => {
      const k = String(p?.effKey ?? '');
      if (k) lastIndex.set(k, i);
    });
    const out: EffectProperty[] = [];
    list.forEach((p, i) => {
      const k = String(p?.effKey ?? '');
      if (!k || lastIndex.get(k) === i) out.push(p);
    });
    return out;
  }

  /** Structural equality on the fields the native plugin actually reads. */
  function propsEqual(a: EffectProperty, b: EffectProperty): boolean {
    return a?.category === b?.category
      && a?.effKey === b?.effKey
      && (a?.effValue ?? 0) === (b?.effValue ?? 0)
      && (a?.resPath ?? '') === (b?.resPath ?? '')
      && (a?.bgPath ?? '') === (b?.bgPath ?? '')
      && (a?.makeupLutStrength ?? -1) === (b?.makeupLutStrength ?? -1);
  }

  /** A 0-strength / empty clear for a property that disappeared. */
  function makeClear(prev: EffectProperty): EffectProperty {
    return { category: prev?.category, effKey: prev?.effKey, effValue: 0, resPath: '' };
  }

  /** Whether a property is a "clear" (turns its channel off). */
  function isClearProp(p: EffectProperty): boolean {
    return String(p?.effKey ?? '') === 'None' || (p?.effValue ?? 0) === 0;
  }

  /**
   * Diff the new full snapshot against lastSnapshot. Returns ONLY the changed
   * entries: added/changed props, plus 0-clears for keys that were present last
   * time but are gone now. Clears are ordered first so that — when an effect is
   * replaced on a shared native slot — the real value is applied last and wins.
   */
  function computeDelta(full: EffectProperty[]): EffectProperty[] {
    const next = snapshotMap(full);
    const changed: EffectProperty[] = [];
    for (const p of full) {
      const k = String(p?.effKey ?? '');
      if (!k) continue;
      const prev = lastSnapshot.get(k);
      if (!prev || !propsEqual(prev, p)) changed.push(p);
    }
    const removed: EffectProperty[] = [];
    for (const [k, prev] of lastSnapshot) {
      if (!next.has(k)) removed.push(makeClear(prev));
    }
    const delta = [...removed, ...changed];
    // Keep clears ahead of real effects within the delta as well.
    const clears: EffectProperty[] = [];
    const reals: EffectProperty[] = [];
    for (const p of delta) (isClearProp(p) ? clears : reals).push(p);
    return [...clears, ...reals];
  }

  /** Reset the incremental baseline (after a forced full apply). */
  function markBaseline(full: EffectProperty[]) {
    lastSnapshot = snapshotMap(full);
  }

  // ---- Property assembly ------------------------------------------------
  function buildOne(detail: EffectDetail): EffectProperty[] {
    const built = TRTCXmagicFactory.buildEffectProperty(detail) as EffectProperty[] | undefined;
    return Array.isArray(built) ? built : [];
  }

  function getProperties(): EffectProperty[] {
    const result: EffectProperty[] = [];
    const constant = constantRef.value;
    if (!constant) return result;

    for (const [groupKey, group] of Object.entries(constant) as Array<[string, any]>) {
      if (!group) continue;
      const kind = getGroupKind(groupKey);

      if (kind === 'intensity') {
        const items = (group.details as any[]) || [];
        for (const item of items) {
          const effKey = String(item?.effKey ?? '');
          if (!effKey) continue;
          const v = intensities[effKey];
          if (!isContributingIntensity(v)) continue;
          result.push(...buildOne({ ...item, effValue: v }));
        }
        continue;
      }

      if (kind === 'pointMakeup') {
        // Each part's selected option carries its own effValue. For UNSELECTED
        // parts we emit an explicit clear (effValue 0) instead of nothing: the
        // native layer is stateful, and these parts share their `effKey`
        // (beauty.faceFeature*) with the light-makeup expansion, so a positive
        // clear is what actually resets a deselected part — and what wipes any
        // residual light-makeup mask when the user switches over to point makeup.
        const items = (group.details as any[]) || [];
        for (const part of items) {
          const partKey = String(part?.labelKey ?? '');
          const option = makeupParts[partKey];
          if (option) {
            result.push(...buildOne(option));
          } else {
            const effKey = String(part?.options?.[0]?.effKey ?? '');
            if (effKey) {
              result.push({
                category: part?.options?.[0]?.category ?? TRTCXmagicEffectCategory?.Beauty,
                effKey,
                effValue: 0,
                resPath: '',
              });
            }
          }
        }
        continue;
      }

      // pickIntensity / motion / pick / template: single picked detail.
      const picked = picks[groupKey];
      if (picked) {
        const isNoneSentinel = String(picked.detail?.effKey ?? '') === 'None';
        if (groupKey === 'lightMakeup' && isNoneSentinel) {
          // Light makeup is expanded natively into component effects (lut +
          // beauty.faceFeature* masks); its built-in "无" tile (effKey "None")
          // would hit the studio "makeup" channel and never reset them. Emit an
          // explicit light.makeup clear (effValue 0 / empty resPath) so the bridge
          // clears the components. Skip it when point makeup is active: point
          // makeup owns the same mask channels and emits its own full set, so a
          // clear here would only fight it (and is unnecessary).
          const pointMakeupActive = Object.keys(makeupParts).length > 0;
          const realItem = (group.details as any[] | undefined)?.find(
            (d: any) => String(d?.effKey ?? '') !== 'None',
          );
          if (!pointMakeupActive && realItem) {
            result.push({
              category: realItem.category,
              effKey: String(realItem.effKey ?? ''),
              effValue: 0,
              resPath: '',
            });
          }
        } else if (groupKey === 'lightMakeup') {
          // Real light-makeup pick: attach the filter(lut)-only strength so the
          // native bridge can scale the bundle's lut component independently of
          // the overall makeup strength (effValue). Defaults to 50 until the
          // user drags the dedicated "滤镜强度" slider.
          const built = buildOne(picked.detail);
          const lutStrength = typeof picked.detail?.lutStrength === 'number'
            ? picked.detail.lutStrength
            : DEFAULT_LIGHT_MAKEUP_LUT_STRENGTH;
          for (const p of built) p.makeupLutStrength = lutStrength;
          result.push(...built);
        } else {
          result.push(...buildOne(picked.detail));
        }
      }
    }

    // Stable-partition so every "no effect / 原图" clear sentinel is applied
    // BEFORE the real effects. The makeup-category "无/原图" tiles serialize to
    // an empty LightCore template carrying `effKey === 'None'` on the native
    // makeup channel. Because the native plugin applies the beautySetting array
    // in order and a later item wins the shared makeup slot, an empty sentinel
    // emitted AFTER a real makeup effect (e.g. advancedMakeup sitting at 原图
    // while lightMakeup has a real pick) would wipe that real effect out — which
    // is exactly why picking light-makeup 白皙/淡颜 rendered nothing. Moving all
    // clear sentinels to the front guarantees the real selection is applied last
    // and therefore wins, regardless of group iteration order. No item is
    // dropped, so the LightCore base that studio makeup relies on is preserved.
    const clears: EffectProperty[] = [];
    const reals: EffectProperty[] = [];
    for (const p of result) {
      if (String(p?.effKey ?? '') === 'None') clears.push(p);
      else reals.push(p);
    }
    // Dedupe by effKey (keep the last occurrence): defensively collapses any
    // accidental duplicate effKey so a single key is never pushed/logged twice.
    return dedupeByEffKey([...clears, ...reals]);
  }

  // ---- Mutators ---------------------------------------------------------
  function setIntensity(detail: EffectDetail, value: number) {
    const effKey = String(detail?.effKey ?? '');
    if (!effKey) return;
    // Mirror into the tree so templates bound to effValue reflect live state.
    detail.effValue = value;

    // For pickIntensity groups (lut / advancedMakeup / lightMakeup) the picked
    // detail IS the source of truth (it lives in picks[groupKey]); we only need
    // to mutate its effValue above. These carry Lut(2) / Makeup(5) categories.
    if (
      detail.category === TRTCXmagicEffectCategory?.Lut
      || detail.category === TRTCXmagicEffectCategory?.Makeup
    ) {
      commitChange();
      return;
    }

    // Pure intensity groups: track by effKey; 0 means "not contributing".
    if (value === 0) {
      delete intensities[effKey];
    } else {
      intensities[effKey] = value;
    }
    commitChange();
  }

  function pickItem(groupKey: string, detail: EffectDetail | null) {
    const constant = constantRef.value;
    if (!constant) return;
    const group = constant[groupKey];
    const kind = getGroupKind(groupKey);

    // Clear peers' isSelected so a single card highlights.
    const clearSel = (items: any[] | undefined) => {
      if (Array.isArray(items)) for (const it of items) it.isSelected = false;
    };
    if (kind === 'motion') {
      if (Array.isArray(group?.details)) for (const sub of group.details) clearSel(sub?.details);
    } else {
      clearSel(group?.details);
    }

    if (detail) {
      detail.isSelected = true;
      // Mutual exclusion mirroring the mobile SDK (TEParamManager): light makeup,
      // point makeup and filter(lut) drive the same makeup / LUT pipeline, so
      // turning one on turns the others off. Without this, leftover effects on the
      // shared `beauty.faceFeature*` / `lut` channels would visually fight.
      if (String(detail.effKey ?? '') !== 'None') {
        if (groupKey === 'lightMakeup') {
          resetGroupState('makeup');
          resetGroupState('lut');
        } else if (groupKey === 'lut') {
          resetGroupState('lightMakeup');
        }
      }
      // For pick + intensity groups (lut / advancedMakeup / lightMakeup) the
      // applied strength is `effValue`. A freshly-built item ships with
      // effValue 0, which for strength-scaled resources (e.g. the light-makeup
      // `makeup.json` sets, whose component alphas are multiplied by
      // makeup.strength) renders as completely invisible — the user picks an
      // item and "nothing happens". Seed an untouched pick to full strength so
      // the effect shows immediately at its designed intensity; the slider then
      // lets the user dial it down. Pure-pick groups (motion / segment /
      // template) carry no strength slider and are unaffected.
      if (
        kind === 'pickIntensity'
        && typeof detail.maxValue === 'number'
        && (typeof detail.effValue !== 'number' || detail.effValue === 0)
      ) {
        detail.effValue = DEFAULT_PICK_STRENGTH[groupKey] ?? detail.maxValue;
      }
      picks[groupKey] = { effKey: String(detail.effKey ?? ''), detail };
    } else {
      delete picks[groupKey];
    }
    commitChange();
  }

  function pickMakeupOption(partKey: string, option: EffectDetail | null) {
    const constant = constantRef.value;
    if (!constant) return;
    // makeup is the only pointMakeup group.
    const group = constant.makeup;
    const part = Array.isArray(group?.details)
      ? group.details.find((d: any) => String(d?.labelKey ?? '') === partKey)
      : undefined;
    if (part && Array.isArray(part.options)) {
      for (const o of part.options) o.isSelected = false;
    }
    if (option) {
      option.isSelected = true;
      makeupParts[partKey] = option;
      // Point makeup conflicts with light makeup on the shared makeup channels
      // (see pickItem). Selecting a point-makeup option disables light makeup.
      resetGroupState('lightMakeup');
    } else {
      delete makeupParts[partKey];
    }
    commitChange();
  }

  function setMakeupIntensity(option: EffectDetail, value: number) {
    if (!option) return;
    option.effValue = value;
    commitChange();
  }

  function setMakeupLutStrength(detail: EffectDetail, value: number) {
    if (!detail) return;
    // Persist on the picked light-makeup detail; getProperties reads it back as
    // `makeupLutStrength`. Kept separate from effValue so the overall and the
    // filter strength can be tuned independently.
    detail.lutStrength = value;
    commitChange();
  }

  /** Reset one group's state + visuals WITHOUT emitting (caller commits). */
  function resetGroupState(groupKey: string) {
    const constant = constantRef.value;
    if (!constant) return;
    const kind = getGroupKind(groupKey);

    clearGroupVisuals(constant, groupKey);

    if (kind === 'intensity') {
      const items = (constant[groupKey]?.details as any[]) || [];
      for (const it of items) {
        const k = String(it?.effKey ?? '');
        if (k) delete intensities[k];
      }
    } else if (kind === 'pointMakeup') {
      const items = (constant[groupKey]?.details as any[]) || [];
      for (const part of items) {
        const partKey = String(part?.labelKey ?? '');
        delete makeupParts[partKey];
      }
    } else {
      delete picks[groupKey];
    }
  }

  function clearCategory(groupKey: string) {
    resetGroupState(groupKey);
    commitChange();
  }

  function clearAll() {
    const constant = constantRef.value;
    if (!constant) return;
    for (const k of Object.keys(constant)) clearGroupVisuals(constant, k);
    for (const k of Object.keys(intensities)) delete intensities[k];
    for (const k of Object.keys(picks)) delete picks[k];
    for (const k of Object.keys(makeupParts)) delete makeupParts[k];
    commitChange();
  }

  return {
    effectConstant: constantRef,
    setIntensity,
    pickItem,
    getPicked: (groupKey) => picks[groupKey],
    pickMakeupOption,
    getMakeupOption: (partKey) => makeupParts[partKey],
    setMakeupIntensity,
    setMakeupLutStrength,
    clearCategory,
    clearAll,
    getProperties,
    markBaseline,
  };
}
