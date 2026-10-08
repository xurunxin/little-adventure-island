import { Capacitor, registerPlugin } from '@capacitor/core';

export {defaultVoice} from './voice-config';
export type AIInput = { operation: 'asr' | 'llm' | 'speech' | 'image' | 'design' | 'voices'; text?: string; system?: string; voice?: string; audio?: string };
export type AIResult = { text?: string; audio?: string; image?: string; voiceId?: string; voices?: Array<{id:string;name:string}> };
interface NativeAI {
  getStatus(): Promise<{ configured: boolean; native: boolean }>;
  invoke(input: AIInput & { requestId: string }): Promise<AIResult>;
  cancel(input: {requestId: string}): Promise<void>;
  setKey(input: {key: string}): Promise<void>;
  clearKey(): Promise<void>;
  openImport(): Promise<void>;
  completeBootstrap(): Promise<void>;
}
const bridge = registerPlugin<NativeAI>('MiniMaxAI');
export async function aiStatus() {
  if (Capacitor.isNativePlatform()) return bridge.getStatus();
  if (!import.meta.env.DEV) return { configured: false, native: false };
  const response = await fetch('/api/ai');
  if (!response.ok) throw new Error('无法检查 AI 服务。');
  return { ...(await response.json() as {configured: boolean}), native: false };
}
export async function invokeAI(input: AIInput, signal?: AbortSignal): Promise<AIResult> {
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('网络正在休息，请连接网络后再试。');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (Capacitor.isNativePlatform()) {
    const requestId = crypto.randomUUID();
    const cancel = () => void bridge.cancel({ requestId });
    signal?.addEventListener('abort', cancel, {once: true});
    try {
      const result = await bridge.invoke({...input, requestId});
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      return result;
    } finally { signal?.removeEventListener('abort', cancel); }
  }
  if (!import.meta.env.DEV) throw new Error('请在安卓 App 中配置 AI 服务。');
  const response = await fetch('/api/ai', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input), signal});
  const result = await response.json() as AIResult & {error?: string};
  if (!response.ok || result.error) throw new Error(result.error || 'AI 服务暂时不可用。');
  return result;
}
export const saveAIKey = (key: string) => bridge.setKey({key});
export const clearAIKey = () => bridge.clearKey();
export const openAIImport = () => bridge.openImport();
export async function completeAIBootstrap() {
  if (Capacitor.isNativePlatform()) await bridge.completeBootstrap();
}
