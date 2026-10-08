package com.qiaoyu.adventure;

import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.webkit.WebView;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Physical tablet microphone + Chromium touch path; only the disposable QA app. */
@RunWith(AndroidJUnit4.class)
public class VoiceHoldTest {
    private WebView web;
    private Object js(String source) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(source,value->{result.set(value);latch.countDown();}));
        assertTrue(latch.await(15,TimeUnit.SECONDS));return new JSONTokener(result.get()).nextValue();
    }
    private void waitFor(String expression) throws Exception {
        long until=SystemClock.elapsedRealtime()+20000;
        while(SystemClock.elapsedRealtime()<until){if(Boolean.TRUE.equals(js(expression)))return;SystemClock.sleep(100);}
        fail("Voice condition failed: "+expression+"; "+js("document.querySelector('.chat-reply')?.textContent"));
    }
    private void touch(int action,long down,float x,float y) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
            MotionEvent.PointerProperties p=new MotionEvent.PointerProperties();p.id=0;p.toolType=MotionEvent.TOOL_TYPE_FINGER;
            MotionEvent.PointerCoords c=new MotionEvent.PointerCoords();c.x=x;c.y=y;c.pressure=1;c.size=1;
            MotionEvent event=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,1,new MotionEvent.PointerProperties[]{p},new MotionEvent.PointerCoords[]{c},0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
            web.dispatchTouchEvent(event);event.recycle();
        });
    }
    @Test public void microphoneAndHoldReleaseCancel() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("Never touch the child's application data",context.getPackageName().endsWith(".qa"));
        boolean expectDenied=Boolean.parseBoolean(InstrumentationRegistry.getArguments().getString("expectDenied","false"));
        if(!expectDenied){
            try(SQLiteDatabase db=SQLiteDatabase.openDatabase(context.getDatabasePath("little_islandSQLite.db").getAbsolutePath(),null,SQLiteDatabase.OPEN_READWRITE);Cursor row=db.rawQuery("SELECT payload FROM app_state WHERE id=1",null)){
                assertTrue(row.moveToFirst());JSONObject state=new JSONObject(row.getString(0));state.getJSONObject("settings").put("conversation",true).put("volume",0);
                db.execSQL("UPDATE app_state SET payload=? WHERE id=1",new Object[]{state.toString()});
            }
            // Status fixture only. Provider requests are intercepted; no credential or audio leaves the tablet.
            context.getSharedPreferences("minimax-private",0).edit().putString("key","qa-status-only").commit();
        }
        JSONObject report=new JSONObject();
        try{
            // Avoid ActivityScenario's idle synchronization with an endlessly animated WebView.
            context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            long launchUntil=SystemClock.elapsedRealtime()+20000;
            while(web==null&&SystemClock.elapsedRealtime()<launchUntil){
                InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                    for(android.app.Activity activity:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)){
                        if(activity instanceof MainActivity)web=((MainActivity)activity).getBridge().getWebView();
                    }
                });
                SystemClock.sleep(100);
            }
            assertNotNull("QA WebView did not resume",web);
            waitFor("!!document.querySelector('.home-book')||!!document.querySelector('.setup-panel')");
            js("navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{window.__micProbe={ok:true,tracks:s.getAudioTracks().length};s.getTracks().forEach(t=>t.stop());}).catch(e=>window.__micProbe={ok:false,name:e.name})");
            waitFor("!!window.__micProbe");JSONObject probe=new JSONObject(String.valueOf(js("JSON.stringify(window.__micProbe)")));report.put("microphone",probe);
            assertEquals("Physical microphone permission result",!expectDenied,probe.getBoolean("ok"));
            if(!expectDenied){
                js("(()=>{window.__voiceCalls=[];const original=window.Capacitor.nativePromise;window.Capacitor.nativePromise=function(plugin,method,input){if(plugin==='MiniMaxAI'&&method==='invoke'){window.__voiceCalls.push({operation:input.operation,audioBytes:input.audio?atob(input.audio.split(',')[1]).length:0});return Promise.resolve(input.operation==='asr'?{text:'我有多少星星？'}:{});}return original.call(this,plugin,method,input);};document.querySelector('.partner-talk-entry').click();})()");
                waitFor("!!document.querySelector('.talk-button')&&!document.querySelector('.talk-button').disabled");
                JSONObject rect=new JSONObject(String.valueOf(js("JSON.stringify((()=>{const r=document.querySelector('.talk-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,viewport:innerWidth};})())")));
                float scale=web.getWidth()/(float)rect.getDouble("viewport"),x=(float)rect.getDouble("x")*scale,y=(float)rect.getDouble("y")*scale;
                long down=SystemClock.uptimeMillis();touch(MotionEvent.ACTION_DOWN,down,x,y);
                waitFor("document.querySelector('.talk-button').classList.contains('listening')");SystemClock.sleep(2200);
                assertEquals(true,js("document.querySelector('.talk-button').textContent.includes('2 秒')"));report.put("heldSeconds",2);
                touch(MotionEvent.ACTION_MOVE,down,x+180*scale,y);SystemClock.sleep(200);
                assertEquals(true,js("document.querySelector('.talk-button').classList.contains('listening')"));report.put("dragOutsideKeepsRecording",true);
                touch(MotionEvent.ACTION_UP,down,x+180*scale,y);
                waitFor("window.__voiceCalls.filter(c=>c.operation==='asr').length===1&&!document.querySelector('.talk-button').disabled");
                assertEquals(true,js("window.__voiceCalls.find(c=>c.operation==='asr').audioBytes>32000"));
                assertEquals(true,js("document.querySelector('.chat-reply').textContent.includes('36颗')"));report.put("releasedOnce",true);
                down=SystemClock.uptimeMillis();touch(MotionEvent.ACTION_DOWN,down,x,y);waitFor("document.querySelector('.talk-button').classList.contains('listening')");SystemClock.sleep(600);
                touch(MotionEvent.ACTION_CANCEL,down,x,y);waitFor("!document.querySelector('.talk-button').classList.contains('listening')");SystemClock.sleep(200);
                assertEquals(true,js("window.__voiceCalls.filter(c=>c.operation==='asr').length===1"));report.put("cancelDoesNotSend",true);
                down=SystemClock.uptimeMillis();touch(MotionEvent.ACTION_DOWN,down,x,y);SystemClock.sleep(50);touch(MotionEvent.ACTION_UP,down,x,y);SystemClock.sleep(500);
                assertEquals(true,js("!document.querySelector('.talk-button').classList.contains('listening')&&window.__voiceCalls.filter(c=>c.operation==='asr').length===1"));report.put("quickTapDoesNotSend",true);
                report.put("provider","stubbed; real tablet microphone and touch; no uploaded recording");
            }
        }finally{
            File directory=new File(context.getFilesDir(),"acceptance");directory.mkdirs();
            try(FileOutputStream out=new FileOutputStream(new File(directory,expectDenied?"voice-before.json":"voice-after.json"))){out.write(report.toString(2).getBytes(StandardCharsets.UTF_8));}
            if(!expectDenied)context.getSharedPreferences("minimax-private",0).edit().remove("key").remove("iv").commit();
        }
    }
}
