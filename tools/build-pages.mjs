import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [releasedArg, previewArg, outputArg] = process.argv.slice(2);
if (!releasedArg || !previewArg || !outputArg || process.argv.length !== 5)
  throw new Error('Usage: node tools/build-pages.mjs RELEASED_CHECKOUT PREVIEW_CHECKOUT OUTPUT');
const released = resolve(releasedArg), preview = resolve(previewArg), output = resolve(outputArg);
const inside = (parent, child) => { const path = relative(parent, child); return !path || (!path.startsWith('..') && !isAbsolute(path)); };
if ([released, preview].some(source => inside(source, output) || inside(output, source)))
  throw new Error('Output must be separate from both source checkouts');
if (existsSync(output) && readdirSync(output).length) throw new Error('Output must be new or empty');

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
const sha = source => git(source, 'rev-parse', 'HEAD').trim();
const publishable = name => /^(src|assets|generated)\//.test(name) ||
  /^[^/]+\.(html|css|ico|webmanifest)$/.test(name) || ['.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml'].includes(name);

function copyApplication(source, target) {
  const files = git(source, 'ls-files', '-z').split('\0').filter(Boolean).filter(publishable);
  if (!files.includes('index.html')) throw new Error('Missing application entry point');
  for (const name of files) {
    const from = resolve(source, name), to = resolve(target, name);
    if (!inside(source, from) || !inside(target, to) || !lstatSync(from).isFile())
      throw new Error(`Unsupported application asset: ${name}`);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  return files;
}

if (!existsSync(resolve(preview, 'playtest.html'))) throw new Error('Preview checkout lacks the Berlin playtest');
const releasedSha = sha(released), previewSha = sha(preview);
const releasedFiles = copyApplication(released, output);
// Preserve the current classic game, including its improvements and storage,
// while making the same runtime shipped on Windows the public default.
copyFileSync(resolve(output, 'index.html'), resolve(output, 'classic.html'));
const previewTarget = resolve(output, 'preview/berlin');
const previewFiles = copyApplication(preview, previewTarget);
const desktopVersion = JSON.parse(readFileSync(resolve(preview, 'package.json'), 'utf8')).version;
const runtimeFiles = previewFiles.filter(name => /^(src|assets|generated)\//.test(name) || ['index.html', 'playtest.html', 'playtest.css', 'map-data.html'].includes(name));
const integrity = runtimeFiles.map(name => {
  const bytes = readFileSync(resolve(previewTarget, name));
  return { path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
writeFileSync(resolve(previewTarget, 'desktop-source.json'), JSON.stringify({commit:previewSha,version:desktopVersion,files:integrity},null,2)+'\n');
function entry(target, classic) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#172a2d"><title>Send It — Berlin</title><meta name="description" content="The full Berlin courier desk: the same game, map, riders and music as the Windows app."></head><body><script>const next=new URL(${JSON.stringify(target)},location.href);next.search=location.search;next.hash=location.hash;location.replace(next.href);</script><noscript>JavaScript is required to play.</noscript><p><a href="${target}">Open Send It</a> · <a href="${classic}">Classic desk</a></p></body></html>\n`;
}
writeFileSync(resolve(output, 'index.html'), entry('preview/berlin/', 'classic.html'));
writeFileSync(resolve(output, '.nojekyll'), '');
writeFileSync(resolve(previewTarget, 'build.json'), JSON.stringify({
  branch: 'feature/berlin-playtest', commit: previewSha, releasedCommit: releasedSha,
  playtest: 'index.html', legacy: 'legacy.html', mapData: 'map-data.html',
  scope: 'full-city', innerRing: 'index.html?city=inner-ring', desktopVersion,
  desktopSource: 'desktop-source.json'
}, null, 2) + '\n');
const browserBuild = `${releasedSha.slice(0,12)}-${previewSha.slice(0,12)}`;
const platform = fileURLToPath(new URL('./web-platform/', import.meta.url));
for (const name of ['web-platform.js', 'service-worker.js'])
  writeFileSync(resolve(previewTarget,name), readFileSync(resolve(platform,name),'utf8').replaceAll('__SEND_IT_BUILD__',browserBuild));
const icon = readFileSync(resolve(preview, 'desktop/icon.png'));
writeFileSync(resolve(previewTarget,'app-icon.png'),icon);
writeFileSync(resolve(previewTarget,'app.webmanifest'),JSON.stringify({
  id:'./',name:'Send It — Berlin',short_name:'Send It',start_url:'./',scope:'./',display:'standalone',
  background_color:'#f6f3e9',theme_color:'#172a2d',description:'The full Berlin courier desk.',
  icons:[{src:'app-icon.png',sizes:`${icon.readUInt32BE(16)}x${icon.readUInt32BE(20)}`,type:'image/png',purpose:'any'}]
},null,2)+'\n');
const gameDocument = readFileSync(resolve(previewTarget,'index.html'),'utf8');
writeFileSync(resolve(previewTarget,'index.html'),gameDocument.replace('</head>','<!-- Browser platform: shared game below is unchanged. -->\n<link rel="manifest" href="app.webmanifest">\n</head>').replace('</body>','<script type="module" src="web-platform.js"></script>\n</body>'));
const offlineFiles = [...runtimeFiles,'web-platform.js','service-worker.js','app-icon.png','app.webmanifest','build.json'].map(path => {
  const bytes=readFileSync(resolve(previewTarget,path));
  return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
});
writeFileSync(resolve(previewTarget,'offline-pack.json'),JSON.stringify({version:browserBuild,bytes:offlineFiles.reduce((sum,file)=>sum+file.bytes,0),files:offlineFiles})+'\n');
writeFileSync(resolve(output, 'preview/index.html'), entry('berlin/', '../classic.html'));
console.log(JSON.stringify({ releasedSha, previewSha, releasedFiles: releasedFiles.length, previewFiles: previewFiles.length, desktopVersion, output }));
