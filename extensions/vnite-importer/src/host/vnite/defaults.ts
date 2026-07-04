import type {
  VniteGameAppearance,
  VniteGameDoc,
  VniteGameLocalDoc,
  VniteGameMetadata,
  VniteGameRecord,
  VniteGameSave,
  VniteLauncherMode,
  VniteMonitorMode
} from './models'

export const DEFAULT_VNITE_PLAY_STATUS = 'unplayed'
export const DEFAULT_VNITE_LAUNCHER_MODE: VniteLauncherMode = 'file'
export const DEFAULT_VNITE_MONITOR_MODE: VniteMonitorMode = 'process'

export function createDefaultVniteMetadata(): VniteGameMetadata {
  return {
    name: '',
    originalName: '',
    sortName: '',
    releaseDate: '',
    description: '',
    developers: [],
    publishers: [],
    platforms: [],
    genres: [],
    tags: [],
    relatedSites: [],
    steamId: '',
    vndbId: '',
    igdbId: '',
    ymgalId: '',
    extra: []
  }
}

export function createDefaultVniteRecord(): VniteGameRecord {
  return {
    addDate: '',
    lastRunDate: '',
    score: -1,
    playTime: 0,
    playStatus: DEFAULT_VNITE_PLAY_STATUS,
    hideFromRecentGames: false,
    timers: [],
    dailyPlayTimes: [],
    storageSize: 0
  }
}

export function createDefaultVniteSave(): VniteGameSave {
  return {
    saveList: {},
    maxBackups: 0,
    autoRestoreSave: false
  }
}

export function createDefaultVniteAppearance(): VniteGameAppearance {
  return {
    logo: {
      position: { x: 0, y: 0 },
      size: 1,
      visible: true
    },
    nsfw: false
  }
}

export function createDefaultVniteGameDoc(id: string): VniteGameDoc {
  return {
    _id: id,
    metadata: createDefaultVniteMetadata(),
    record: createDefaultVniteRecord(),
    save: createDefaultVniteSave(),
    memory: { memoryList: {} },
    apperance: createDefaultVniteAppearance()
  }
}

export function createDefaultVniteGameLocalDoc(id: string): VniteGameLocalDoc {
  return {
    _id: id,
    path: {
      gamePath: '',
      savePaths: []
    },
    launcher: {
      mode: DEFAULT_VNITE_LAUNCHER_MODE,
      fileConfig: {
        path: '',
        args: [],
        monitorMode: DEFAULT_VNITE_MONITOR_MODE,
        monitorPath: ''
      },
      urlConfig: {
        url: '',
        browserPath: '',
        monitorMode: DEFAULT_VNITE_MONITOR_MODE,
        monitorPath: ''
      },
      scriptConfig: {
        workingDirectory: '',
        command: [],
        monitorMode: DEFAULT_VNITE_MONITOR_MODE,
        monitorPath: ''
      },
      useMagpie: false
    },
    utils: {
      markPath: '',
      rootPath: ''
    }
  }
}
