const {execFileSync}=require('node:child_process');
const {writeFileSync}=require('node:fs');
const path=require('node:path');
module.exports=async context=>{
  const root=context.packager.projectDir;
  let commit='source-archive',dirty=null;
  try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();dirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());}catch{}
  writeFileSync(path.join(root,'desktop/build.json'),JSON.stringify({commit,dirty,version:context.packager.appInfo.version,city:'berlin-city-v1-b81f2dddf012',ruleset:'berlin-dispatch-v5'},null,2)+'\n');
};
