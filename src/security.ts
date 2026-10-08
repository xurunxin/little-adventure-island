import type { State } from "./domain";
const encode = new TextEncoder();
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function digest(value: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encode.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encode.encode(salt),
        iterations: 120000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
export async function createCredentials(pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("请设置六位数字密码。");
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const recovery = hex(crypto.getRandomValues(new Uint8Array(12)).buffer)
    .toUpperCase()
    .match(/.{4}/g)!
    .join("-");
  return {
    credentials: {
      salt,
      pin: await digest(pin, salt),
      recovery: await digest(recovery.replaceAll("-", "").toUpperCase(), salt),
    },
    recovery,
  };
}
export async function verify(
  value: string,
  credentials: NonNullable<State["credentials"]>,
  recovery = false,
) {
  const hash = await digest(
    recovery ? value.replaceAll("-", "").toUpperCase().trim() : value,
    credentials.salt,
  );
  const expected = recovery ? credentials.recovery : credentials.pin;
  let difference = 0;
  for (let i = 0; i < 64; i++)
    difference |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
