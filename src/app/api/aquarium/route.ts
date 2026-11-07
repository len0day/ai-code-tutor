import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getAquarium,
  buyFish,
  buyFood,
  feedFish,
  getPlantSize,
  waterPlant,
  FISH_SPECIES,
  FOOD_PRICE,
  MAX_FISH,
  FEDS_TO_GROW,
  MAX_PLANT_SIZE,
} from "@/lib/aquarium";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const state = await getAquarium(user.id);
  const plantSize = await getPlantSize(user.id);
  return NextResponse.json({
    ...state,
    plantSize,
    species: FISH_SPECIES,
    foodPrice: FOOD_PRICE,
    maxFish: MAX_FISH,
    fedsToGrow: FEDS_TO_GROW,
    maxPlantSize: MAX_PLANT_SIZE,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  let body: { action?: string; species?: string; qty?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  let result: { ok: boolean; error?: string } = { ok: true };
  if (body.action === "buy-fish") {
    result = await buyFish(user.id, String(body.species ?? ""));
  } else if (body.action === "buy-food") {
    result = await buyFood(user.id, Number(body.qty ?? 1));
  } else if (body.action === "feed") {
    result = await feedFish(user.id);
  } else if (body.action === "water") {
    await waterPlant(user.id);
  } else {
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "操作失败" }, { status: 400 });
  }
  const state = await getAquarium(user.id);
  const plantSize = await getPlantSize(user.id);
  return NextResponse.json({
    ...state,
    plantSize,
    species: FISH_SPECIES,
    foodPrice: FOOD_PRICE,
    maxFish: MAX_FISH,
    fedsToGrow: FEDS_TO_GROW,
    maxPlantSize: MAX_PLANT_SIZE,
  });
}
