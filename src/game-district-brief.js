import { Game } from './game-core.js';

Game.prototype.ensureDistrictBriefs=function(){this.districtBriefs??=new Map();return this.districtBriefs;};
Game.prototype.districtBriefRemaining=function(id){const until=this.ensureDistrictBriefs().get(id)??0;return Math.max(0,until-this.elapsed);};
Game.prototype.districtBriefActive=function(id){return this.districtBriefRemaining(id)>0;};
Game.prototype.briefDistrict=function(id){
  const district=this.districts.find(d=>d.id===id);if(!district||!this.isDistrictUnlocked(id)||this.dispatchFocus<1||this.districtBriefActive(id))return false;
  this.dispatchFocus-=1;this.ensureDistrictBriefs().set(id,this.elapsed+24);this.runStats.toolsUsed+=1;this.runStats.districtBriefs=(this.runStats.districtBriefs??0)+1;this.logDispatch('district-brief',null,{district:id,name:district.name,until:this.elapsed+24});this.flash(`KIEZ BRIEF · ${district.name} · riders listening for local work`,4);return true;
};

const baseChoiceScore=Game.prototype.courierChoiceScore;
Game.prototype.courierChoiceScore=function(c,d,withNoise=true){let score=baseChoiceScore.call(this,c,d,withNoise);if(!Number.isFinite(score)||!d)return score;if(this.districtBriefActive(d.pickupDistrict)){score+=.24;if(d.channel==='local')score+=.12;}return score;};
