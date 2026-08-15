---
title: "clawdao-video-factory v1.1 — 视频生成管线打通（最后一关）"
type: plan
status: active
date: 2026-07-28
author: Codex (imfly)
covers_period: 2026-07-28 ~ 2026-08-04
phases: Phase A~C
duration: 1 周
source: clawdao-video-agent 的 DEVELOPMENT_PLAN.md v2.2「一键口播视频」
---

# clawdao-video-factory v1.1 — 视频生成管线打通（最后一关）

## 背景

`clawdao-video-factory` 是 ClawDao 生态中的**视频制作工厂**可插拔应用，提供抖音解析、yt-dlp 下载、FFmpeg 音视频处理、HTTP 代理等后端能力，和一个 React + Antd 的 Web 控制台。

### 现状分析

Web 控制台包含 9 个功能面板：

| 面板 | 功能 | 状态 |
|------|------|------|
| 创作工作流（pipeline） | URL → ASR → TTS 编排 | ⚠️ 半成品，卡在 TTS 后无下文 |
| 语音识别（ASR） | 抖音链接识别 + 上传音频识别 | ✅ 可用 |
| 语音合成（TTS） | CosyVoice 文本转语音 | ✅ 可用 |
| 视频生成（TalkingHead） | 头像 + prompt → Seedance 视频 | ⚠️ 独立面板，未集成到 pipeline |
| 自动剪辑 | 字幕 + BGM + 封面 | ⚠️ 有 UI 但未对接真实后端 |
| 自动发布 | 多平台发布账号管理 | ⚠️ 占位 |
| 语音库 / 资料库 | 本地 LocalStorage 资产管理 | ✅ 可用 |
| 任务中心 | 任务队列追踪 | ✅ 可用 |

### 参考计划

参考 `clawdao-video-agent` 项目（口播视频生成系统）的 DEVELOPMENT_PLAN.md v2.2「一键口播视频」章节，其中定义的自动化工作流：

```
1. Extract   — 抖音链接解析 + ASR
2. Rewrite   — LLM 文案优化
3. TTS       — CosyVoice 语音合成
4. Video     — Seedance 2.0 图生视频（音频驱动口型）
5. Edit      — 字幕烧录 + BGM + 封面
6. Publish   — 多平台分发
7. Done      — 完成
```

### 核心问题（Gap Analysis）

当前 `CreatorWorkflowPanel.tsx` 的工作流在 TTS 后即终止，存在以下关键断裂点：

1. **无 LLM 文案润色** — ASR 识别后直接走 TTS，跳过了 rewrite 步骤
2. **视频生成未集成** — TalkingHeadStudio 有独立的面板但 pipeline 没有调用它
3. **Avatar 头像未传入** — pipeline 的 `avatarFile` 状态只用于 UI 展示，未传递给视频生成 API
4. **音频未传递** — `videoSubmitImage` 的 `audioWavBase64` 参数需要 pipeline 的 TTS 输出
5. **API Key 硬编码为空** — `TalkingHeadStudio.tsx` 调用 `videoSubmitImage({ baseUrl: '', apiKey: '' }, ...)` 不可用
6. **Editor 后端缺失** — 自动剪辑面板调用了 `editorSubmit`，但后端 `/api/editor/*` 尚未实现
7. **pipeline 缺少配置入口** — 用户无法在工作流中配置 API Key、模型选择等参数

---

## 目标

> 在 1 周内，**快速验证端到端视频生成**：从抖音链接 → ASR 识别 → LLM 润色 → TTS → Seedance 图生视频 → 预览下载。打通"最后一关"，让 pipeline 能实际产出视频 MP4 文件。

### 范围（In Scope）

- ✅ Pipeline 7 步完整串联（extract → asr → rewrite → tts → video → edit → done）
- ✅ LLM 文案润色步骤加入 pipeline
- ✅ Avatar 头像上传 + 视频生成参数配置集成到 pipeline
- ✅ API Key 配置入口（LLM + Video 各自的 baseUrl / apiKey）
- ✅ TTS 输出音频自动传入视频生成
- ✅ 视频预览 + 下载功能
- ✅ Seedance 视频生成成功后触发自动剪辑
- ✅ 后端 `/api/editor/*` 基础实现（字幕烧录 + 封面合成 via FFmpeg）

### 非范围（Out of Scope）

- ❌ 多平台自动发布（保留 UI 占位，不实现真实分发）
- ❌ ClawDao Project Protocol 扩展（保持现有 manifest 不变）
- ❌ 3D 数字人 / VRM / Live2D
- ❌ 实时直播推流
- ❌ 用户账号系统 / SSO

---

## 架构设计

### 新增 & 修改文件清单

```
# 新增
web/src/services/pipelineEngine.ts          # 工作流引擎（事件驱动编排）
web/src/components/VideoPanel/PipelineConfigBar.tsx  # 工作流配置栏
src/editor-server.ts                        # 自动剪辑后端（FFmpeg 字幕+封面合成）

# 修改
web/src/components/VideoPanel/CreatorWorkflowPanel.tsx  # 改造为 7 步完整流程
web/src/components/VideoPanel/TalkingHeadStudio.tsx      # 提取通用视频生成函数
web/src/api/client.ts                                    # 新增 editor 相关 API
web/vite.config.ts                                       # 新增 /api/editor 代理
src/http-server.ts                                       # 注册 /api/editor/* 路由
```

### 工作流引擎设计

建立 `pipelineEngine.ts` 事件驱动引擎，替代当前 `CreatorWorkflowPanel.tsx` 内联的 `async/await` 流程：

```typescript
// 核心事件类型
type PipelineEvent =
  | { type: 'step:start'; step: string }
  | { type: 'step:progress'; step: string; progress: number; message: string }
  | { type: 'step:complete'; step: string; result: any }
  | { type: 'step:fail'; step: string; error: string }
  | { type: 'pipeline:abort' }
  | { type: 'pipeline:done'; outputUrl?: string }

// 步骤定义
interface PipelineStep {
  id: string;
  label: string;
  executor: (ctx: PipelineContext, emit: EmitFn) => Promise<any>;
  retryable?: boolean;
  timeoutMs?: number;
}

// 上下文传递
interface PipelineContext {
  sourceUrl?: string;
  transcript?: string;
  script?: string;           // 润色后的文案
  ttsAudio?: { path: string; base64: string };
  avatarImage?: { dataUrl: string; fileName: string };
  videoOutputUrl?: string;
  editedOutputUrl?: string;
  config: PipelineConfig;
}
```

### 配置模型

```typescript
interface PipelineConfig {
  // LLM 润色配置
  llm: { baseUrl: string; apiKey: string; model: string };
  // TTS 配置（复用现有）
  tts: { speaker: string; speed: number; seed: number };
  // 视频生成配置
  video: {
    provider: 'seedance' | 'hailuo';
    baseUrl: string;
    apiKey: string;
    prompt: string;
    duration: number;  // 秒
  };
  // 自动剪辑配置
  edit: {
    subtitleTemplate: string;
    bgmEnabled: boolean;
    bgmVolume: number;
  };
}
```

---

## Phase 划分与执行计划

### Phase A — 核心引擎 + 配置（2 天）

#### A1. 后端 Editor 服务（1 天）

在 `src/editor-server.ts` 中实现 FFmpeg 字幕烧录 + 封面合成端点：

- `POST /api/editor/cover` — 合成封面图（文字 + 背景）
- `POST /api/editor/jobs` — 提交剪辑任务：输入视频 + 字幕 SRT + 封面 → 输出最终视频
- `GET /api/editor/jobs/:id` — 查询任务状态
- `GET /api/editor/output/:file` — 提供输出文件下载

字幕合成使用 FFmpeg `drawtext` filter，封面合成使用 FFmpeg `image2` + overlay。

验证方式：`curl -X POST http://127.0.0.1:18792/api/editor/jobs -d '{...}'` 返回 jobId。

#### A2. 工作流引擎（1 天）

在 `web/src/services/pipelineEngine.ts` 中实现：

- `createPipeline(steps, config)` → Pipeline 实例
- `pipeline.start(ctx)` → 执行流程，返回事件流
- `pipeline.abort()` → 中止
- `pipeline.on('step:complete', cb)` → 事件订阅

步骤编排：
1. extract — 抖音 URL 解析（复用现有 `extractDouyin` + `douyinAudio` + `asr`）
2. rewrite — LLM 调用（复用现有 `llm` API）
3. tts — CosyVoice 合成（复用现有 `ttsSubmit` + `ttsQuery`）
4. video — 视频生成（提取 TalkingHeadStudio 的生成逻辑为独立函数）
5. edit — 调 editor API（复用现有 `editorSubmit` + `editorJobWait`）
6. done — 返回最终视频 URL

### Phase B — Pipeline UI 改造（2 天）

#### B1. PipelineConfigBar 配置栏

新建 `PipelineConfigBar.tsx` 组件，作为工作流上方的配置区域：

- **LLM 配置**：baseUrl + apiKey + model 选择（折叠面板）
- **TTS 配置**：音色 + 语速（复用现有）
- **视频配置**：Provider 选择（Seedance / Hailuo）+ prompt 模板 + duration
- **剪辑配置**：字幕模板 + BGM 开关

配置持久化到 `localStorage`（用 `zustand/persist`）。

#### B2. CreatorWorkflowPanel 改造

将现有 panel 改造为 7 步完整流程：

1. **输入区**：保留抖音链接 + 文案输入 + 头像上传，**新增** PipelineConfigBar
2. **进度区**：7 步垂直 Steps（extract → asr → rewrite → tts → video → edit → done）
3. **实时日志**：保留事件日志列表
4. **结果预览**：视频播放器 + 下载按钮
5. **中止按钮**：保留

关键修改点：
- 将内联 `async/await` 改为调用 `pipelineEngine`
- 视频生成步骤改为调用提取后的 `runVideoGeneration` 函数（从 TalkingHeadStudio 提取）
- 将 TTS 输出的 base64 音频传入视频生成步骤
- 视频生成传入用户上传的头像
- 自动剪辑步骤调 editor API

#### B3. TalkingHeadStudio 重构

将视频生成逻辑提取为纯函数 `runVideoGeneration(ctx, config)`，放在 `services/` 下：

```typescript
// web/src/services/videoGeneration.ts
export async function runVideoGeneration(
  params: {
    avatarDataUrl: string;
    prompt: string;
    audioWavBase64?: string;
  },
  config: { baseUrl: string; apiKey: string; provider: string },
  emit: (event: PipelineEvent) => void
): Promise<string>  // 返回视频 URL
```

TalkingHeadStudio 面板和 pipeline 共享这个函数。

### Phase C — 联调验证（2 天）

#### C1. 端到端测试

1. 启动后端：`bun run dev`（port 18792）
2. 启动前端：`cd web && npm run dev`（port 5180）
3. 工作流测试：
   - 输入抖音链接 → 自动提取 → ASR → LLM 润色 → TTS → 视频生成 → 预览
   - 输入文案 + 头像 → TTS → 视频生成 → 预览
4. 验证异常场景：
   - API Key 未配 → 友好提示
   - 抖音链接失效 → 降级提示
   - TTS 失败 → 跳过视频生成
   - 视频生成超时 → 超时提示

#### C2. README 显示 Bug 修复（附加）

在 `clawdao/apps/desktop/src-tauri/resources/embedded/agent-server/src/projectRunner.ts` 中修复：

```typescript
// 在 listProjects 和 inspectProject 中，获取 readme 的逻辑改为：
// 1. 优先读 manifest.json 的 readme 字段
// 2. 如果为空，尝试读取项目目录下的 README.md 文件
// 3. 如果仍为空，返回 null
```

---

## 验收标准

1. ✅ 打开 pipeline 面板，输入抖音链接 + 上传头像，点击"一键生成"
2. ✅ 流程依次经过：提取文案 → ASR → LLM 润色 → TTS → 视频生成 → 剪辑 → 完成
3. ✅ 每个步骤在进度区有实时状态显示
4. ✅ 最终视频在预览区可播放、可下载
5. ✅ API Key 可在配置栏编辑，持久化保存
6. ✅ 任意步骤失败有友好提示，不阻塞后续操作
7. ✅ 可随时中止运行中的工作流

---

## 技术细节

### FFmpeg 字幕合成命令

```bash
# 字幕烧录（drawtext）
ffmpeg -i input.mp4 -vf "drawtext=text='字幕内容':fontfile=/path/to/font.ttf:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-th-50:enable='between(t,0,10)'" -c:a copy output.mp4

# 封面叠加
ffmpeg -i input.mp4 -i cover.png -filter_complex "overlay=0:0:enable='between(t,0,3)'" -c:a copy output.mp4
```

### Seedance API 调用

当前 `api/client.ts` 已有 `videoSubmitImage`，接收 `imageDataUrl` + `prompt` + `audioWavBase64`，返回 `{ video: { url: string } }`。

Pipeline 中调用：
1. TTS 完成后，拿到 `filePath`
2. 通过 `ttsAudioUrl(filePath)` 获取音频 URL
3. fetch 音频文件 → 转 base64
4. 调用 `videoSubmitImage` 传入头像 + prompt + 音频 base64

### LLM 润色 Prompt

```typescript
const REWRITE_SYSTEM_PROMPT = `你是短视频爆款文案优化专家。
请将以下视频口播文案优化为爆款风格：
- 开头要有吸引力（黄金 3 秒原则）
- 语言简洁有力，适合口播
- 适当加入情绪词和互动引导
- 保留核心信息，不改变原意
- 输出纯文案，不要解释`;
```

---

## 风险与后备方案

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Seedance API 在国内不可用 | 中 | 高 | 视频生成步骤失败时友好提示，跳过步骤给出预览 |
| 用户没有 GPU 跑 FFmpeg 字幕 | 低 | 中 | Editor 后端运行在 Bun，FFmpeg 纯 CPU 可跑，仅速度慢 |
| 抖音链接过期/无法解析 | 中 | 中 | 降级到直接输入文案模式 |
| 用户未配置任何 API Key | 高 | 高 | 步骤执行前检查配置，未配置时置灰按钮 + tooltip 提示 |
| LLM 润色后文案长度翻倍 | 低 | 低 | TTS 前截断到 1000 字（现有逻辑已支持） |

---

## 附录：clawdao-video-agent 参考架构映射

| 口播视频系统 v2.2 | clawdao-video-factory v1.1 | 实现说明 |
|-------------------|---------------------------|----------|
| 1. Extract | extract 步骤 | 复用现有 douyin + ASR API |
| 2. Rewrite | rewrite 步骤 | 新增 LLM 润色步骤 |
| 3. TTS | tts 步骤 | 复用现有 CosyVoice TTS API |
| 4. Video（Seedance 2.0） | video 步骤 | 从 TalkingHeadStudio 提取为共享函数 |
| 5. Edit（字幕+BGM+封面） | edit 步骤 | 新增 FFmpeg Editor 后端 |
| 6. Publish | 延后 | UI 占位保留，真实分发延后 |
| PipelineEvent 事件驱动 | pipelineEngine.ts | 全新实现，emit/on 模式 |
| abort 机制 | pipeline.abort() | 引擎原生支持 |
| 自动降级 | 步骤级 try/catch | 单步失败不影响后续 |
