// Capture short-lived PCM in memory and send standard mono WAV to ASR.
export function microphoneErrorMessage(error:unknown) {
  const name=(error as {name?:string})?.name;
  if(name==='NotAllowedError'||name==='SecurityError')return '小话筒还没有获得权限，请爸爸妈妈在系统设置中允许麦克风，再按住试试。';
  if(name==='NotFoundError')return '没有找到小话筒，请爸爸妈妈检查这台设备。';
  if(name==='NotReadableError'||name==='AbortError')return '小话筒暂时打不开，请关闭其他录音应用，再按住试试。';
  return '小话筒没有打开，请爸爸妈妈检查麦克风权限，再按住试试。';
}
export function wavData(samples:Float32Array,sampleRate:number) {
  const length=Math.floor(samples.length*16000/sampleRate), buffer=new ArrayBuffer(44+length*2), view=new DataView(buffer);
  const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++) {
    const from=Math.floor(i*sampleRate/16000),to=Math.max(from+1,Math.floor((i+1)*sampleRate/16000));let sum=0;
    for(let j=from;j<to&&j<samples.length;j++)sum+=samples[j];
    const s=Math.max(-1,Math.min(1,sum/(to-from)));view.setInt16(44+i*2,s*(s<0?32768:32767),true);
  }
  let binary='';const bytes=new Uint8Array(buffer);for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return `data:audio/wav;base64,${btoa(binary)}`;
}
export async function startVoiceRecording(signal:AbortSignal) {
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
  if(signal.aborted||document.hidden){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Cancelled','AbortError');}
  const context=new AudioContext();await context.resume();
  const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(2048,1,1),mute=context.createGain();mute.gain.value=0;
  const chunks:Float32Array[]=[];let count=0,stopped=false;const start=performance.now();
  processor.onaudioprocess=event=>{if(stopped||count>=context.sampleRate*15)return;const data=new Float32Array(event.inputBuffer.getChannelData(0));chunks.push(data);count+=data.length;};
  source.connect(processor);processor.connect(mute);mute.connect(context.destination);
  const stop=(send:boolean)=>{
    if(stopped)return;stopped=true;processor.onaudioprocess=null;processor.disconnect();source.disconnect();mute.disconnect();stream.getTracks().forEach(t=>t.stop());void context.close();signal.removeEventListener('abort',cancel);
    if(!send||performance.now()-start<350)return;
    const merged=new Float32Array(count);let at=0;for(const chunk of chunks){merged.set(chunk,at);at+=chunk.length;}chunks.length=0;
    return wavData(merged,context.sampleRate);
  };
  const cancel=()=>stop(false);signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();
  return {stop};
}
