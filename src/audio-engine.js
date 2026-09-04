export const AUDIO_THEME={key:'D minor pentatonic',bpm:102,scale:[50,53,55,57,60,62,65,67,69,72],master:.2};

const midiHz=midi=>440*Math.pow(2,(midi-69)/12);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

class AudioEngine{
  constructor(){this.ctx=null;this.master=null;this.enabled=true;this.lastCue=new Map();this.maxVoices=18;this.voices=0;this.riderNotes=[62,65,67,69,72,74];}
  ensure(){if(!this.enabled)return null;if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume?.();return this.ctx;}const AC=globalThis.AudioContext??globalThis.webkitAudioContext;if(!AC)return null;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=AUDIO_THEME.master;this.master.connect(this.ctx.destination);return this.ctx;}
  beat(div=2){const ctx=this.ensure();if(!ctx)return 0;const step=(60/AUDIO_THEME.bpm)/div;return Math.ceil((ctx.currentTime+.012)/step)*step;}
  allow(key,gap=.04){const now=typeof performance!=='undefined'?performance.now()/1000:Date.now()/1000,last=this.lastCue.get(key)??-Infinity;if(now-last<gap)return false;this.lastCue.set(key,now);return true;}
  tone({midi=62,duration=.13,volume=.16,type='sine',when=null,pan=0,attack=.008,detune=0,filter=4200}={}){const ctx=this.ensure();if(!ctx||this.voices>=this.maxVoices)return;const start=when??ctx.currentTime+.006,osc=ctx.createOscillator(),gain=ctx.createGain(),biquad=ctx.createBiquadFilter();osc.type=type;osc.frequency.setValueAtTime(midiHz(midi),start);osc.detune.value=detune;biquad.type='lowpass';biquad.frequency.value=filter;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+attack);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(biquad);biquad.connect(gain);let output=gain;if(typeof ctx.createStereoPanner==='function'){const p=ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);gain.connect(p);output=p;}output.connect(this.master);this.voices++;osc.start(start);osc.stop(start+duration+.03);osc.addEventListener('ended',()=>{this.voices=Math.max(0,this.voices-1);});}
  chord(notes,{volume=.09,duration=.22,type='triangle',step=.025}={}){const when=this.beat(2);notes.forEach((midi,i)=>this.tone({midi,volume,duration,type,when:when+i*step,pan:(i-(notes.length-1)/2)*.18}));}
  ping({urgent=false,pan=0}={}){if(!this.allow(`ping-${urgent}`,urgent?.22:.42))return;const when=this.beat(4),root=urgent?69:62;this.tone({midi:root,volume:urgent?.13:.085,duration:urgent?.34:.42,type:'sine',when,pan,filter:5000});this.tone({midi:root+12,volume:urgent?.045:.025,duration:.18,type:'sine',when:when+.018,pan,filter:6000});}
  riderSpeed(riderIndex=0,speed=1){if(!this.allow(`rider-speed-${riderIndex}`,clamp(.58-speed*.1,.2,.52)))return;const base=this.riderNotes[riderIndex%this.riderNotes.length],lift=speed>1.18?5:speed>1.04?2:0;this.tone({midi:base+lift,volume:.045+clamp(speed-1,0,.45)*.06,duration:.09,type:riderIndex%2?'triangle':'sine',when:this.beat(4),pan:(riderIndex-2.5)/3.4,filter:3800});}
  cue(name,data={}){if(!this.enabled)return;const pan=clamp(data.pan??0,-1,1);switch(name){
    case'hover-job':if(this.allow(name,.09))this.tone({midi:69,volume:.025,duration:.045,type:'triangle',pan});break;
    case'hover-rider':if(this.allow(name,.09))this.tone({midi:this.riderNotes[data.riderIndex%6]??65,volume:.026,duration:.05,type:'sine',pan});break;
    case'select-job':this.tone({midi:62,volume:.065,duration:.09,type:'triangle',when:this.beat(4),pan});break;
    case'select-rider':this.chord([this.riderNotes[data.riderIndex%6]??62,(this.riderNotes[data.riderIndex%6]??62)+7],{volume:.045,duration:.12,type:'sine'});break;
    case'call-open':this.chord([62,67],{volume:.055,duration:.14,type:'sine'});break;
    case'call-priority':this.chord([62,69,74],{volume:.065,duration:.18,type:'triangle'});break;
    case'call-local':this.chord([57,62,65],{volume:.05,duration:.13,type:'sine'});break;
    case'call-off':this.tone({midi:57,volume:.05,duration:.1,type:'triangle'});break;
    case'radio-denied':this.chord([53,54],{volume:.055,duration:.14,type:'square'});break;
    case'claim':this.chord([57,62,67],{volume:.05,duration:.12,type:'triangle'});break;
    case'pickup':this.chord([62,65],{volume:.045,duration:.1,type:'sine'});break;
    case'complete':this.chord([62,67,69],{volume:.055,duration:.2,type:'triangle'});break;
    case'fail':this.chord([60,57,53],{volume:.05,duration:.23,type:'sine',step:.04});break;
    case'pressure':if(this.allow(name,1.6))this.tone({midi:50,volume:.04,duration:.38,type:'sine',filter:900});break;
    case'breach':this.chord([50,53,49],{volume:.075,duration:.38,type:'sine',step:.055});break;
    case'brief':this.chord([57,62,65,69],{volume:.05,duration:.24,type:'triangle',step:.035});break;
    case'event-forecast':this.chord([55,60],{volume:.04,duration:.24,type:'sine'});break;
    case'event-start':this.chord([50,57,60],{volume:.055,duration:.28,type:'triangle'});break;
    case'event-end':this.chord([57,62,69],{volume:.04,duration:.22,type:'sine'});break;
    case'break':this.chord([62,57],{volume:.035,duration:.22,type:'sine',step:.06});break;
    case'radio-on':this.chord([57,62],{volume:.04,duration:.13,type:'triangle'});break;
    case'goal':this.chord([62,67,69,74],{volume:.065,duration:.28,type:'triangle',step:.045});break;
    case'upgrade':this.chord([57,62,65,69],{volume:.055,duration:.3,type:'sine',step:.035});break;
    case'flow':this.chord([62,65,69,74],{volume:.045+Math.min(.04,(data.flow??3)*.004),duration:.2,type:'triangle',step:.03});break;
    case'flow-break':this.chord([69,62,57],{volume:.035,duration:.18,type:'sine',step:.035});break;
    case'city-expand':this.chord([50,57,62,65,69],{volume:.065,duration:.44,type:'triangle',step:.05});break;
    default:if(this.allow(`tap-${name}`,.07))this.tone({midi:62,volume:.018,duration:.035,type:'triangle'});
  }}
}

export const audio=new AudioEngine();
