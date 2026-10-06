// A read-only view of one dispatch. Rider decisions remain simulation-owned.
export class DispatchCoach {
  constructor(){this.deliveryId=null;}
  observe(game){
    if(!this.deliveryId){
      const called=game.deliveries.find(d=>d.firstCalledAt!=null);
      if(called)this.deliveryId=called.id;
    }
    let d=game.deliveryById(this.deliveryId)||game.deliveryById(game.selectedDeliveryId);
    if(!d){const waiting=game.activeDeliveries().filter(d=>d.status==='waiting');d=waiting.find(d=>game.deliveryDispatchInsight?.(d)?.state==='safe')||waiting[0];}
    if(!d)return{phase:'empty',text:'New contracts will arrive. Pause whenever you need time to decide.'};
    const id=d.id.toUpperCase();
    if(d.status==='completed')return{phase:'complete',text:`${id} delivered. The rider chose the job; your broadcast made it available.`};
    if(d.status==='failed')return{phase:'failed',text:`${id} missed its deadline. ${d.claimedAt!=null?'Try giving the next rider more time.':'Try a better-fit broadcast or a bonus on the next job.'}`};
    if(d.status==='claimed')return{phase:'claimed',text:`${game.courierById(d.courierId)?.name||'A rider'} chose ${id}. Its radio slot is free; follow pickup and delivery on the map.`};
    if(d.called)return{phase:'live',text:`${id} is on ${d.channel.toUpperCase()} radio. Riders decide; no rider is assigned. Watch for a claim.`};
    return{phase:'choose',deliveryId:d.id,text:`Broadcast ${id} with O (Open · 1 radio). Riders choose whether to accept.`,action:'Show contract'};
  }
}
