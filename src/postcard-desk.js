import { postcardFor, makeChallengeURL, challengeURLForPostcard, collectPostcard, normalizePostcardCollection, POSTCARD_STORAGE_KEY } from './shift-postcard.js';
import { renderPostcardSVG } from './postcard-art.js';

const $ = selector => document.querySelector(selector);
const put = (node, value) => { const next=String(value); if(node.textContent!==next)node.textContent=next; };
const count = card => card.stamps.filter(s=>s.earned).length;

// Presentation and optional device-local keepsakes. This never dispatches work.
export class PostcardDesk {
  constructor({ onCue=()=>{}, onOpen=()=>{}, onClose=()=>{} }={}) {
    this.onCue=onCue;this.onOpen=onOpen;this.onClose=onClose;this.card=null;this.game=null;this.objectURL=null;this.seen=new Set();this.saved=false;
    $('#postcard-progress').addEventListener('click',()=>this.open());
    $('#open-postcards').addEventListener('click',()=>this.open());
    $('#close-postcards').addEventListener('click',()=>$('#postcard-dialog').close());
    $('#postcard-dialog').addEventListener('close',()=>this.onClose());
    $('#download-postcard').addEventListener('click',()=>this.download());
    $('#copy-challenge').addEventListener('click',()=>this.copyChallenge());
  }
  reset(game) {
    this.game=game;this.card=postcardFor(game);this.seen=new Set(this.card.stamps.filter(s=>s.earned).map(s=>s.id));this.saved=false;
    if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=null;
    $('#review-postcard').replaceChildren();put($('#postcard-save-status'),'');put($('#challenge-status'),'');$('#challenge-link').hidden=true;
  }
  update(game) {
    this.game=game;this.card=postcardFor(game);
    this.card.stamps.forEach((stamp,index)=>{
      $('#postcard-progress').querySelectorAll('i')[index].dataset.earned=String(stamp.earned);
      if(stamp.earned&&!this.seen.has(stamp.id)){this.seen.add(stamp.id);if(!game.gameOver)this.onCue(stamp);}
    });
    const label=`${game.completed} of ${game.config.target} delivered. ${count(this.card)} of 3 stamps earned. Inspect shift achievements.`;
    $('#postcard-progress').setAttribute('aria-label',label);$('#postcard-progress').title=this.card.stamps.map(s=>`${s.label}: ${s.value}/${s.target}`).join(' · ');
  }
  readCollection() {
    try{return normalizePostcardCollection(JSON.parse(localStorage.getItem(POSTCARD_STORAGE_KEY)||'[]'));}catch{return [];}
  }
  open() {
    if(!this.game)return;
    this.update(this.game);this.onOpen();
    put($('#postcard-place'),`${this.card.locality} · ${this.game.mode==='training'?'3':'9'} minutes · ${this.game.seed}`);
    $('#postcard-stamps').replaceChildren(...this.card.stamps.map(stamp=>{
      const box=document.createElement('section');box.className='postcard-stamp';box.dataset.earned=String(stamp.earned);
      const title=document.createElement('h3'),value=document.createElement('strong'),detail=document.createElement('p'),status=document.createElement('span');
      title.textContent=stamp.label;value.textContent=`${Math.min(stamp.value,stamp.target)} / ${stamp.target}`;detail.textContent=stamp.detail;status.className='stamp-label';status.textContent=stamp.earned?'STAMP EARNED':'STILL TO EARN';box.append(title,value,detail,status);return box;
    }));
    put($('#postcard-next'),this.card.nextTry);
    const collection=this.readCollection();put($('#postcard-count'),`(${collection.length})`);
    $('#postcard-collection').replaceChildren(...collection.map(card=>{
      const li=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('small'),link=document.createElement('a');
      title.textContent=`${card.locality} · ${count(card)} / 3 stamps`;
      const outcome={success:'Shift completed','team-left':'Team signed off',collapse:'Desk lost reputation','target-missed':'Target missed'}[card.outcome];
      detail.textContent=`${card.completed} / ${card.target} delivered · ${outcome} · ${card.seed}`;
      link.textContent='Retry ↗';link.href=challengeURLForPostcard(card,location.href);link.title='Start this exact saved challenge';li.append(title,detail,link);return li;
    }));
    $('#postcard-dialog').showModal();
  }
  review(game) {
    this.update(game);
    const svg=renderPostcardSVG(game,this.card);
    if(this.objectURL)URL.revokeObjectURL(this.objectURL);
    this.objectURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    const image=document.createElement('img');image.className='postcard-image';image.src=this.objectURL;image.alt=`${this.card.locality} postcard. ${this.card.headline}. ${this.card.stamps.map(s=>`${s.label}: ${s.value} of ${s.target}${s.earned?', earned':''}`).join('. ')}. ${this.card.riders.map(r=>`${r.name}: ${r.line}`).join(' ')}`;
    const caption=document.createElement('p');caption.className='postcard-caption';caption.textContent=this.card.stamps.map(s=>`${s.earned?'✓':'○'} ${s.label} ${Math.min(s.value,s.target)}/${s.target}`).join(' · ');
    $('#review-postcard').replaceChildren(image,caption);
    if(!this.saved){
      try{const collection=collectPostcard(this.readCollection(),this.card);localStorage.setItem(POSTCARD_STORAGE_KEY,JSON.stringify(collection));put($('#postcard-save-status'),collection.some(card=>card.id===this.card.id)?'Best attempt kept in Menu → Stamps & postcards.':'This shift could not fit in the device album. Save its postcard as a file instead.');}
      catch{put($('#postcard-save-status'),'Device storage is unavailable. You can still save this postcard as a file.');}
      this.saved=true;
    }
  }
  download() {
    if(!this.objectURL)return;
    const link=document.createElement('a');link.href=this.objectURL;link.download=`send-it-${this.card.locality}-${this.card.seed}`.replace(/[^a-z0-9_-]/gi,'_').slice(0,110)+'.svg';link.click();
  }
  async copyChallenge() {
    const base=location.protocol==='sendit:'||['localhost','127.0.0.1'].includes(location.hostname)?'https://generalgroovy.github.io/bike/preview/berlin/':location.href;
    const url=makeChallengeURL(this.game,base);
    try {await navigator.clipboard.writeText(url);put($('#challenge-status'),'Challenge link copied: same streets, seed and rules. Results stay on your device.');}
    catch {const field=$('#challenge-link');field.hidden=false;field.value=url;field.focus();field.select();put($('#challenge-status'),'Copy this link to challenge someone to the same shift.');}
  }
}

export function renderSetupStamps(mode, target) {
  const data=[[target,'deliveries'],[mode==='training'?3:6,'clean in a row'],[3,'riders deliver']];
  $('#setup-stamps').replaceChildren(...data.map(([number,label])=>{const box=document.createElement('div');box.className='setup-stamp';const value=document.createElement('strong'),name=document.createElement('span');value.textContent=number;name.textContent=label;box.append(value,name);return box;}));
}
