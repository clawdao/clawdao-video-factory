---
title: "clawdao-video-factory v1.2 — LongCat 数字人视频接入"
type: plan
status: active
date: 2026-07-29
author: Codex (imfly)
phases: Phase C~D
depends_on: models/clawdao-model-longcat（Phase A/B，并行项目）
---

# clawdao-video-factory v1.2 — LongCat 数字人视频接入

## 背景

本机 Mac Mini 无 NVIDIA GPU，LongCat-Video-Avatar-1.5 推理（必须 CUDA）部署到独立 GPU 机器。模型侧（安装、权重下载、部署、API 服务实现）已独立为 **`models/clawdao-model-longcat`** 项目，由其内部 Phase A/B 完成，详见 `models/clawdao-model-longcat/docs/deploy-plan.md`。

**本文档范围：端点约束定义（第 1 节）+ Phase C 本项目接入 + Phase D 联调验收。C/D 与模型项目的 A/B 并行推进。**

### 链路现状（接入必要性）

| 检查项 | 现状 | 后果 |
|--------|------|------|
| 后端 `src/http-server.ts` 实现 `/api/video/*` | **不存在** | 前端调用必然 404 |
| `web/vite.config.ts` 代理 `/api/video` | **未配置** | 开发环境请求打到 Vite 返回 HTML |
| `TalkingHeadStudio.tsx` 传入配置 | `{ baseUrl:'', apiKey:'' }` 空占位 | 即使后端存在也不可用 |
| 视频生成时长 | 分钟级（推理 2~5 分钟 + 冷启动） | 必须异步任务模式 |

---

## 1. 端点约束（本项目制定，`clawdao-model-longcat` 必须逐字实现）

设计原则：**与本项目 TTS 接口（aigcpanel submit/query 惯例）完全同构**，前端视频流程与 TTS 流程代码模式一致，后端纯透传，零桥接零适配。

### 1.1 POST /api/video/submit

请求 JSON：

```json
{
  "image": "<头像图片 base64 或 dataURL，必填>",
  "prompt": "<场景描述文本，必填>",
  "audioWavBase64": "<WAV 音频 base64，可空>",
  "resolution": "480P"
}
```

响应 200：`{ "data": { "jobId": "<uuid>" } }`；校验失败 400：`{ "msg": "<原因>" }`

### 1.2 POST /api/video/query

请求 JSON：`{ "jobId": "<uuid>" }`

响应 200：

```json
{
  "data": {
    "status": "running | success | fail",
    "progress": 45,
    "message": "推理中...",
    "data": { "filePath": "<jobId>.mp4" },
    "msg": "<fail 时的错误信息>"
  }
}
```

- `status` 仅三值（排队归并为 `running`）
- `data.filePath` 仅 success 时返回，且只含文件名（镜像 `/api/tts/query` 的 `job.data?.filePath` 用法）
- jobId 不存在 → 404

### 1.3 GET /api/video/file?file=\<文件名\>

mp4 二进制流（镜像 `/api/tts/audio?file=` 用法）。仅允许 outputs 目录内纯文件名，拒绝目录穿越。

### 1.4 GET /api/health

`{ "status": "ok", "gpu": [...], "queuedJobs": 0, "weightsReady": true }`

### 1.5 鉴权

请求头 `Authorization: Bearer ${LONGCAT_API_TOKEN}`。本项目侧经 `configKeys` 注入，日志掩码。

---

## 2. 数据流

```
web/ (React :5180)
  └─ /api/video/* ──vite proxy──► src/ (Bun :18792)
                                    │  · 透传远程契约（路径/包膜不变）
                                    │  · task-store 登记（ClawDao Task Center 可见）
                                    │  · LONGCAT_MOCK=1 时走本地 mock（并行开发用）
                                    └─HTTPS+Token──► clawdao-model-longcat (:8000)
                                                       FastAPI → torchrun → LongCat-Video-Avatar-1.5
```

配置项（环境变量 / ClawDao configKeys 注入）：

| 变量 | 说明 |
|------|------|
| `LONGCAT_BASE_URL` | 远程服务地址，如 `http://<gpu-host>:8000` |
| `LONGCAT_API_TOKEN` | 远程服务鉴权 token（掩码） |
| `LONGCAT_MOCK` | `=1` 时启用本地 mock，不依赖远程服务 |

---

## 3. Phase C — 本项目接入

### C1. 新增 `src/longcat.ts`

远程 API 客户端（Bun 零依赖，fetch 实现）：

```typescript
longcatSubmit(input: { image, prompt, audioWavBase64?, resolution? })
  → POST {LONGCAT_BASE_URL}/api/video/submit → { jobId }
longcatQuery(jobId)
  → POST {LONGCAT_BASE_URL}/api/video/query → { status, progress?, filePath?, msg? }
longcatFetchFile(fileName)
  → GET  {LONGCAT_BASE_URL}/api/video/file?file= → 缓存到 CLAWDAO_DATA_DIR → 本地路径
longcatHealth() → boolean
```

**MOCK 模式**（`LONGCAT_MOCK=1`）：submit 返回本地生成的假 jobId；query 前 3 秒 running、之后 success 并指向一个本地示例 mp4；使 Phase C/D 不等待模型项目 A/B 完成。

### C2. 修改 `src/http-server.ts`

| 路由 | 行为 |
|------|------|
| `POST /api/video/submit` | `longcatSubmit` → `taskStore.create('longcat-video', {}, jobId)`（复用远程 jobId 作为任务 id）→ 原样返回 `{ data: { jobId } }` |
| `POST /api/video/query` | `longcatQuery` → 同步状态到 task-store（success 时后台 `longcatFetchFile` 缓存 mp4，filePath 改写为本地缓存名）→ 原样返回契约响应 |
| `GET /api/video/file` | 命中本地缓存直接返回；未命中透传远程并缓存 |

另：

- `dispatchTask` 的 switch 增加 `case 'longcat-video'`（ClawDao Protocol 任务通道）
- `/api/health` 增加 `longcat: boolean`（远程可达性）

### C3. 修改 `.clawdao/project.json`

新增 action：

```json
"longcat-video": {
  "name": "数字人视频生成",
  "description": "头像 + 音频 + 场景描述 → LongCat 数字人口播视频（远程 GPU）",
  "type": "task",
  "invoke": {
    "http": { "method": "POST", "path": "/api/v1/tasks", "body": { "type": "longcat-video" } }
  }
}
```

`configKeys` 增加：`["LONGCAT_BASE_URL", "LONGCAT_API_TOKEN"]`。

### C4. 前端改造

| 文件 | 改动 |
|------|------|
| `web/vite.config.ts` | 补 `/api/video` 代理到 :18792（当前缺失，属 bug 修复） |
| `web/src/api/client.ts` | `videoSubmitImage` 拆为 `videoSubmit`（返回 jobId）+ `videoQuery`（镜像 `ttsQuery` 代码模式）+ `videoJobWait(jobId, maxMs=900_000)` 轮询辅助；新增 `videoFileUrl(filePath)`（镜像 `ttsAudioUrl`） |
| `web/src/components/VideoPanel/TalkingHeadStudio.tsx` | 删除 `{ baseUrl:'', apiKey:'' }` 空占位；改为 submit → `videoJobWait` 轮询 → `videoFileUrl` 预览；进度文案区分"排队中/推理中/下载中"；超时 15 分钟友好提示 |

### C5. 与 v1.1 管线衔接

`PipelineConfig.video.provider` 枚举由 `'seedance' | 'hailuo'` 扩展为 `+ 'longcat'`。**仅加扩展点，不改动 v1.1 引擎**，管线接入随 v1.1 实施时落地。

---

## 4. Phase D — 联调验收（与 Phase C 同步推进）

### 4.1 Mock 链路验收（不等模型项目）

1. `LONGCAT_MOCK=1 bun run dev` 启动后端
2. `curl -X POST :18792/api/video/submit` → jobId → query 轮询 → success → file 下载可播放
3. 前端 TalkingHeadStudio 全流程：上传头像 + prompt → 生成 → 预览 → 推送工作流
4. ClawDao Task Center 可见 `longcat-video` 任务与状态流转

### 4.2 真机联调验收（模型项目 Phase A/B 就绪后）

1. 配置 `LONGCAT_BASE_URL` + `LONGCAT_API_TOKEN`（掩码核对），`/api/health` 的 `longcat: true`
2. 真实头像 + TTS 音频端到端产出 mp4，口型同步质量人工确认
3. 异常路径：远程关机 / token 失效（401 透传）/ 超时 / OOM（远程 fail + msg 透传）
4. 成本核对：单条 10s 视频远程耗时 ≤ 6 分钟（RTX 4090 INT8 480P）

---

## 5. 验收标准

1. ✅ `/api/video/submit|query|file` 三端点实现，响应与第 1 节契约逐字一致
2. ✅ Mock 模式下前端全流程可用（不依赖远程）
3. ✅ 真机模式下端到端产出 mp4，口型同步合格
4. ✅ `.clawdao/project.json` 声明 `longcat-video`，ClawDao Task Center 可见
5. ✅ 密钥零硬编码，走 `configKeys` 注入且日志掩码
6. ✅ 远程不可达时前端明确报错，不影响其他面板

---

## 6. 风险与后备

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 远程服务未就绪阻塞 C/D | 中 | 中 | LONGCAT_MOCK=1 mock 链路先行 |
| 契约理解偏差（两项目并行） | 中 | 高 | 契约为本文档第 1 节 + deploy-plan 第 2 节双写，逐字一致；联调首项即契约 diff |
| 单卡 4090 显存紧张 | 中 | 中 | 远程强制 INT8 + 480P；fail msg 透传提示 |
| 分钟级任务用户体验 | 高 | 低 | 进度文案分级 + task-store 持久可查 |
| 密钥泄露 | 低 | 高 | configKeys 注入 + 日志掩码 + 远程非 127.0.0.1 监听强制 token |

## 7. 相关文档

| 文档 | 关系 |
|------|------|
| `models/clawdao-model-longcat/docs/deploy-plan.md` | 模型侧 Phase A/B 执行文档（端点契约的实现方） |
| `docs/plans/v1/01-video-pipeline-last-mile.md` | v1.1 管线编排；本文档为其 video 步骤提供可用 provider |
| `docs/plans/v1/00/` | 原始设计参考（硬件评估、排障表已吸收进模型项目文档） |
