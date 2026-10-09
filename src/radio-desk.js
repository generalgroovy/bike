import { conversationFor, appendConversation } from './radio-conversation.js';

// A bounded presentation history. Nothing here dispatches, predicts or advances play.
export class RadioDesk {
  constructor(root=document) { this.root=root; this.reset(); }
  node(id) { return this.root.querySelector(id); }
  reset() { this.history=[];this.current=null;this.until=0;this.phases=new Map();this.seen=new WeakSet();this.serial=0;this.render(); }
  observe(game,events) {
    const exchanges=events.filter(event=>{
      if(this.seen.has(event))return false;this.seen.add(event);return true;
    }).map(event=>conversationFor(game,event)).filter(Boolean);
    for(const rider of game.couriers){
      const prior=this.phases.get(rider.id),jobId=rider.deliveryId;
      if(prior){
        const action=rider.phase==='waiting-window'&&(prior.phase!==rider.phase||prior.jobId!==jobId)?'window-wait'
          :prior.phase==='waiting-window'&&rider.phase==='handover'&&prior.jobId===jobId?'window-open':null;
        if(action)exchanges.push(conversationFor(game,{action,at:game.elapsed,rider:rider.name,deliveryId:jobId}));
      }
      this.phases.set(rider.id,{phase:rider.phase,jobId});
    }
    // Separate real calls may share a paused timestamp and channel. A view-local
    // serial retains both snapshots; observing the same log object stays silent.
    for(const exchange of exchanges.filter(Boolean)){
      exchange.id+=`:${++this.serial}`;this.history=appendConversation(this.history,exchange,12);
    }
    // Direct player actions answer immediately; simultaneous field reports favor
    // outcomes over arrivals. Opening parcels stay in the log, off the map.
    const direct=new Set(['call','channel','prefer','sweeten','client-call','uncall','radio-denied']);
    const candidates=exchanges.filter(e=>e&&!(e.action==='spawn'&&game.elapsed===0));
    candidates.sort((a,b)=>(direct.has(b.action)?10:b.priority)-(direct.has(a.action)?10:a.priority));
    const next=candidates[0];
    if(next&&(!this.current||game.elapsed>=this.until||direct.has(next.action)||next.priority>=this.current.priority)){
      this.current=next;this.until=game.elapsed+Math.max(5,Math.min(9,next.lines.reduce((sum,line)=>sum+line.text.length,0)/25));
    } else if(this.current&&game.elapsed>=this.until)this.current=null;
    this.render();
  }
  lines(exchange) {
    return exchange.lines.map(line=>{
      const bubble=document.createElement('p');bubble.className='radio-bubble';bubble.dataset.speaker=line.speaker;bubble.dataset.tone=line.tone;
      const name=document.createElement('strong'),words=document.createElement('span');name.textContent=line.name;words.textContent=line.text;
      bubble.append(name,words);return bubble;
    });
  }
  render() {
    const panel=this.node('#radio-exchange');if(!panel)return;
    panel.hidden=!this.current;
    if(this.current&&panel.dataset.exchange!==this.current.id){
      panel.dataset.exchange=this.current.id;panel.dataset.action=this.current.action;
      this.node('#radio-job').textContent=this.current.jobId?.toUpperCase()??'On the air';
      this.node('#radio-lines').replaceChildren(...this.lines(this.current));
    }
    if(!this.current)delete panel.dataset.exchange;
  }
  dismiss(){this.current=null;this.render();}
  renderLog(){
    const list=this.node('#radio-history');list.replaceChildren();
    for(const exchange of [...this.history].reverse()){
      const item=document.createElement('li');item.dataset.action=exchange.action;
      const stamp=document.createElement('small');stamp.className='radio-log-stamp';
      const at=Math.max(0,Math.floor(exchange.at));stamp.textContent=`${Math.floor(at/60)}:${String(at%60).padStart(2,'0')} · ${exchange.jobId?.toUpperCase()??'Team'} · ${exchange.action.replaceAll('-',' ')}`;
      item.append(stamp,...this.lines(exchange));list.append(item);
    }
    this.node('#radio-log-empty').hidden=this.history.length>0;
  }
}
