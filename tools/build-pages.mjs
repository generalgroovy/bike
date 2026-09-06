import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

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
  return files.length;
}

if (!existsSync(resolve(preview, 'playtest.html'))) throw new Error('Preview checkout lacks the Berlin playtest');
const releasedSha = sha(released), previewSha = sha(preview);
const releasedFiles = copyApplication(released, output);
const previewTarget = resolve(output, 'preview/berlin');
const previewFiles = copyApplication(preview, previewTarget);
writeFileSync(resolve(output, '.nojekyll'), '');
writeFileSync(resolve(previewTarget, 'build.json'), JSON.stringify({
  branch: 'feature/berlin-playtest', commit: previewSha, releasedCommit: releasedSha,
  playtest: 'playtest.html', fullGame: 'index.html'
}, null, 2) + '\n');
writeFileSync(resolve(output, 'preview/index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Send It - Berlin preview</title>
<style>body{font:18px/1.6 system-ui;margin:0;background:#f6f3e9;color:#172a2d}main{max-width:680px;margin:8vh auto;padding:28px}h1{line-height:1.15;font-size:40px}a{color:inherit}nav{display:grid;gap:14px;margin:30px 0}nav a{display:block;padding:18px 22px;border:1px solid #b9cbbf;border-radius:10px;text-decoration:none}nav a:first-child{background:#172a2d;color:#fffdf4}small{font-size:13px;overflow-wrap:anywhere}</style>
<main><small>SEND IT / BERLIN / PLAYABLE PREVIEW</small><h1>Try the Berlin desk.</h1>
<p>Three couriers. A shared radio. You choose which jobs they hear; they choose which jobs to take.</p>
<nav><a href="berlin/playtest.html">Play the simplified Berlin desk<br><small>Guided 3-minute opening or a 9-minute shift</small></a>
<a href="berlin/">Explore the full game on this branch</a></nav>
<p>This concept preview uses the curated Berlin map. Mobile refinement and further expansion follow playtesting and concept approval.</p>
<small>Build <a href="https://github.com/generalgroovy/bike/commit/${previewSha}">${previewSha.slice(0, 7)}</a> · <a href="../">Released game</a> · <a href="berlin/build.json">Build details</a></small></main></html>\n`);
console.log(JSON.stringify({ releasedSha, previewSha, releasedFiles, previewFiles, output }));
