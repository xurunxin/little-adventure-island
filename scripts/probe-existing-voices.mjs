import {invokeMiniMax} from '../server/minimax.mjs';
import {writeFileSync} from 'node:fs';
try {
 const r=await invokeMiniMax({operation:'voices'});
 writeFileSync('evidence/private/existing-voices.json',JSON.stringify(r,null,2));
 console.log(JSON.stringify({ok:true,count:r.voices.length}));
} catch(e){console.log(JSON.stringify({ok:false,error:e.message}));}
