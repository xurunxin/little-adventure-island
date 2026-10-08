package com.qiaoyu.adventure;

import android.content.Intent;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Credentials never enter the WebView, backup, or packaged web resources. */
@CapacitorPlugin(name = "MiniMaxAI")
public class MiniMaxAIPlugin extends Plugin {
    private static final String AES = "island.minimax.storage", RSA = "island.minimax.import";
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final Map<String, HttpURLConnection> connections = new ConcurrentHashMap<>();
    private final java.util.Set<String> cancelled = ConcurrentHashMap.newKeySet();
    private long importUntil = 0;
    private SharedPreferences prefs() { return getContext().getSharedPreferences("minimax-private", 0); }
    private byte[] decode(String value) { return Base64.decode(value, Base64.DEFAULT); }
    private String encode(byte[] value) { return Base64.encodeToString(value, Base64.NO_WRAP); }
    private KeyStore store() throws Exception { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); return store; }
    private SecretKey storageKey() throws Exception {
        KeyStore store = store();
        if (!store.containsAlias(AES)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(AES, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey)store.getKey(AES, null);
    }
    private void saveKey(String key) throws Exception {
        if (key.length() < 16 || key.length() > 4096 || key.contains("\n")) throw new Exception("API Key 格式不正确。");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, storageKey());
        String encrypted = encode(cipher.doFinal(key.getBytes(StandardCharsets.UTF_8)));
        if (!prefs().edit().putString("key", encrypted).putString("iv", encode(cipher.getIV())).commit()) throw new Exception("无法保存 API Key。");
    }
    private String key() throws Exception {
        if (!prefs().contains("key")) throw new Exception("请让家长先配置 MiniMax 服务。");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, storageKey(), new GCMParameterSpec(128, decode(prefs().getString("iv", ""))));
        return new String(cipher.doFinal(decode(prefs().getString("key", ""))), StandardCharsets.UTF_8);
    }
    private void publicKey() throws Exception {
        KeyStore store = store();
        if (!store.containsAlias(RSA)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(RSA, KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(3072).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_PKCS1).build());
            generator.generateKeyPair(); store = store();
        }
        String pem = "-----BEGIN PUBLIC KEY-----\n" + Base64.encodeToString(store.getCertificate(RSA).getPublicKey().getEncoded(), Base64.DEFAULT) + "-----END PUBLIC KEY-----\n";
        try (FileOutputStream file = new FileOutputStream(new File(getContext().getExternalFilesDir(null), "minimax-import-public.pem"))) {
            file.write(pem.getBytes(StandardCharsets.US_ASCII));
        }
    }
    private void sealedImport(Intent intent) {
        String value = intent == null ? null : intent.getStringExtra("minimax_sealed");
        if (value == null) return;
        intent.removeExtra("minimax_sealed");
        if ((prefs().getBoolean("bootstrapped", false) || prefs().contains("key")) && System.currentTimeMillis() > importUntil) return;
        try {
            if (value.length() > 16000) return;
            JSONObject envelope = new JSONObject(new String(decode(value), StandardCharsets.UTF_8));
            Cipher rsa = Cipher.getInstance("RSA/ECB/PKCS1Padding"); rsa.init(Cipher.DECRYPT_MODE, store().getKey(RSA, null));
            byte[] sessionKey = rsa.doFinal(decode(envelope.getString("wrapped")));
            Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
            aes.init(Cipher.DECRYPT_MODE, new SecretKeySpec(sessionKey, "AES"), new GCMParameterSpec(128, decode(envelope.getString("iv"))));
            saveKey(new String(aes.doFinal(decode(envelope.getString("ciphertext"))), StandardCharsets.UTF_8));
            importUntil = 0;
        } catch (Exception ignored) { /* Never log provider credentials or ciphertext. */ }
    }
    @Override public void load() {
        try { publicKey(); sealedImport(getActivity().getIntent()); } catch (Exception ignored) { }
    }
    @Override protected void handleOnNewIntent(Intent intent) { sealedImport(intent); }
    @PluginMethod public void getStatus(PluginCall call) {
        JSObject result = new JSObject(); result.put("configured", prefs().contains("key")); result.put("native", true); call.resolve(result);
    }
    @PluginMethod public void setKey(PluginCall call) {
        try { saveKey(call.getString("key", "").trim()); call.resolve(); } catch (Exception error) { call.reject("无法保存，请检查 API Key。", "KEY_SAVE"); }
    }
    @PluginMethod public void clearKey(PluginCall call) { prefs().edit().remove("key").remove("iv").apply(); call.resolve(); }
    @PluginMethod public void completeBootstrap(PluginCall call) { prefs().edit().putBoolean("bootstrapped", true).apply(); call.resolve(); }
    @PluginMethod public void openImport(PluginCall call) {
        try { publicKey(); importUntil = System.currentTimeMillis() + 120000; call.resolve(); }
        catch (Exception error) { call.reject("无法准备电脑导入。", "IMPORT"); }
    }
    @PluginMethod public void cancel(PluginCall call) {
        String requestId = call.getString("requestId", ""); cancelled.add(requestId);
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> cancelled.remove(requestId), 120000);
        HttpURLConnection connection = connections.remove(requestId);
        if (connection != null) connection.disconnect(); call.resolve();
    }
    private String text(PluginCall call, String name, int max) throws Exception {
        String value = call.getString(name, ""); if (value.length() > max) throw new Exception("内容太长，请缩短后再试。"); return value;
    }
    private JSONObject post(String path, byte[] body, String contentType, String key, String requestId, boolean asr) throws Exception {
        HttpURLConnection connection = (HttpURLConnection)new URL("https://api.minimax.cn/v1/" + path).openConnection();
        connection.setConnectTimeout(15000); connection.setReadTimeout(90000); connection.setRequestMethod("POST");
        connection.setRequestProperty("Authorization", "Bearer " + key); connection.setRequestProperty("Content-Type", contentType);
        if (asr) connection.setRequestProperty("language", "zh");
        connection.setInstanceFollowRedirects(false); connection.setDoOutput(true); connections.put(requestId, connection);
        try {
            if (cancelled.contains(requestId)) throw new Exception("Cancelled");
            try (java.io.OutputStream out = connection.getOutputStream()) { out.write(body); }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new Exception("MiniMax 服务暂时无法访问（" + status + "）。");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream stream = connection.getInputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = stream.read(buffer)) != -1) { bytes.write(buffer, 0, count); if (bytes.size() > 14000000) throw new Exception("返回资源太大。"); }
            }
            JSONObject data = new JSONObject(bytes.toString("UTF-8"));
            JSONObject base = data.optJSONObject("base_resp");
            if (base != null && base.optInt("status_code", 0) == 2061) throw new Exception("MiniMax 当前 Key 套餐不支持这项能力，可使用内置音色或更换 Key。");
            if (base != null && base.optInt("status_code", 0) != 0) throw new Exception("MiniMax 请求失败（" + base.optInt("status_code") + "），请检查服务额度与配置。");
            return data;
        } finally { connections.remove(requestId, connection); connection.disconnect(); }
    }
    private byte[] hex(String value) throws Exception {
        if (value.isEmpty() || value.length() % 2 != 0 || !value.matches("[a-fA-F0-9]+")) throw new Exception("没有收到有效音频。");
        byte[] bytes = new byte[value.length() / 2];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte)Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        return bytes;
    }
    @PluginMethod public void invoke(PluginCall call) {
        executor.execute(() -> {
            try {
                String operation = call.getString("operation", ""), requestId = call.getString("requestId", "");
                if (cancelled.contains(requestId)) throw new Exception("Cancelled");
                String content = text(call, "text", 2000), voice = text(call, "voice", 160), path;
                JSONObject body = new JSONObject(); byte[] payload; String contentType = "application/json";
                switch (operation) {
                    case "llm":
                        path = "text/chatcompletion_v2";
                        body.put("model", "MiniMax-M3").put("stream", false).put("max_completion_tokens", 2048);
                        body.put("messages", new JSONArray().put(new JSONObject().put("role", "system").put("content", text(call, "system", 12000)))
                            .put(new JSONObject().put("role", "user").put("content", content))); break;
                    case "speech":
                        path = "t2a_v2"; body.put("model", "speech-2.8-hd").put("text", content).put("stream", false).put("output_format", "hex").put("language_boost", "Chinese");
                        body.put("voice_setting", new JSONObject().put("voice_id", voice.isEmpty() ? "Chinese (Mandarin)_Cute_Spirit" : voice).put("speed", .92).put("vol", 1).put("pitch", 0).put("text_normalization", true));
                        body.put("audio_setting", new JSONObject().put("format", "mp3").put("sample_rate", 32000).put("bitrate", 128000).put("channel", 1)); break;
                    case "image": path = "image_generation"; body.put("model", "image-01").put("prompt", content.substring(0, Math.min(1500, content.length())))
                        .put("aspect_ratio", "1:1").put("n", 1).put("response_format", "base64").put("prompt_optimizer", false); break;
                    case "design": path = "voice_design"; body.put("prompt", content).put("preview_text", "你好呀，我是你的小伙伴。我们一起完成今天的小任务吧！"); break;
                    case "voices": path = "get_voice"; body.put("voice_type", "voice_generation"); break;
                    case "asr": path = "speech_to_text"; break;
                    default: throw new Exception("不支持的 AI 操作。");
                }
                if (operation.equals("asr")) {
                    String audio = text(call, "audio", 1000000);
                    if (!audio.matches("data:audio/wav;base64,[A-Za-z0-9+/=]+")) throw new Exception("录音格式不正确。");
                    String boundary = "island" + new SecureRandom().nextInt(100000000);
                    ByteArrayOutputStream multipart = new ByteArrayOutputStream();
                    String fields = "--"+boundary+"\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nasr-1.0\r\n--"+boundary+"\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"voice.wav\"\r\nContent-Type: audio/wav\r\n\r\n";
                    multipart.write(fields.getBytes(StandardCharsets.UTF_8)); multipart.write(decode(audio.substring(audio.indexOf(',') + 1)));
                    multipart.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8)); payload = multipart.toByteArray(); contentType = "multipart/form-data; boundary=" + boundary;
                } else payload = body.toString().getBytes(StandardCharsets.UTF_8);
                JSONObject data = post(path, payload, contentType, key(), requestId, operation.equals("asr")); JSObject result = new JSObject();
                switch (operation) {
                    case "llm": result.put("text", data.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content").replaceAll("(?s)<think>.*?</think>", "").trim()); break;
                    case "asr": result.put("text", data.getString("text")); break;
                    case "speech": result.put("audio", "data:audio/mp3;base64," + encode(hex(data.getJSONObject("data").getString("audio")))); break;
                    case "design": result.put("voiceId", data.getString("voice_id")); result.put("audio", "data:audio/mp3;base64," + encode(hex(data.getString("trial_audio")))); break;
                    case "voices":
                        JSONArray list = data.optJSONArray("voice_generation"), voices = new JSONArray();
                        if (list != null) for (int i = 0; i < list.length(); i++) { JSONObject row = list.getJSONObject(i); voices.put(new JSONObject().put("id", row.getString("voice_id")).put("name", row.optString("voice_name", row.getString("voice_id")))); }
                        result.put("voices", voices); break;
                    case "image": String image = data.getJSONObject("data").getJSONArray("image_base64").getString(0); result.put("image", image.startsWith("data:") ? image : "data:image/jpeg;base64," + image); break;
                }
                call.resolve(result);
            } catch (Exception error) {
                String message = error.getMessage();
                if (message == null || !(message.startsWith("MiniMax") || message.startsWith("请让家长") || message.startsWith("内容太长") || message.startsWith("没有收到") || message.startsWith("录音格式"))) message = "伙伴暂时连不上，请检查网络后再试。";
                call.reject(message, "AI_REQUEST");
            }
        });
    }
    @Override protected void handleOnDestroy() { connections.values().forEach(HttpURLConnection::disconnect); executor.shutdownNow(); }
}
