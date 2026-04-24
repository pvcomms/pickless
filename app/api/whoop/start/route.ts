import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { stateKey, WHOOP_SCOPES } from "@/lib/whoop";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u")?.trim();
  if (!u || !/^[a-z0-9]{4,32}$/i.test(u)) {
    return NextResponse.json({ error: "missing user id" }, { status: 400 });
  }
  const clientId = process.env.WHOOP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "whoop not configured" },
      { status: 503 },
    );
  }

  // Random state binding pickless userId to OAuth callback
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const state = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    const k = new Redis({ url, token });
    await k.set(stateKey(state), { picklessUserId: u }, { ex: 600 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/whoop/callback`;
  const authUrl = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", WHOOP_SCOPES);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
