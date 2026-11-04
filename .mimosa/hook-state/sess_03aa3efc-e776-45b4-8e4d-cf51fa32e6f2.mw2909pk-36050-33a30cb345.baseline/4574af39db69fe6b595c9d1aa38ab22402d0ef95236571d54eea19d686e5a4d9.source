import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { synthesizeSpeech, MAX_TEXT_LENGTH } from "@/lib/tts";
import { TTS_VOICE, DEFAULT_TTS_VOICE } from "@/lib/ai/presets";

// 朗读消耗外部服务，需要登录
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      text?: string;
      voice?: string;
      rate?: string;
      lang?: string;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "没有可朗读的文本" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `文本过长（最多 ${MAX_TEXT_LENGTH} 字符）` },
        { status: 400 }
      );
    }

    // 语音优先级：显式 voice 参数 > 课程语言映射 > 默认中文女声
    const voice =
      body.voice?.trim() ||
      (body.lang && body.lang !== "zh" && TTS_VOICE[body.lang]) ||
      DEFAULT_TTS_VOICE;

    const audio = await synthesizeSpeech(text, { voice, rate: body.rate });
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "语音合成失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
