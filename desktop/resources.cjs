const path=require('node:path');
const {readFile}=require('node:fs/promises');
const ORIGIN='sendit://app';
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.geojson':'application/geo+json','.gz':'application/gzip','.svg':'image/svg+xml','.png':'image/png'};
function resourceName(url){
  try{
    const u=new URL(url);if(u.protocol!=='sendit:'||u.host!=='app'||u.username||u.password)return null;
    const name=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname).slice(1);
    if(!name||name.includes('\\')||name.includes('\0')||name.split('/').some(p=>!p||p==='.'||p==='..'))return null;
    if(!['index.html','playtest.html','map-data.html','playtest.css'].includes(name)&&!(/^(src|assets|generated)\//.test(name)&&Object.hasOwn(MIME,path.extname(name))))return null;
    return name;
  }catch{return null;}
}
function externalLink(url){
  try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['github.com','gdi.berlin.de','daten.berlin.de','www.govdata.de','www.openstreetmap.org'].includes(u.hostname);}catch{return false;}
}
function appNavigation(url){const name=resourceName(url);return ['index.html','playtest.html','map-data.html'].includes(name);}
function createResourceHandler(root){return async request=>{
  const name=resourceName(request.url);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(!name)return new Response('Not found',{status:404});
  const file=path.resolve(root,name),relative=path.relative(root,file);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return new Response('Not found',{status:404});
  try{
    const body=await readFile(file);
    return new Response(request.method==='HEAD'?null:body,{headers:{'content-type':MIME[path.extname(name)],'content-security-policy':CSP,'x-content-type-options':'nosniff','cache-control':'no-cache'}});
  }catch{return new Response('Not found',{status:404});}
};}
module.exports={ORIGIN,CSP,resourceName,externalLink,appNavigation,createResourceHandler};
