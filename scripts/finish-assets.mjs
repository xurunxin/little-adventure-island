import sharp from 'sharp';
import { readdir,readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public/assets');
async function optimize(folder){for(const file of await readdir(folder,{withFileTypes:true})){const target=path.join(folder,file.name);if(file.isDirectory())await optimize(target);else if(file.name.endsWith('.png')){const original=await readFile(target);const meta=await sharp(original).metadata();const max=target.includes(`${path.sep}pets${path.sep}`)?768:target.includes(`${path.sep}decor${path.sep}`)?512:target===path.join(root,'island.png')||target===path.join(root,'storybook.png')||target===path.join(root,'title.png')?1600:640;let processing=sharp(original);if(file.name==='title.png'||file.name.startsWith('nav-'))processing=processing.trim();const output=await processing.resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();await writeFile(target,output);console.log(`${path.relative(root,target)} ${meta.width}x${meta.height} -> ${Math.round(output.length/1024)} KB`);}}}
await optimize(root);
// Android launcher images derive from the generated island artwork, with real alpha.
const source=await sharp(path.join(root,'nav-island.png')).resize(180,180,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).toBuffer();
for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
 const folder=path.resolve(`android/app/src/main/res/mipmap-${density}`);await mkdir(folder,{recursive:true});
 const foreground=await sharp(source).resize(Math.round(size*.75),Math.round(size*.75)).toBuffer();
 const icon=await sharp({create:{width:size,height:size,channels:4,background:'#fff5db'}}).composite([{input:foreground,gravity:'centre'}]).png().toBuffer();
 await writeFile(path.join(folder,'ic_launcher.png'),icon);await writeFile(path.join(folder,'ic_launcher_round.png'),icon);
 const adaptiveSize=Math.round(size*2.25);const adaptive=await sharp({create:{width:adaptiveSize,height:adaptiveSize,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:await sharp(source).resize(Math.round(adaptiveSize*.55),Math.round(adaptiveSize*.55)).toBuffer(),gravity:'centre'}]).png().toBuffer();await writeFile(path.join(folder,'ic_launcher_foreground.png'),adaptive);
}
