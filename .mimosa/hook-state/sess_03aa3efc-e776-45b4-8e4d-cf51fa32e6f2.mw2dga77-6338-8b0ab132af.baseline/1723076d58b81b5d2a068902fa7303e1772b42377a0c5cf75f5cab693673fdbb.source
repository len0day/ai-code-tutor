"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface Me {
  id: string;
  username: string;
  role: "admin" | "user";
}

let cachedMe: Me | null | undefined;
let mePromise: Promise<Me | null> | null = null;

/** 拉取当前登录用户（模块级缓存，退出登录时重置） */
export function fetchMe(): Promise<Me | null> {
  if (!mePromise) {
    mePromise = fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        cachedMe = d.user;
        return d.user as Me | null;
      })
      .catch(() => null);
  }
  return mePromise;
}

export function resetMeCache() {
  cachedMe = undefined;
  mePromise = null;
}

/**
 * me === undefined：加载中
 * me === null：未登录
 */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(() => cachedMe);
  useEffect(() => {
    fetchMe().then(setMe);
  }, []);
  return me;
}

/** 需要登录的页面：未登录自动跳 /login */
export function useRequireUser(): Me | null | undefined {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me === null) router.replace("/login");
  }, [me, router]);
  return me;
}

/** 需要管理员的页面：未登录跳 /login，非管理员跳首页 */
export function useRequireAdmin(): Me | null | undefined {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me === null) router.replace("/login");
    else if (me && me.role !== "admin") router.replace("/");
  }, [me, router]);
  return me;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  resetMeCache();
}
