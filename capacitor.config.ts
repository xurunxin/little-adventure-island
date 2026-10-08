import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.qiaoyu.adventure",
  appName: "小小冒险岛",
  webDir: "dist/client",
  server: { androidScheme: "https" },
  android: { backgroundColor: "#fff7e7", allowMixedContent: false },
  plugins: { CapacitorSQLite: { androidIsEncryption: false } },
};
export default config;
