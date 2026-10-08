import { useState } from "react";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "@phosphor-icons/react";
import { createCredentials } from "./security";
import { recommendedTasks, taskSeeds, rewardSeeds, type State } from "./domain";
import type { IslandService } from "./service";
import { petNames, TaskImage, Stars } from "./components";

export function Setup({
  service,
  onError,
}: {
  service: IslandService;
  onError: (message: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [pet, setPet] = useState<State["companion"]>("fox");
  const [name, setName] = useState("小狐狸");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tasks, setTasks] = useState(recommendedTasks);
  const [rewards, setRewards] = useState<string[]>([]);
  const [receipt, setReceipt] =
    useState<Awaited<ReturnType<typeof createCredentials>>>();
  const [busy, setBusy] = useState(false);
  const prepare = async () => {
    if (pin !== confirm) return onError("两次输入的密码不一样。");
    if (!tasks.length) return onError("请至少选一个任务。");
    setBusy(true);
    try {
      setReceipt(await createCredentials(pin));
      setStep(2);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      await service.run({
        type: "initialize",
        credentials: receipt.credentials,
        companion: pet,
        name: name.trim() || petNames[pet],
        taskIds: tasks,
        rewardIds: rewards,
      });
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="setup-shell">
      <section className={`setup-panel step-${step}`}>
        <header>
          <p className="eyebrow">欢迎来到</p>
          <h1>小小冒险岛</h1>
          <p>
            {step === 0
              ? "选一位小伙伴，一起开始生活中的冒险。"
              : step === 1
                ? "请爸爸妈妈一起准备小岛。"
                : "小岛快准备好了！"}
          </p>
        </header>
        {step === 0 ? (
          <>
            <div className="pet-choices">
              {(["fox", "rabbit", "bear"] as const).map((key) => (
                <button
                  key={key}
                  className={`pet-choice ${pet === key ? "selected" : ""}`}
                  onClick={() => {
                    setPet(key);
                    setName(petNames[key]);
                  }}
                >
                  <img src={`/assets/pets/${key}.webp`} alt={petNames[key]} />
                  <strong>{petNames[key]}</strong>
                  {pet === key && <Check weight="bold" />}
                </button>
              ))}
            </div>
            <label className="name-input">
              给小伙伴起个名字
              <input
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="primary" onClick={() => setStep(1)}>
              邀请爸爸妈妈 <ArrowRight weight="bold" />
            </button>
          </>
        ) : step === 1 ? (
          <>
            <div className="setup-columns">
              <div>
                <h2>
                  <ShieldCheck weight="fill" /> 家长密码
                </h2>
                <p className="muted">六位数字，用于审核任务和设置奖励。</p>
                <label>
                  设置密码
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  再输入一次
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirm}
                    onChange={(e) =>
                      setConfirm(e.target.value.replace(/\D/g, ""))
                    }
                    autoComplete="new-password"
                  />
                </label>
                <h2>第一批奖励</h2>
                <p className="muted">
                  勾选即确认示例价格并上架，也可稍后设置。
                </p>
                {rewardSeeds.map((reward) => (
                  <label className="check-row" key={reward.id}>
                    <input
                      type="checkbox"
                      checked={rewards.includes(reward.id)}
                      onChange={(e) =>
                        setRewards(
                          e.target.checked
                            ? [...rewards, reward.id]
                            : rewards.filter((id) => id !== reward.id),
                        )
                      }
                    />
                    {reward.title}
                    <Stars value={reward.price} />
                  </label>
                ))}
              </div>
              <div>
                <h2>
                  每天的小任务 <small>已选 {tasks.length} 项</small>
                </h2>
                <p className="muted">建议先选 4–6 项，之后可以调整。</p>
                <div className="seed-picker">
                  {taskSeeds.map((task) => (
                    <button
                      key={task.id}
                      className={tasks.includes(task.id) ? "selected" : ""}
                      onClick={() =>
                        setTasks(
                          tasks.includes(task.id)
                            ? tasks.filter((id) => id !== task.id)
                            : [...tasks, task.id],
                        )
                      }
                    >
                      <TaskImage image={task.image} title={task.title} />
                      <span>{task.title}</span>
                      {tasks.includes(task.id) && <Check weight="bold" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setStep(0)}>
                <ArrowLeft /> 返回
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void prepare()}
              >
                {busy ? "正在准备…" : "准备好了"}
              </button>
            </div>
          </>
        ) : (
          <div className="recovery-receipt">
            <ShieldCheck size={56} weight="fill" />
            <h2>请保存家长恢复码</h2>
            <p>忘记密码时，用它设置新密码。请把它保存在孩子看不到的地方。</p>
            <code>{receipt?.recovery}</code>
            <p className="muted">
              这台平板上的小岛会自动保存。还可以在家长设置里导出备份。
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void start()}
            >
              {busy ? "正在保存…" : "我已保存，开始冒险"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
