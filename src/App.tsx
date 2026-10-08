import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import {
  LockKey,
  SpeakerHigh,
  ArrowLeft,
  CheckCircle,
  Hourglass,
  Gift,
  PawPrint,
  ShieldCheck,
  X,
  Microphone,
} from "@phosphor-icons/react";
import {
  available,
  balance,
  currentClaim,
  level,
  localDay,
  reduceState,
  reserved,
  todayTasks,
  blankState,
  type State,
  type Task,
  type Reward,
  type Command,
} from "./domain";
import { createRepository, MemoryRepository, type Repository } from "./storage";
import { IslandService } from "./service";
import { createCredentials } from "./security";
import { Scene } from "./Scene";
import { Setup } from "./Setup";
import { Parent } from "./Parent";
import { Modal, Stars, TaskImage, AudioButton, growth, Counter } from "./components";
import { say, sound, speakTask, stopAudio } from "./audio";
import {TaskArtContext} from './art';
import {completeAIBootstrap} from './ai';
import {VoiceChat} from './VoiceChat';

let servicePromise: Promise<IslandService> | undefined;
async function prepareService() {
  let repository: Repository = createRepository();
  // A separate, non-persistent composition fixture. Never enabled in an APK build.
  if (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("design") === "1"
  ) {
    let s = blankState();
    const credentials = (await createCredentials("123456")).credentials;
    const today = localDay();
    s = reduceState(
      s,
      {
        type: "initialize",
        credentials,
        companion: "fox",
        name: "小狐狸",
        taskIds: ["wash-hands", "tidy-toys", "read"],
        rewardIds: ["stickers", "activity", "picnic", "new-book", "toy"],
      },
      { day: "2026-01-01", at: "2026-01-01T08:00:00Z", parent: false },
    );
    for (let i = 1; i <= 12; i++) {
      const day = `2026-01-${String(i).padStart(2, "0")}`;
      const ctx = { day, at: `${day}T08:00:00Z`, parent: true };
      s = reduceState(s, { type: "claim", taskId: "wash-hands" }, ctx);
      s = reduceState(s, { type: "submit", claimId: `wash-hands:${day}` }, ctx);
      s = reduceState(
        s,
        { type: "review", claimId: `wash-hands:${day}`, approve: true },
        ctx,
      );
    }
    s = reduceState(
      s,
      { type: "saveReward", reward: { ...s.rewards[0], price: 18 } },
      { day: today, at: new Date().toISOString(), parent: true },
    );
    s = reduceState(
      s,
      { type: "redeem", rewardId: "stickers", requestId: "design-reward" },
      { day: today, at: new Date().toISOString(), parent: false },
    );
    s = reduceState(
      s,
      { type: "reviewReward", requestId: "design-reward", approve: true },
      { day: today, at: new Date().toISOString(), parent: true },
    );
    s = reduceState(
      s,
      { type: "fulfill", requestId: "design-reward" },
      { day: today, at: new Date().toISOString(), parent: true },
    );
    s.celebrations = [];
    repository = new MemoryRepository(s);
  }
  const service = new IslandService(repository);
  await service.init();
  return service;
}
type Screen = "home" | "tasks" | "rewards" | "partner";
export function App() {
  const [service, setService] = useState<IslandService>();
  const [state, setState] = useState<State>();
  const [fatal, setFatal] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [category, setCategory] = useState("全部");
  const [pinOpen, setPinOpen] = useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const closeChat=useCallback(()=>setChatOpen(false),[]);
  const [task, setTask] = useState<Task>();
  const [reward, setReward] = useState<{ reward: Reward; id: string }>();
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(
    (ready: boolean) => setSceneReady(ready),
    [],
  );
  const [effect, setEffect] = useState<{
    id: string;
    kind: "task" | "reward" | "level" | "claim";
  } | null>(null);
  const [celebration, setCelebration] = useState<State["celebrations"]>();
  const finishCelebrationRef = useRef<() => void>(() => {});
  const error = useCallback((message: string) => {
    setToast(message);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let live = true;
    let unsubscribe: (() => void) | undefined;
    servicePromise ??= prepareService();
    servicePromise
      .then((instance) => {
        if (!live) return;
        setService(instance);
        setState({ ...instance.state });
        unsubscribe = instance.subscribe(() => {
          if (live) {
            setState({ ...instance.state });
            if (!instance.parent) {
              setPinOpen(false);
            }
          }
        });
      })
      .catch((e) => setFatal(e.message));
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!service) return;
    const hide = () => {
      document.documentElement.classList.toggle('is-background',document.hidden);
      if (document.hidden) {
        service.lock();
        stopAudio();
        setTask(undefined);
        setReward(undefined);
        setChatOpen(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    const listener = CapacitorApp.addListener(
      "appStateChange",
      ({ isActive }) => {
        document.documentElement.classList.toggle('is-background',!isActive||document.hidden);
        if (!isActive) {
          service.lock();
          stopAudio();
          setTask(undefined);
          setReward(undefined);
          setChatOpen(false);
        }
      },
    );
    const timer = setInterval(() => {
      if (!document.hidden)
        void service.run({ type: "tick" }).catch((e) => error(e.message));
    }, 60000);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      void listener.then((handle) => handle.remove());
      clearInterval(timer);
    };
  }, [service, error]);
  const act = useCallback(
    async (command: Command) => {
      if (!service || working.current) return false;
      working.current = true;
      setBusy(true);
      try {
        await service.run(command);
        return true;
      } catch (e) {
        error((e as Error).message);
        return false;
      } finally {
        working.current = false;
        setBusy(false);
      }
    },
    [service, error],
  );
  useEffect(() => {
    if (!service) return;
    const listener = CapacitorApp.addListener("backButton", () => {
      if (service.parent) {
        service.lock();
        setScreen("home");
      } else if (pinOpen) setPinOpen(false);
      else if (chatOpen) setChatOpen(false);
      else if (task) setTask(undefined);
      else if (reward) setReward(undefined);
      else setScreen("home");
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [service, pinOpen, task, reward,chatOpen]);
  useEffect(()=>{if(state?.initialized)void completeAIBootstrap().catch(()=>{});},[state?.initialized]);
  const finishCelebration = useCallback(async () => {
    if (
      celebration &&
      (await act({ type: "celebrated", ids: celebration.map((c) => c.id) }))
    )
      setCelebration(undefined);
  }, [act, celebration]);
  finishCelebrationRef.current = () => void finishCelebration();
  useEffect(() => {
    if (
      state?.initialized &&
      !service?.parent &&
      state.celebrations.length &&
      !celebration
    ) {
      setCelebration([...state.celebrations]);
      const upgraded = state.celebrations.some((c) => c.levelUp);
      const rewardOnly = state.celebrations.every((c) => c.kind === "reward");
      setEffect({
        id: crypto.randomUUID(),
        kind: upgraded ? "level" : rewardOnly ? "reward" : "task",
      });
      void sound(rewardOnly ? "reward" : "success", state.settings.volume);
      void say(
        upgraded
          ? "level-up"
          : rewardOnly
            ? "reward-approved"
            : "task-approved",
        state.settings.volume,
      );
    }
  }, [state, service, celebration]);
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => finishCelebrationRef.current(), 4000);
    return () => clearTimeout(timer);
  }, [celebration]);
  if (fatal)
    return (
      <div className="fatal">
        <h1>小岛暂时无法打开</h1>
        <p>{fatal}</p>
        <button className="primary" onClick={() => location.reload()}>
          再试一次
        </button>
      </div>
    );
  if (!service || !state)
    return (
      <div className="loading">
        <img src="/assets/nav-island.webp" alt="" />
        <h1>小岛正在醒来…</h1>
      </div>
    );
  const exit = () => {
    service.lock();
    setScreen("home");
  };
  const day = localDay();
  const tasks = todayTasks(state, day);
  const current = task ? currentClaim(state, task, day) : undefined;
  const performTask = async (t: Task) => {
    const c = currentClaim(state, t, day);
    if (!c) {
      if (await act({ type: "claim", taskId: t.id })) {
        setEffect({ id: crypto.randomUUID(), kind: "claim" });
        void sound("tap", state.settings.volume);
        void say("task-claimed", state.settings.volume);
        setTask(undefined);
        setToast("任务领取啦，去试一试吧！");
      }
    } else if (c.status === "active") {
      if (await act({ type: "submit", claimId: c.id })) {
        setTask(undefined);
        void say("task-pending", state.settings.volume);
        setToast("请爸爸妈妈来确认吧。");
      }
    }
  };
  const taskLabel = (t: Task) => {
    const c = currentClaim(state, t, day);
    return !c
      ? "我来试试"
      : c.status === "active"
        ? "我完成啦"
        : c.status === "pending"
          ? "等家长确认"
          : c.status === "approved"
            ? "完成啦"
            : "今日已结束";
  };
  const nav = [
    { id: "home" as const, label: "小岛", image: "nav-island.webp" },
    { id: "tasks" as const, label: "任务", image: "nav-tasks.webp" },
    { id: "rewards" as const, label: "奖励", image: "nav-rewards.webp" },
    {
      id: "partner" as const,
      label: "伙伴",
      image: `pets/${state.companion}-icon.webp`,
    },
  ];
  return (
    <TaskArtContext.Provider value={state.illustrations}><div className={`app-shell screen-${screen}`}>
      <img
        className="island-background"
        src="/assets/island.webp"
        alt=""
        draggable={false}
      />
      <div className="sky-layer" aria-hidden="true"><img src="/assets/cloud.webp" alt=""/><img src="/assets/cloud.webp" alt=""/><img className="swaying-leaves" src="/assets/leaves.webp" alt=""/></div>
      {!state.initialized ? (
        <Setup service={service} onError={error} />
      ) : service.parent ? (
        <Parent
          service={service}
          state={state}
          act={act}
          onExit={exit}
          onError={error}
        />
      ) : (
        <>
          <Scene
            state={state}
            visible={screen === "home" || screen === "partner"}
            effect={effect}
            onReady={onSceneReady}
          />
          {!sceneReady && (screen === "home" || screen === "partner") && (
            <img
              className="pet-fallback"
              src={`/assets/pets/${state.companion}.webp`}
              alt={state.companionName}
            />
          )}
          {level(state) >= 2 && (screen === "home" || screen === "partner") && (
            <div className="garden-decor" aria-label="成长家园">
              {growth
                .filter(
                  (_, i) => i > 0 && i < level(state) && ![3, 5, 9].includes(i),
                )
                .map((item, i) => (
                  <img
                    key={item.image}
                    src={`/assets/decor/${item.image}.webp`}
                    alt={item.name}
                    style={{ left: `${i * 22}%` }}
                  />
                ))}
            </div>
          )}
          <header className="child-header">
            <button
              className="brand"
              onClick={() => setScreen("home")}
              aria-label="小小冒险岛首页"
            >
              <img src="/assets/title.webp" alt="小小冒险岛" />
            </button>
            <div
              className="wallet"
              aria-label={`可用积分 ${available(state)}，总积分 ${balance(state)}`}
            >
              <img src="/assets/star.webp" alt="星星" />
              <Counter value={available(state)} gain={celebration?.reduce((sum,c)=>sum+c.points,0)||0}/>
              {reserved(state) > 0 && <small>预留 {reserved(state)}</small>}
            </div>
            <button
              className="parent-lock"
              aria-label="家长设置"
              onClick={() => setPinOpen(true)}
            >
              <LockKey weight="fill" />
              <span>家长设置</span>
            </button>
          </header>
          {screen === "home" && (
            <>
              <section className="home-book">
                <img
                  className="book-background"
                  src="/assets/storybook.webp"
                  alt=""
                />
                <div className="home-cards">
                  {tasks.slice(0, 3).map((t, index) => {
                    const claim = currentClaim(state, t, day);
                    return (
                      <article
                        className={`home-task ${claim?.status === "approved" ? "done" : ""}`}
                        key={t.id}
                      >
                        <button
                          className="picture-button"
                          onClick={() => {
                            setTask(t);
                            speakTask(claim || t, state);
                          }}
                          aria-label={`查看任务 ${t.title}`}
                        >
                          <TaskImage
                            image={claim?.image || t.image}
                            title={claim?.title || t.title}
                          />
                          {claim?.status === "approved" && (
                            <CheckCircle className="done-mark" weight="fill" />
                          )}
                          {claim?.status === "pending" && (
                            <Hourglass className="done-mark" weight="fill" />
                          )}
                        </button>
                        <h2>{claim?.title || t.title}</h2>
                        <Stars value={claim?.points || t.points} />
                        {index === 0 || claim ? (
                          <button
                            className={
                              claim?.status === "pending" ||
                              claim?.status === "approved"
                                ? "secondary status-button"
                                : "primary"
                            }
                            disabled={
                              busy ||
                              claim?.status === "pending" ||
                              claim?.status === "approved"
                            }
                            onClick={() => {
                              if (!claim) {
                                setTask(t);
                                speakTask(t, state);
                              } else void performTask(t);
                            }}
                          >
                            {taskLabel(t)}
                          </button>
                        ) : (
                          <AudioButton
                            onClick={() => {
                              setTask(t);
                              speakTask(t, state);
                            }}
                            label={`听 ${t.title} 并查看任务`}
                          />
                        )}
                      </article>
                    );
                  })}
                  {tasks.length === 0 && (
                    <div className="book-empty">
                      <PawPrint weight="fill" />
                      <h2>今天的小岛很悠闲</h2>
                      <p>请爸爸妈妈发布一个小任务吧。</p>
                    </div>
                  )}
                </div>
              </section>
              <div className="companion-level">Lv.{level(state)}</div>
              <div className="pet-speech">
                <button
                  onClick={() => void say("choose-task", state.settings.volume)}
                  aria-label="听伙伴说话"
                >
                  你想先做哪一个？
                </button>
              </div>
              {state.settings.conversation&&<button className="partner-talk-entry" onClick={()=>{stopAudio();setChatOpen(true);}}><Microphone weight="fill"/>和伙伴聊聊</button>}
              {tasks.length > 3 && (
                <button
                  className="all-tasks"
                  onClick={() => setScreen("tasks")}
                >
                  还有 {tasks.length - 3} 个小任务 <span>看看全部</span>
                </button>
              )}
            </>
          )}
          {screen === "tasks" && (
            <main className="child-page">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">每一次尝试都很棒</p>
                  <h1>今日小任务</h1>
                </div>
                <AudioButton
                  onClick={() => void say("tasks", state.settings.volume)}
                />
              </div>
              <div className="category-tabs">
                {["全部", "自理", "整理", "学习", "运动"].map((x) => (
                  <button
                    key={x}
                    className={x === category ? "selected" : ""}
                    onClick={() => setCategory(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="task-grid">
                {tasks
                  .filter((t) => category === "全部" || t.category === category)
                  .map((t) => {
                    const c = currentClaim(state, t, day);
                    return (
                      <article className="task-card" key={t.id}>
                        <button
                          className="picture-button"
                          onClick={() => {
                            setTask(t);
                            speakTask(c || t, state);
                          }}
                        >
                          <TaskImage
                            image={c?.image || t.image}
                            title={c?.title || t.title}
                          />
                        </button>
                        <div className="card-title">
                          <h2>{c?.title || t.title}</h2>
                          <AudioButton
                            onClick={() => speakTask(c || t, state)}
                          />
                        </div>
                        <Stars value={c?.points || t.points} />
                        <button
                          className={
                            c?.status === "pending" || c?.status === "approved"
                              ? "secondary"
                              : "primary"
                          }
                          disabled={
                            busy ||
                            c?.status === "pending" ||
                            c?.status === "approved"
                          }
                          onClick={() => {
                            if (!c) {
                              setTask(t);
                              speakTask(t, state);
                            } else void performTask(t);
                          }}
                        >
                          {taskLabel(t)}
                        </button>
                      </article>
                    );
                  })}
              </div>
              {tasks.length === 0 && (
                <p className="empty-line">
                  爸爸妈妈准备好任务后，就可以开始啦。
                </p>
              )}
              {state.claims.some(
                (c) => c.status === "pending" && c.day !== day,
              ) && (
                <section className="older-pending">
                  <h2>还有任务等家长确认</h2>
                  {state.claims
                    .filter((c) => c.status === "pending" && c.day !== day)
                    .map((c) => (
                      <p key={c.id}>
                        <Hourglass weight="fill" /> {c.title} · {c.day}
                      </p>
                    ))}
                </section>
              )}
            </main>
          )}
          {screen === "rewards" && (
            <main className="child-page">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">把努力变成喜欢的小惊喜</p>
                  <h1>星星奖励屋</h1>
                </div>
                <div className="balance-note">
                  可以使用 <Stars value={available(state)} />
                </div>
              </div>
              <div className="reward-grid">
                {state.rewards
                  .filter((r) => r.enabled)
                  .map((r) => (
                    <article className="reward-card" key={r.id}>
                      <img
                        src={`/assets/rewards/${r.image}.webp`}
                        alt={r.title}
                      />
                      <h2>{r.title}</h2>
                      <Stars value={r.price} />
                      <button
                        className="primary"
                        onClick={() =>
                          setReward({ reward: r, id: crypto.randomUUID() })
                        }
                        disabled={available(state) < r.price || busy}
                      >
                        {available(state) < r.price
                          ? `还差 ${r.price - available(state)} 颗`
                          : "申请兑换"}
                      </button>
                    </article>
                  ))}
              </div>
              {!state.rewards.some((r) => r.enabled) && (
                <div className="empty-message">
                  <Gift weight="fill" />
                  <h2>奖励屋正在准备</h2>
                  <p>请爸爸妈妈来设置喜欢的奖励。</p>
                </div>
              )}
              <h2 className="tickets-title">我的奖励券</h2>
              <div className="ticket-list">
                {state.redemptions
                  .filter((r) =>
                    ["pending", "approved", "fulfilled"].includes(r.status),
                  )
                  .slice()
                  .reverse()
                  .map((r) => (
                    <article className={`ticket ${r.status}`} key={r.id}>
                      <img src={`/assets/rewards/${r.image}.webp`} alt="" />
                      <div>
                        <strong>{r.title}</strong>
                        <p>
                          {
                            {
                              pending: `等家长批准 · 预留 ${r.price} 颗星星`,
                              approved: "兑换成功 · 和家长约好兑现时间",
                              fulfilled: "奖励已经兑现啦！",
                              rejected: "暂未批准",
                              cancelled: "已取消",
                            }[r.status]
                          }
                        </p>
                      </div>
                      {r.status === "pending" && (
                        <button
                          className="secondary"
                          onClick={() =>
                            void act({ type: "cancel", requestId: r.id })
                          }
                        >
                          取消申请
                        </button>
                      )}
                      {r.status === "fulfilled" && (
                        <CheckCircle weight="fill" />
                      )}
                    </article>
                  ))}
              </div>
            </main>
          )}
          {screen === "partner" && (
            <>
              <main className="partner-panel">
                <p className="eyebrow">一直陪你慢慢长大</p>
                <h1>{state.companionName}</h1>
                <div className="growth-summary">
                  <strong>Lv.{level(state)}</strong>
                  <progress
                    max={100}
                    value={level(state) === 10 ? 100 : state.xp % 100}
                  />
                  <span>
                    {level(state) === 10
                      ? `已到最高等级 · 累计 ${state.xp} 经验`
                      : `再积累 ${100 - (state.xp % 100)} 经验就升级`}
                  </span>
                </div>
                <p className="muted">
                  完成任务获得成长经验，兑换奖励不会减少经验。
                </p>
                <div className="growth-grid">
                  {growth.map((item, i) => {
                    const unlocked = i < level(state);
                    return (
                      <div
                        className={`growth-item ${unlocked ? "unlocked" : ""}`}
                        key={item.name}
                      >
                        <img
                          src={`/assets/decor/${item.image}.webp`}
                          alt={item.name}
                        />
                        <span>
                          {unlocked ? item.name : `Lv.${i + 1} ${item.name}`}
                        </span>
                        {unlocked ? (
                          <CheckCircle weight="fill" />
                        ) : (
                          <LockKey weight="fill" />
                        )}
                        {[3, 5, 9].includes(i) && unlocked && (
                          <button
                            className="secondary"
                            onClick={() =>
                              void act({
                                type: "wear",
                                costume:
                                  state.costume === item.image
                                    ? "none"
                                    : (item.image as State["costume"]),
                              })
                            }
                          >
                            {state.costume === item.image ? "摘下来" : "穿上"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </main>
              <div className="pet-speech partner-speech">
                <button
                  onClick={() => void say("partner", state.settings.volume)}
                >
                  一起长大，真开心！
                </button>
              </div>
              {state.settings.conversation&&<button className="partner-talk-entry" onClick={()=>{stopAudio();setChatOpen(true);}}><Microphone weight="fill"/>和伙伴聊聊</button>}
            </>
          )}
          <nav className="child-nav" aria-label="主要导航">
            {nav.map((item) => (
              <button
                key={item.id}
                aria-current={screen === item.id ? "page" : undefined}
                className={screen === item.id ? "selected" : ""}
                onClick={() => {
                  setScreen(item.id);
                  void sound("tap", state.settings.volume);
                }}
              >
                <img src={`/assets/${item.image}`} alt="" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      {pinOpen && (
        <PinDialog
          service={service}
          onClose={() => setPinOpen(false)}
          onError={error}
        />
      )}
      {task && !service.parent && (
        <Modal
          title={current?.title || task.title}
          onClose={() => setTask(undefined)}
        >
          <div className="task-detail">
            <TaskImage
              image={current?.image || task.image}
              title={current?.title || task.title}
            />
            <div>
              <p>{current?.description || task.description}</p>
              <div className="detail-reward">
                <Stars value={current?.points || task.points} />
                <span>＋10 成长经验</span>
              </div>
              <AudioButton onClick={() => speakTask(current || task, state)} />
              <button
                className="primary"
                disabled={
                  busy ||
                  current?.status === "pending" ||
                  current?.status === "approved"
                }
                onClick={() => void performTask(task)}
              >
                {taskLabel(task)}
              </button>
              {current?.status === "active" && (
                <p className="muted">
                  先去完成现实中的小任务，再回来告诉伙伴。
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
      {reward && !service.parent && (
        <Modal title="申请这个奖励？" onClose={() => setReward(undefined)}>
          <div className="reward-detail">
            <img
              src={`/assets/rewards/${reward.reward.image}.webp`}
              alt={reward.reward.title}
            />
            <h2>{reward.reward.title}</h2>
            <p>{reward.reward.description}</p>
            <Stars value={reward.reward.price} />
            <p className="muted">
              先预留星星，请爸爸妈妈批准。没有批准会退回星星。
            </p>
            <button
              className="primary"
              disabled={busy || available(state) < reward.reward.price}
              onClick={async () => {
                if (
                  await act({
                    type: "redeem",
                    rewardId: reward.reward.id,
                    requestId: reward.id,
                  })
                ) {
                  setReward(undefined);
                  setToast("已经申请啦，请爸爸妈妈来看看。");
                  void say("reward-pending", state.settings.volume);
                }
              }}
            >
              请家长批准
            </button>
          </div>
        </Modal>
      )}
      {celebration && !service.parent && (
        <div className="celebration-shade">
          <section className="celebration">
            <img
              src={
                celebration.every((c) => c.kind === "reward")
                  ? "/assets/gift-open.webp"
                  : `/assets/pets/${state.companion}-happy.webp`
              }
              alt="庆祝新收获"
            />
            <h1>
              {celebration.some((c) => c.levelUp)
                ? "伙伴升级啦！"
                : celebration.every((c) => c.kind === "reward")
                  ? "奖励兑换成功啦！"
                  : "你做到了！"}
            </h1>
            {celebration.some((c) => c.kind === "task") && (
              <>
                <p>爸爸妈妈确认了你的努力</p>
                <Stars
                  value={celebration.reduce((sum, c) => sum + c.points, 0)}
                />
                <p>星星已经存进小袋子啦</p>
              </>
            )}
            {celebration
              .filter((c) => c.kind === "reward")
              .map((c) => (
                <p key={c.id}>{c.title} · 新的奖励券已准备好</p>
              ))}
            <button
              className="primary"
              onClick={() => void finishCelebration()}
            >
              继续冒险
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X />
          </button>
        </div>
      )}
      <div className="rotate-message">
        <img src="/assets/nav-island.webp" alt="" />
        <h2>把平板横过来，小岛更好看</h2>
      </div>
      {chatOpen&&!service.parent&&<VoiceChat state={state} onClose={closeChat}/>}
    </div></TaskArtContext.Provider>
  );
}
function PinDialog({
  service,
  onClose,
  onError,
}: {
  service: IslandService;
  onClose: () => void;
  onError: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [reset, setReset] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const unlock = async () => {
    setBusy(true);
    try {
      await service.unlock(value, recovery);
      if (recovery) setReset(true);
      else onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const change = async () => {
    if (newPin !== repeat) return onError("两次密码不一样。");
    setBusy(true);
    try {
      const created = await createCredentials(newPin);
      await service.run({
        type: "credentials",
        credentials: created.credentials,
      });
      setReceipt(created.recovery);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={reset ? "设置新的家长密码" : "爸爸妈妈请进"}
      onClose={() => {
        if (reset) service.lock();
        onClose();
      }}
    >
      <div className="pin-dialog">
        <ShieldCheck size={52} weight="fill" />
        {receipt ? (
          <>
            <p>请保存新的恢复码。旧恢复码已失效。</p>
            <code className="recovery-code">{receipt}</code>
            <button className="primary" onClick={onClose}>
              我已保存
            </button>
          </>
        ) : reset ? (
          <>
            <label>
              新的六位密码
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label>
              再输入一次
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={repeat}
                onChange={(e) => setRepeat(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void change()}
            >
              保存新密码
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <p>
              {recovery
                ? "输入准备小岛时保存的恢复码。"
                : "输入六位家长密码，确认任务或设置奖励。"}
            </p>
            <input
              aria-label={recovery ? "恢复码" : "家长密码"}
              autoFocus
              type={recovery ? "text" : "password"}
              inputMode={recovery ? "text" : "numeric"}
              maxLength={recovery ? 29 : 6}
              value={value}
              onChange={(e) =>
                setValue(
                  recovery ? e.target.value : e.target.value.replace(/\D/g, ""),
                )
              }
              autoComplete="off"
            />
            <button className="primary" disabled={busy}>
              {busy ? "正在检查…" : "进入家长设置"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRecovery(!recovery);
                setValue("");
              }}
            >
              {recovery ? "使用密码进入" : "忘记密码，使用恢复码"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
