package com.qiaoyu.adventure;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
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

/** Real WebView/SQLite acceptance, restricted to the disposable .qa package. */
@RunWith(AndroidJUnit4.class)
public class IslandAcceptanceTest {
    private WebView web;
    private Context context;

    private Object js(String source) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> web.evaluateJavascript(source, value -> {result.set(value);latch.countDown();}));
        assertTrue("WebView response timed out", latch.await(15,TimeUnit.SECONDS));
        return new JSONTokener(result.get()).nextValue();
    }
    private void waitFor(String expression) throws Exception {
        long until=SystemClock.elapsedRealtime()+20000;
        while(SystemClock.elapsedRealtime()<until){if(Boolean.TRUE.equals(js(expression)))return;SystemClock.sleep(120);}
        fail("Page condition failed: "+expression+"\n"+js("document.body.innerText"));
    }
    private void click(String text) throws Exception {
        String name=JSONObject.quote(text);
        waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==="+name+"&&!b.disabled)");
        assertEquals(true,js("(()=>{const root=document.querySelector('[role=dialog]')||document;const b=Array.from(root.querySelectorAll('button')).find(b=>b.textContent.trim()==="+name+"&&!b.disabled);if(!b)return false;b.click();return true;})()"));
    }
    private JSONObject state() throws Exception {
        File file=context.getDatabasePath("little_islandSQLite.db");
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(file.getAbsolutePath(),null,SQLiteDatabase.OPEN_READONLY);Cursor row=db.rawQuery("SELECT payload FROM app_state WHERE id=1",null)){
            assertTrue(row.moveToFirst());return new JSONObject(row.getString(0));
        }
    }
    private int balance(JSONObject state) throws Exception {
        int total=0;JSONArray ledger=state.getJSONArray("ledger");for(int i=0;i<ledger.length();i++)total+=ledger.getJSONObject(i).getInt("amount");return total;
    }
    private void parent() throws Exception {
        waitFor("!!document.querySelector('[aria-label=\"家长设置\"]')");
        js("document.querySelector('[aria-label=\"家长设置\"]').click()");
        waitFor("!!document.querySelector('input[aria-label=\"家长密码\"]')");
        js("(()=>{const input=document.querySelector('input[aria-label=\"家长密码\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'123456');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
        click("进入家长设置");waitFor("!!document.querySelector('.parent-page')");
    }
    private void evidence(String name,String data) throws Exception {
        File dir=new File(context.getFilesDir(),"acceptance");assertTrue(dir.exists()||dir.mkdirs());
        try(FileOutputStream output=new FileOutputStream(new File(dir,name))){output.write(data.getBytes(StandardCharsets.UTF_8));}
    }
    @Test public void offlineFlowPersistenceAndPerformance() throws Exception {
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("Never run against the child's actual data",context.getPackageName().endsWith(".qa"));
        JSONObject initial=state();assertEquals(36,balance(initial));assertEquals(120,initial.getInt("xp"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(activity->{web=activity.getBridge().getWebView();activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);});
            waitFor("!!document.querySelector('.home-book')&&!!window.__islandMetrics&&window.__islandMetrics.frames>10");
            waitFor("Array.from(document.images).filter(i=>i.getBoundingClientRect().width>0).every(i=>i.complete&&i.naturalWidth>0)");
            evidence("home-dom.txt",String.valueOf(js("document.body.innerText")));
            click("我来试试");waitFor("!!document.querySelector('[role=dialog]')");click("我来试试");
            waitFor("Array.from(document.querySelectorAll('.home-task button')).some(b=>b.textContent.trim()==='我完成啦')");
            click("我完成啦");waitFor("document.body.innerText.includes('等家长确认')");assertEquals(36,balance(state()));
            parent();click("确认完成");waitFor("!document.body.innerText.includes('确认完成')");
            assertEquals(39,balance(state()));assertEquals(130,state().getInt("xp"));
            click("回到小岛");waitFor("!!document.querySelector('.celebration')");click("继续冒险");
            click("奖励");click("申请兑换");click("请家长批准");waitFor("document.body.innerText.includes('预留 15')");
            assertEquals(39,balance(state()));
            parent();click("批准兑换");waitFor("document.body.innerText.includes('已扣除 15')");assertEquals(24,balance(state()));
            click("已经兑现");waitFor("!document.body.innerText.includes('已经兑现')");assertEquals(24,balance(state()));
            click("回到小岛");waitFor("!!document.querySelector('.celebration')");click("继续冒险");
            scenario.recreate();scenario.onActivity(activity->web=activity.getBridge().getWebView());
            waitFor("!!document.querySelector('.home-book')&&!!window.__islandMetrics");
            assertEquals(24,balance(state()));assertEquals(130,state().getInt("xp"));assertEquals(false,js("!!document.querySelector('.parent-page')"));
            // Save enough native state to verify it independently after an external force-stop.
            evidence("flow-state.json",state().toString(2));
            int seconds=Integer.parseInt(InstrumentationRegistry.getArguments().getString("performanceSeconds","900"));
            JSONArray samples=new JSONArray();long start=SystemClock.elapsedRealtime();
            while(SystemClock.elapsedRealtime()-start<seconds*1000L){SystemClock.sleep(30000);Object sample=js("JSON.stringify(window.__islandMetrics)");samples.put(new JSONObject(String.valueOf(sample)));}
            JSONObject report=new JSONObject();report.put("durationSeconds",(SystemClock.elapsedRealtime()-start)/1000.0);report.put("samples",samples);report.put("finalState",state());
            report.put("viewport",new JSONObject(String.valueOf(js("JSON.stringify({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})"))));
            evidence("native-acceptance.json",report.toString(2));
            JSONObject finalMetrics=samples.getJSONObject(samples.length()-1);
            assertEquals("WebGL",finalMetrics.getString("renderer"));assertTrue("Sustained frame rate below 30 fps",finalMetrics.getInt("fps")>=30);
            double average=finalMetrics.getDouble("frames")/finalMetrics.getDouble("seconds");assertTrue("Average frame rate below 30 fps",average>=30);
            assertEquals(24,balance(state()));assertEquals(130,state().getInt("xp"));
        }
    }
}
