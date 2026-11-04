import "server-only";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Edge TTS（Edge 浏览器「大声朗读」同款服务）。
 * 通过 msedge-tts 包连接 Bing 语音合成 WebSocket，
 * 无需 API Key，输出 MP3；超长文本自动分段后拼接。
 */

export const MAX_TEXT_LENGTH = 8000;
const CHUNK_MAX = 1600; // 单次 SSML 合成的文本上限
export const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 按段落/句子边界切分长文本 */
function splitChunks(text: string, max = CHUNK_MAX): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    // 优先段落换行，其次中英文句读，最后硬切
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.4) {
      cut = Math.max(
        rest.lastIndexOf("。", max),
        rest.lastIndexOf("！", max),
        rest.lastIndexOf("？", max),
        rest.lastIndexOf("；", max),
        rest.lastIndexOf(". ", max)
      );
    }
    if (cut < max * 0.4) cut = max;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) chunks.push(rest.trim());
  return chunks.filter(Boolean);
}

export interface TtsOptions {
  /** 语音名，如 zh-CN-XiaoxiaoNeural / zh-CN-YunxiNeural */
  voice?: string;
  /** 语速，如 "+10%" / "-20%" */
  rate?: string;
}

/** 合成文本为 MP3 Buffer（超长自动分段拼接） */
export async function synthesizeSpeech(
  text: string,
  opts?: TtsOptions
): Promise<Buffer> {
  const voice = opts?.voice || DEFAULT_VOICE;
  const rate = opts?.rate || "+0%";
  const pieces = splitChunks(text);

  const tts = new MsEdgeTTS({ enableLogger: false });
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  try {
    const buffers: Buffer[] = [];
    for (const piece of pieces) {
      const { audioStream } = tts.toStream(escapeXml(piece), { rate });
      for await (const chunk of audioStream) {
        buffers.push(Buffer.from(chunk as ArrayBufferLike));
      }
    }
    const audio = Buffer.concat(buffers);
    if (audio.length === 0) {
      throw new Error("未生成任何音频，请稍后重试");
    }
    return audio;
  } finally {
    tts.close();
  }
}
