import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { blankState, validateState, type State } from "./domain";

export interface Repository {
  load(): Promise<State>;
  save(expected: number, state: State): Promise<void>;
}
const createSQL =
  "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL);";
export class MemoryRepository implements Repository {
  constructor(private state = blankState()) {}
  async load() {
    return structuredClone(this.state);
  }
  async save(expected: number, next: State) {
    if (this.state.revision !== expected)
      throw new Error("记录已经更新，请重试。");
    this.state = structuredClone(next);
  }
}
export class NativeRepository implements Repository {
  private connection?: Promise<SQLiteDBConnection>;
  private connect() {
    return (this.connection ??= this.open());
  }
  private async open() {
    const manager = new SQLiteConnection(CapacitorSQLite);
    await manager.checkConnectionsConsistency();
    const existing = await manager.isConnection("little_island", false);
    const db = existing.result
      ? await manager.retrieveConnection("little_island", false)
      : await manager.createConnection(
          "little_island",
          false,
          "no-encryption",
          1,
          false,
        );
    await db.open();
    await db.execute(createSQL);
    await db.run(
      "INSERT OR IGNORE INTO app_state(id, revision, payload) VALUES(1, 0, ?)",
      [JSON.stringify(blankState())],
    );
    return db;
  }
  async load() {
    const db = await this.connect();
    const rows = await db.query("SELECT payload FROM app_state WHERE id=1");
    return validateState(JSON.parse(rows.values![0].payload));
  }
  async save(expected: number, next: State) {
    const db = await this.connect();
    const result = await db.run(
      "UPDATE app_state SET revision=?, payload=? WHERE id=1 AND revision=?",
      [next.revision, JSON.stringify(next), expected],
    );
    if (result.changes?.changes !== 1)
      throw new Error("记录已经更新，请重试。");
  }
}
type BrowserRecord = { binary: Uint8Array; revision: number };
export class BrowserRepository implements Repository {
  private engine?: Promise<SqlJsStatic>;
  private idb?: Promise<IDBDatabase>;
  private sql() {
    return (this.engine ??= initSqlJs({
      locateFile: () => "/assets/sql-wasm.wasm",
    }));
  }
  private database() {
    return (this.idb ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("little-island", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("sqlite");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }
  private async read(): Promise<BrowserRecord | undefined> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("sqlite", "readonly");
      const req = transaction.objectStore("sqlite").get("main");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  private readState(db: Database) {
    const row = db.exec("SELECT payload FROM app_state WHERE id=1");
    return validateState(JSON.parse(String(row[0].values[0][0])));
  }
  async load() {
    const SQL = await this.sql();
    const stored = await this.read();
    if (!stored) return blankState();
    const db = new SQL.Database(stored.binary);
    try {
      return this.readState(db);
    } finally {
      db.close();
    }
  }
  async save(expected: number, next: State) {
    const SQL = await this.sql();
    const database = await this.database();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("sqlite", "readwrite");
      const store = tx.objectStore("sqlite");
      const req = store.get("main");
      let failure: unknown;
      req.onsuccess = () => {
        const current = req.result as BrowserRecord | undefined;
        if ((current?.revision ?? 0) !== expected) {
          failure = new Error("记录已经更新，请重试。");
          tx.abort();
          return;
        }
        const sql = current
          ? new SQL.Database(current.binary)
          : new SQL.Database();
        try {
          sql.run(createSQL);
          sql.run("INSERT OR IGNORE INTO app_state VALUES (1,0,?)", [
            JSON.stringify(blankState()),
          ]);
          sql.run(
            "UPDATE app_state SET revision=?, payload=? WHERE id=1 AND revision=?",
            [next.revision, JSON.stringify(next), expected],
          );
          if (sql.getRowsModified() !== 1)
            throw new Error("记录已经更新，请重试。");
          store.put({ revision: next.revision, binary: sql.export() }, "main");
        } catch (error) {
          failure = error;
          tx.abort();
        } finally {
          sql.close();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          failure ?? tx.error ?? new Error("保存失败，请检查平板存储空间。"),
        );
      tx.onerror = () => reject(tx.error);
    });
  }
}
export function createRepository() {
  return Capacitor.isNativePlatform()
    ? new NativeRepository()
    : new BrowserRepository();
}
