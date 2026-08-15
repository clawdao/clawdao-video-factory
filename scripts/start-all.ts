#!/usr/bin/env bun
/**
 * scripts/start-all.ts — 通用项目多进程启动管理器 (ClawDao 模板)
 *
 * 读取 .clawdao/project.json 配置，自动检测并启动项目的所有服务：
 *   - 后端服务（Bun 或 Python）
 *   - 前端服务（web/ 目录下的 Vite 开发服务器）
 *
 * 由 clawdao 的 runProject() 调用：bun run scripts/start-all.ts
 * 
 * 生命周期：
 *   1. 按顺序启动后端 → 前端
 *   2. 监听 SIGTERM/SIGINT，优雅关闭所有子进程
 *   3. 任一子进程退出 → 整体关闭
 *   4. 输出访问地址到 stdout（runProject 通过 pipe 捕获）
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ── 项目配置读取 ──

interface ProjectConfig {
  name?: string;
  ports?: Record<string, number>;
  protocol?: { lifecycle?: Record<string, unknown> };
}

const cwd = process.cwd();
const configPath = resolve(cwd, '.clawdao/project.json');
let config: ProjectConfig = {};
let configError: string | null = null;

if (!existsSync(configPath)) {
  configError = '.clawdao/project.json not found — using defaults';
  console.warn(`[start-all] ${configError}`);
} else {
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (e) {
    configError = `Invalid .clawdao/project.json: ${e}`;
    console.error(`[start-all] ${configError}`);
  }
}

const preferredApiPort = config.ports?.dev ?? 18792;
const preferredWebPort = config.ports?.web ?? 5180;
const appName = config.name ?? 'ClawDao App';

// ── 端口自动分配规则（PORT AUTO-ASSIGNMENT） ──
// 规则：
//   1. 首选端口 = 环境变量 VF_PORT/VF_WEB_PORT > .clawdao/project.json ports.dev/web > 内置默认值
//   2. 启动前探测：若首选端口被占用，自动向上递增（+1）寻找空闲端口，最多尝试 50 次
//   3. 回写：实际端口写回 .clawdao/project.json，保证平台预检 / health-check / 前端代理读到一致端口
//   4. 绝不误杀：不 kill 端口上的其他进程（可能是平台 toolbox 或其他项目），只清理本管理器 .running.pids 里的残留

function isPortFree(port: number): boolean {
  try {
    const out = Bun.spawnSync(['lsof', `-ti:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    return !out.stdout.toString().trim();
  } catch {
    return true;
  }
}

function findAvailablePort(preferred: number): number {
  let port = preferred;
  for (let i = 0; i < 50; i++) {
    if (isPortFree(port)) return port;
    port += 1;
  }
  console.warn(`[start-all] ⚠ 找不到 ${preferred}+50 范围内的空闲端口，回退使用 ${preferred}`);
  return preferred;
}

const apiPort = Number(process.env.VF_PORT) || findAvailablePort(preferredApiPort);
const webPort = Number(process.env.VF_WEB_PORT) || findAvailablePort(preferredWebPort);

// 端口发生变化 → 回写 manifest，让平台与前端都读到实际端口
if ((apiPort !== preferredApiPort || webPort !== preferredWebPort) && !configError) {
  try {
    config.ports = { ...(config.ports || {}), dev: apiPort, web: webPort };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    console.log(`[start-all] ↻ 端口自动调整并已回写 ${configPath}`);
    console.log(`[start-all]   dev=${preferredApiPort} → ${apiPort}${apiPort !== preferredApiPort ? ' (被占用，自动+1)' : ''}`);
    console.log(`[start-all]   web=${preferredWebPort} → ${webPort}${webPort !== preferredWebPort ? ' (被占用，自动+1)' : ''}`);
  } catch (e) {
    console.warn(`[start-all] ⚠ 端口回写失败（继续以实际端口 ${apiPort}/${webPort} 启动）: ${e}`);
  }
}

// ── 清理残留进程（安全版） ──
// 只清理 .running.pids 里记录的、本管理器此前启动且仍存活的子进程；
// 绝不对端口上所有进程无差别 kill（避免误杀平台 toolbox / 其他项目服务）。

const PID_FILE = resolve(cwd, '.clawdao', '.running.pids');
const trackedPids: number[] = [];

function killStalePids(): void {
  try {
    if (!existsSync(PID_FILE)) return;
    const stale = readFileSync(PID_FILE, 'utf-8').trim().split(/\s+/).filter(Boolean);
    for (const pid of stale) {
      const n = Number(pid);
      if (!Number.isInteger(n) || n <= 0) continue;
      try {
        process.kill(n, 0); // 探测存活
        process.kill(n, 'SIGKILL');
        console.log(`[start-all] ↻ cleaned stale PID ${n}`);
      } catch { /* 已退出或无权 */ }
    }
  } catch { /* best-effort */ }
}

killStalePids();

function writePidFile() {
  try {
    writeFileSync(PID_FILE, trackedPids.join('\n'), 'utf-8');
  } catch { /* best-effort */ }
}

function cleanupPidFile() {
  try {
    if (existsSync(PID_FILE)) {
      // Only remove if WE wrote it (check first pid matches)
      const content = readFileSync(PID_FILE, 'utf-8').trim();
      if (content === trackedPids.join('\n')) {
        // defer: don't remove on crash, let runProject clean up
      }
    }
  } catch { /* best-effort */ }
}

// ── 进程管理 ──

type Subprocess = import('bun').Subprocess;
const children: Subprocess[] = [];

function cleanup(signal = 'SIGTERM') {
  console.log(`[start-all] Shutting down all services (${signal})...`);
  for (const proc of children) {
    if (proc.killed) continue;
    try { proc.kill(signal); } catch { /* ignore */ }
  }
  // Force exit after grace period
  const timer = setTimeout(() => {
    console.log('[start-all] Force exit');
    process.exit(0);
  }, 3000);
  timer.unref();
}

process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));
process.on('exit', () => cleanupPidFile());

// ── 服务启动 ──

interface ServiceInfo {
  name: string;
  pid: number;
  port?: number;
  url?: string;
}

const runningServices: ServiceInfo[] = [];

async function startService(
  label: string,
  cmd: string[],
  opts: { port?: number; url?: string; delay?: number; cwd?: string } = {},
): Promise<Subprocess | null> {
  try {
    if (opts.delay) await new Promise(r => setTimeout(r, opts.delay));

    const proc = Bun.spawn(cmd, {
      cwd: opts.cwd ?? cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env },
    });
    
    children.push(proc);
    trackedPids.push(proc.pid);
    writePidFile();

    const info: ServiceInfo = {
      name: label,
      pid: proc.pid,
      port: opts.port,
      url: opts.url,
    };
    runningServices.push(info);

    const urlPart = opts.url ? ` → ${opts.url}` : '';
    console.log(`[start-all] ✓ ${label} (PID ${proc.pid})${urlPart}`);

    // Track process exit
    proc.exited.then((code: number | null) => {
      console.log(`[start-all] ✗ ${label} exited (code ${code})`);
      if (code !== 0 && code !== null) {
        cleanup('SIGTERM');
      }
    });

    return proc;
  } catch (e) {
    console.error(`[start-all] ✗ Failed to start ${label}:`, e);
    return null;
  }
}

// ── 1. 后端服务 ──

const hasPackageJson = existsSync(resolve(cwd, 'package.json'));
const hasPython = existsSync(resolve(cwd, 'main.py')) || existsSync(resolve(cwd, 'requirements.txt'));

if (hasPackageJson) {
  // Bun/Node 项目
  const entryFiles = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js', 'app.ts', 'app.js'];
  let entry = entryFiles.find(f => existsSync(resolve(cwd, f)));
  if (!entry && existsSync(resolve(cwd, 'src'))) {
    const { readdirSync } = await import('fs');
    const files = readdirSync(resolve(cwd, 'src'));
    entry = files.find(f => f.startsWith('index') && (f.endsWith('.ts') || f.endsWith('.js')));
  }
  
  const cmd = entry
    ? ['bun', 'run', entry, '--port', String(apiPort)]
    : ['bun', 'run', 'start']; // fallback to npm start

  await startService('Backend', cmd, {
    port: apiPort,
    url: `http://127.0.0.1:${apiPort}`,
  });
} else if (hasPython) {
  await startService('Backend', ['python3', 'main.py']);
}

// ── 2. 前端服务（web/ 目录） ──

const webDir = resolve(cwd, 'web');
if (existsSync(resolve(webDir, 'package.json'))) {
  await startService('Frontend', ['npx', 'vite', '--host', '--port', String(webPort)], {
    port: webPort,
    url: `http://localhost:${webPort}`,
    delay: 1500, // give backend a head start
    cwd: webDir, // ponytail: vite needs index.html from web/, not project root
  });
}

// ── 3. 打印入口地址 ──

const homeUrl = config.ports?.web
  ? `http://localhost:${config.ports.web}`
  : config.ports?.dev
    ? `http://localhost:${config.ports.dev}`
    : null;

console.log('');
console.log('═══════════════════════════════════════');
console.log(`  ${appName}`);
console.log(`  ${runningServices.length} service(s) running`);
if (homeUrl) {
  console.log(`  🌐 主页: ${homeUrl}/`);
}
for (const svc of runningServices) {
  console.log(`  ${svc.url ? `🔗 ${svc.url}` : `⚙️  ${svc.name} (PID ${svc.pid})`}`);
}
console.log('═══════════════════════════════════════');
console.log('');

// ── 等待子进程 ──

// 等待所有子进程的信号
await Promise.race([
  ...children.map(proc => proc.exited),
]);
cleanup('SIGTERM');
