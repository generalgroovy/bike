const {app,BrowserWindow,Menu,protocol,session,shell,dialog,powerMonitor}=require('electron');
const path=require('node:path');
const {mkdirSync,readFileSync}=require('node:fs');
const {ORIGIN,createResourceHandler,externalLink,appNavigation,resourceName}=require('./resources.cjs');
app.setName('Send It');app.setAppUserModelId('com.generalgroovy.sendit');
const profile=process.env.SEND_IT_DATA_DIR?path.resolve(process.env.SEND_IT_DATA_DIR):path.join(app.getPath('appData'),'Send It Berlin');
mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
protocol.registerSchemesAsPrivileged([{scheme:'sendit',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let desk,closing=false;
const icon=path.join(__dirname,'icon.png');
const safePreferences={nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false};
async function pauseAndSave(){
  if(!desk||desk.isDestroyed()||!appNavigation(desk.webContents.getURL()))return;
  await desk.webContents.executeJavaScript("window.dispatchEvent(new Event('send-it:pause-and-save'))");
  desk.webContents.session.flushStorageData();
}
function protect(win){
  const wc=win.webContents;
  const returnToDesk=()=>{if(desk&&!desk.isDestroyed()){desk.restore();desk.show();desk.focus();}if(win!==desk)win.close();};
  wc.on('will-attach-webview',event=>event.preventDefault());
  wc.on('will-navigate',(event,url)=>{
    if(win!==desk&&appNavigation(url)&&resourceName(url)!=='map-data.html'){event.preventDefault();returnToDesk();}
    else if(!appNavigation(url)){event.preventDefault();if(externalLink(url))shell.openExternal(url);}
  });
  wc.setWindowOpenHandler(({url})=>{if(appNavigation(url)){if(resourceName(url)==='map-data.html')showSources();else returnToDesk();}else if(externalLink(url))shell.openExternal(url);return{action:'deny'};});
}
function showSources(){
  pauseAndSave().catch(()=>{});
  const info=new BrowserWindow({title:'Send It · Map sources',width:950,height:760,icon,autoHideMenuBar:true,webPreferences:safePreferences});
  protect(info);info.loadURL(ORIGIN+'/map-data.html');
}
function openDesk(){
  desk=new BrowserWindow({title:'Send It · Berlin',width:1440,height:940,minWidth:850,minHeight:650,backgroundColor:'#f6f3e9',icon,show:false,webPreferences:safePreferences});
  protect(desk);desk.once('ready-to-show',()=>desk.show());
  desk.on('blur',()=>pauseAndSave().catch(()=>{}));desk.on('minimize',()=>pauseAndSave().catch(()=>{}));
  desk.on('close',event=>{
    if(closing)return;event.preventDefault();
    pauseAndSave().then(()=>{closing=true;for(const win of BrowserWindow.getAllWindows())win.destroy();app.quit();}).catch(error=>{
      dialog.showMessageBox(desk,{type:'error',title:'Save before closing',message:'The desk could not finish saving.',detail:error.message,buttons:['Keep playing','Close without saving'],defaultId:0,cancelId:0}).then(({response})=>{if(response===1){closing=true;app.quit();}});
    });
  });
  desk.loadURL(ORIGIN+'/?city=berlin&mode=training&district=mitte');
}
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(desk){if(desk.isMinimized())desk.restore();desk.show();desk.focus();}});
  app.whenReady().then(()=>{
    session.defaultSession.protocol.handle('sendit',createResourceHandler(app.getAppPath()));
    session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    // Runtime gameplay never fetches a website. Source links open only after a click.
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(_details,callback)=>callback({cancel:true}));
    session.defaultSession.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:'Save Send It file',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))}));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Desk',submenu:[{label:'Pause and save',accelerator:'CmdOrCtrl+S',click:()=>pauseAndSave().catch(()=>{})},{label:'Saved data folder',click:()=>shell.openPath(profile)},{type:'separator'},{role:'quit'}]},
      {label:'View',submenu:[{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},
      {label:'Help',submenu:[{label:'Map sources · offline',click:showSources},{label:'About Send It',click:()=>{
        let build={};try{build=JSON.parse(readFileSync(path.join(__dirname,'build.json'),'utf8'));}catch{}
        dialog.showMessageBox(desk,{type:'info',title:'Send It',message:`Send It · Berlin ${app.getVersion()}`,detail:`You control information. Couriers choose.\n\nAll maps, portraits and the original score are bundled.\nBuild: ${build.commit??'development'}\n\nSaved shifts: ${profile}`});
      }}]}
    ]));
    powerMonitor.on('suspend',()=>pauseAndSave().catch(()=>{}));openDesk();
  });
  app.on('window-all-closed',()=>app.quit());
}
