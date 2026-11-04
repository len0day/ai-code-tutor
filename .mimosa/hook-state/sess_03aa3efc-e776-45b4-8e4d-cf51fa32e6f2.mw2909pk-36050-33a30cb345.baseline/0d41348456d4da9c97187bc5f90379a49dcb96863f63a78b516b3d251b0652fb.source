"use client";

import { useEffect, useReducer } from "react";

/**
 * 全局单例朗读播放器：同一时刻只播一段音频，
 * 各组件通过 activeKey 感知谁在播，再次点击即停止。
 */
let audioEl: HTMLAudioElement | null = null;
let activeKey: string | null = null;
let loadingKey: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function stopSpeaking() {
  if (audioEl) {
    audioEl.pause();
    audioEl = null;
  }
  activeKey = null;
  loadingKey = null;
  notify();
}

export function useTts() {
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, [force]);

  async function speak(key: string, text: string, lang?: string) {
    if (activeKey === key) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    loadingKey = key;
    notify();

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) {
        let msg = "朗读失败";
        try {
          msg = (await res.json()).error ?? msg;
        } catch {
          /* 非 JSON 响应 */
        }
        throw new Error(msg);
      }
      // 用户在等待期间点了别处/停止则放弃播放
      if (loadingKey !== key) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioEl = audio;
      loadingKey = null;
      activeKey = key;
      notify();

      const done = () => {
        if (audioEl === audio) {
          audioEl = null;
          activeKey = null;
          notify();
        }
        URL.revokeObjectURL(url);
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
    } catch (err) {
      loadingKey = null;
      if (activeKey === key) activeKey = null;
      notify();
      if (err instanceof Error && err.message.includes("play()")) {
        throw new Error("浏览器阻止了自动播放，请再点一次");
      }
      throw err;
    }
  }

  return { speak, stop: stopSpeaking, activeKey, loadingKey };
}
