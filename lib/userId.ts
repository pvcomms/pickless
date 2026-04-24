const KEY = "pickless_user_id";

export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function setUserId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, id);
}

export function newId(): string {
  // 8-char base36 — ~2.8e12 space, short enough to type, hard enough to guess
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}
