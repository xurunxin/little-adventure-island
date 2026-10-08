import {useEffect,useRef,useState} from 'react';
import {Microphone,SpeakerHigh,Star,ClipboardText} from '@phosphor-icons/react';
import {Modal,petNames} from './components';
import {aiStatus,invokeAI} from './ai';
import {companionSystem,factualReply,localIntent,parseCompanionResponse} from './conversation';
import {startVoiceRecording,microphoneErrorMessage} from './voice-recorder';
import {say,stopAudio} from './audio';
import type {State} from './domain';
export function VoiceChat({state,onClose}:{state:State;onClose:()=>void}) {
  const [phase,setPhase]=useState<'idle'|'permission'|'recording'|'thinking'|'speaking'>('idle'),[reply,setReply]=useState('按住小话筒，告诉我你想说什么吧！'),[question,setQuestion]=useState(''),[seconds,setSeconds]=useState(0),[ready,setReady]=useState(false);
  const controller=useRef<AbortController|undefined>(undefined),recorder=useRef<Awaited<ReturnType<typeof startVoiceRecording>>|undefined>(undefined),holding=useRef(false),stateRef=useRef(state),limit=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),generation=useRef(0),busy=useRef(false);
  stateRef.current=state;
  const [note,setNote]=useState('');
  const pointer=useRef<number|undefined>(undefined);
  const cancel=()=>{generation.current++;holding.current=false;pointer.current=undefined;busy.current=false;controller.current?.abort();recorder.current?.stop(false);recorder.current=undefined;clearTimeout(limit.current);stopAudio();};
  useEffect(()=>{let live=true;void aiStatus().then(s=>{if(live)setReady(s.configured);}).catch(()=>{});const hide=()=>{if(document.hidden){cancel();onClose();}};document.addEventListener('visibilitychange',hide);return()=>{live=false;cancel();document.removeEventListener('visibilitychange',hide);};},[onClose]);
  const answer=async(text:string,control:AbortController,token:number)=>{
    setQuestion(text);setPhase('thinking');
    let intent=localIntent(text),response='';
    if(!intent){const result=await invokeAI({operation:'llm',system:`${companionSystem} 当前伙伴物种是${petNames[stateRef.current.companion]}。`,text},control.signal);const parsed=parseCompanionResponse(result.text||'');intent=parsed.intent;response=parsed.reply;}
    if(control.signal.aborted||token!==generation.current)return;
    if(intent!=='chat')response=factualReply(stateRef.current,intent!);
    setReply(response);
    let speech;
    try{speech=await invokeAI({operation:'speech',voice:stateRef.current.settings.voiceId,text:response},control.signal);}catch(error){if(intent!=='chat'&&!control.signal.aborted&&token===generation.current){setNote('网络在休息，可以先听任务图卡哦。');busy.current=false;setPhase('idle');return;}throw error;}
    if(control.signal.aborted||token!==generation.current||document.hidden)return;
    setPhase('speaking');await say('',stateRef.current.settings.volume,speech.audio);
    busy.current=false;setPhase('idle');
  };
  const failure=(error:unknown,control:AbortController)=>{if(!control.signal.aborted){busy.current=false;setPhase('idle');setReply((error as Error).message==='Permission denied'?'请爸爸妈妈允许小话筒，我们再试一次。':'小伙伴暂时没听清，或网络在休息。我们可以先看看任务卡。');}};
  const ask=async(text:string)=>{if(busy.current||!ready)return;cancel();setNote('');busy.current=true;const token=generation.current,control=new AbortController();controller.current=control;try{await answer(text,control,token);}catch(error){failure(error,control);}};
  const finish=async(send=true)=>{
    const waitingForMic=holding.current;holding.current=false;pointer.current=undefined;clearTimeout(limit.current);const r=recorder.current;recorder.current=undefined;
    if(!r){if(waitingForMic){controller.current?.abort();busy.current=false;setPhase('idle');}return;}
    const audio=r.stop(send),control=controller.current!,token=generation.current;
    if(!audio){control.abort();busy.current=false;setPhase('idle');return;}
    setPhase('thinking');setReply('小伙伴正在听懂你的话…');
    try{const result=await invokeAI({operation:'asr',audio},control.signal);const text=result.text?.trim();if(!text)throw new Error('Empty recording');await answer(text,control,token);}catch(error){failure(error,control);}
  };
  const start=async()=>{
    if(busy.current||!ready)return;cancel();holding.current=true;busy.current=true;const control=new AbortController();controller.current=control;const token=generation.current;
    setPhase('permission');stopAudio();
    setNote('');
    try{const r=await startVoiceRecording(control.signal);if(!holding.current||control.signal.aborted||token!==generation.current){r.stop(false);return;}recorder.current=r;setSeconds(0);setPhase('recording');setReply('我在听，慢慢说就好。');limit.current=setTimeout(()=>void finish(),15000);}catch(error){if(!control.signal.aborted&&token===generation.current){holding.current=false;pointer.current=undefined;busy.current=false;setPhase('idle');setReply(microphoneErrorMessage(error));}}
  };
  useEffect(()=>{if(phase!=='recording')return;const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer);},[phase]);
  return <Modal title={`和${state.companionName}聊一聊`} onClose={onClose}>
    <div className="chat-partner"><img src={`/assets/pets/${state.companion}-icon.webp`} alt={state.companionName}/><div className="chat-reply" role="status">{reply}</div></div>
    {question&&<p className="chat-question">你说：{question}</p>}
    {!ready&&<p className="muted">请家长在设置中准备好伙伴的 AI 服务。</p>}
    <div className="chat-shortcuts"><button className="secondary" disabled={!ready||busy.current} onClick={()=>void ask('我有多少星星？')}><Star weight="fill"/>我有多少星星</button><button className="secondary" disabled={!ready||busy.current} onClick={()=>void ask('今天可以做什么任务？')}><ClipboardText/>今天做什么</button></div>
    <button className={`talk-button ${phase==='recording'?'listening':''}`} disabled={!ready||phase==='thinking'||phase==='speaking'} onPointerDown={e=>{if(!e.isPrimary||e.button!==0||busy.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);void start();pointer.current=e.pointerId;}} onPointerUp={e=>{if(pointer.current===e.pointerId)void finish();}} onPointerCancel={e=>{if(pointer.current===e.pointerId)void finish(false);}} onLostPointerCapture={e=>{if(pointer.current===e.pointerId)void finish(false);}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();void start();}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();void finish();}}} aria-label="按住和伙伴说话"><Microphone weight="fill"/>{phase==='recording'?`我在听 · ${seconds} 秒` : phase==='permission'?'打开小话筒…':phase==='thinking'?'伙伴想一想…':'按住说话'}</button>
    <p className="chat-hint"><SpeakerHigh/>{note||'松开后，小伙伴会回答你 · 每次最多 15 秒'}</p>
  </Modal>;
}
