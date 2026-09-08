"""Render the exact in-game composition with Chromium's OfflineAudioContext.
Usage: python tools/render-score-demo.py OUTPUT_FOLDER
Requires Playwright + Chromium; no live audio device, samples or network services.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import base64,json,sys,wave
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1];out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch();page=browser.new_page()
        # The data information page provides a same-origin JS context without a game.
        page.goto(f'http://127.0.0.1:{server.server_port}/map-data.html')
        result=page.evaluate('''async()=>{
          const {scheduleNote,eventPhrase,scoreBar,SCORE,connectScoreOutput,taskPulse,TASK_RHYTHMS}=await import('/src/playtest-score.js');
          const rate=44100,seconds=58,ctx=new OfflineAudioContext(2,rate*seconds,rate),master=ctx.createGain();master.gain.value=.35;connectScoreOutput(ctx,master);
          const cues=[[0,'rider',{rider:'Kira'}],[3,'rider',{rider:'Mauro'}],[6,'rider',{rider:'Brian'}],
            [9,'spawn',{cargo:'document'}],[10.5,'spawn',{cargo:'fragile'}],[12,'spawn',{cargo:'grocery'}],
            [14,'call-open',{}],[15.5,'call-local',{}],[17,'call-priority',{}],[19,'client-call',{}],
            [21,'pickup',{rider:'Mauro'}],[23,'complete',{rider:'Kira'}],[26,'complete',{rider:'Brian'}],
            [40+16*60/SCORE.bpm,'complete',{rider:'Kira'}],[53,'fail',{cargo:'document'}],[55.5,'event-end',{}]];
          for(const [at,name,data] of cues)for(const n of eventPhrase(name,data))scheduleNote(ctx,master,n,at);
          for(let i=0;i<4;i++)for(const n of scoreBar('build',i,{riding:3}))scheduleNote(ctx,master,n,29+i*4*60/SCORE.bpm);
          const rhythms=TASK_RHYTHMS.map((r,i)=>({at:40+i*4*60/SCORE.bpm,...r}));
          for(let i=0;i<4;i++)for(const n of scoreBar('recovery',i,{riding:1}))scheduleNote(ctx,master,{...n,volume:n.volume*.45},rhythms[i].at);
          for(const r of rhythms)for(let step=0;step<16;step+=r.steps)for(const n of taskPulse({id:'d0',type:'document',called:true},{ordinal:step/r.steps,volume:1.6}))scheduleNote(ctx,master,n,r.at+step*60/SCORE.bpm/4);
          const buffer=await ctx.startRendering(),pcm=new Int16Array(buffer.length*2),metrics=[];
          for(let channel=0;channel<2;channel++){
            const data=buffer.getChannelData(channel);let peak=0,sum=0;
            for(let i=0;i<data.length;i++){if(!Number.isFinite(data[i]))throw Error('Non-finite audio');peak=Math.max(peak,Math.abs(data[i]));sum+=data[i]*data[i];pcm[i*2+channel]=Math.round(Math.max(-1,Math.min(1,data[i]))*32767);}
            metrics.push({channel,peak,rms:Math.sqrt(sum/data.length)});
          }
          const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
          return{title:SCORE.title,bpm:SCORE.bpm,key:SCORE.key,rate,seconds,metrics,rhythms,cues:cues.map(([at,name,data])=>({at,name,...data})),pcm:btoa(binary)};
        }''')
        data=base64.b64decode(result.pop('pcm'))
        assert all(.0001<m['rms'] and m['peak']<.9 for m in result['metrics']),result
        with wave.open(str(out/'send-it-spokes-and-postcards.wav'),'wb') as f:
            f.setnchannels(2);f.setsampwidth(2);f.setframerate(result['rate']);f.writeframes(data)
        result['passed']=True
        (out/'send-it-score-audio-qa.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2));browser.close()
finally:server.shutdown();server.server_close()
