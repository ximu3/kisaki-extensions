/**
 * Webview RPC contract shared between the extension host entry and the
 * webview document. Both sides live in this project, so the types are simply
 * imported on each side; no separate contract package is needed.
 */
export interface ToolSettingsState {
  enabled: boolean
}

export interface HostFunctions {
  loadState(): Promise<ToolSettingsState>
  saveState(state: ToolSettingsState): Promise<void>
  sendTestNotification(): Promise<void>
}

export type UiFunctions = Record<string, never>
