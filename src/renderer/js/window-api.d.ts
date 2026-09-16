// ==========================================================================
// windowAPI 全局类型声明
// ==========================================================================

/** 窗口控制动作联合类型 */
export type WindowControlAction = 'minimize' | 'maximize' | 'close';

/** 窗口控制 API 接口 */
export interface WindowAPI {
  /** 最小化窗口 */
  minimize(): Promise<void>;
  /** 最大化/还原窗口 */
  maximize(): Promise<void>;
  /** 关闭窗口 */
  close(): Promise<void>;
}

declare global {
  interface Window {
    windowAPI: WindowAPI;
  }
}