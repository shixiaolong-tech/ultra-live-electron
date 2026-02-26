import { getUrlParam } from './envUtils';

const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'ja', 'ko', 'zh-HK'];

export function getLanguage(): string {
  const langParam = getUrlParam('lang');
  if (langParam) {
    const normalized = langParam.replace(/_/, '-');
    if (SUPPORTED_LOCALES.includes(normalized)) return normalized;
    if (normalized.startsWith('zh')) return 'zh-CN';
    if (normalized.startsWith('ja')) return 'ja';
    if (normalized.startsWith('ko')) return 'ko';
    return 'en-US';
  }
  const browser = (navigator.language || 'zh').replace(/_/, '-').toLowerCase();
  if (browser === 'zh-cn' || browser === 'zh') return 'zh-CN';
  if (browser === 'zh-hk' || browser === 'zh-tw') return 'zh-HK';
  if (browser.startsWith('ja')) return 'ja';
  if (browser.startsWith('ko')) return 'ko';
  if (browser.startsWith('en')) return 'en-US';
  return 'en-US';
}
