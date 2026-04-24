// Gmail OAuth + receipt fetcher.
// Pulls Swiggy + Zomato receipt emails from the user's Gmail and extracts
// real order history. Parsing is delegated to Gemini for robustness across
// the many subtly-different receipt templates these companies use.

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function envOrThrow(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing env: ${k}`);
  return v;
}

export function getRedirectUri(req: Request): string {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  const url = new URL(req.url);
  return `${url.origin}/api/gmail/callback`;
}

export function buildAuthUrl(req: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: envOrThrow("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: SCOPE,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_OAUTH_URL}?${params}`;
}

export async function exchangeCode(
  req: Request,
  code: string,
): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    code,
    client_id: envOrThrow("GOOGLE_CLIENT_ID"),
    client_secret: envOrThrow("GOOGLE_CLIENT_SECRET"),
    redirect_uri: getRedirectUri(req),
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${await res.text()}`);
  return res.json();
}

// Multi-pass Gmail search: combine sender-filter (precise receipts) +
// keyword-filter (broad food signal — restaurant names, delivery brands,
// dish keywords). Lets us pick up forwarded receipts, group orders, expense
// reports etc. that don't come from the official sender domain.
const SENDER_QUERY =
  "from:(noreply@swiggy.in OR no-reply@swiggy.in OR feedback@swiggy.in OR noreply@zomato.com OR no-reply@zomato.com OR feedback@zomato.com OR orders@zomato.com OR no-reply@swish.swiggy.com OR no-reply@blinkit.com OR no-reply@dunzo.com OR no-reply@deliveroo.co.uk OR no-reply@uber.com OR receipts@uber.com OR no-reply@doordash.com)";

const KEYWORD_QUERY =
  '(("order placed" OR "order confirmed" OR "order delivered" OR "order summary" OR "your order" OR "thanks for ordering" OR "ordered from") AND (swiggy OR zomato OR blinkit OR swish OR dunzo OR uber OR deliveroo OR doordash OR biryani OR pizza OR burger OR thali))';

export async function listReceiptIds(accessToken: string): Promise<string[]> {
  const queries = [
    `${SENDER_QUERY} newer_than:180d`,
    `${KEYWORD_QUERY} newer_than:180d`,
  ];
  const seen = new Set<string>();
  await Promise.all(
    queries.map(async (q) => {
      const res = await fetch(
        `${GMAIL_API}/messages?q=${encodeURIComponent(q)}&maxResults=25`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return;
      const data = await res.json();
      for (const m of data.messages || []) seen.add(m.id);
    }),
  );
  return [...seen].slice(0, 30);
}

export type RawMessage = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  bodyText: string;
};

function decodeBase64Url(s: string): string {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      return decoded
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return decoded.replace(/\s+/g, " ").trim();
  }
  for (const part of payload.parts || []) {
    const text = extractBody(part);
    if (text) return text;
  }
  return "";
}

export async function fetchMessage(
  accessToken: string,
  id: string,
): Promise<RawMessage | null> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const headers = (data.payload?.headers || []) as {
    name: string;
    value: string;
  }[];
  const get = (n: string) =>
    headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
  return {
    id,
    from: get("from"),
    subject: get("subject"),
    date: get("date"),
    snippet: data.snippet || "",
    bodyText: extractBody(data.payload).slice(0, 4000),
  };
}

export async function fetchReceiptCorpus(
  accessToken: string,
): Promise<RawMessage[]> {
  const ids = await listReceiptIds(accessToken);
  const messages = await Promise.all(
    ids.map((id) => fetchMessage(accessToken, id)),
  );
  return messages.filter((m): m is RawMessage => m !== null);
}
