import {useEffect, useRef, useState} from 'react';
import {aiStatus, invokeAI, saveAIKey, clearAIKey, openAIImport, defaultVoice} from './ai';
import type {State, Command} from './domain';
import {say,stopAudio} from './audio';
import {defaultVoiceLabel} from './voice-config';
export function AISettings({state,act,onError}:{state:State;act:(c:Command)=>Promise<boolean>;onError:(s:string)=>void}) {
  const [status,setStatus]=useState<{configured:boolean;native:boolean}>(),[key,setKey]=useState(''),[description,setDescription]=useState('温柔明亮的普通话声音，像亲切的幼儿园老师，清晰自然，语速舒缓。'),[busy,setBusy]=useState(false),[designed,setDesigned]=useState<{id:string;audio:string}>(),[message,setMessage]=useState('');
  const controller=useRef<AbortController|undefined>(undefined);
  const [existing,setExisting]=useState<Array<{id:string;name:string}>>([]),[voiceId,setVoiceId]=useState('');
  const refresh=()=>void aiStatus().then(setStatus).catch(()=>setStatus(undefined));
  useEffect(()=>{refresh();const cancel=()=>{if(document.hidden){controller.current?.abort();stopAudio();}};document.addEventListener('visibilitychange',cancel);const timer=setInterval(refresh,5000);return()=>{controller.current?.abort();stopAudio();clearInterval(timer);document.removeEventListener('visibilitychange',cancel);};},[]);
  const work=async(callback:(signal:AbortSignal)=>Promise<void>)=>{if(busy)return;const control=new AbortController();controller.current=control;setBusy(true);try{await callback(control.signal);}catch(e){if(!control.signal.aborted)onError((e as Error).message);}finally{if(!control.signal.aborted)setBusy(false);}};
  return <section className="ai-settings"><h2>小伙伴的 AI 能力</h2>
    <p className="muted">任务和积分离线保存。语音对话、配图和新语音生成需要联网，会使用您的 MiniMax 服务额度。开启对话后，录音会发送到 MiniMax 识别，本机不保存对话录音或聊天历史。</p>
    <p className={status?.configured?'positive':'muted'}>{status?.configured?'✓ MiniMax 已配置':'MiniMax 尚未配置'}</p>
    {status?.native&&<><label>MiniMax API Key<input aria-label="MiniMax API Key" type="password" autoComplete="off" value={key} placeholder="输入新的 Key 后保存" onChange={e=>setKey(e.target.value)}/></label><div className="admin-card-actions"><button className="secondary" disabled={!key.trim()||busy} onClick={()=>void work(async()=>{await saveAIKey(key.trim());setKey('');refresh();setMessage('密钥已加密保存在这台平板上。');})}>保存密钥</button><button className="secondary" onClick={()=>void openAIImport().then(()=>setMessage('已准备好，2 分钟内可从电脑导入环境变量中的密钥。')).catch(e=>onError(e.message))}>从电脑导入</button>{status.configured&&<button className="secondary" onClick={()=>void clearAIKey().then(()=>{refresh();setMessage('密钥已移除。');})}>移除密钥</button>}</div></>}
    {status&&!status.native&&<p className="muted">本机预览使用电脑环境变量 MINIMAX_CN_API_KEY；安卓安装后使用平板上的加密配置。</p>}
    <label className="check-row"><input type="checkbox" checked={state.settings.conversation} disabled={!status?.configured} onChange={e=>void act({type:'settings',settings:{...state.settings,conversation:e.target.checked}})}/>开放与小伙伴语音对话</label>
    <label>伙伴音色<select value={designed?.id===state.settings.voiceId?'custom':state.settings.voiceId===defaultVoice?'default':'custom'} onChange={e=>{if(e.target.value==='default')void act({type:'settings',settings:{...state.settings,voiceId:defaultVoice}});}}><option value="default">{defaultVoiceLabel}</option>{state.settings.voiceId!==defaultVoice&&<option value="custom">已设计的专属音色</option>}</select></label>
    <label>描述一个专属声音<textarea rows={3} maxLength={600} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <button className="secondary" disabled={!status?.configured||busy||!description.trim()} onClick={()=>void work(async(signal)=>{const r=await invokeAI({operation:'design',text:description},signal);if(!r.voiceId||!r.audio)throw new Error('没有收到完整的音色结果。');setDesigned({id:r.voiceId,audio:r.audio});})}>{busy?'伙伴正在准备…':'设计并试听声音'}</button>
    {designed&&<div className="voice-preview"><button className="secondary" onClick={()=>void say('',state.settings.volume,designed.audio)}>试听新音色</button><button className="primary" disabled={busy} onClick={()=>void work(async(signal)=>{await invokeAI({operation:'speech',voice:designed.id,text:'你好呀，我们一起完成今天的小任务吧。'},signal);if(await act({type:'settings',settings:{...state.settings,voiceId:designed.id}}))setMessage('专属音色已启用。');})}>使用这个声音</button></div>}
    <h3>使用已有的 voice_id</h3>
    <p className="muted">可以沿用之前通过接口设计的声音。先用 TTS 试听，成功后保存为伙伴音色。</p>
    <button className="secondary" disabled={!status?.configured||busy} onClick={()=>void work(async signal=>{const r=await invokeAI({operation:'voices'},signal);setExisting(r.voices||[]);setMessage(r.voices?.length?'已读取账号中设计的声音。':'这个 Key 下暂时没有已激活的设计音色。');})}>读取已有音色</button>
    {existing.length>0&&<label>选择已有音色<select value={voiceId} onChange={e=>setVoiceId(e.target.value)}><option value="">请选择</option>{existing.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
    <label>已有 voice_id<input maxLength={160} value={voiceId} onChange={e=>setVoiceId(e.target.value)} placeholder="ttv-voice-…"/></label>
    <button className="secondary" disabled={!status?.configured||busy||!voiceId.trim()} onClick={()=>void work(async signal=>{const r=await invokeAI({operation:'speech',voice:voiceId.trim(),text:'你好呀，我是你的小伙伴。我们一起完成今天的小任务吧！'},signal);if(!r.audio)throw new Error('没有收到试听音频。');setDesigned({id:voiceId.trim(),audio:r.audio});void say('',state.settings.volume,r.audio);})}>用这个 ID 生成试听</button>
    {message&&<p role="status">{message}</p>}
  </section>;
}
