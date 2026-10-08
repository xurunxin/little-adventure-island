import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const additions=['rewards/mystery-gift','tasks/read-alone'];
const manifest=JSON.parse(await readFile('design/art-manifest.json','utf8'));
for(const name of additions){
  const source=`${name}.png`,runtime=`${name}.webp`;
  const info=await sharp(`public/assets/${source}`).metadata();
  if(name.startsWith('rewards/')&&!info.hasAlpha)throw new Error('Reward image must retain transparency');
  const result=await sharp(`public/assets/${source}`).resize(640,640,{fit:'cover'}).webp({quality:92,alphaQuality:100,effort:6}).toFile(`public/assets/${runtime}`);
  const row={source,runtime,width:result.width,height:result.height,bytes:result.size,alpha:info.hasAlpha};
  const index=manifest.findIndex(item=>item.source===source);
  if(index<0)manifest.push(row);else manifest[index]=row;
  const data=await readFile(`public/assets/${runtime}`);
  console.log(JSON.stringify({...row,sha256:createHash('sha256').update(data).digest('hex')}));
}
await writeFile('design/art-manifest.json',JSON.stringify(manifest,null,2));
