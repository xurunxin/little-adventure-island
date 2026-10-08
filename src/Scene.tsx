import { useEffect, useRef } from "react";
import { Application, Assets, Sprite, Texture, type Spritesheet } from "pixi.js";
import type { State } from "./domain";
import {App as CapacitorApp} from '@capacitor/app';
type Effect = { id: string; kind: "task" | "reward" | "level" | "claim" };
declare global {
  interface Window {
    __islandMetrics?: {
      frames: number;
      slowFrames: number;
      maxMs: number;
      seconds: number;
      renderer: string;
      fps: number;
    };
  }
}

export function Scene({
  state,
  visible,
  effect,
  onReady,
}: {
  state: State;
  visible: boolean;
  effect: Effect | null;
  onReady: (ready: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const config = useRef({ state, visible, effect });
  config.current = { state, visible, effect };
  useEffect(() => {
    const app = new Application();
    let stopped = false;
    let initialized=false,appActive=true;
    let avatar: Sprite;
    let costume: Sprite;
    let loadedCompanion = "";
    let loadedCostume = "";
    let texture: Texture;
    let happy: Texture;
    let star: Texture;
    let accessories:Spritesheet;
    let lastEffect = "";
    let effectAt = -100;
    let time = 0;
    let elapsed = 0;
    let fpsFrames = 0;
    let metricSeconds = 0;
    const particles: {
      sprite: Sprite;
      vx: number;
      vy: number;
      age: number;
      life: number;
      flyToWallet: boolean;
      startX: number;
      startY: number;
    }[] = [];
    const initialize = async () => {
      try {
        await app.init({
          resizeTo: host.current!,
          preference: "webgl",
          backgroundAlpha: 0,
          antialias: true,
          resolution: 1,
          powerPreference: "low-power",
        });
        if (stopped) {
          app.destroy(true);
          return;
        }
        initialized=true;
        if(document.hidden||!appActive)app.stop();
        host.current!.appendChild(app.canvas);
        accessories=await Assets.load<Spritesheet>('/assets/atlases/effects.json');
        if(stopped)return;
        star = accessories.textures.star;
        avatar = new Sprite();
        avatar.anchor.set(0.5, 1);
        app.stage.addChild(avatar);
        costume = new Sprite();
        costume.anchor.set(0.5, 1);
        app.stage.addChild(costume);
        window.__islandMetrics = {
          frames: 0,
          slowFrames: 0,
          maxMs: 0,
          seconds: 0,
          renderer: "WebGL",
          fps: 0,
        };
        onReady(true);
        app.ticker.add((ticker) => {
          const { state: s, visible: show, effect: event } = config.current;
          const dt = Math.min(ticker.deltaMS / 1000, 0.05);
          time += dt;
          if (s.companion !== loadedCompanion) {
            loadedCompanion = s.companion;
            const name = loadedCompanion;
            void Assets.load<Spritesheet>(`/assets/atlases/${name}.json`)
              .then((sheet) => {
                if (!stopped && loadedCompanion === name) {
                  texture = sheet.textures[name];
                  happy = sheet.textures[`${name}-happy`];
                  avatar.texture = texture;
                }
              })
              .catch(() => onReady(false));
          }
          if (s.costume !== loadedCostume) {
            loadedCostume = s.costume;
            const name = loadedCostume;
            if (name === "none") costume.visible = false;
            else
              costume.texture = accessories.textures[name];
          }
          const width = app.screen.width,
            height = app.screen.height;
          avatar.visible = show && !!texture;
          if (texture) {
            const size = Math.min(width * 0.28, height * 0.49);
            const scale = size / Math.max(texture.width, texture.height);
            const celebrating = time - effectAt < 3;
            const blink = time % 5.7 > 5.54;
            avatar.texture = (celebrating || blink) && happy ? happy : texture;
            avatar.scale.set(
              scale * (1 + Math.sin(time * 2.1) * 0.008),
              scale * (1 + Math.cos(time * 2.1) * 0.01),
            );
            avatar.position.set(
              width * 0.835,
              height * 0.797 -
                (celebrating
                  ? Math.abs(Math.sin((time - effectAt) * 6)) * height * 0.025
                  : 0),
            );
            avatar.rotation = celebrating
              ? Math.sin((time - effectAt) * 6) * 0.03
              : Math.sin(time * 1.4) * 0.006;
            costume.visible =
              show && s.costume !== "none" && !!costume.texture.width;
            if (costume.visible) {
              const accessoryWidth = size * (s.costume === "bag" ? 0.35 : 0.43);
              costume.width = accessoryWidth;
              costume.height =
                accessoryWidth *
                (costume.texture.height / costume.texture.width);
              costume.position.set(
                avatar.x + (s.costume === "bag" ? size * 0.23 : 0),
                avatar.y -
                  size *
                    (s.costume === "bag"
                      ? 0.25
                      : s.companion === "rabbit"
                        ? 0.57
                        : 0.6),
              );
            }
          }
          if (event && event.id !== lastEffect) {
            lastEffect = event.id;
            effectAt = time;
            const count =
              event.kind === "claim"
                ? 0
                : s.settings.effects === "gentle"
                  ? 22
                  : 65;
            for (let i = 0; i < count; i++) {
              const sprite = new Sprite(star);
              sprite.anchor.set(0.5);
              sprite.width = sprite.height = 10 + Math.random() * 20;
              sprite.position.set(
                width * (event.kind === "reward" ? 0.5 : 0.75),
                height * 0.5,
              );
              app.stage.addChild(sprite);
              particles.push({
                sprite,
                vx: (Math.random() - 0.5) * width * 0.7,
                vy: -80 - Math.random() * height * 0.4,
                age: 0,
                life: 1.2 + Math.random() * 1.5,
                flyToWallet: event.kind==='task',
                startX: sprite.x,
                startY: sprite.y,
              });
            }
          }
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.age += dt;
            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.vy += height * 0.25 * dt;
            p.sprite.rotation += dt * 2;
            p.sprite.alpha = 1 - p.age / p.life;
            if(p.flyToWallet){
              const t=Math.min(1,p.age/p.life);
              const eased=t*t*(3-2*t);
              p.sprite.x=p.startX+(width*.45-p.startX)*eased+Math.sin(t*Math.PI)*p.vx*.2;
              p.sprite.y=p.startY+(height*.06-p.startY)*eased-Math.sin(t*Math.PI)*height*.16;
              p.sprite.alpha=Math.min(1,(1-t)*4);
            }
            if (p.age >= p.life) {
              p.sprite.destroy();
              particles.splice(i, 1);
            }
          }
          const m = window.__islandMetrics!;
          m.frames++;
          if (ticker.elapsedMS > 34) m.slowFrames++;
          m.maxMs = Math.max(m.maxMs, ticker.elapsedMS);
          elapsed += ticker.elapsedMS;
          fpsFrames++;
          metricSeconds += ticker.elapsedMS / 1000;
          m.seconds = metricSeconds;
          if (elapsed >= 1000) {
            m.fps = Math.round((fpsFrames * 1000) / elapsed);
            elapsed = 0;
            fpsFrames = 0;
          }
        });
      } catch (error) {
        if(stopped)return;
        console.error("Scene initialization failed", error);
        onReady(false);
      }
    };
    void initialize();
    const visibility = () => {
      if(!initialized||stopped)return;
      if (document.hidden||!appActive) app.stop();
      else app.start();
    };
    const activity=CapacitorApp.addListener('appStateChange',({isActive})=>{appActive=isActive;visibility();});
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", visibility);
      void activity.then(listener=>listener.remove());
      if (app.renderer) app.destroy(true, { children: true, texture: false });
    };
  }, [onReady]);
  return <div ref={host} className="scene-canvas" aria-hidden="true" />;
}
