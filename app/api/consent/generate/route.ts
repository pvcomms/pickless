import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { kv, NS } from "@/lib/kv";
import type { TasteProfile } from "@/app/api/taste-profile/route";

export type ConsentToken = {
  prefs: {
    loves: string[];
    avoids: string[];
    budgetBand: { lo: number; hi: number; currency: string };
    archetype: string;
  };
  scope: string;
  spendCap: number;
  expiresAt: number;
  used: boolean;
};

const TTL = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const {
    userId,
    scope = "any",
    spendCap,
  } = (await req.json()) as {
    userId?: string;
    scope?: string;
    spendCap?: number;
  };

  // Pull taste profile if we have a userId
  let prefs: ConsentToken["prefs"] = {
    loves: [],
    avoids: [],
    budgetBand: { lo: 0, hi: 1000, currency: "INR" },
    archetype: "undiscovered palette",
  };

  if (userId) {
    const db = kv();
    if (db) {
      const stored = await db.get<{ profile: TasteProfile }>(
        `${NS}user:${userId}`,
      );
      if (stored?.profile) {
        const p = stored.profile;
        prefs = {
          loves: p.loves ?? [],
          avoids: p.avoids ?? [],
          budgetBand: p.budgetBand ?? { lo: 0, hi: 1000, currency: "INR" },
          archetype: p.archetype ?? "undiscovered palette",
        };
      }
    }
  }

  const cap =
    spendCap ?? (prefs.budgetBand.hi > 0 ? prefs.budgetBand.hi : 1000);
  const token = randomBytes(8).toString("hex"); // 16-char hex, 64-bit space
  const expiresAt = Date.now() + TTL * 1000;

  const record: ConsentToken = {
    prefs,
    scope,
    spendCap: cap,
    expiresAt,
    used: false,
  };

  const db = kv();
  if (db) {
    await db.set(`${NS}consent:${token}`, record, { ex: TTL });
  }

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://picklessai.vercel.app";
  const verifyUrl = `${base}/consent/scan?t=${token}`;

  return NextResponse.json({
    token,
    verifyUrl,
    expiresAt,
    prefs,
    scope,
    spendCap: cap,
  });
}
