import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Keep-alive ping from Vercel cron (vercel.json -> /api/health every
// 5 minutes). The SELECT 1 round-trips Railway Postgres so the
// connection / instance doesn't sleep between user traffic.
export async function GET() {
  await db.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
