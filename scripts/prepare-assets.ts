import { mkdir, copyFile, writeFile, access } from "node:fs/promises";
import { taskSeeds } from "../src/domain.ts";
await mkdir("public/assets", { recursive: true });
await mkdir("public/audio", { recursive: true });
await copyFile(
  "node_modules/sql.js/dist/sql-wasm.wasm",
  "public/assets/sql-wasm.wasm",
);
try {
  await access("public/assets/adventure.ttf");
} catch {
  for (const [remote, local] of [
    ["ZCOOLKuaiLe-Regular.ttf", "adventure.ttf"],
    ["OFL.txt", "font-license.txt"],
  ]) {
    const response = await fetch(
      `https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/${remote}`,
    );
    if (!response.ok)
      throw new Error(`Font download failed: ${response.status}`);
    await writeFile(
      `public/assets/${local}`,
      new Uint8Array(await response.arrayBuffer()),
    );
  }
}
const prompts = [
  {id:'custom-task',text:'这是爸爸妈妈准备的小任务。一起看看图片，听听爸爸妈妈的说明吧。'},
  ...taskSeeds.map((task) => ({
    id: task.id,
    text: `${task.title}。${task.description}`,
  })),
  {
    id: "welcome",
    text: "欢迎来到小小冒险岛。和小伙伴一起，开始生活中的冒险吧！",
  },
  { id: "choose-task", text: "你想先做哪一个？点一点图片，听听怎么完成吧。" },
  {
    id: "task-claimed",
    text: "任务领取啦！先去完成现实中的小任务，再回来告诉伙伴。",
  },
  { id: "task-pending", text: "已经提交啦。请爸爸妈妈来确认你的努力吧。" },
  {
    id: "task-approved",
    text: "你做到了！爸爸妈妈确认了你的努力。星星已经存进小袋子啦！",
  },
  { id: "level-up", text: "伙伴升级啦！每一次尝试，都让我们一起长大。" },
  { id: "reward-pending", text: "奖励已经申请啦。请爸爸妈妈来看看吧。" },
  {
    id: "reward-approved",
    text: "奖励兑换成功啦！和爸爸妈妈一起约好兑现的时间吧。",
  },
  { id: "tasks", text: "今天的小任务在这里。点一点图片，选一个想做的任务吧。" },
  {
    id: "partner",
    text: "一起长大，真开心！完成任务积累经验，就会得到新的装扮和家园装饰。",
  },
];
await writeFile("scripts/audio-texts.json", JSON.stringify(prompts, null, 2));
console.log(
  `Prepared SQLite WASM, licensed Chinese font, and ${prompts.length} voice prompts.`,
);
