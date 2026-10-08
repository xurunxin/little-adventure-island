import test from "node:test";
import assert from "node:assert/strict";
import {
  blankState,
  reduceState,
  available,
  balance,
  reserved,
  level,
  validateState,
  type State,
  type Command,
} from "../src/domain.ts";
import { createCredentials, verify } from "../src/security.ts";
import { MemoryRepository } from "../src/storage.ts";
import { IslandService } from "../src/service.ts";
const credentials = {
  salt: "a".repeat(32),
  pin: "b".repeat(64),
  recovery: "c".repeat(64),
};
const ctx = { day: "2026-10-08", at: "2026-10-08T08:00:00Z", parent: true };
function run(s: State, c: Command, context = ctx) {
  return reduceState(s, c, context);
}
function setup() {
  return run(blankState(), {
    type: "initialize",
    credentials,
    companion: "fox",
    name: "小狐狸",
    taskIds: ["wash-hands", "tidy-toys", "read"],
    rewardIds: ["stickers"],
  });
}
function earn(s = setup(), key = "wash-hands") {
  s = run(s, { type: "claim", taskId: key });
  s = run(s, { type: "submit", claimId: `${key}:${ctx.day}` });
  return run(s, {
    type: "review",
    claimId: `${key}:${ctx.day}`,
    approve: true,
  });
}
function funded() {
  let s = setup();
  s = run(s, {
    type: "saveTask",
    task: { ...s.tasks[0], id: "fund", points: 100, enabled: true },
  });
  return earn(s, "fund");
}
test("24 templates are imported but not published before setup", () => {
  const s = blankState();
  assert.equal(s.tasks.length, 24);
  assert.equal(s.tasks.filter((t) => t.enabled).length, 0);
  assert.equal(s.rewards.filter((r) => r.enabled).length, 0);
});
test("approval pays exactly once; submission alone pays nothing", () => {
  let s = setup();
  s = run(s, { type: "claim", taskId: "wash-hands" });
  s = run(s, { type: "submit", claimId: "wash-hands:2026-10-08" });
  assert.equal(balance(s), 0);
  assert.equal(s.xp, 0);
  s = run(s, { type: "review", claimId: s.claims[0].id, approve: true });
  const duplicate = run(s, {
    type: "review",
    claimId: s.claims[0].id,
    approve: true,
  });
  assert.equal(balance(duplicate), 3);
  assert.equal(duplicate.xp, 10);
  assert.equal(duplicate.ledger.length, 1);
  assert.equal(duplicate.celebrations.length, 1);
});
test("repeated claim and submit have a single instance", () => {
  let s = setup();
  s = run(s, { type: "claim", taskId: "wash-hands" });
  s = run(s, { type: "claim", taskId: "wash-hands" });
  s = run(s, { type: "submit", claimId: s.claims[0].id });
  s = run(s, { type: "submit", claimId: s.claims[0].id });
  assert.equal(s.claims.length, 1);
  assert.equal(s.claims[0].status, "pending");
});
test("parent-only commands reject child callers", () => {
  const s = earn();
  assert.throws(
    () =>
      run(
        s,
        { type: "review", claimId: s.claims[0].id, approve: true },
        { ...ctx, parent: false },
      ),
    /家长/,
  );
  assert.throws(
    () =>
      run(s, { type: "saveTask", task: s.tasks[0] }, { ...ctx, parent: false }),
    /家长/,
  );
  assert.throws(
    () =>
      run(
        s,
        { type: "settings", settings: { volume: 0, effects: "gentle" } },
        { ...ctx, parent: false },
      ),
    /家长/,
  );
});
test("reward snapshot survives editing template and disabling task", () => {
  let s = setup();
  s = run(s, { type: "claim", taskId: "wash-hands" });
  s = run(s, {
    type: "saveTask",
    task: {
      ...s.tasks.find((t) => t.id === "wash-hands")!,
      title: "new title",
      points: 999,
      enabled: false,
    },
  });
  s = run(s, { type: "submit", claimId: s.claims[0].id });
  s = run(s, { type: "review", claimId: s.claims[0].id, approve: true });
  assert.equal(balance(s), 3);
  assert.equal(s.ledger[0].title, "洗洗小手");
});
test("daily rollover expires unsubmitted but preserves pending claims", () => {
  let s = setup();
  s = run(s, { type: "claim", taskId: "wash-hands" });
  s = run(s, { type: "claim", taskId: "tidy-toys" });
  s = run(s, { type: "submit", claimId: "tidy-toys:2026-10-08" });
  s = run(s, { type: "tick" }, { ...ctx, day: "2026-10-09" });
  assert.equal(s.claims[0].status, "expired");
  assert.equal(s.claims[1].status, "pending");
  s = run(
    s,
    { type: "review", claimId: s.claims[1].id, approve: true },
    { ...ctx, day: "2026-10-09" },
  );
  assert.equal(balance(s), 5);
  assert.throws(
    () =>
      run(
        s,
        { type: "submit", claimId: s.claims[0].id },
        { ...ctx, day: "2026-10-09" },
      ),
    /结束/,
  );
});
test("clock rollback cannot create additional claims", () => {
  let s = earn();
  s = run(s, { type: "tick" }, { ...ctx, day: "2026-10-09" });
  assert.throws(() => run(s, { type: "claim", taskId: "read" }), /日期/);
  s = run(
    s,
    { type: "claim", taskId: "wash-hands" },
    { ...ctx, day: "2026-10-09" },
  );
  assert.equal(s.claims.length, 2);
});
test("one-time task cannot be granted on another day", () => {
  let s = setup();
  s = run(s, {
    type: "saveTask",
    task: { ...s.tasks.find((t) => t.id === "read")!, period: "once" },
  });
  s = run(s, { type: "claim", taskId: "read" });
  s = run(s, { type: "submit", claimId: "read:once" });
  s = run(s, { type: "review", claimId: "read:once", approve: true });
  s = run(s, { type: "claim", taskId: "read" }, { ...ctx, day: "2026-10-09" });
  assert.equal(s.claims.length, 1);
  assert.equal(balance(s), 5);
});
test("rejection returns current-day task to active without penalty", () => {
  let s = setup();
  s = run(s, { type: "claim", taskId: "read" });
  s = run(s, { type: "submit", claimId: s.claims[0].id });
  s = run(s, { type: "review", claimId: s.claims[0].id, approve: false });
  assert.equal(s.claims[0].status, "active");
  assert.equal(balance(s), 0);
  assert.equal(s.xp, 0);
});
test("reservations prevent overspending across concurrent applications", () => {
  let s = funded();
  s = run(s, { type: "saveReward", reward: { ...s.rewards[0], price: 60 } });
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  assert.equal(balance(s), 100);
  assert.equal(reserved(s), 60);
  assert.equal(available(s), 40);
  assert.throws(
    () => run(s, { type: "redeem", rewardId: "stickers", requestId: "b" }),
    /星星/,
  );
  assert.equal(s.redemptions.length, 1);
});
test("duplicate redemption request ID cannot reserve twice", () => {
  let s = funded();
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  assert.equal(reserved(s), 15);
  assert.equal(s.redemptions.length, 1);
});
test("approval deducts snapshot price exactly once, fulfillment never deducts again", () => {
  let s = funded();
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  s = run(s, {
    type: "saveReward",
    reward: { ...s.rewards[0], price: 80, enabled: false },
  });
  s = run(s, { type: "reviewReward", requestId: "a", approve: true });
  s = run(s, { type: "reviewReward", requestId: "a", approve: true });
  assert.equal(balance(s), 85);
  assert.equal(available(s), 85);
  assert.equal(reserved(s), 0);
  assert.equal(s.xp, 10);
  s = run(s, { type: "fulfill", requestId: "a" });
  s = run(s, { type: "fulfill", requestId: "a" });
  assert.equal(balance(s), 85);
  assert.equal(s.ledger.length, 2);
  assert.equal(s.redemptions[0].status, "fulfilled");
  assert.equal(s.celebrations.filter((c) => c.kind === "reward").length, 1);
});
test("rejection and cancellation release reservations", () => {
  let s = funded();
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "b" });
  s = run(s, { type: "cancel", requestId: "a" });
  assert.equal(reserved(s), 15);
  s = run(s, { type: "reviewReward", requestId: "b", approve: false });
  assert.equal(available(s), 100);
  assert.equal(s.ledger.length, 1);
});
test("unapproved reward cannot be fulfilled", () => {
  let s = funded();
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  assert.throws(() => run(s, { type: "fulfill", requestId: "a" }), /先批准/);
});
test("level clamps at ten while experience continues", () => {
  const s = setup();
  s.xp = 1500;
  assert.equal(level(s), 10);
  assert.equal(s.xp, 1500);
  assert.throws(
    () => run(setup(), { type: "wear", costume: "crown" }),
    /没有解锁/,
  );
});
test("backup preserves snapshots, reservations, recordings and credentials", () => {
  let s = funded();
  s = run(s, { type: "redeem", rewardId: "stickers", requestId: "a" });
  s = run(s, {
    type: "recording",
    taskId: "read",
    data: "data:audio/webm;base64,QUJD",
  });
  const restored = validateState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored, s);
  assert.equal(available(restored), 85);
});
test("malformed and tampered backup is rejected", () => {
  let s = earn();
  assert.throws(() => validateState({ ...s, xp: 99 }));
  assert.throws(() => validateState({ ...s, ledger: [] }));
  assert.throws(() =>
    validateState({ ...s, ledger: [...s.ledger, ...s.ledger] }),
  );
  assert.throws(() => validateState({ ...s, schemaVersion: 999 }));
  assert.throws(() => validateState({ ...s, unknown: "oops" }));
});
test("repository CAS rejects stale writes", async () => {
  const repo = new MemoryRepository();
  const initial = await repo.load();
  const next = run(initial, { type: "tick" });
  await repo.save(initial.revision, next);
  await assert.rejects(repo.save(initial.revision, next), /更新/);
  assert.equal((await repo.load()).revision, 1);
});
test("service persists before publishing; failed writes leave visible state unchanged", async () => {
  class FailingRepository extends MemoryRepository {
    fail = false;
    override async save(expected: number, s: State) {
      if (this.fail) throw new Error("disk full");
      return super.save(expected, s);
    }
  }
  const repo = new FailingRepository(setup());
  const service = new IslandService(repo);
  await service.init();
  const previous = structuredClone(service.state);
  repo.fail = true;
  await assert.rejects(
    service.run({ type: "claim", taskId: "wash-hands" }),
    /disk full/,
  );
  assert.deepEqual(service.state, previous);
  assert.deepEqual(await repo.load(), previous);
});
test("service serializes simultaneous clicks into one claim", async () => {
  const repo = new MemoryRepository(setup());
  const service = new IslandService(repo);
  await service.init();
  await Promise.all([
    service.run({ type: "claim", taskId: "wash-hands" }),
    service.run({ type: "claim", taskId: "wash-hands" }),
  ]);
  assert.equal(service.state.claims.length, 1);
});
test("PIN and recovery hashes are salted; correct credentials verify", async () => {
  const a = await createCredentials("123456");
  const b = await createCredentials("123456");
  assert.notEqual(a.credentials.pin, b.credentials.pin);
  assert.ok(await verify("123456", a.credentials));
  assert.equal(await verify("000000", a.credentials), false);
  assert.ok(await verify(a.recovery, a.credentials, true));
  assert.equal(await verify("BAD-CODE", a.credentials, true), false);
  await assert.rejects(createCredentials("123"), /六位/);
});
test("changing recurrence after a claim cannot manufacture another reward", () => {
  let s = earn();
  assert.throws(
    () =>
      run(s, {
        type: "saveTask",
        task: {
          ...s.tasks.find((t) => t.id === "wash-hands")!,
          period: "once",
        },
      }),
    /重复规则/,
  );
  assert.equal(balance(s), 3);
});
test("restore rejects invalid dates, foreign audio, missing sources and locked costumes", () => {
  const s = earn();
  assert.throws(() => validateState({ ...s, lastDay: "2026-02-30" }));
  assert.throws(() =>
    validateState({
      ...s,
      recordings: { read: "https://example.com/audio.mp3" },
    }),
  );
  assert.throws(() =>
    validateState({
      ...s,
      recordings: { unknown: "data:audio/webm;base64,QUJD" },
    }),
  );
  assert.throws(() => validateState({ ...s, costume: "crown" }));
  assert.throws(() =>
    validateState({
      ...s,
      claims: s.claims.map((c) => ({ ...c, image: "../unknown" })),
    }),
  );
});
test("background locking revokes queued parent edits", async () => {
  const service = new IslandService(new MemoryRepository(setup()));
  await service.init();
  service.parent = true;
  const pending = service.run({
    type: "settings",
    settings: { volume: 0, effects: "gentle" },
  });
  service.lock();
  await assert.rejects(pending, /密码/);
  assert.equal(service.state.settings.volume, 0.75);
});
