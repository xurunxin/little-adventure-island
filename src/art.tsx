import {createContext, useContext} from 'react';
export const TaskArtContext = createContext<Record<string, string>>({});
export function useTaskArt(image: string) {
  const custom = useContext(TaskArtContext);
  return custom[image] || `/assets/tasks/${encodeURIComponent(image)}.webp`;
}
export async function decodeArt(data: string) {
  const image = new Image(); image.src = data; await image.decode();
  if (!image.naturalWidth || image.naturalWidth > 2048 || image.naturalHeight > 2048) throw new Error('图片尺寸不合适，请重新裁剪。');
  return image;
}
export async function prepareCustomArt(images: Record<string,string>) { await Promise.all(Object.values(images).map(decodeArt)); }
