import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  localDay,
  reduceState,
  validateState,
  type State,
  type Command,
} from "./domain";
import type { Repository } from "./storage";
import { verify } from "./security";
import {prepareCustomArt, decodeArt} from './art';

export class IslandService {
  state!: State;
  parent = false;
  private queue = Promise.resolve();
  private listeners = new Set<() => void>();
  private failures = 0;
  private blockedUntil = 0;
  constructor(private repository: Repository) {}
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  private emit() {
    this.listeners.forEach((callback) => callback());
  }
  async init() {
    this.state = await this.repository.load();
    if (typeof Image !== 'undefined') await prepareCustomArt(this.state.illustrations);
    await this.run({ type: "tick" });
  }
  lock() {
    this.parent = false;
    this.emit();
  }
  async unlock(pin: string, recovery = false) {
    if (Date.now() < this.blockedUntil) throw new Error("请稍等一分钟再试。");
    if (
      !this.state.credentials ||
      !(await verify(pin, this.state.credentials, recovery))
    ) {
      if (++this.failures >= 5) {
        this.blockedUntil = Date.now() + 60000;
        this.failures = 0;
      }
      throw new Error(recovery ? "恢复码不正确。" : "密码不正确，再试一次。");
    }
    this.failures = 0;
    this.parent = true;
    this.emit();
  }
  run(command: Command): Promise<State> {
    const needsParent = new Set([
      "review",
      "reviewReward",
      "fulfill",
      "saveTask",
      "saveReward",
      "settings",
      "credentials",
      "recording",
    ]).has(command.type);
    const authorizedAtSubmission = this.parent;
    const work = this.queue.then(async () => {
      if (needsParent && (!authorizedAtSubmission || !this.parent))
        throw new Error("请重新输入家长密码。");
      const current = await this.repository.load();
      const next = reduceState(current, command, {
        day: localDay(),
        at: new Date().toISOString(),
        parent: this.parent && authorizedAtSubmission,
      });
      if (command.type === 'saveTask' && command.illustration && typeof Image !== 'undefined') await decodeArt(command.illustration);
      await this.repository.save(current.revision, next);
      this.state = next;
      this.emit();
      return next;
    });
    this.queue = work.then(
      () => undefined,
      () => undefined,
    );
    return work;
  }
  async backup() {
    if (!this.parent) throw new Error("请先进入家长设置。");
    await this.queue;
    const state = validateState(await this.repository.load());
    return JSON.stringify(
      {
        format: "little-island-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        state,
      },
      null,
      2,
    );
  }
  private async downloadBackup(data: string, name: string) {
    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({
        directory: Directory.Cache,
        path: `backups/${name}`,
        data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      await Share.share({
        title: "小小冒险岛备份",
        files: [result.uri],
        dialogTitle: "保存备份文件",
      });
    } else {
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  async export() {
    await this.downloadBackup(
      await this.backup(),
      `小小冒险岛-${localDay()}.json`,
    );
  }
  async exportRollback() {
    if (!this.parent) throw new Error("请先进入家长设置。");
    let data: string;
    try {
      data = Capacitor.isNativePlatform()
        ? String(
            (
              await Filesystem.readFile({
                directory: Directory.Data,
                path: "backups/before-restore.json",
                encoding: Encoding.UTF8,
              })
            ).data,
          )
        : localStorage.getItem("little-island-before-restore") || "";
    } catch {
      throw new Error("还没有恢复前的数据副本。");
    }
    if (!data) throw new Error("还没有恢复前的数据副本。");
    await this.downloadBackup(data, `小小冒险岛-恢复前副本-${localDay()}.json`);
  }
  async restore(data: string) {
    if (!this.parent) throw new Error("请先进入家长设置。");
    if (data.length > 40000000) throw new Error("备份文件太大。");
    const envelope = JSON.parse(data);
    if (envelope.format !== "little-island-backup" || envelope.version !== 1)
      throw new Error("这不是支持的小岛备份文件。");
    const incoming = validateState(envelope.state);
    if (typeof Image !== 'undefined') await prepareCustomArt(incoming.illustrations);
    const work = this.queue.then(async () => {
      if (!this.parent) throw new Error("请重新进入家长设置。");
      const current = await this.repository.load();
      const rollback = JSON.stringify({
        format: "little-island-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        state: current,
      });
      if (Capacitor.isNativePlatform())
        await Filesystem.writeFile({
          directory: Directory.Data,
          path: "backups/before-restore.json",
          data: rollback,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      else {
        localStorage.setItem("little-island-before-restore", rollback);
      }
      const restored = {
        ...incoming,
        revision: current.revision + 1,
        lastDay: [incoming.lastDay, current.lastDay, localDay()].sort().at(-1)!,
      };
      await this.repository.save(current.revision, restored);
      this.state = restored;
      this.lock();
      this.emit();
    });
    this.queue = work.then(
      () => undefined,
      () => undefined,
    );
    await work;
  }
}
