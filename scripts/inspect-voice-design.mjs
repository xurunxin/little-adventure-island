const response = await fetch('https://api.minimax.cn/v1/voice_design', {method:'POST',headers:{Authorization:`Bearer ${process.env.MINIMAX_CN_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prompt:'A warm, gentle female voice speaking clear Mandarin Chinese, like a friendly preschool teacher. Calm, bright and natural.',preview_text:'你好呀，我们一起完成今天的小任务吧。'}),signal:AbortSignal.timeout(90000)});
const data=await response.json();
console.log(JSON.stringify({http:response.status,code:data.base_resp?.status_code,message:data.base_resp?.status_msg,fields:Object.keys(data)}));
