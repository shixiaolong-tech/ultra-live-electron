import { api } from '@/lib/api';
import { LoginType } from '@/views/Login/types';
import { LOCAL_STORAGE_KEY_USER_INFO } from '@/const/local';

export const getUserInfo = async () => {
  try {
    const userInfoResponse = await api.user.getUserInfo();
    if (userInfoResponse.code === 200 && userInfoResponse.data) {
      const data = {
        userId: userInfoResponse.data?.userId,
        userName: userInfoResponse.data?.name,
        userSig: userInfoResponse.data?.userSig,
        avatarUrl: userInfoResponse.data?.avatar,
        loginType: LoginType.SDKSecretKey
      }
      window.localStorage.setItem(LOCAL_STORAGE_KEY_USER_INFO, JSON.stringify(data));
      return data;
    }
    return null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}
