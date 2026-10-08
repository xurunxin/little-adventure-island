import type { ReactNode } from "react";
import {useEffect,useState} from 'react';
import { X, SpeakerHigh } from "@phosphor-icons/react";
import { useTaskArt } from './art';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-shade" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X weight="bold" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Stars({ value }: { value: number }) {
  return (
    <span className="stars">
      <img src="/assets/star.webp" alt="星星" />
      <strong>{value}</strong>
    </span>
  );
}
export function TaskImage({ image, title }: { image: string; title: string }) {
  return (
    <img
      className="task-picture"
      src={useTaskArt(image)}
      alt={title}
      loading="eager"
      draggable={false}
    />
  );
}
export function AudioButton({
  onClick,
  label = "听一听",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="audio-button" aria-label={label} onClick={onClick}>
      <SpeakerHigh weight="fill" />
    </button>
  );
}
export const petNames = { fox: "小狐狸", rabbit: "小兔子", bear: "小熊" };
export function Counter({value,gain}:{value:number;gain:number}){
 const [shown,setShown]=useState(value);
 useEffect(()=>{if(!gain||document.hidden){setShown(value);return;}const start=performance.now();const from=Math.max(0,value-gain);let frame=0;const step=(now:number)=>{const t=Math.min(1,(now-start)/1200);setShown(Math.round(from+(value-from)*(1-Math.pow(1-t,3))));if(t<1&&!document.hidden)frame=requestAnimationFrame(step);else setShown(value);};frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);},[value,gain]);
 return <strong>{shown}</strong>;
}
export const growth = [
  { name: "薄荷围巾", image: "scarf" },
  { name: "小花盆", image: "flower" },
  { name: "彩色旗", image: "bunting" },
  { name: "探险帽", image: "hat" },
  { name: "彩色气球", image: "balloon" },
  { name: "小背包", image: "bag" },
  { name: "绘本角", image: "books" },
  { name: "小夜灯", image: "lamp" },
  { name: "野餐桌", image: "picnic" },
  { name: "星星皇冠", image: "crown" },
];
