import {readdir,readFile,writeFile} from 'node:fs/promises';
for(const name of await readdir('src')){if(name.endsWith('.tsx')){const path=`src/${name}`;const content=await readFile(path,'utf8');await writeFile(path,content.replaceAll('.png','.webp'));}}
