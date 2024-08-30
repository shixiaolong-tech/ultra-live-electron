import { defineStore } from 'pinia';
import useAudioEffectManager, { TUIAudioMusicParam } from '../utils/useAudioEffectManager';
import { safelyParse } from "../utils/utils"
const audioEffectManager = useAudioEffectManager();

interface musicDataStoreType {
  musicData: musicDataType;
  playingMusicId:number;

}
export enum PlayModeType {
  SingleLoopPlay = 'SingleLoopPlay',
  SequentialPlay = 'SequentialPlay'
}

type InfoType = {
  selectId : number;
  activeId : number;
}

interface musicDataType{
  musicDataList:Array<TUIAudioMusicParam>;
  musicIdSeed: number;
  musicVolume: number;
  currentPlayMode: PlayModeType;
  audioEffectInfo:InfoType;
  changeVoiceInfo:InfoType;
}

const musicDataDefaultValue:musicDataType = {
  musicDataList:[{
    id: 0,
    path:
        'https://web.sdk.qcloud.com/trtc/electron/download/resources/media/bgm/PositiveHappyAdvertising.mp3',
    loopCount: 0,
    publish: true,
    isShortFile: false,
    startTimeMS: 0,
    endTimeMS: 0
  }],
  musicIdSeed:0,
  musicVolume:0,
  currentPlayMode:PlayModeType.SequentialPlay,
  audioEffectInfo:{selectId:0,activeId:0},
  changeVoiceInfo:{selectId:0,activeId:0}
}

const isMusicDataType = (musicData:musicDataType):boolean => {
  return (musicData&&
    typeof musicData === 'object'&&
    musicData.musicDataList&&
    typeof musicData.musicIdSeed === 'number' &&
    typeof musicData.currentPlayMode === 'string'&&
    typeof musicData.musicVolume === 'number'&&
    typeof musicData.changeVoiceInfo === 'object'&&
    typeof musicData.audioEffectInfo === 'object'
  )
}
export const useMusicDataStore = defineStore('musicData', {
  state: (): musicDataStoreType => ({
    musicData: isMusicDataType(safelyParse(localStorage.getItem('musicData') as string)) ? safelyParse(localStorage.getItem('musicData') as string):musicDataDefaultValue,
    playingMusicId:-1,
  }),
  getters: {
    musicName(state) {
      return (id: number) => {
        for (const item of state.musicData.musicDataList) {
          if (item.id === id) {
            let postfix: string|undefined = '';
            if (item.path.includes('/')) {
              postfix = (item.path.split('/')).pop();
            }
            else {
              postfix = (item.path.split('\\')).pop();
            }
            return postfix ?.split('.')[0];
          }
        }
      };
    }
  },
  actions: {
    addMusic(musicFile: File&{path: string}) {
      const data: TUIAudioMusicParam = {
        id: this.generateNewId(),
        path: musicFile.path,
        loopCount: 2,
        publish: true,
        isShortFile: false,
        startTimeMS: 0,
        endTimeMS: 0
      };
      this.musicData.musicDataList.push(data);
      this.updateMusicData(this.getMusicDataOrigin());
    },
    deleteMusic(id: number) {
      for (const i in this.musicData.musicDataList) {
        const item = this.musicData.musicDataList[i];
        if (item.id === id) {
          this.musicData.musicDataList.splice(+i, 1);
          this.updateMusicData(this.getMusicDataOrigin());
          return;
        }
      }
    },
    updateMusicData(data:musicDataType) {
      this.musicData = data;
      localStorage.setItem('musicData', JSON.stringify(data));
      window.mainWindowPort?.postMessage({
        key:"updateMusicData",
        data,
      });

    },
    updatePlayingMusicId(id:number){
      this.playingMusicId = id;
    },
    updateAudioEffectOrChangeVoiceInfo(prop:"audioEffectInfo" | "changeVoiceInfo",Info:InfoType){
      this.musicData[prop] = Info;
      this.updateMusicData(this.getMusicDataOrigin());
    },
    setMusicVolume(volume: number) {
      this.musicData.musicVolume = volume;
      this.updateMusicData(this.getMusicDataOrigin());
    },
    setPlayingMusicId(id: number) {
      this.playingMusicId = id;
      this.updatePlayingMusicId(id);
    },
    setCurrentPlayMode(playModeKey: PlayModeType) {
      this.musicData.currentPlayMode = PlayModeType[playModeKey];
      this.updateMusicData(this.getMusicDataOrigin());
    },
    getMusicPath(id: number): string {
      for(let i=0;i<this.musicData.musicDataList?.length;i++){
        if(this.musicData.musicDataList[i].id === id){
          return this.musicData.musicDataList[i].path
        }
      }
      return '';
    },
    getMusicIndex(id: number): number {
      for (const i in this.musicData.musicDataList) {
        if (this.musicData.musicDataList[i].id === id) {
          return +i;
        }
      }
      return -1;
    },
    getMusicDataOrigin(){
      return safelyParse(JSON.stringify(this.musicData));
    }
    ,
    getMusicDataLength(): number {
      return this.musicData.musicDataList?.length;
    },
    isRepetition(musicFile: File&{path: string}): boolean {
      for(let i=0;i < this.musicData.musicDataList?.length;i++){
        if(!this.musicData.musicDataList[i])return false;
        if(this.musicData.musicDataList[i].path === musicFile.path){
          return true;
        }
      }
      return false;
    },
    generateNewId():number {
      if (this.musicData.musicIdSeed + 1 >= (Math.pow(2, 31) - 1)) {
        this.musicData.musicIdSeed = 0;
      } else {
        ++this.musicData.musicIdSeed;
      }
      return this.musicData.musicIdSeed;
    },
    initChangeVoiceAndAudioEffect(){
      audioEffectManager.setVoiceReverbType(this.musicData.audioEffectInfo.activeId);
      audioEffectManager.setVoiceChangerType(this.musicData.changeVoiceInfo.activeId);
    }
  }
});
