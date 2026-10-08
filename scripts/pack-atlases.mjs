import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
const folder='public/assets/atlases';await mkdir(folder,{recursive:true});
async function atlas(name,items,maxSize){
 let x=2;const images=[],frames={};let height=0;
 for(const [key,file] of items){const data=await sharp(file).resize({width:maxSize,height:maxSize,fit:'inside',withoutEnlargement:true}).png().toBuffer();const {width:w,height:h}=await sharp(data).metadata();images.push({input:data,left:x,top:2});frames[key]={frame:{x,y:2,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}};x+=w+4;height=Math.max(height,h+4);}
 await sharp({create:{width:x,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(images).png({compressionLevel:9}).toFile(`${folder}/${name}.png`);
 await writeFile(`${folder}/${name}.json`,JSON.stringify({frames,meta:{image:`${name}.png`,format:'RGBA8888',size:{w:x,h:height},scale:'1'}},null,2));
}
for(const pet of ['fox','rabbit','bear'])await atlas(pet,[[pet,`public/assets/pets/${pet}.png`],[`${pet}-happy`,`public/assets/pets/${pet}-happy.png`]],768);
await atlas('effects',[['star','public/assets/star.png'],...['hat','bag','crown'].map(name=>[name,`public/assets/decor/${name}.png`])],256);
console.log('Packed three companion atlases and one effects/accessories atlas. Source PNGs retained for UI.');
