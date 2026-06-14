import TRTCXmagicFactory, {
  TRTCXmagicEffectConstant,
  TRTCXmagicEffectValueType,
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
} from 'trtc-electron-plugin-xmagic';
import { getAppPath } from './envUtils';

export {
  TRTCXmagicEffectConstant,
  TRTCXmagicEffectValueType,
  TRTCXmagicEffectCategory,
  default as TRTCXmagicFactory
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
} from 'trtc-electron-plugin-xmagic';

export type TRTCXmagicEffectProperty = {
  category?: any; // TRTCXmagicEffectCategory;
  effKey: string;
  effValue?: string;
  resPath?: string;
  imgPath?: string;
  bgPath?: string;
  label?: string;
}

/**
 * Beauty capability level (aligned with the mobile SDK tiers, e.g. "A1-00" ~
 * "S1-07"). It controls which effect categories/items `getEffectConstant()`
 * returns. Declared as a standalone constant rather than a field of
 * `XmagicLicense`, because it is an init-time capability switch, NOT a license
 * credential (it is not consumed by `buildEffectInitParam`).
 */
export const BEAUTY_LEVEL = 'S1-07';

async function init() {
  const appPath = await getAppPath();
  // The plugin's new `init` takes an options object; `beautyLevel` is stored as
  // factory state and later consumed by `getEffectConstant()`. The legacy
  // string form `init(appPath)` is still accepted by the plugin for backward
  // compatibility, but we pass the object form to carry the level.
  TRTCXmagicFactory.init({ appPath, beautyLevel: BEAUTY_LEVEL });
}
init();

const { platform } = process;

// Open-source build: fill in your own xmagic license credentials here.
export const XmagicLicense = {
  licenseURL: '',
  licenseKey: '',
};

const lutResourceList = [
  {
    key: 'LUT_REFRESHING',
    label: '清晰',
    label_en: 'Refreshing',
    resPath: 'lut.bundle/moren_lf.png',
    icon: './assets/beauty_panel/panel_icon/lut_icon/moren_lf.png',
  },
  {
    key: 'LUT_TOKYO',
    label: '东京',
    label_en: 'Tokyo',
    resPath: 'lut.bundle/dongjing_lf.png',
    icon: './assets/beauty_panel/panel_icon/lut_icon/dongjing_lf.png',
  },
  {
    key: 'LUT_WHITE',
    label: '白皙',
    label_en: 'White',
    resPath: 'lut.bundle/n_baixi.png',
    icon: './assets/beauty_panel/panel_icon/lut_icon/baixi_lf.png',
  },
  {
    key: 'LUT_NATURAL',
    label: '自然',
    label_en: 'Natural',
    resPath: 'lut.bundle/n_ziran.png',
    icon: './assets/beauty_panel/panel_icon/lut_icon/ziran_lf.png',
  },
  {
    key: 'LUT_ALLURE',
    label: '心动',
    label_en: 'Allure',
    resPath: 'lut.bundle/xindong_lf.png',
    icon: './assets/beauty_panel/panel_icon/lut_icon/xindong_lf.png',
  },
]
// Lut(Filter)
TRTCXmagicEffectConstant['EFFECT_LUT'].options = TRTCXmagicEffectConstant['EFFECT_LUT'].options.concat(
  lutResourceList.map(item => {
    return {
      ...TRTCXmagicEffectConstant['EFFECT_LUT'].valueMeta.value,
      ...item,
    }
  })
);

// Makeup
TRTCXmagicEffectConstant['EFFECT_MAKEUP'].options = TRTCXmagicEffectConstant['EFFECT_MAKEUP'].options.concat([
  {
    key: 'MAKEUP_PEACH',
    label: '桃花',
    label_en: 'Peach',
    effKey: platform === 'win32' ? 'makeup.strength' : 'video_fenfenxia',
    valueType: TRTCXmagicEffectValueType.ZERO_ONE,
    resPath:
      platform === 'win32'
        ? 'makeupMotionRes.bundle/video_fenfenxia/template.json'
        : 'makeupMotionRes.bundle/video_fenfenxia',
    icon: './assets/beauty_panel/panel_icon/makeup_icon/video_fenfenxia.png'
  },
  {
    key: 'MAKEUP_SUNBURN',
    label: '晒伤',
    label_en: 'Sunburn',
    effKey: platform === 'win32' ? 'makeup.strength' : 'video_shaishangzhuang',
    valueType: TRTCXmagicEffectValueType.ZERO_ONE,
    resPath:
        platform === 'win32'
          ? 'makeupMotionRes.bundle/video_shaishangzhuang/template.json'
          : 'makeupMotionRes.bundle/video_shaishangzhuang',
    icon: './assets/beauty_panel/panel_icon/makeup_icon/video_shaishangzhuang.png'
  },
]);

// Light Makeup. Aligned with the mobile SDK: on Windows it uses the dedicated
// effKey `light.makeup`, and `resPath` points to a resource "directory" (which
// contains makeup.json + image/) rather than the makeup.json file itself; the
// strength is driven by effValue (seeded to full strength once selected).
// Note: the native plugin distinguishes `light.makeup` by effKey under the
// MAKEUP category (see beauty-plugin-cpp).
const lightMakeupResourceList = [
  {
    key: 'LIGHT_MAKEUP_BAIXI',
    label: '白皙',
    label_en: 'Fair',
    effKey: platform === 'win32' ? 'light.makeup' : 'light_baixi',
    valueType: TRTCXmagicEffectValueType.ZERO_ONE,
    resPath: 'makeupMotionRes.bundle/light_baixi',
    icon: './assets/beauty_panel/panel_icon/light_makeup_icon/light_baixi.png',
  },
  {
    key: 'LIGHT_MAKEUP_DANYAN',
    label: '淡颜',
    label_en: 'Light',
    effKey: platform === 'win32' ? 'light.makeup' : 'light_danyan',
    valueType: TRTCXmagicEffectValueType.ZERO_ONE,
    resPath: 'makeupMotionRes.bundle/light_danyan',
    icon: './assets/beauty_panel/panel_icon/light_makeup_icon/light_danyan.png',
  },
];
// `EFFECT_LIGHT_MAKEUP` may not exist on older plugin constants; create a
// fallback before weaving the options in.
if (!TRTCXmagicEffectConstant['EFFECT_LIGHT_MAKEUP']) {
  TRTCXmagicEffectConstant['EFFECT_LIGHT_MAKEUP'] = { options: [] };
}
TRTCXmagicEffectConstant['EFFECT_LIGHT_MAKEUP'].options =
  TRTCXmagicEffectConstant['EFFECT_LIGHT_MAKEUP'].options.concat(lightMakeupResourceList);

// Motion
TRTCXmagicEffectConstant['EFFECT_MOTION']['2dOptions'] = TRTCXmagicEffectConstant['EFFECT_MOTION']['2dOptions'].concat([
  {
    key: 'MOTION_BUNNY',
    label: '兔兔酱',
    label_en: 'Bunny',
    effKey: 'video_tutujiang',
    resPath:
      platform === 'win32'
        ? '2dMotionRes.bundle/video_tutujiang/template.json'
        : '2dMotionRes.bundle',
    icon: './assets/beauty_panel/panel_icon/motions_icon/video_tutujiang.png',
    valueType: TRTCXmagicEffectValueType.NONE,
  },
]);
TRTCXmagicEffectConstant['EFFECT_MOTION']['3dOptions'] = TRTCXmagicEffectConstant['EFFECT_MOTION']['3dOptions'].concat([
  {
    key: 'MOTION_ROSE',
    label: '知性玫瑰',
    label_en: 'Glasses',
    effKey: 'video_zhixingmeigui',
    resPath:
      platform === 'win32'
        ? '3dMotionRes.bundle/video_zhixingmeigui/template.json'
        : '3dMotionRes.bundle',
    icon:'./assets/beauty_panel/panel_icon/motions_icon/video_zhixingmeigui.png',
    valueType: TRTCXmagicEffectValueType.NONE,
  },
]);
TRTCXmagicEffectConstant['EFFECT_MOTION']['handOptions'] = TRTCXmagicEffectConstant['EFFECT_MOTION']['handOptions'].concat([
  {
    key: 'MOTION_SAKURA',
    label: '樱花女孩',
    label_en: 'Sakura',
    effKey: 'video_sakuragirl',
    resPath:
      platform === 'win32'
        ? 'handMotionRes.bundle/video_sakuragirl/template.json'
        : 'handMotionRes.bundle',
    icon:'./assets/beauty_panel/panel_icon/motions_icon/video_sakuragirl.png',
    valueType: TRTCXmagicEffectValueType.NONE,
  },
  {
    key: 'MOTION_BUBBLE',
    label: '童年泡泡糖',
    label_en: 'Bubble',
    effKey: 'video_bubblegum',
    resPath:
      platform === 'win32'
        ? 'ganMotionRes.bundle/video_bubblegum/template.json'
        : 'ganMotionRes.bundle',
    icon: './assets/beauty_panel/panel_icon/motions_icon/video_bubblegum.png',
    valueType: TRTCXmagicEffectValueType.NONE,
  }
]);

const greenScreenBackgroundImageList = [
  {
    key: 'SEG_GREEN_WATER_DROPS',
    label: '绿幕/水滴',
    label_en: 'Green Screen/Water Drops',
    icon: './assets/virtual_bg/water-drops.jpg',
  }
];

const virtualBackgroundImageList = [
  {
    key: 'SEG_BLACKBOARD',
    label: '黑板',
    label_en: 'Blackboard',
    icon: './assets/virtual_bg/Blackboard.jpg',
  },
]
// Virtual background
TRTCXmagicEffectConstant['EFFECT_SEGMENTATION'].options = TRTCXmagicEffectConstant['EFFECT_SEGMENTATION'].options.concat(
  greenScreenBackgroundImageList.map(item => {
    return {
      ...TRTCXmagicEffectConstant['EFFECT_SEGMENTATION'].valueMeta.greenScreen,
      ...item,
    }
  }),
  virtualBackgroundImageList.map(item => {
    return {
      ...TRTCXmagicEffectConstant['EFFECT_SEGMENTATION'].valueMeta.background,
      ...item,
    }
  })
);

export const customEffectConstant = TRTCXmagicEffectConstant;

/**
 * Cached snapshot of the unmerged effect constant produced by
 * `TRTCXmagicFactory.getEffectConstant(customEffectConstant)`. Used as the
 * baseline shape (with default effValue/isSelected) when no historical
 * properties exist for a camera. Lazily populated by `prewarmEffectConstant()`.
 */
let cachedBaselineEffectConstant: any = null;

/**
 * Prewarm the xmagic factory: triggers `TRTCXmagicFactory.init(appPath)` (which
 * happens at module import time) to actually finish, then computes and caches
 * the baseline effect constant. Calling this at app startup ensures that the
 * very first time the camera dialog opens, the main window already has a
 * ready-to-ship `effectConstant` payload to put on `SHOW_CHILD_PANEL.extra`.
 *
 * Safe to call multiple times — subsequent calls reuse the cached snapshot.
 */
export async function prewarmEffectConstant(): Promise<any> {
  if (cachedBaselineEffectConstant) return cachedBaselineEffectConstant;
  // `init()` was scheduled at module import; awaiting a microtask gives it a
  // chance to settle before we ask the factory to build the constant.
  await Promise.resolve();
  cachedBaselineEffectConstant = TRTCXmagicFactory.getEffectConstant(customEffectConstant);
  return cachedBaselineEffectConstant;
}

/**
 * Build a per-open effectConstant snapshot for the camera dialog.
 *
 * In add mode (no `historyProperties`), returns a fresh baseline (all defaults).
 * In edit mode, calls `getEffectConstant(custom, history)` so that the library
 * back-fills `details[i].effValue` / `isSelected` according to the camera's
 * existing properties — the child window can then render the constant directly
 * with no merge logic of its own.
 *
 * Always returns a fresh top-level object (not the cached one) so that the
 * dialog can mutate its copy locally without polluting the baseline cache.
 */
export function buildEffectConstantForCamera(historyProperties?: any[]): any {
  if (historyProperties && historyProperties.length > 0) {
    return TRTCXmagicFactory.getEffectConstant(customEffectConstant, historyProperties);
  }
  // Re-run getEffectConstant rather than cloning the cached one, because the
  // cached object is shared by all callers (including potential future ones)
  // and we want a clean, isolated tree per dialog open.
  return TRTCXmagicFactory.getEffectConstant(customEffectConstant);
}

/**
 * Expose the plugin's built-in i18n base table: `labelKey -> { zh, en }`.
 *
 * Every label-bearing node returned by `getEffectConstant()` now carries a
 * stable `labelKey`; the app layer translates those keys via its i18next
 * resources (see `src/i18n`). This helper surfaces the plugin's built-in zh/en
 * baseline so the app can seed those two languages automatically and only needs
 * to hand-translate the remaining languages.
 *
 * Returns `{}` when the running plugin version predates multi-language support,
 * so callers degrade gracefully (UI then falls back to each node's `label` /
 * `label_en`).
 */
export function getBeautyI18nResource(): Record<string, { zh: string; en: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (TRTCXmagicFactory as any).getI18nResource;
    return typeof fn === 'function' ? fn.call(TRTCXmagicFactory) : {};
  } catch {
    return {};
  }
}
