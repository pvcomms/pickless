import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "Gmail not configured. Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET on Vercel.",
      },
      { status: 503 },
    );
  }
  const state = crypto.randomUUID();
  const url = buildAuthUrl(req, state);
  const res = NextResponse.redirect(url);
  res.cookies.set("pickless_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
