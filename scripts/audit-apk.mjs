import {readFileSync,writeFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const path=process.argv[2],zip=readFileSync(path),secret=process.env.MINIMAX_CN_API_KEY,files=new Map();
let end=zip.length-22;while(end>=Math.max(0,zip.length-65557)&&zip.readUInt32LE(end)!==0x06054b50)end--;
if(end<0)throw new Error('Invalid APK archive');
let at=zip.readUInt32LE(end+16),containsCredential=false;
for(let i=0;i<zip.readUInt16LE(end+10);i++){
 if(zip.readUInt32LE(at)!==0x02014b50)throw new Error('Invalid ZIP directory');
 const method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+20),nameLength=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32),offset=zip.readUInt32LE(at+42);
 const name=zip.toString('utf8',at+46,at+46+nameLength),start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28),data=zip.subarray(start,start+size),raw=method===8?inflateRawSync(data):data;
 if(secret&&raw.includes(Buffer.from(secret)))containsCredential=true;
 files.set(name,raw);at+=46+nameLength+extra+comment;
}
const manifest=JSON.parse(files.get('assets/public/assets/preload.json').toString());
const missing=manifest.images.filter(path=>!files.has(`assets/public${path}`));
for(const path of ['/assets/adventure.ttf','/assets/sql-wasm.wasm',...['fox','rabbit','bear','effects'].map(name=>`/assets/atlases/${name}.json`)])if(!files.has(`assets/public${path}`))missing.push(path);
const voices=[...files.keys()].filter(p=>/^assets\/public\/audio\/.*\.mp3$/.test(p));
const audioManifest=JSON.parse(readFileSync('design/audio-manifest.json','utf8'));
const expectedVoice=JSON.parse(readFileSync('design/content-update-1.0.2.json','utf8')).voice.id;
const audioProvenanceMatches=audioManifest.length===35&&audioManifest.every(row=>row.model==='speech-2.8-hd'&&row.voice===expectedVoice&&files.has(`assets/public/audio/${row.id}.mp3`)&&createHash('sha256').update(files.get(`assets/public/audio/${row.id}.mp3`)).digest('hex')===row.sha256.toLowerCase());
const pngs=[...files.keys()].filter(p=>p.startsWith('assets/public/assets/')&&p.endsWith('.png'));
const hasDesignFixture=[...files].some(([name,data])=>name.startsWith('assets/public/assets/')&&name.endsWith('.js')&&data.includes(Buffer.from('design-reward')));
const report={file:path,bytes:zip.length,sha256:createHash('sha256').update(zip).digest('hex'),bundledImages:manifest.images.length,missingImages:missing,bundledVoices:voices.length,defaultVoice:expectedVoice,mmxAudioProvenance:audioProvenanceMatches,authoringPngs:pngs.filter(p=>!p.includes('/atlases/')),plaintextAPIKey:containsCredential,developmentFixture:hasDesignFixture};
if(missing.length||containsCredential||report.authoringPngs.length||voices.length!==35||hasDesignFixture||!audioProvenanceMatches)throw new Error('Release content audit failed');
writeFileSync('evidence/apk-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
