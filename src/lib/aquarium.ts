import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";
import { spendXp } from "./store";

/**
 * 鱼缸玩法：用 XP 购买鱼 / 鱼食，喂食让鱼长大。
 * 数据存于 aquarium_fish（每条鱼）与 aquarium_state（鱼食库存）。
 */

export interface FishSpecies {
  species: string;
  name: string;
  emoji: string;
  price: number;
}

export const FISH_SPECIES: FishSpecies[] = [
  { species: "guppy", name: "小蓝鱼", emoji: "🐠", price: 20 },
  { species: "goldfish", name: "小金鱼", emoji: "🐟", price: 40 },
  { species: "puffer", name: "小河豚", emoji: "🐡", price: 80 },
  { species: "shark", name: "鲨鱼宝宝", emoji: "🦈", price: 150 },
  { species: "whale", name: "小鲸鱼", emoji: "🐋", price: 300 },
];

export const FOOD_PRICE = 10;
/** 每喂 3 次鱼长大一号（上限 5 号） */
export const FEDS_TO_GROW = 3;
export const MAX_FISH = 12;

export interface AquariumFish {
  id: string;
  species: string;
  size: number;
  fedCount: number;
  createdAt: string;
}

export interface AquariumState {
  fish: AquariumFish[];
  food: number;
  xp: number;
}

/** 取鱼缸状态（鱼 + 鱼食 + 当前 XP）；首次访问自动建栏并送一份鱼食 */
export async function getAquarium(userId: string): Promise<AquariumState> {
  const db = await getDb();
  const existing = await db.get<{ food: number }>(
    "SELECT food FROM aquarium_state WHERE user_id = $userId",
    { userId }
  );
  if (!existing) {
    await db.run(
      "INSERT INTO aquarium_state (user_id, food) VALUES ($userId, 1)",
      { userId }
    );
  }
  const rows = await db.all<{
    id: string;
    species: string;
    size: number;
    fed_count: number;
    created_at: string;
  }>(
    "SELECT id, species, size, fed_count, created_at FROM aquarium_fish WHERE user_id = $userId ORDER BY created_at ASC",
    { userId }
  );
  const stat = await db.get<{ xp: number }>(
    "SELECT xp FROM user_stats WHERE user_id = $userId",
    { userId }
  );
  return {
    fish: rows.map((r) => ({
      id: r.id,
      species: r.species,
      size: r.size,
      fedCount: r.fed_count,
      createdAt: r.created_at,
    })),
    food: existing?.food ?? 1,
    xp: stat?.xp ?? 0,
  };
}

/** 买鱼：扣 XP 并入缸 */
export async function buyFish(
  userId: string,
  species: string
): Promise<{ ok: boolean; error?: string }> {
  const sp = FISH_SPECIES.find((s) => s.species === species);
  if (!sp) return { ok: false, error: "没有这种鱼" };
  const db = await getDb();
  const count = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM aquarium_fish WHERE user_id = $userId",
    { userId }
  );
  if ((count?.n ?? 0) >= MAX_FISH) {
    return { ok: false, error: `鱼缸最多养 ${MAX_FISH} 条鱼` };
  }
  const spent = await spendXp(userId, sp.price);
  if (!spent) return { ok: false, error: "XP 不够，先去多学几课吧" };
  await db.run(
    "INSERT INTO aquarium_fish (id, user_id, species, size, fed_count, created_at) VALUES ($id, $userId, $species, 1, 0, $createdAt)",
    {
      id: crypto.randomUUID(),
      userId,
      species,
      createdAt: new Date().toISOString(),
    }
  );
  return { ok: true };
}

/** 买鱼食：扣 XP，鱼食 +qty */
export async function buyFood(
  userId: string,
  qty = 1
): Promise<{ ok: boolean; error?: string }> {
  const q = Math.floor(qty);
  if (!Number.isFinite(q) || q < 1 || q > 10) {
    return { ok: false, error: "一次买 1~10 份" };
  }
  const spent = await spendXp(userId, q * FOOD_PRICE);
  if (!spent) return { ok: false, error: "XP 不够，先去多学几课吧" };
  const db = await getDb();
  await db.run(
    `INSERT INTO aquarium_state (user_id, food, last_fed_at) VALUES ($userId, $qty, NULL)
     ON CONFLICT (user_id) DO UPDATE SET food = aquarium_state.food + $qty`,
    { userId, qty: q }
  );
  return { ok: true };
}

/** 喂食：消耗一份鱼食，所有鱼 +1 饱食度（每 3 次长大一号） */
export async function feedFish(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const state = await db.get<{ food: number }>(
    "SELECT food FROM aquarium_state WHERE user_id = $userId",
    { userId }
  );
  if (!state || state.food <= 0) {
    return { ok: false, error: "没有鱼食了，先买一份" };
  }
  await db.run(
    "UPDATE aquarium_state SET food = food - 1, last_fed_at = $at WHERE user_id = $userId",
    { at: new Date().toISOString(), userId }
  );
  await db.run(
    `UPDATE aquarium_fish
     SET fed_count = fed_count + 1,
         size = MIN(5, 1 + (fed_count + 1) / ${FEDS_TO_GROW})
     WHERE user_id = $userId`,
    { userId }
  );
  return { ok: true };
}

// ---- 房间树苗：浇水长大（1~5 号） ----

export const MAX_PLANT_SIZE = 5;

/** 取树苗大小（首次访问自动建栏，默认 1 号） */
export async function getPlantSize(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ plant_size: number }>(
    "SELECT plant_size FROM room_state WHERE user_id = $userId",
    { userId }
  );
  if (!row) {
    await db.run("INSERT INTO room_state (user_id, plant_size) VALUES ($userId, 1)", {
      userId,
    });
    return 1;
  }
  return row.plant_size;
}

/** 浇水：树苗长大一号（上限 5 号），返回新大小 */
export async function waterPlant(userId: string): Promise<number> {
  const db = await getDb();
  const size = await getPlantSize(userId);
  const next = Math.min(MAX_PLANT_SIZE, size + 1);
  if (next !== size) {
    await db.run(
      "UPDATE room_state SET plant_size = $size WHERE user_id = $userId",
      { size: next, userId }
    );
  }
  return next;
}
