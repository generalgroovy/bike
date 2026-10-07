// A read-only view of one dispatch. Rider decisions remain simulation-owned.
export class DispatchCoach {
  constructor(){this.deliveryId=null;}
  nextJob(game){
    if(game.gameOver)return null;
    const waiting=game.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called&&d.deadlineAt>game.elapsed);
    return waiting.find(d=>game.deliveryDispatchInsight?.(d)?.state==='safe')||waiting[0]||null;
  }
  followNext(game,id){
    const d=game.deliveryById(id);
    if(game.gameOver||!d||d.status!=='waiting'||d.called||d.deadlineAt<=game.elapsed)return false;
    this.deliveryId=id;
    return true;
  }
  outcome(game,phase,text){
    const next=this.nextJob(game);
    return{phase,text:next?`${text} Compare the next waiting job when you are ready.`:`${text} ${game.gameOver?'The shift has ended. Start a new run to try again.':'New jobs will arrive; you can dismiss the guide.'}`,
      ...(next?{deliveryId:next.id,action:'Show next job',next:true}:{})};
  }
  observe(game){
    if(!this.deliveryId){
      const called=game.deliveries.find(d=>d.firstCalledAt!=null);
      if(called)this.deliveryId=called.id;
    }
    let d=game.deliveryById(this.deliveryId)||game.deliveryById(game.selectedDeliveryId);
    if(!d){const waiting=game.activeDeliveries().filter(d=>d.status==='waiting');d=waiting.find(d=>game.deliveryDispatchInsight?.(d)?.state==='safe')||waiting[0];}
    if(!d)return{phase:'empty',text:'New jobs will arrive. Pause whenever you need time to decide.'};
    const id=d.id.toUpperCase();
    if(d.status==='completed')return this.outcome(game,'complete',`${id} delivered. The rider chose the job; your broadcast made it available.`);
    if(d.status==='failed')return this.outcome(game,'failed',`${id} missed its deadline. ${d.claimedAt!=null?'Try giving the next rider more time.':'Try a better-fit broadcast or a bonus on the next job.'}`);
    if(d.status==='claimed')return{phase:'claimed',text:`${game.courierById(d.courierId)?.name||'A rider'} chose ${id}. Its radio slot is free; follow pickup and delivery on the map.`};
    if(d.called)return{phase:'live',text:`${id} is on ${d.channel.toUpperCase()} radio. Riders decide; no rider is assigned. Watch for a claim.`};
    return{phase:'choose',deliveryId:d.id,text:`Broadcast ${id} with Open (1 radio slot). Riders choose whether to accept.`,action:'Show job'};
  }
}
