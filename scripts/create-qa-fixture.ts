// Creates disposable data for the separate .qa application. Never imported by the app.
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { blankState, reduceState, localDay } from "../src/domain";
import { createCredentials } from "../src/security";

const folder = "evidence/private";
await mkdir(folder, { recursive: true });
let state = blankState();
const created = await createCredentials("123456");
const context = (day: string, parent: boolean) => ({
  day,
  parent,
  at: `${day}T08:00:00.000Z`,
});
const today = localDay();
state = reduceState(
  state,
  {
    type: "initialize",
    credentials: created.credentials,
    companion: "fox",
    name: "小狐狸",
    taskIds: ["wash-hands", "tidy-toys", "read", "wear-shoes", "outdoors"],
    rewardIds: ["stickers", "activity", "picnic", "new-book", "toy"],
  },
  context("2026-01-01", false),
);
for (let i = 1; i <= 12; i++) {
  const day = `2026-01-${String(i).padStart(2, "0")}`;
  for (const command of [
    { type: "claim", taskId: "wash-hands" },
    { type: "submit", claimId: `wash-hands:${day}` },
    { type: "review", claimId: `wash-hands:${day}`, approve: true },
  ] as const)
    state = reduceState(state, command, context(day, true));
}
state = reduceState(state, { type: "tick" }, context(today, false));
state.celebrations = [];
const db = new DatabaseSync(`${folder}/little_islandSQLite.db`);
db.exec(
  "CREATE TABLE IF NOT EXISTS app_state(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL);",
);
db.prepare("INSERT OR REPLACE INTO app_state VALUES(1,?,?)").run(
  state.revision,
  JSON.stringify(state),
);
db.close();
await writeFile(
  `${folder}/qa-backup.json`,
  JSON.stringify(
    {
      format: "little-island-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  ),
);
console.log(
  "Created isolated QA SQLite and backup: 36 points, 120 XP. Production app remains uninitialized.",
);
