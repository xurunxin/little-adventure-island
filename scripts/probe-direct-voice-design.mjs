import {writeFileSync} from 'node:fs';
const host='https://api.minimaxi.com/v1/';
const response=await fetch(host+'voice_design',{method:'POST',headers:{Authorization:`Bearer ${process.env.MINIMAX_CN_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prompt:'温柔明亮的普通话女性声音，像亲切的幼儿园老师，清晰自然，语速舒缓，活泼但不夸张。',preview_text:'你好呀，我是你的小伙伴。我们一起完成今天的小任务吧！'}),signal:AbortSignal.timeout(90000)});
const data=await response.json();
const report={endpoint:host+'voice_design',http:response.status,code:data.base_resp?.status_code,message:data.base_resp?.status_msg,fields:Object.keys(data)};
if(!data.base_resp?.status_code&&data.voice_id){
 report.voiceId=data.voice_id;
 writeFileSync('evidence/minimax-direct-designed-voice.mp3',Buffer.from(data.trial_audio,'hex'));
 const tts=await fetch(host+'t2a_v2',{method:'POST',headers:{Authorization:`Bearer ${process.env.MINIMAX_CN_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'speech-2.8-hd',text:'你好呀，我们一起完成今天的小任务吧。',voice_setting:{voice_id:data.voice_id,speed:.92,vol:1,pitch:0},audio_setting:{sample_rate:32000,bitrate:128000,format:'mp3',channel:1},language_boost:'Chinese',stream:false,output_format:'hex'}),signal:AbortSignal.timeout(90000)});
 const audio=await tts.json();report.ttsCode=audio.base_resp?.status_code;report.ttsMessage=audio.base_resp?.status_msg;
 if(audio.data?.audio)writeFileSync('evidence/minimax-direct-designed-tts.mp3',Buffer.from(audio.data.audio,'hex'));
}
writeFileSync('evidence/minimax-direct-voice-design.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
