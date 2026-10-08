// Import only an encrypted envelope. No plaintext key is written to disk or adb arguments.
import {execFileSync} from 'node:child_process';
import {createCipheriv, publicEncrypt, randomBytes, constants} from 'node:crypto';
import {join} from 'node:path';
const serial = process.argv.slice(2).find(arg=>arg!=='--qa');
if (!serial) throw new Error('Usage: npm run ai:import -- <device-serial> [--qa]. Find the serial with adb devices.');
const appId = process.argv.includes('--qa') ? 'com.qiaoyu.adventure.qa' : 'com.qiaoyu.adventure';
const adb = join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
if (!process.env.MINIMAX_CN_API_KEY) throw new Error('MINIMAX_CN_API_KEY is not configured.');
if(!/^[A-Za-z0-9_.:-]+$/.test(serial))throw new Error('Invalid adb serial.');
{
  const publicKey = execFileSync(adb, ['-s', serial, 'exec-out', 'cat', `/sdcard/Android/data/${appId}/files/minimax-import-public.pem`], {stdio: ['ignore','pipe','ignore']});
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(process.env.MINIMAX_CN_API_KEY, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  const envelope = Buffer.from(JSON.stringify({wrapped: publicEncrypt({key: publicKey, padding: constants.RSA_PKCS1_PADDING}, key).toString('base64'), iv: iv.toString('base64'), ciphertext: encrypted.toString('base64')})).toString('base64');
  execFileSync(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${appId}/com.qiaoyu.adventure.MainActivity`, '--es', 'minimax_sealed', envelope], {stdio: 'ignore'});
  console.log('Encrypted MiniMax credential import delivered. Confirm the configured status in parent settings.');
}
