import TUIRoomEngine, { TUIAudioEffectManager } from '@tencentcloud/tuiroom-engine-electron';

export { TUIVoiceReverbType, TUIVoiceChangerType, TUIAudioMusicParam, TUIMusicPlayObserver } from '@tencentcloud/tuiroom-engine-electron';

const audioEffectManager: TUIAudioEffectManager = TUIRoomEngine.getAudioEffectManager();
export default function useAudioEffectManager() {
  return audioEffectManager;
}