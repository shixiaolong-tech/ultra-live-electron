/**
 * i18n explanation
 *
 * <script>
 * import i18n, { useI18n } from '../locale';
 * const { t } = useI18n();
 *
 * // case 1: No variables in translation temlate text
 * t('happy');
 * i18n.t('happy');
 * // case 2: Exist variables in translation template text
 * t('kick sb. out of room', { someOneName: 'xiaoming' });
 * i18n.t('kick sb. out of room', { someOneName: 'xiaoming' });
 *
 * // switch language
 * switch (i18n.global.locale.value) {
 *  case 'en-US':
 *    i18n.global.locale.value = 'zh-CN';
 *    break;
 *  case 'zh-CN':
 *    i18n.global.locale.value = 'en-US';
 *    break;
 * }
 * </script>
 */

import { getLanguage } from '../utils/common';
import ZH from './zh-CN';
import EN from './en-US';
import JA from './ja';
import KO from './ko';
import ZH_HK from './zh-HK';
import { ref } from 'vue';

const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'ja', 'ko', 'zh-HK'] as const;

const locale = ref('');
class TUIKitI18n {
  messages: Record<string, any>;
  global: Record<string, any>;

  constructor(options: { messages: Record<string, any>, locale: string }) {
    this.messages = options.messages;
    locale.value = options.locale;
    this.global = {};
    this.global.locale = locale;
    this.global.t = this.t.bind(this);
  }

  private getNamed(option: Record<string, any>) {
    return (key: string) => option[key] || key;
  }

  private t(key: any, option?: Record<string, any>) {
    const message = this.messages[locale.value];
    if (!message[key]) {
      return key;
    }
    if (typeof message[key] === 'function') {
      const named = this.getNamed(option || {});
      return message[key]({ named });
    }
    return message[key];
  }
}

const stored = typeof window !== 'undefined' ? window.localStorage?.getItem('app-language') : null;
const language = (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) ? stored : getLanguage();
const i18n = new TUIKitI18n({
  locale: language,
  messages: {
    'zh-CN': ZH,
    'en-US': EN,
    'ja': JA,
    'ko': KO,
    'zh-HK': ZH_HK,
  },
});

window.ipcRenderer.send('set-language', language);

export default i18n;

export function useI18n() {
  return {
    t: i18n.global.t.bind(i18n),
  };
}

