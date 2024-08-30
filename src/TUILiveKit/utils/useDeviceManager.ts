import TUIRoomEngine, { TUIDeviceManager } from '@tencentcloud/tuiroom-engine-electron';

export { TUIMediaDeviceType, TUIMediaDeviceState, TUIMediaDeviceEventType, TUIDeviceInfo } from '@tencentcloud/tuiroom-engine-electron';

const deviceManager:TUIDeviceManager = TUIRoomEngine.getDeviceManager();

export default function useDeviceManager() {
  return deviceManager;
}
