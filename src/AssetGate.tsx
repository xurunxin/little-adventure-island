import {useEffect,useState,type ReactNode} from 'react';
import {PawPrint,Star} from '@phosphor-icons/react';

// Retain decoded images, including atlases, throughout the process lifetime.
const readyImages=new Map<string,HTMLImageElement>();
async function imageReady(url:string){
 if(readyImages.has(url))return;
 const picture=new Image();picture.decoding='async';
 await new Promise<void>((resolve,reject)=>{
  const timeout=setTimeout(()=>finish(new Error('Image preload timed out')),20000);
  const finish=(error?:Error)=>{clearTimeout(timeout);picture.onload=null;picture.onerror=null;error?reject(error):resolve();};
  picture.onerror=()=>finish(new Error(`Unable to load ${url}`));
  picture.onload=()=>void picture.decode().then(()=>finish(),()=>finish(new Error(`Unable to decode ${url}`)));
  picture.src=url;
 });
 readyImages.set(url,picture);
}
export function AssetGate({children}:{children:ReactNode}){
 const [attempt,setAttempt]=useState(0),[done,setDone]=useState(0),[total,setTotal]=useState(1),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;setFailed(false);setDone(0);
  const start=async()=>{
   const response=await fetch('/assets/preload.json',{cache:'no-store'});if(!response.ok)throw new Error('Preload manifest unavailable');
   const manifest=await response.json() as {images:string[]};if(!Array.isArray(manifest.images)||!manifest.images.length)throw new Error('Preload manifest is empty');
   if(!live)return;setTotal(manifest.images.length);let index=0,loaded=0;
   const worker=async()=>{while(live&&index<manifest.images.length){const url=manifest.images[index++];if(!url.startsWith('/assets/'))throw new Error('Unexpected asset path');await imageReady(url);if(live)setDone(++loaded);}};
   // Bound concurrent decoding on the Snapdragon 680.
   await Promise.all(Array.from({length:4},worker));if(live)setReady(true);
  };
  void start().catch(error=>{console.error('Artwork preload failed',error);if(live)setFailed(true);});
  return()=>{live=false;};
 },[attempt]);
 if(ready)return children;
 const percent=Math.min(100,Math.round(done/total*100));
 return <main className="asset-loading"><div className="loading-mascot"><PawPrint weight="fill"/><Star className="loading-star" weight="fill"/></div><h1>小岛正在醒来…</h1><p>{failed?'还有图片没有准备好，请再试一次。':'小伙伴正在准备今天的冒险'}</p><progress aria-label="图片准备进度" max={total} value={done}/><span className="loading-percent">{percent}%</span>{failed&&<button className="primary" onClick={()=>setAttempt(value=>value+1)}>重新准备</button>}</main>;
}
