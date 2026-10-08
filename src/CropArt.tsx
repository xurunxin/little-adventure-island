import {useEffect, useState} from 'react';
import {Modal} from './components';
export function CropArt({source, onSave, onClose}: {source:string; onSave:(data:string)=>void; onClose:()=>void}) {
  const [image,setImage]=useState<HTMLImageElement>(), [zoom,setZoom]=useState(1), [x,setX]=useState(50), [y,setY]=useState(50), [error,setError]=useState('');
  useEffect(()=>{let live=true;const img=new Image();img.src=source;void img.decode().then(()=>{if(live)setImage(img);},()=>{if(live)setError('图片没有加载成功，请重新生成。');});return()=>{live=false;};},[source]);
  const save=()=>{
    if(!image)return;
    const size=Math.min(image.width,image.height)/zoom;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const ctx=canvas.getContext('2d')!;
    ctx.drawImage(image,(image.width-size)*x/100,(image.height-size)*y/100,size,size,0,0,640,640);
    onSave(canvas.toDataURL('image/webp',.9));
  };
  const size=image?Math.min(image.width,image.height)/zoom:1;
  return <Modal title="裁剪任务插画" onClose={onClose}>
    <p>放大并调整位置，让孩子能清楚看见要做的动作。</p>
    <div className="crop-preview">{image&&<img src={source} alt="待裁剪插画" style={{width:`${image.width/size*100}%`,height:`${image.height/size*100}%`,maxWidth:'none',left:`${-(image.width/size-1)*x}%`,top:`${-(image.height/size-1)*y}%`}}/>}</div>
    {error&&<p role="alert">{error}</p>}
    <label>放大<input aria-label="裁剪放大" type="range" min="1" max="3" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
    <label>左右位置<input aria-label="裁剪左右位置" type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label>
    <label>上下位置<input aria-label="裁剪上下位置" type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label>
    <div className="dialog-actions"><button className="secondary" onClick={onClose}>返回</button><button className="primary" disabled={!image} onClick={save}>使用这张插画</button></div>
  </Modal>;
}
