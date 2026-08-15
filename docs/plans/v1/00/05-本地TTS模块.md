# 05 — 本地 TTS 模块

## 5.1 概述

TTS（Text-to-Speech）模块负责将文案脚本转换为自然流畅的配音音频，作为 LongCat 音频驱动视频生成的输入。

**选型：CosyVoice-300M-SFT**

- 阿里通义实验室开源
- 中文效果业界领先
- 支持情感控制、语速调节
- 可在 CPU 上实时运行
- 支持参考音频克隆音色

## 5.2 模块接口

```
TTSModule
├── generate(text, output_path, **kwargs) → audio_path
├── generate_batch(text_list, output_dir, **kwargs) → [audio_paths]
├── adjust_speed(audio_path, speed, output_path) → audio_path
└── adjust_volume(audio_path, volume, output_path) → audio_path
```

### 核心方法

#### `generate(text, output_path, tts_mode='sft', voice='default', speed=1.0, emotion=None, ref_audio=None, ref_text=None)`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | str | 必填 | 需要转为语音的文本 |
| `output_path` | str | 必填 | 输出音频文件路径 |
| `tts_mode` | str | `'sft'` | `'sft'` 标准模式 / `'voice_clone'` 音色克隆 |
| `voice` | str | `'default'` | 预置音色 ID |
| `speed` | float | `1.0` | 语速倍率 (0.5~2.0) |
| `emotion` | str | None | 情感标签: `happy`, `sad`, `angry`, `surprised` 等 |
| `ref_audio` | str | None | 参考音频路径（音色克隆模式） |
| `ref_text` | str | None | 参考音频对应文本 |
| **返回** | str | | 生成的音频文件路径 |

#### `generate_batch(text_list, output_dir, **kwargs)`

批量生成多个文本的音频。返回音频文件路径列表。

## 5.3 使用示例

### 基础用法

```python
# 标准模式
from src.tts.cosyvoice_tts import TTSModule

tts = TTSModule(
    model_dir='pretrained_models/CosyVoice-300M-SFT',
    device='cpu'  # 或 'cuda:0' 如果有 GPU
)

# 生成配音
audio_path = tts.generate(
    text="大家好，欢迎收看今天的科技频道。我们今天来聊聊人工智能的最新发展。",
    output_path='outputs/audio/script.wav',
    tts_mode='sft',
    voice='default',
    speed=1.0
)
print(f"配音已生成: {audio_path}")
```

### 音色克隆（基于参考音频）

```python
# 使用参考音频克隆指定声音
audio_path = tts.generate(
    text="今天我们来介绍一个非常有用的AI工具。",
    output_path='outputs/audio/cloned.wav',
    tts_mode='voice_clone',
    ref_audio='samples/reference_voice.wav',
    ref_text="这是参考音频的对应文本内容。"
)
```

### 长文本分段处理

```python
# 自动处理长文本（超过模型限制时自动分段）
text = """
今天我们要讲的是一个非常重要的主题。
（5000字长文...）
"""

audio_path = tts.generate(
    text=text,
    output_path='outputs/audio/long_script.wav',
    # 内部会自动分段合并
)
```

### 批量生成

```python
# 批量生成多条配音
scripts = [
    "第一条视频文案内容...",
    "第二条视频文案内容...",
    "第三条视频文案内容...",
]
audio_paths = tts.generate_batch(
    scripts,
    output_dir='outputs/audio/batch/',
    speed=1.1  # 统一语速
)
```

## 5.4 音频预处理

生成的音频需要适配 LongCat 的输入要求：

```python
from src.tts.audio_utils import prepare_audio_for_longcat

# 标准化采样率（16kHz）、格式（WAV）
longcat_audio = prepare_audio_for_longcat(
    input_path='outputs/audio/script.wav',
    output_path='outputs/audio/script_16k.wav',
    target_sr=16000,    # LongCat 要求 16kHz
    normalize_volume=True  # 音量归一化
)
```

## 5.5 语速和音频时长控制

LongCat 生成视频的帧数由音频时长决定，因此控制音频时长非常重要：

```python
from src.tts.audio_utils import adjust_audio_to_target_duration

# 调整音频到目标时长（秒）
adjusted = adjust_audio_to_target_duration(
    input_path='outputs/audio/script.wav',
    target_duration=30.0,  # 目标 30 秒
    output_path='outputs/audio/script_adjusted.wav'
)
```

## 5.6 接口说明

### CosyVoiceTTS 类

```python
class CosyVoiceTTS:
    def __init__(self, model_dir: str, device: str = 'cpu'):
        """
        初始化 CosyVoice TTS 引擎
        
        Args:
            model_dir: 模型目录路径
            device: 运行设备 ('cpu' | 'cuda:0')
        """
        
    def generate(self, text: str, output_path: str, **kwargs) -> str:
        """生成语音"""
        
    def generate_batch(self, texts: list[str], output_dir: str, **kwargs) -> list[str]:
        """批量生成语音"""
```

### AudioUtils 工具函数

```python
def prepare_audio_for_longcat(
    input_path: str,
    output_path: str,
    target_sr: int = 16000,
    normalize_volume: bool = True
) -> str:
    """将音频转换为 LongCat 标准格式"""
    
def adjust_speed(
    input_path: str,
    speed: float,
    output_path: str
) -> str:
    """调整语速"""
    
def adjust_volume(
    input_path: str,
    gain_db: float,
    output_path: str
) -> str:
    """调整音量"""
    
def get_audio_duration(input_path: str) -> float:
    """获取音频时长（秒）"""
    
def split_long_text(text: str, max_chars: int = 500) -> list[str]:
    """将长文本分段（用于分多次生成后合并）"""
    
def merge_audio_segments(
    segment_paths: list[str],
    output_path: str
) -> str:
    """合并多段音频"""
    
def adjust_to_target_duration(
    input_path: str,
    target_duration: float,
    output_path: str
) -> str:
    """调整音频到目标时长"""
```
