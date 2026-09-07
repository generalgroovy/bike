// Stable spatial lookup: broad city coverage without scanning every address for
// each offer. Original array order is retained so seeded choices stay replayable.
export class CityAddressIndex {
  constructor(nodes, cellSize=100) {
    this.cellSize=cellSize;this.cells=new Map();
    nodes.forEach((node,index)=>{const key=this.key(node.x,node.y);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push({node,index});});
  }
  key(x,y){return `${Math.floor(x/this.cellSize)},${Math.floor(y/this.cellSize)}`;}
  near(x,y,radius) {
    const found=[],s=this.cellSize;
    for(let a=Math.floor((x-radius)/s);a<=Math.floor((x+radius)/s);a++)
      for(let b=Math.floor((y-radius)/s);b<=Math.floor((y+radius)/s);b++)
        for(const entry of this.cells.get(`${a},${b}`)??[])if(Math.hypot(entry.node.x-x,entry.node.y-y)<radius)found.push(entry);
    return found.sort((a,b)=>a.index-b.index).map(e=>e.node);
  }
}
