// Opt-in, bounded launch timing. Every run uses its own disposable test profile;
// it never opens, changes or deletes the player's saved-data directory.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, mkdir, cp, stat } from 'node:fs/promises';
import { freemem, totalmem, tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { chromium } from 'playwright';

const values = process.argv.slice(2), option = name => { const index = values.indexOf(name); return index < 0 ? undefined : values[index + 1]; };
if (!values.includes('--exe') || !values.includes('--report')) throw Error('Pass --exe and --report; optionally --copy-unpacked and --timeout-ms.');
for (const name of ['--exe', '--report', '--copy-unpacked', '--timeout-ms']) {
  if (values.includes(name) && (!option(name) || option(name).startsWith('--'))) throw Error(`Missing value for ${name}`);
}
const executable = path.resolve(option('--exe')), report = path.resolve(option('--report'));
const timeout = Math.min(240000, Math.max(30000, Number(option('--timeout-ms')) || 180000));
for (const output of [report, ...(values.includes('--copy-unpacked') ? [path.resolve(option('--copy-unpacked'))] : [])]) {
  try { await stat(output); throw Error(`Output already exists: ${output}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const baseline = await stat(executable);
const profile = await mkdtemp(path.join(tmpdir(), 'send-it-startup-'));
const env = { ...process.env, SEND_IT_DATA_DIR: profile }; delete env.ELECTRON_RUN_AS_NODE;
const startedAt = new Date(), started = performance.now();
const result = { executable, executableBytes: baseline.size, profile, startedAt: startedAt.toISOString(),
  host: { totalMemoryMiB: Math.round(totalmem() / 1048576), freeMemoryMiBAtLaunch: Math.round(freemem() / 1048576) },
  stages: {}, observations: [], passed: false };
const elapsed = () => Math.round(performance.now() - started);
const observe = (stage, data = {}) => { result.observations.push({ stage, elapsedMs: elapsed(), ...data }); console.log(JSON.stringify(result.observations.at(-1))); };
let browser, page, child;
try {
  child = spawn(executable, ['--remote-debugging-port=0', `--user-data-dir=${profile}`, '--host-resolver-rules=MAP * ~NOTFOUND'], { env, windowsHide: true, stdio: 'ignore' });
  child.on('error', error => { result.launchError = String(error); });
  observe('launcher-created', { pid: child.pid });
  let endpoint;
  while (!endpoint && elapsed() < timeout) {
    if (result.launchError) throw Error(result.launchError);
    if (child.exitCode != null) throw Error(`Launcher exited before debugging became available (${child.exitCode})`);
    try { const [port] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); endpoint = `http://127.0.0.1:${port}`; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!endpoint) throw Error(`No debugging endpoint after ${timeout}ms`);
  result.stages.debugEndpointMs = elapsed(); observe('electron-debug-endpoint');
  browser = await chromium.connectOverCDP(endpoint, { timeout: 30000 });
  const context = browser.contexts()[0];
  page = context.pages()[0];
  if (!page) page = await context.waitForEvent('page', { timeout: 30000 });
  await page.locator('#intro').waitFor({ state: 'visible', timeout: Math.max(1000, timeout - elapsed()) });
  result.stages.playableSetupMs = elapsed(); observe('playable-setup');
  result.renderer = await page.evaluate(() => ({
    navigation: performance.getEntriesByType('navigation').map(entry => ({ startTime: entry.startTime,
      responseEnd: entry.responseEnd, domContentLoadedEventEnd: entry.domContentLoadedEventEnd, loadEventEnd: entry.loadEventEnd })),
    marks: performance.getEntriesByType('mark').filter(entry => entry.name.startsWith('send-it:')).map(entry => ({ name: entry.name, at: entry.startTime })),
    hasFatalError: document.querySelector('#fatal-error')?.hidden === false,
    title: document.title
  }));
  if (result.renderer.hasFatalError) throw Error('The native desk displayed a startup error');
  if (process.platform === 'win32') {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    const nativeId = processInfo.find(item => item.type === 'browser')?.id;
    if (!Number.isSafeInteger(nativeId) || nativeId <= 0) throw Error('The measured debugging endpoint did not identify its native process');
    // Query this endpoint's exact native PID and its ancestry, never another
    // concurrently launched Send It instance found by name or timestamp.
    const script = "$items=@();$next=[uint32]$env:SEND_IT_TEST_NATIVE_PID;for($i=0;$i -lt 12 -and $next -gt 0;$i++){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$next);if(!$p){break};$items+=[pscustomobject]@{id=$p.ProcessId;parentId=$p.ParentProcessId;startedAt=$p.CreationDate.ToUniversalTime().ToString('o');path=$p.ExecutablePath;commandLine=$p.CommandLine};if($next -eq [uint32]$env:SEND_IT_TEST_LAUNCHER_PID){break};$next=$p.ParentProcessId};ConvertTo-Json -InputObject @($items) -Compress";
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, SEND_IT_TEST_NATIVE_PID: String(nativeId), SEND_IT_TEST_LAUNCHER_PID: String(child.pid) }, windowsHide: true, timeout: 15000
    });
    const ancestry = JSON.parse(stdout), native = ancestry.find(item => item.id === nativeId);
    if (!native || !ancestry.some(item => item.id === child.pid) || !native.commandLine?.includes(profile)) throw Error('Native process is not bound to the measured launcher and profile');
    if (path.basename(native.path) !== 'Send It.exe') throw Error('Unexpected native executable');
    result.processes = ancestry.map(({commandLine, ...item}) => item);
    {
      result.stages.electronProcessMs = Math.max(0, Date.parse(native.startedAt) - startedAt.getTime());
      result.stages.electronToDebugMs = result.stages.debugEndpointMs - result.stages.electronProcessMs;
      result.nativeExecutable = native.path;
      if (values.includes('--copy-unpacked')) {
        const directory = path.dirname(native.path), destination = path.resolve(option('--copy-unpacked'));
        if (path.basename(native.path) !== 'Send It.exe' || !directory.startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('Refusing to copy a native directory outside the measured temporary extraction');
        await cp(directory, destination, { recursive: true, errorOnExist: true, force: false });
        result.copiedUnpackedDirectory = destination;
      }
    }
  }
  if (values.includes('--copy-unpacked') && !result.copiedUnpackedDirectory) throw Error('No verified temporary app directory was copied');
  result.host.freeMemoryMiBAtSetup = Math.round(freemem() / 1048576);
  result.passed = true;
} catch (error) { result.error = String(error); process.exitCode = 1; }
finally {
  if (browser) {
    const closeStarted = elapsed();
    // window.close follows the real native close/save handler. Closing a CDP
    // connection alone does not establish that Electron has actually exited.
    if (page && !page.isClosed()) await Promise.race([page.evaluate(() => window.close()).catch(() => {}), new Promise(resolve => setTimeout(resolve, 2500))]);
    const exited = child?.exitCode != null || await new Promise(resolve => {
      const onExit = () => { clearTimeout(timer); resolve(true); };
      const timer = setTimeout(() => { child?.off('exit', onExit); resolve(false); }, 15000);
      child?.once('exit', onExit);
    });
    result.close = { nativeExited: exited, exitCode: child?.exitCode, waitMs: elapsed() - closeStarted };
    if (!exited || child?.exitCode !== 0) { result.passed = false; result.error ??= 'Native process did not exit cleanly after normal window close'; process.exitCode = 1; }
    await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 2500))]);
  }
  // A timed-out launcher may still be extracting. Leave it and its test profile
  // intact for diagnosis; never kill other apps or clean an inferred temp path.
  if (child?.exitCode == null) child?.unref();
  await mkdir(path.dirname(report), { recursive: true });
  await writeFile(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
}
