import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { setTokens, stateKey, type WhoopTokens } from "@/lib/whoop";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(`${req.nextUrl.origin}/connect?whoop=error`);
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return NextResponse.redirect(`${req.nextUrl.origin}/connect?whoop=no-kv`);
  }
  const k = new Redis({ url, token });
  const binding = await k.get<{ picklessUserId: string }>(stateKey(state));
  if (!binding?.picklessUserId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/connect?whoop=state`);
  }
  await k.del(stateKey(state));

  const redirectUri = `${req.nextUrl.origin}/api/whoop/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
  });
  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[whoop callback] token exchange failed", res.status, txt);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/connect?whoop=token_${res.status}`,
    );
  }
  const d = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  const tokens: WhoopTokens = {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresAt: Date.now() + (d.expires_in - 60) * 1000,
    scope: d.scope,
  };
  await setTokens(binding.picklessUserId, tokens);
  return NextResponse.redirect(`${req.nextUrl.origin}/connect?whoop=connected`);
}
