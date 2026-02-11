// API配置和HTTP客户端
// 动态获取API基础路径，可通过环境变量 VITE_API_BASE_URL 在编译期设置
export const getApiBaseUrl = () => {
  // 优先使用环境变量，如果没有设置则使用默认值
  return 'https://xmarslive.com/api';
};

const API_BASE_URL = getApiBaseUrl();

// WebSocket URL
const WS_URL = 'wss://ws.thesuite.dev';
export const getWebSocketEndpoint = () => WS_URL;

// 通用响应类型
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}
export const devToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxMDExIiwiaWF0IjoxNzU5MTEzNjcyLCJleHAiOjE3NjE3MDU2NzIsInRva2VuSWQiOiJiYmVkNmM4OTMxOTI0YzAxODU5NzhhYjI3OTY2NGRkYyJ9.i69e0KP5M2PctJ8Ltt9Yz-FsQ4SnpUYgVi_3waXA2EV2PWxFzXTZZBdIZ00G5e1ot5257Ok16hPhx3xfmwM1LA'

export const getUserToken = () => {
  try {
    const userStore = localStorage.getItem('billion-live-token') as any;
    if (userStore) {
      return userStore;
    }
    return null;
  } catch (e) {
    return null;
  }
}
export interface UserProfile {
  userId?: number;
  trtcUserId?: string;
  name: string;
  username: string;
  avatar: string;
  banner: string;
  bio: string;
  twitter?: string;
  badge?: string;
  followers: string;
  following: string;
  userPosts: number;
  joinDate: string;
  location?: string;
  website?: string;
  shareCount?: number;
  totalBalance?: number;
  hlBalance?: number;
  userSig?: string;
  pointsUserList: any[];
  consumeLevel?: number;
  lighted?: boolean;
  isBlocked?: boolean; // 非自己的用户，是否被拉黑
  banPost?: boolean; // 是否被禁言
  banComment?: boolean; // 是否被禁言
  banGroupChat?: boolean; // 是否被禁言
  banLiveChat?: boolean; // 是否被禁言
  isOfficial?: number; // 是否为官方认证 0否 1是
}
// HTTP客户端类
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = getUserToken();
  }

  // 通用请求方法
  private async request<T = any>(
    endpoint: string,
    options: RequestInit & { skipToken?: boolean } = {},
    extra: Record<string, unknown> = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    if (!this.token && !extra.skipToken) {
      this.token = getUserToken();
    }
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    // 如果不跳过token，则添加token
    if (!extra.skipToken) {
      headers.token = this.token || '';
    }
    // 如果不是 FormData 类型的请求，则设置 Content-Type
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  // GET请求
  async get<T = any>(
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    let query = '';
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      query = queryParams.toString();
    }
    return this.request<T>(query ? `${endpoint}?${query}` : endpoint, {
      method: 'GET',
    });
  }
  // POST请求
  async post<T = any>(endpoint: string, data?: any, extra?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, extra);
  }

  // upload
  async upload<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', data);
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  }
}

// 创建API客户端实例
export const apiClient = new ApiClient(API_BASE_URL);

// API服务
export const api = {
  user: {
    // 获取用户详细信息
    getUserInfo: () => apiClient.get<UserProfile>('/app/user/getUserProfile'),
  },
  assistant: {
    // 直播助手验证码登录
    loginByCode: (loginCode: string) => apiClient.post<{
      token: string;
      expire: number;
      userId: number;
      userName: string;
      avatar: string;
    }>(
      '/app/user/assistant/loginByCode',
      { 
        loginCode,  
      },
      {
        skipToken: true,
      }
    ),
  },
  room: {
    // 上传直播封面
    uploadLiveCover: (file: File) => {
      return apiClient.upload('/app/room/uploadFile', file);
    },
    // 创建直播房间
    createLiveRoom: (data: any) => {
      return apiClient.post<{
        userSig: string;
        sdkAppId: number;
        playbackUrl: string;
        obsStreamUrl: string;
        roomId: number;
        obsStreamKey: string;
        obsServer: string;
      }>('/app/room/createLiveRoom', data);
    },
    stopLiveWithTRTC: (roomId: number) => apiClient.post<{
      success: boolean;
    }>('/app/room/stopLiveWithTRTC', { roomId }),
    // 更新直播信息 status 1: 开播, 0: 结束
    updateRoomStatus: ({roomId, status}: {roomId: string, status: number}) => apiClient.post<{
      success: boolean;
    }>('/app/room/updateRoomStatus', {roomId, status}),
    // 检查用户直播间状态
    checkUserLiveStatus: (roomId: number) => apiClient.get<{
      status: number;
    }>('/app/room/checkUserLiveStatus', { roomId }),
    // 获取用户信息（通过用户ID）
    getUserInfo: (userId: string) => apiClient.get('/app/user/getUserInfo', { userId }),
    // 获取当前直播状态
    getCurrentLiveStatus: () => apiClient.get<{
      status: number;
      isLive: boolean;
      roomId: number | null;
      roomName: string;
      roomType: number;
      playingMethod: string;
      streamingMode: string;
      roomImg: string;
      obsServer: string;
      obsStreamKey: string;
      userSig: string;
      sdkAppId: number;
    }>('/app/room/getCurrentLiveStatus'),
    // 获取直播间评论列表
    selectRoomChatList: (params: { page: number; limit: number; roomId: number }) => apiClient.get<{
      totalCount: number;
      pageSize: number;
      totalPage: number;
      currPage: number;
      list: Array<any>;
    }>('/app/room/selectRoomChatList', params),
    // 获取直播间人数、礼物列表详情
    getRoomGiftRankingList: (params: { roomId: string; type: number }) => apiClient.get<{
      currentRoomUserCount: number;
      rankingList: Array<any>;
      myRanking: any;
      totalViewerCount: number;
    }>('/app/room/getRoomGiftRankingList', params),
  },
  category: {
    // 获取热门直播分类
    getHotLiveCategory: (params: { page: number; limit: number }) => apiClient.get<Array<{
      id: number;
      name: string;
      nameEn: string;
      imageUrl: string;
    }>>('/app/hotLiveCategory/list', params),
  }
}

export default api;
