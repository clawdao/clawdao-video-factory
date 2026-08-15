# 08 — API 参考

## 8.1 Pipeline API

```python
class LipSyncPipeline:
    def __init__(self, config_path: str = 'config/local.yaml',
                 config_dict: dict | None = None):
        """
        初始化口播视频生成流水线。
        根据配置自动创建 Provider（SSH/HTTP）和 TTS 模块。
        
        Args:
            config_path: YAML 配置文件路径
            config_dict: 直接传入配置字典（优先级高于 config_path）
        """
    
    def image_to_video(self, image_path, script, output_path,
                       tts_kwargs=None, subtitle=False, subtitle_lang='zh'):
        """图片 → 口播视频"""
    
    def video_to_video(self, video_path, script, output_path,
                       tts_kwargs=None, subtitle=False):
        """视频 → 口播视频（换口型）"""
    
    def batch_process(self, image_path, scripts, output_dir,
                      tts_kwargs=None, max_concurrent=1):
        """批量处理"""
```

---

## 8.2 Provider API

### CloudProvider（抽象基类）

```python
# src/remote/provider.py

class CloudProvider(ABC):
    """云 GPU 提供商抽象基类"""
    
    @abstractmethod
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """上传文件到云端"""
    
    @abstractmethod
    def download_file(self, remote_path: str, local_path: str) -> bool:
        """从云端下载文件"""
    
    @abstractmethod
    def run_command(self, command: str, workdir: str | None = None,
                    timeout: int | None = None) -> CommandResult:
        """在云端执行命令"""
    
    @abstractmethod
    def check_gpu(self) -> list[GPUInfo]:
        """获取 GPU 列表及状态"""
    
    @abstractmethod
    def file_exists(self, remote_path: str) -> bool:
        """检查远程文件是否存在"""
    
    @abstractmethod
    def close(self):
        """关闭连接"""
```

### SSHProvider

```python
# src/remote/providers/ssh_provider.py

class SSHProvider(CloudProvider):
    """
    SSH/SFTP 方式连接云 GPU
    适用：AutoDL, Vast.ai, 阿里云, 腾讯云 等
    """
    
    def __init__(self, host: str, port: int = 22,
                 username: str = 'root',
                 key_filename: str | None = None,
                 password: str | None = None,
                 timeout: int = 30,
                 remote_work_dir: str = '/root'):
        """初始化 SSH 连接"""
    
    def upload_file(self, local_path: str, remote_path: str) -> bool: ...
    def download_file(self, remote_path: str, local_path: str) -> bool: ...
    def run_command(self, command: str, workdir: str | None = None,
                    timeout: int | None = None) -> CommandResult: ...
    def check_gpu(self) -> list[GPUInfo]: ...
    def file_exists(self, remote_path: str) -> bool: ...
    def close(self): ...
```

### HTTPProvider

```python
# src/remote/providers/http_provider.py

class HTTPProvider(CloudProvider):
    """
    HTTP REST API 方式连接云 GPU
    适用：Modal, Replicate, 自建 FastAPI 服务
    """
    
    def __init__(self, api_base_url: str,
                 api_key: str | None = None,
                 timeout: int = 1800):
        """初始化 HTTP 客户端"""
    
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """HTTP multipart 上传文件"""
    
    def download_file(self, remote_path: str, local_path: str) -> bool:
        """HTTP 流式下载文件"""
    
    def run_command(self, command: str, **kwargs) -> CommandResult:
        """通过 API 执行命令（可能受限）"""
    
    def check_gpu(self) -> list[GPUInfo]:
        """GET /health 获取 GPU 状态"""
    
    def file_exists(self, remote_path: str) -> bool:
        """HEAD 请求检查文件"""
    
    def close(self): ...
```

### AutoProvider（自动创建）

```python
# src/remote/providers/auto_provider.py

class AutoProvider:
    """根据配置自动选择/创建 Provider"""
    
    @staticmethod
    def create(config: dict) -> CloudProvider:
        """
        根据 config['provider']['type'] 创建对应 Provider
        
        Args:
            config: 配置字典，需包含 provider.type 字段
        
        Returns:
            SSHProvider 或 HTTPProvider 实例
        
        Raises:
            ValueError: provider.type 不支持
        """
```

---

## 8.3 TaskQueue API

```python
class TaskQueue:
    def __init__(self, provider: CloudProvider,
                 inference_config: dict,
                 max_concurrent: int = 1,
                 retry_limit: int = 3,
                 timeout_minutes: int = 30):
        """
        初始化任务队列
        
        Args:
            provider: CloudProvider 实例（SSH/HTTP 皆可）
            inference_config: 推理参数配置
            max_concurrent: 最大并发任务数
            retry_limit: 失败重试次数
            timeout_minutes: 单任务超时时间
        """
    
    def add_task(self, mode: str, image: str | None = None,
                 video: str | None = None, audio: str | None = None,
                 text: str | None = None,
                 output_name: str = 'output.mp4',
                 custom_params: dict | None = None) -> str:
        """添加推理任务，返回 task_id"""
    
    def add_batch(self, tasks: list[dict]) -> list[str]:
        """批量添加任务"""
    
    def get_status(self, task_id: str) -> dict:
        """获取任务状态"""
    
    async def wait_for(self, task_id: str) -> dict:
        """等待任务完成"""
    
    def cancel(self, task_id: str) -> bool:
        """取消任务"""
    
    async def start(self): ...
    def stop(self): ...
    def get_stats(self) -> dict: ...
```

---

## 8.4 TTS API

```python
class CosyVoiceTTS:
    def __init__(self, model_dir: str, device: str = 'cpu'):
        """初始化 CosyVoice TTS 引擎"""
    
    def generate(self, text: str, output_path: str,
                 tts_mode: str = 'sft', voice: str = 'default',
                 speed: float = 1.0, emotion: str | None = None,
                 ref_audio: str | None = None,
                 ref_text: str | None = None) -> str:
        """文本转语音"""
    
    def generate_batch(self, texts: list[str], output_dir: str,
                       **kwargs) -> list[str]:
        """批量文本转语音"""
```

---

## 8.5 TTS Scheduler（位置感知调度器）

```python
# src/tts/scheduler.py

class TTSScheduler:
    """
    TTS 调度器：根据配置决定在本地还是云端执行 TTS。
    对上层 Pipeline 透明，调用方无需关心 TTS 实际执行位置。
    """
    
    def __init__(self, config: dict, provider: CloudProvider | None = None):
        """
        Args:
            config: TTS 配置（含 run_on 字段）
            provider: CloudProvider 实例（TTS 在云端时需要）
        """
    
    def generate(self, text: str, output_path: str,
                 **kwargs) -> str:
        """
        生成语音，根据配置路由到本地或云端
        
        Args:
            text: 输入文本
            output_path: 输出音频路径
            **kwargs: 透传给 CosyVoice TTS 的参数
        
        Returns:
            str: 音频文件路径
        
        Raises:
            ValueError: run_on='cloud' 但未提供 provider
        """
    
    def _generate_local(self, ...) -> str: ...
    def _generate_on_cloud(self, ...) -> str: ...
```

---

## 8.6 服务器端 API（HTTP 模式）

### 服务器端 API 端点

部署在云 GPU 上的 FastAPI 服务，供 HTTPProvider 调用：

```python
# src/remote/server/api_server.py

# POST /infer — 提交推理任务
# Request: multipart/form-data
#   - image: 图片文件
#   - audio: 音频文件（可选，TTS在云端时传文本）
#   - script: 文案文本（可选，TTS在云端时使用）
#   - mode: "ai2v" | "at2v" | "ai2v_vc" | "at2v_vc"
#   - params: JSON 字符串（额外推理参数）
# Response: {"task_id": "uuid", "status": "queued"}

# GET /status/{task_id} — 查询任务状态
# Response: {"task_id": "uuid", "status": "running|completed|failed",
#            "progress": 0.5, "message": "..."}

# GET /download/{task_id} — 下载结果视频
# Response: video/mp4 文件流

# GET /health — 健康检查
# Response: {"status": "ok", "gpu_count": 1, "gpu_name": "RTX 4090",
#            "vram_free_gb": 20.5, "tasks_running": 0, "tasks_queued": 2}
```

### 推理脚本命令行接口（SSH 模式）

```bash
python infer_avatar.py \
    --mode {ai2v|at2v|ai2v_vc|at2v_vc} \
    --image <path> \
    --audio <path> \
    --text "<description>" \
    --output <path> \
    --weights <dir> \
    [--video <path>] \
    [--resolution {480P|720P}] \
    [--num_segments <int>] \
    [--ref_img_index <int>] \
    [--mask_frame_range <int>] \
    [--audio_cfg <float>] \
    [--use_distill] \
    [--use_int8] \
    [--model_type {avatar-v1.0|avatar-v1.5}] \
    [--nproc_per_node <int>] \
    [--context_parallel_size <int>]
```

---

## 8.7 Audio Utils API

```python
def prepare_audio_for_longcat(input_path, output_path,
                              target_sr=16000,
                              normalize_volume=True) -> str:
    """音频转换为 LongCat 标准 16kHz WAV 格式"""

def adjust_speed(input_path, speed, output_path) -> str:
    """调整语速（保持音调）"""

def adjust_volume(input_path, gain_db, output_path) -> str:
    """调整音量"""

def get_audio_duration(input_path) -> float:
    """获取音频时长（秒）"""

def split_long_text(text, max_chars=500) -> list[str]:
    """长文本分段"""

def merge_audio_segments(segment_paths, output_path) -> str:
    """合并多段音频"""

def adjust_to_target_duration(input_path, target_duration,
                              output_path) -> str:
    """变速调整到目标时长"""
```

---

## 8.8 Postprocess API

```python
def generate_subtitle(text, audio_duration, output_path,
                      lang='zh') -> str:
    """生成 SRT 字幕文件"""

def embed_subtitle(video_path, subtitle_path, output_path,
                   font_path=None, font_size=48) -> str:
    """将字幕嵌入视频（FFmpeg）"""

def compose_final_video(video_path, audio_path, output_path,
                        subtitle_path=None, codec='h264',
                        bitrate='8M') -> str:
    """合成最终视频"""
```
