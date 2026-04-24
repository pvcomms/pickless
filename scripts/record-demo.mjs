/**
 * Pickless end-to-end agent demo recording.
 * Drives picklessai.vercel.app from landing → pick → heart → sync badge → /me/{id}.
 * Saves webm to ./videos/ + converts to mp4.
 *
 * Run: node scripts/record-demo.mjs
 */
import { chromium } from "playwright";
import { mkdir, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SITE = process.env.SITE || "https://picklessai.vercel.app";
const OUT_DIR = path.resolve("videos");
const FINAL = path.join(OUT_DIR, "pickless-demo.mp4");

async function pause(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
    permissions: ["geolocation"],
    geolocation: { latitude: 12.9784, longitude: 77.6408 }, // Indiranagar
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });

  // Seed state so the demo has something to show (loved dish, prior orders).
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        "pickless_location",
        JSON.stringify({
          lat: 12.9784,
          lng: 77.6408,
          city: "Bangalore",
          neighborhood: "Indiranagar",
          country: "India",
          countryCode: "IN",
        }),
      );
      localStorage.setItem("pickless_connected", JSON.stringify(["swiggy"]));
      localStorage.setItem(
        "pickless_prefs",
        JSON.stringify({
          diet: "any",
          cuisines: ["Indian"],
          vibe: "treat",
          spice: "medium",
          budgetMax: 600,
          dontEat: [],
        }),
      );
      localStorage.setItem(
        "pickless_loved",
        JSON.stringify([
          {
            dish: "Chicken Biryani",
            restaurant: "Meghana Foods",
            savedAt: new Date().toISOString(),
          },
        ]),
      );
    } catch {}
  });

  const page = await ctx.newPage();
  const log = (msg) => console.log(`[demo] ${msg}`);

  // ───── 1. Landing page ─────
  log("landing");
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pause(3500);
  await page.mouse.wheel(0, 400);
  await pause(1800);
  await page.mouse.wheel(0, 400);
  await pause(1800);
  await page.mouse.wheel(0, -800);
  await pause(1000);

  // ───── 2. /app ─────
  log("app (idle phase)");
  await page.goto(`${SITE}/app`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  // Let predict-picks auto-load
  await pause(5000);

  // Click a mood (cozy)
  log("mood: cozy");
  const cozy = page.getByRole("button", { name: /cozy/i }).first();
  if (await cozy.isVisible().catch(() => false)) {
    await cozy.click();
  }
  await pause(1200);

  // Wait for predict cards to (re-)bake. Look for either dish text or Safe label.
  log("waiting for 3 pre-baked cards");
  try {
    await page.waitForSelector("text=/SAFE|SMART|WILD/i", { timeout: 25000 });
    await pause(500);
    // also wait for actual dish text beyond just the label
    await page.waitForFunction(
      () => {
        const labels = ["Safe", "Smart", "Wild"];
        return labels.some((l) => {
          const btn = [...document.querySelectorAll("button")].find(
            (b) => b.textContent && b.textContent.includes(l),
          );
          return btn && btn.textContent.length > 30;
        });
      },
      { timeout: 30000 },
    );
  } catch {}

  await pause(3500); // let viewer read the 3 cards

  // Scroll so cards + chips are framed
  await page.evaluate(() => window.scrollTo(0, 200));
  await pause(1500);

  // Click a budget chip to show live re-bake
  log("click budget chip ≤ ₹500");
  const budgetBtn = page.locator("button", { hasText: /^≤ ₹500$/ }).first();
  if (await budgetBtn.isVisible().catch(() => false)) {
    await budgetBtn.click();
    await pause(4000); // wait for re-bake
  }

  // Click the Safe card
  log("click Safe card");
  const safeCard = page.locator("button", { hasText: /Safe/i }).first();
  if (await safeCard.isVisible().catch(() => false)) {
    await safeCard.click();
  }
  await pause(1500);

  // Reveal phase
  log("reveal phase");
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(3500);

  // Heart the dish
  log("heart");
  const heart = page.getByRole("button", { name: /love this|loved/i }).first();
  if (await heart.isVisible().catch(() => false)) {
    await heart.click();
  }
  await pause(2500);

  // Open taste-sync badge
  log("open taste sync badge");
  const badge = page.locator("button", { hasText: /^Taste · /i }).first();
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  } else {
    // scroll to top in case it's off-screen
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(500);
    await page
      .locator("button", { hasText: /^Taste · /i })
      .first()
      .click()
      .catch(() => {});
  }
  await pause(3500);

  // Extract the shareable URL shown in the dropdown and navigate there to
  // demo the portable /me/{id} hydration flow.
  log("navigate to /me/{id}");
  const myUrl = await page.evaluate(() => {
    const id = localStorage.getItem("pickless_user_id");
    return id ? `/me/${id}` : null;
  });
  if (myUrl) {
    await page.goto(`${SITE}${myUrl}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await pause(5000);
  }

  // ───── 4. /consent ─────
  log("consent pass");
  await page.goto(`${SITE}/consent`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await pause(4500);

  log("done, closing context");
  await page.close();
  await ctx.close();
  await browser.close();

  // Find the webm playwright wrote and rename/convert
  const files = await readdir(OUT_DIR);
  const webms = files
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(OUT_DIR, f));
  if (webms.length === 0) {
    console.error("no webm recorded");
    process.exit(1);
  }
  const webm = webms[webms.length - 1];
  console.log(`[demo] webm: ${webm}`);

  const ff = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webm,
      "-c:v",
      "libx264",
      "-crf",
      "20",
      "-preset",
      "slow",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-vf",
      "scale=1280:800:flags=lanczos",
      FINAL,
    ],
    { stdio: "inherit" },
  );
  if (ff.status !== 0) {
    console.error("ffmpeg failed");
    process.exit(1);
  }

  // Copy to Desktop for easy grab
  const desk = `/Users/p/Desktop/pickless-demo.mp4`;
  await rename(FINAL, desk).catch(async () => {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(FINAL, desk);
  });
  console.log(`[demo] mp4: ${desk}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
