import { api } from '@/lib/api';

// 本地存储的 key
export const LOCAL_STORAGE_KEY_USER_INFO = 'billion-live-userInfo';
export const LOCAL_STORAGE_KEY_LIVE_RESULT = 'billion-liveResult';
export const LOCAL_STORAGE_KEY_TOKEN = 'billion-live-token';


export const SDKAppID = 20030277;
export const SDKSecretKey = '82113b6566a80533e6e5fd7f80b72df5d4d448d667713cb9478bc97b6ac78bf7';

// 清除所有信息
export const clearAllLocalStorage = () => {
  window.localStorage.removeItem(LOCAL_STORAGE_KEY_USER_INFO);
  window.localStorage.removeItem(LOCAL_STORAGE_KEY_LIVE_RESULT);
  window.localStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
  api.resetToken('');
}
