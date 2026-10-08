import {readFileSync,writeFileSync} from 'node:fs';
import {invokeMiniMax} from '../server/minimax.mjs';
const voices=JSON.parse(readFileSync('evidence/private/existing-voices.json','utf8')).voices;
const voice=voices[0];
try {
 const r=await invokeMiniMax({operation:'speech',voice:voice.id,text:'你好呀，我是你的小伙伴。你现在有十八颗星星，完成任务后请家长确认哦。'});
 const bytes=Buffer.from(r.audio.split(',')[1],'base64');writeFileSync('evidence/existing-designed-voice-tts.mp3',bytes);
 writeFileSync('evidence/private/existing-voice-tts.json',JSON.stringify({voiceId:voice.id,ok:true,bytes:bytes.length}));
 console.log(JSON.stringify({ok:true,existingDesignedVoices:voices.length,ttsBytes:bytes.length}));
}catch(error){console.log(JSON.stringify({ok:false,error:error.message}));}
