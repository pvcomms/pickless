/**
 * Pickless reels-format demo (9:16, ~25s).
 * Records at iPhone-ish viewport (430x932) then ffmpeg-scales to 1080x1920.
 * Output: ~/Desktop/pickless-reels.mp4
 *
 * Run: node scripts/record-reels.mjs
 */
import { chromium, devices } from "playwright";
import { mkdir, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SITE = process.env.SITE || "https://picklessai.vercel.app";
const OUT_DIR = path.resolve("videos");
const FINAL = path.join(OUT_DIR, "pickless-reels.mp4");
const DESK = `/Users/p/Desktop/pickless-reels.mp4`;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const VW = 430;
  const VH = 932;

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const ctx = await browser.newContext({
    ...devices["iPhone 14 Pro Max"],
    viewport: { width: VW, height: VH },
    recordVideo: { dir: OUT_DIR, size: { width: VW, height: VH } },
    permissions: ["geolocation"],
    geolocation: { latitude: 12.9784, longitude: 77.6408 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });

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
      // Suppress PWA install nag in recordings — it hugs the bottom on mobile
      // and crops every frame.
      localStorage.setItem("pickless_install_dismissed", "1");
    } catch {}
  });

  const page = await ctx.newPage();
  const log = (m) => console.log(`[reels] ${m}`);

  // 1. Landing — 3s hero
  log("landing");
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pause(3000);

  // 2. /app — wait for predict cards, 5s
  log("/app");
  await page.goto(`${SITE}/app`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  // Let it settle + predict-picks to bake
  try {
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

  // Scroll to show mood + cards
  await page.evaluate(() => window.scrollTo(0, 150));
  await pause(2800);

  // 3. Click Safe card
  log("click Safe");
  const safe = page.locator("button", { hasText: /Safe/i }).first();
  if (await safe.isVisible().catch(() => false)) {
    await safe.click();
  }
  await pause(500);

  // 4. Reveal — scroll to top + hold 3.5s
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(3500);

  // 5. Heart it
  log("heart");
  const heart = page.getByRole("button", { name: /love this|loved/i }).first();
  if (await heart.isVisible().catch(() => false)) {
    await heart.click();
  }
  await pause(1800);

  // 6. /me portable URL (the money shot for the thesis)
  log("/me");
  const myUrl = await page.evaluate(() => {
    const id = localStorage.getItem("pickless_user_id");
    return id ? `/me/${id}` : null;
  });
  if (myUrl) {
    await page.goto(`${SITE}${myUrl}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await pause(4200);
  }

  // 7. /consent — close with the protocol artifact
  log("/consent");
  await page.goto(`${SITE}/consent`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await pause(3500);

  log("done, closing");
  await page.close();
  await ctx.close();
  await browser.close();

  const files = await readdir(OUT_DIR);
  const webms = files
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(OUT_DIR, f));
  if (webms.length === 0) {
    console.error("no webm recorded");
    process.exit(1);
  }
  const webm = webms[webms.length - 1];
  console.log(`[reels] webm: ${webm}`);

  // Scale 430x932 → 1080x1920 (maintain aspect, pad if slight mismatch).
  // 1080/430 = 2.512..., 1920/932 = 2.060..., so we scale to fit height
  // and pad black bars left/right. But 430:932 == 0.4614, 1080:1920 = 0.5625,
  // so padding sides is needed. Actually scale-then-pad via ffmpeg filter:
  const ff = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webm,
      "-c:v",
      "libx264",
      "-crf",
      "19",
      "-preset",
      "slow",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-vf",
      // Input 430x932 is taller aspect than 1080x1920 output.
      // Fit to height 1920 then pad left/right with ink color.
      // Pad with the warm paper bg so sides don't read as "black bars"
      "scale=-2:1920:flags=lanczos,pad=1080:1920:(ow-iw)/2:0:color=0xF7F6F3",
      "-r",
      "30",
      FINAL,
    ],
    { stdio: "inherit" },
  );
  if (ff.status !== 0) {
    console.error("ffmpeg failed");
    process.exit(1);
  }

  await rename(FINAL, DESK).catch(async () => {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(FINAL, DESK);
  });
  console.log(`[reels] mp4: ${DESK}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
