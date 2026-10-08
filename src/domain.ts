import { z } from "zod";
import {defaultVoice,legacyDefaultVoice} from './voice-config';

const id = z.string().min(1).max(160);
const text = z.string().trim().min(1).max(100);
const voice = z.string().max(300).optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
  );
const timestamp = z.string().datetime({ offset: true });
const audioData = z
  .string()
  .max(3000000)
  .regex(
    /^data:audio\/[a-z0-9.+-]+(?:;codecs=[a-z0-9.+-]+)?;base64,[A-Za-z0-9+/=]+$/i,
  );
const imageData = z.string().max(1200000).regex(/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/);
export const taskSchema = z
  .object({
    id,
    title: text,
    description: z.string().max(500),
    category: z.enum(["自理", "整理", "学习", "运动"]),
    image: id,
    points: z.number().int().min(1).max(1000),
    period: z.enum(["daily", "once"]),
    enabled: z.boolean(),
    voice,
  })
  .strict();
export const rewardSchema = z
  .object({
    id,
    title: text,
    description: z.string().max(500),
    image: id,
    price: z.number().int().min(1).max(100000),
    enabled: z.boolean(),
  })
  .strict();
export type Task = z.infer<typeof taskSchema>;
export type Reward = z.infer<typeof rewardSchema>;
const claimSchema = z
  .object({
    id,
    taskId: id,
    day: date,
    title: text,
    description: z.string().max(500),
    image: id,
    voice,
    points: z.number().int().min(1).max(1000),
    xp: z.literal(10),
    period: z.enum(["daily", "once"]),
    status: z.enum(["active", "pending", "approved", "expired"]),
    createdAt: timestamp,
    approvedAt: timestamp.optional(),
    recordingId: id.optional(),
  })
  .strict();
const redemptionSchema = z
  .object({
    id,
    rewardId: id,
    title: text,
    image: id,
    price: z.number().int().min(1).max(100000),
    status: z.enum([
      "pending",
      "approved",
      "fulfilled",
      "rejected",
      "cancelled",
    ]),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
const ledgerSchema = z
  .object({
    id,
    sourceId: id,
    kind: z.enum(["task", "reward"]),
    amount: z.number().int().min(-100000).max(1000),
    title: text,
    at: timestamp,
  })
  .strict();
const celebrationSchema = z
  .object({
    id,
    title: text,
    points: z.number().int(),
    levelUp: z.boolean(),
    kind: z.enum(["task", "reward"]),
  })
  .strict();
export const credentialsSchema = z
  .object({
    salt: z.string().regex(/^[a-f0-9]{32}$/),
    pin: z.string().regex(/^[a-f0-9]{64}$/),
    recovery: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    initialized: z.boolean(),
    companion: z.enum(["fox", "rabbit", "bear"]),
    companionName: text,
    costume: z.enum(["none", "hat", "bag", "crown"]),
    xp: z.number().int().nonnegative(),
    lastDay: z.union([date, z.literal("")]),
    credentials: credentialsSchema.nullable(),
    tasks: z.array(taskSchema).max(500),
    rewards: z.array(rewardSchema).max(500),
    claims: z.array(claimSchema).max(50000),
    redemptions: z.array(redemptionSchema).max(50000),
    ledger: z.array(ledgerSchema).max(100000),
    celebrations: z.array(celebrationSchema).max(50000),
    settings: z
      .object({
        volume: z.number().min(0).max(1),
        effects: z.enum(["standard", "gentle"]),
        conversation: z.boolean().default(false),
        voiceId: z.string().min(1).max(160).default(defaultVoice),
      })
      .strict(),
    recordings: z.record(z.string(), audioData),
    voiceAssets: z.record(id, audioData).default({}),
    illustrations: z.record(id, imageData).default({}),
  })
  .strict();
export type State = z.infer<typeof stateSchema>;
export type Claim = State["claims"][number];
export type Redemption = State["redemptions"][number];
export const taskSeeds: Task[] = [
  ["brush-morning", "早晨刷牙", "早晨和爸爸妈妈一起把牙齿刷干净。", "自理", 3],
  ["brush-night", "晚上刷牙", "睡前和爸爸妈妈一起刷牙。", "自理", 3],
  ["wash-hands", "洗洗小手", "吃饭前，用清水和洗手液把小手洗干净。", "自理", 3],
  [
    "wear-shoes",
    "自己穿鞋",
    "试着自己穿好鞋子。需要时可以请大人帮助。",
    "自理",
    3,
  ],
  ["laundry", "衣服回家", "把换下的脏衣服放进衣篮。", "自理", 3],
  ["towel", "整理小毛巾", "把自己的小毛巾挂回原来的位置。", "自理", 3],
  ["tidy-toys", "玩具回家", "把玩过的玩具放回收纳箱。", "整理", 5],
  ["sort-blocks", "积木分类", "把积木按颜色或形状分好。", "整理", 5],
  ["books", "图书归架", "把看过的绘本放回书架。", "整理", 3],
  ["tidy-shoes", "鞋子排队", "把自己的鞋子整齐放好。", "整理", 3],
  ["wipe-table", "擦擦小桌", "用小抹布擦干净自己的小桌面。", "整理", 5],
  ["napkins", "摆好餐巾", "帮助家人摆放餐巾。", "整理", 3],
  ["read", "一起读书", "和爸爸妈妈一起读绘本，读十分钟。", "学习", 5],
  ["draw", "画一幅画", "画一幅你喜欢的画。", "学习", 5],
  ["puzzle", "拼图挑战", "完成一幅适合自己的拼图。", "学习", 8],
  ["pencils", "画笔归位", "把画笔和画纸收好。", "学习", 3],
  ["story", "看图讲故事", "看看绘本里的图，讲一小段故事。", "学习", 5],
  ["colors", "寻找颜色", "找到三种颜色，说说它们在哪里。", "学习", 3],
  ["outdoors", "户外小冒险", "和大人一起到户外活动十五分钟。", "运动", 8],
  ["ball", "快乐玩球", "和家人一起玩球五分钟。", "运动", 5],
  ["stretch", "伸伸小身体", "跟着大人做几个简单的伸展动作。", "运动", 3],
  ["sports", "运动玩具归位", "活动后把运动玩具放回原位。", "运动", 3],
  ["water", "给植物喝水", "和大人一起给植物浇水。", "运动", 5],
  ["bag", "整理出门包", "和大人一起整理出门用的小包。", "运动", 5],
].map(([key, title, description, category, points]) => ({
  id: String(key),
  title: String(title),
  description: String(description),
  category: category as Task["category"],
  image: String(key),
  points: Number(points),
  period: "daily",
  enabled: false,
}));
export const rewardSeeds: Reward[] = [
  {
    id: "stickers",
    title: "一张喜欢的贴纸",
    description: "选一张喜欢的贴纸。",
    image: "stickers",
    price: 15,
    enabled: false,
  },
  {
    id: "activity",
    title: "选择家庭活动",
    description: "和家人商量，选一次喜欢的家庭活动。",
    image: "activity",
    price: 30,
    enabled: false,
  },
  {
    id: "picnic",
    title: "一次公园野餐",
    description: "和家人约好时间，一起去公园野餐。",
    image: "picnic",
    price: 80,
    enabled: false,
  },
  {
    id: "new-book",
    title: "一本新绘本",
    description: "和爸爸妈妈一起选一本新绘本。",
    image: "new-book",
    price: 100,
    enabled: false,
  },
  {
    id: "toy",
    title: "一个小玩具",
    description: "和爸爸妈妈商量，选一个小玩具。",
    image: "toy",
    price: 150,
    enabled: false,
  },
];
export const recommendedTasks = [
  "wash-hands",
  "wear-shoes",
  "tidy-toys",
  "read",
  "outdoors",
];
// Picture options are independent of task/reward templates and their prices.
export const taskPictureOptions = [
  ...taskSeeds.map(({image,title})=>({image,title})),
  {image:'read-alone',title:'自己阅读'},
];
export const rewardPictureOptions = [
  ...rewardSeeds.map(({image,title})=>({image,title})),
  {image:'mystery-gift',title:'神秘礼物'},
];
export function blankState(): State {
  return {
    schemaVersion: 1,
    revision: 0,
    initialized: false,
    companion: "fox",
    companionName: "小狐狸",
    costume: "none",
    xp: 0,
    lastDay: "",
    credentials: null,
    tasks: structuredClone(taskSeeds),
    rewards: structuredClone(rewardSeeds),
    claims: [],
    redemptions: [],
    ledger: [],
    celebrations: [],
    settings: { volume: 0.75, effects: "standard", conversation: false, voiceId: defaultVoice },
    recordings: {},
    voiceAssets: {},
    illustrations: {},
  };
}
export function balance(s: State) {
  return s.ledger.reduce((sum, row) => sum + row.amount, 0);
}
export function reserved(s: State) {
  return s.redemptions
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.price, 0);
}
export function available(s: State) {
  return balance(s) - reserved(s);
}
export function level(s: State) {
  return Math.min(10, 1 + Math.floor(s.xp / 100));
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function instanceId(t: Task, day: string) {
  return `${t.id}:${t.period === "once" ? "once" : day}`;
}
export function todayTasks(s: State, day = localDay()) {
  return s.tasks.filter(
    (t) =>
      t.enabled &&
      !(
        t.period === "once" &&
        s.claims.some(
          (c) =>
            c.taskId === t.id && c.period === "once" && c.status === "approved",
        )
      ),
  );
}
export function currentClaim(s: State, t: Task, day = localDay()) {
  return s.claims.find((c) => c.id === instanceId(t, day));
}
export type Command =
  | {
      type: "initialize";
      credentials: z.infer<typeof credentialsSchema>;
      companion: State["companion"];
      name: string;
      taskIds: string[];
      rewardIds: string[];
    }
  | { type: "tick" }
  | { type: "claim"; taskId: string }
  | { type: "submit"; claimId: string }
  | { type: "wear"; costume: State["costume"] }
  | { type: "review"; claimId: string; approve: boolean }
  | { type: "redeem"; rewardId: string; requestId: string }
  | { type: "cancel"; requestId: string }
  | { type: "reviewReward"; requestId: string; approve: boolean }
  | { type: "fulfill"; requestId: string }
  | { type: "saveTask"; task: Task; illustration?: string; recording?: string }
  | { type: "saveReward"; reward: Reward }
  | { type: "settings"; settings: Pick<State["settings"], "volume" | "effects"> & Partial<State["settings"]> }
  | { type: "credentials"; credentials: NonNullable<State["credentials"]> }
  | { type: "recording"; taskId: string; data: string }
  | { type: "celebrated"; ids: string[] };
const parentTypes = new Set([
  "review",
  "reviewReward",
  "fulfill",
  "saveTask",
  "saveReward",
  "settings",
  "credentials",
  "recording",
]);
export function validateState(input: unknown): State {
  const s = stateSchema.parse(input);
  if(s.settings.voiceId===legacyDefaultVoice)s.settings.voiceId=defaultVoice;
  for (const rows of [
    s.tasks,
    s.rewards,
    s.claims,
    s.redemptions,
    s.ledger,
    s.celebrations,
  ])
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error("备份包含重复记录。");
  if (s.initialized && !s.credentials) throw new Error("家长密码记录不完整。");
  if (s.initialized && !s.lastDay) throw new Error("日期记录不完整。");
  if (balance(s) < 0 || available(s) < 0) throw new Error("积分记录不一致。");
  if (
    s.xp !==
    s.claims
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + c.xp, 0)
  )
    throw new Error("成长经验记录不一致。");
  const taskIds = new Set(s.tasks.map((t) => t.id)),
    rewardIds = new Set(s.rewards.map((r) => r.id));
  const claimIds = new Set(s.claims.map((c) => c.id)),
    redemptionIds = new Set(s.redemptions.map((r) => r.id));
  const rowsBySource = new Map<string, State["ledger"]>();
  for (const row of s.ledger) {
    const key = `${row.kind}:${row.sourceId}`;
    const rows = rowsBySource.get(key) || [];
    rows.push(row);
    rowsBySource.set(key, rows);
  }
  const taskImages = new Set(taskPictureOptions.map((t) => t.image)),
    rewardImages = new Set(rewardPictureOptions.map((r) => r.image));
  const art = Object.entries(s.illustrations);
  if (art.length > 500 || art.reduce((sum, [, data]) => sum + data.length, 0) > 24000000 || art.some(([key]) => !key.startsWith("custom:")))
    throw new Error("自定义图片数量或大小超出限制。");
  for (const [key] of art) taskImages.add(key);
  if (
    s.tasks.some((t) => !taskImages.has(t.image)) ||
    s.rewards.some((r) => !rewardImages.has(r.image))
  )
    throw new Error("备份包含未知图片。");
  if (Object.keys(s.recordings).some((key) => !taskIds.has(key)))
    throw new Error("录音对应的任务不存在。");
  if([...Object.values(s.recordings),...Object.values(s.voiceAssets)].reduce((sum,data)=>sum+data.length,0)>12000000)
    throw new Error("自定义语音存储已满，请移除不再使用的录音。");
  if(JSON.stringify(s).length>39000000)throw new Error("小岛数据已达到当前备份容量，请先导出保存。");
  if (level(s) < { none: 1, hat: 4, bag: 6, crown: 10 }[s.costume])
    throw new Error("装扮解锁记录不一致。");
  for (const c of s.claims) {
    if(c.recordingId && !s.voiceAssets[c.recordingId])throw new Error("任务语音快照不完整。");
    if (
      !taskIds.has(c.taskId) ||
      !taskImages.has(c.image) ||
      c.id !== `${c.taskId}:${c.period === "once" ? "once" : c.day}`
    )
      throw new Error("任务记录不完整。");
    const rows = rowsBySource.get(`task:${c.id}`) || [];
    if (
      c.status === "approved"
        ? !c.approvedAt ||
          rows.length !== 1 ||
          rows[0].id !== `earn:${c.id}` ||
          rows[0].amount !== c.points
        : rows.length !== 0 || !!c.approvedAt
    )
      throw new Error("任务积分记录不一致。");
  }
  for (const r of s.redemptions) {
    if (!rewardIds.has(r.rewardId) || !rewardImages.has(r.image))
      throw new Error("奖励记录不完整。");
    const rows = rowsBySource.get(`reward:${r.id}`) || [];
    if (
      ["approved", "fulfilled"].includes(r.status)
        ? rows.length !== 1 ||
          rows[0].id !== `spend:${r.id}` ||
          rows[0].amount !== -r.price
        : rows.length !== 0
    )
      throw new Error("兑换积分记录不一致。");
  }
  if (
    s.ledger.some((l) =>
      l.kind === "task"
        ? !claimIds.has(l.sourceId)
        : !redemptionIds.has(l.sourceId),
    )
  )
    throw new Error("积分来源不完整。");
  for (const c of s.celebrations) {
    if (c.kind === "task") {
      const claim = s.claims.find((row) => row.id === c.id);
      if (!claim || claim.status !== "approved" || c.points !== claim.points)
        throw new Error("庆祝记录不一致。");
    } else {
      const reward = s.redemptions.find((row) => `reward:${row.id}` === c.id);
      if (
        !reward ||
        !["approved", "fulfilled"].includes(reward.status) ||
        c.points !== 0
      )
        throw new Error("庆祝记录不一致。");
    }
  }
  return s;
}
export function reduceState(
  original: State,
  command: Command,
  ctx: { day: string; at: string; parent: boolean },
): State {
  if (parentTypes.has(command.type) && !ctx.parent)
    throw new Error("请先进入家长设置。");
  if (
    !original.initialized &&
    command.type !== "initialize" &&
    command.type !== "tick"
  )
    throw new Error("请先和家长一起准备小岛。");
  const s = structuredClone(original);
  if (ctx.day >= s.lastDay) {
    s.lastDay = ctx.day;
    for (const c of s.claims)
      if (c.period === "daily" && c.status === "active" && c.day < ctx.day)
        c.status = "expired";
  }
  const findClaim = (key: string) => {
    const c = s.claims.find((c) => c.id === key);
    if (!c) throw new Error("找不到这个任务。");
    return c;
  };
  const findReward = (key: string) => {
    const r = s.redemptions.find((r) => r.id === key);
    if (!r) throw new Error("找不到这次兑换。");
    return r;
  };
  switch (command.type) {
    case "initialize": {
      if (s.initialized) throw new Error("小岛已经准备好了。");
      s.credentials = credentialsSchema.parse(command.credentials);
      s.companion = command.companion;
      s.companionName = text.parse(command.name);
      s.initialized = true;
      s.tasks.forEach((t) => (t.enabled = command.taskIds.includes(t.id)));
      s.rewards.forEach((r) => (r.enabled = command.rewardIds.includes(r.id)));
      break;
    }
    case "tick":
      break;
    case "wear":
      if (level(s) < { none: 1, hat: 4, bag: 6, crown: 10 }[command.costume])
        throw new Error("这件装扮还没有解锁。");
      s.costume = command.costume;
      break;
    case "claim": {
      if (ctx.day < s.lastDay)
        throw new Error("平板日期有变化，请让家长检查时间。");
      const t = s.tasks.find((t) => t.id === command.taskId && t.enabled);
      if (!t) throw new Error("这个任务暂时没有开放。");
      const key = instanceId(t, ctx.day);
      if (s.claims.some((c) => c.id === key)) break;
      let recordingId:string|undefined;
      const recording=s.recordings[t.id];
      if(recording){recordingId=Object.keys(s.voiceAssets).find(id=>s.voiceAssets[id]===recording)||`voice:${key}`;s.voiceAssets[recordingId]=recording;}
      s.claims.push({
        id: key,
        taskId: t.id,
        day: ctx.day,
        title: t.title,
        description: t.description,
        image: t.image,
        ...(t.voice ? { voice: t.voice } : {}),
        points: t.points,
        xp: 10,
        period: t.period,
        status: "active",
        createdAt: ctx.at,
        ...(recordingId ? {recordingId} : {}),
      });
      break;
    }
    case "submit": {
      const c = findClaim(command.claimId);
      if (c.status === "pending" || c.status === "approved") break;
      if (c.status !== "active")
        throw new Error("这个任务已经结束，看看今天的新任务吧。");
      c.status = "pending";
      break;
    }
    case "review": {
      const c = findClaim(command.claimId);
      if (c.status === "approved") break;
      if (c.status !== "pending") throw new Error("这个任务目前不需要审核。");
      if (!command.approve) {
        c.status =
          c.period === "daily" && c.day < ctx.day ? "expired" : "active";
        break;
      }
      const oldLevel = level(s);
      c.status = "approved";
      c.approvedAt = ctx.at;
      s.xp += c.xp;
      s.ledger.push({
        id: `earn:${c.id}`,
        sourceId: c.id,
        kind: "task",
        amount: c.points,
        title: c.title,
        at: ctx.at,
      });
      s.celebrations.push({
        id: c.id,
        title: c.title,
        points: c.points,
        levelUp: level(s) > oldLevel,
        kind: "task",
      });
      break;
    }
    case "redeem": {
      if (s.redemptions.some((r) => r.id === command.requestId)) break;
      const r = s.rewards.find((r) => r.id === command.rewardId && r.enabled);
      if (!r) throw new Error("这个奖励暂时没有上架。");
      if (available(s) < r.price)
        throw new Error("星星还差一点点，再完成几个任务吧。");
      s.redemptions.push({
        id: command.requestId,
        rewardId: r.id,
        title: r.title,
        image: r.image,
        price: r.price,
        status: "pending",
        createdAt: ctx.at,
        updatedAt: ctx.at,
      });
      break;
    }
    case "cancel": {
      const r = findReward(command.requestId);
      if (r.status === "cancelled") break;
      if (r.status !== "pending") throw new Error("这个申请已经处理了。");
      r.status = "cancelled";
      r.updatedAt = ctx.at;
      break;
    }
    case "reviewReward": {
      const r = findReward(command.requestId);
      if (
        r.status === "approved" ||
        r.status === "fulfilled" ||
        r.status === "rejected"
      )
        break;
      if (r.status !== "pending") throw new Error("这个申请已经取消。");
      r.status = command.approve ? "approved" : "rejected";
      r.updatedAt = ctx.at;
      if (command.approve) {
        s.ledger.push({
          id: `spend:${r.id}`,
          sourceId: r.id,
          kind: "reward",
          amount: -r.price,
          title: r.title,
          at: ctx.at,
        });
        s.celebrations.push({
          id: `reward:${r.id}`,
          title: r.title,
          points: 0,
          levelUp: false,
          kind: "reward",
        });
      }
      break;
    }
    case "fulfill": {
      const r = findReward(command.requestId);
      if (r.status === "fulfilled") break;
      if (r.status !== "approved") throw new Error("请先批准兑换。");
      r.status = "fulfilled";
      r.updatedAt = ctx.at;
      break;
    }
    case "saveTask": {
      const t = taskSchema.parse(command.task);
      if (command.illustration !== undefined) {
        if (!t.image.startsWith("custom:")) throw new Error("自定义图片编号不正确。");
        s.illustrations[t.image] = imageData.parse(command.illustration);
      }
      if (command.recording !== undefined) s.recordings[t.id] = audioData.parse(command.recording);
      const i = s.tasks.findIndex((t) => t.id === command.task.id);
      if (
        i >= 0 &&
        s.tasks[i].period !== t.period &&
        s.claims.some((c) => c.taskId === t.id)
      )
        throw new Error("已经领取过的任务不能改重复规则，请添加一个新任务。");
      if (i < 0) s.tasks.push(t);
      else s.tasks[i] = t;
      break;
    }
    case "saveReward": {
      const r = rewardSchema.parse(command.reward);
      const i = s.rewards.findIndex((r) => r.id === command.reward.id);
      if (i < 0) s.rewards.push(r);
      else s.rewards[i] = r;
      break;
    }
    case "settings":
      s.settings = stateSchema.shape.settings.parse({ ...s.settings, ...command.settings });
      break;
    case "credentials":
      s.credentials = credentialsSchema.parse(command.credentials);
      break;
    case "recording":
      if (!s.tasks.some((t) => t.id === command.taskId))
        throw new Error("请先保存任务。");
      if (
        command.data &&
        !/^data:audio\/[a-z0-9.+-]+(?:;codecs=[a-z0-9.+-]+)?;base64,[A-Za-z0-9+/=]+$/i.test(
          command.data,
        )
      )
        throw new Error("录音格式不正确。");
      if (command.data.length > 3000000)
        throw new Error("录音太长，请控制在三十秒内。");
      if (command.data) s.recordings[command.taskId] = command.data;
      else delete s.recordings[command.taskId];
      break;
    case "celebrated":
      s.celebrations = s.celebrations.filter(
        (c) => !command.ids.includes(c.id),
      );
      break;
  }
  s.revision = original.revision + 1;
  return validateState(s);
}
