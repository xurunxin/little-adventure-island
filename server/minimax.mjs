// Development-only proxy. The APK uses the native Android Keystore bridge.
const endpoint='https://api.minimax.cn/v1/';
export async function invokeMiniMax(input,key=process.env.MINIMAX_CN_API_KEY){
 if(!key)throw new Error('请先配置 MiniMax API Key。');
 const signal=AbortSignal.timeout(90000);let path,body,headers={Authorization:`Bearer ${key}`};
 const text=String(input.text||'').slice(0,2000),voice=String(input.voice||'Chinese (Mandarin)_Cute_Spirit').slice(0,160);
 switch(input.operation){
  case 'llm':path='text/chatcompletion_v2';body={model:'MiniMax-M3',messages:[{role:'system',content:String(input.system||'').slice(0,12000)},{role:'user',content:text}],stream:false,max_completion_tokens:2048};break;
  case 'speech':path='t2a_v2';body={model:'speech-2.8-hd',text,voice_setting:{voice_id:voice,speed:.92,vol:1,pitch:0,text_normalization:true},audio_setting:{format:'mp3',sample_rate:32000,bitrate:128000,channel:1},language_boost:'Chinese',output_format:'hex',stream:false};break;
  case 'image':path='image_generation';body={model:'image-01',prompt:text,aspect_ratio:'1:1',n:1,response_format:'base64',prompt_optimizer:false};break;
  case 'design':path='voice_design';body={prompt:text,preview_text:'你好呀，我是你的小伙伴。我们一起完成今天的小任务吧！'};break;
  case 'voices':path='get_voice';body={voice_type:'voice_generation'};break;
  case 'asr':{path='speech_to_text';body=new FormData();body.set('model','asr-1.0');body.set('response_format','json');const data=String(input.audio||'');if(!/^data:audio\/wav;base64,[a-z0-9+/=]+$/i.test(data)||data.length>1000000)throw new Error('录音格式或长度不正确。');body.set('file',new Blob([Buffer.from(data.split(',')[1],'base64')],{type:'audio/wav'}),'voice.wav');headers.language='zh';break;}
  default:throw new Error('不支持的 AI 操作。');
 }
 if(!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
 const response=await fetch(endpoint+path,{method:'POST',headers,body,signal});const data=await response.json();if(!response.ok||data.base_resp?.status_code){if(data.base_resp?.status_code===2061)throw new Error('当前 Key 的套餐不支持这项能力，可使用内置音色或在家长设置中更换 Key。');throw new Error(`MiniMax 请求失败（${data.base_resp?.status_code||response.status}），请检查网络和服务额度。`);}
 if(input.operation==='llm')return {text:String(data.choices?.[0]?.message?.content||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim()};
 if(input.operation==='asr')return {text:String(data.text||'')};
 if(input.operation==='voices')return {voices:(data.voice_generation||[]).map(v=>({id:v.voice_id,name:v.voice_name||v.voice_id}))};
 if(input.operation==='speech'){const hex=data.data?.audio;if(typeof hex!=='string'||!/^[a-f0-9]+$/i.test(hex))throw new Error('语音服务没有返回有效音频。');return {audio:`data:audio/mp3;base64,${Buffer.from(hex,'hex').toString('base64')}`};}
 if(input.operation==='design')return {voiceId:data.voice_id,audio:`data:audio/mp3;base64,${Buffer.from(data.trial_audio||'','hex').toString('base64')}`};
 const encoded=data.data?.image_base64?.[0];if(!encoded)throw new Error('图片服务没有返回有效图片。');return {image:encoded.startsWith('data:')?encoded:`data:image/jpeg;base64,${encoded}`};
}
export function minimaxDevelopmentPlugin(){return {name:'local-minimax',configureServer(server){server.middlewares.use('/api/ai',async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');try{const remote=req.socket.remoteAddress;if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote))throw new Error('AI 调试仅允许本机访问。');if(req.method==='GET'){res.end(JSON.stringify({configured:!!process.env.MINIMAX_CN_API_KEY}));return;}if(req.method!=='POST')throw new Error('Unsupported method');const origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))throw new Error('Unsupported origin');let body='';for await(const chunk of req){body+=chunk;if(body.length>1200000)throw new Error('Request too large');}res.end(JSON.stringify(await invokeMiniMax(JSON.parse(body))));}catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}});}};}
