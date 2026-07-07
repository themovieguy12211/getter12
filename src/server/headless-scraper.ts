/**
 * Headless browser scraper — visits SPA sites, extracts stream URLs from network requests.
 * Runs on Coolify with just `playwright` npm package + `npx playwright install chromium`.
 */

import { chromium, Browser, BrowserContext } from "playwright";

interface ScrapeTarget {
  name: string;
  movieUrl: (tmdbId: string) => string;
  tvUrl: (tmdbId: string, season: string, episode: string) => string;
}

interface ScrapeResult {
  target: string;
  url: string;
  label: string;
}

const TARGETS: ScrapeTarget[] = [
  // Stream Aggregators
  { name: "popcornmovies", movieUrl: (id) => `https://popcornmovies.io/watch/movie/${id}`, tvUrl: (id, s, e) => `https://popcornmovies.io/watch/tv/${id}?s=${s}&e=${e}` },
  { name: "arrowtv", movieUrl: (id) => `https://arrowtv.net/watch/movie/${id}`, tvUrl: (id, s, e) => `https://arrowtv.net/watch/tv/${id}/${s}/${e}` },
  { name: "rivestream", movieUrl: (id) => `https://www.rivestream.app/watch?type=movie&id=${id}`, tvUrl: (id, s, e) => `https://www.rivestream.app/watch?type=tv&id=${id}&season=${s}&episode=${e}` },
  { name: "cineby", movieUrl: (id) => `https://cineby.at/movie/${id}`, tvUrl: (id, s, e) => `https://cineby.at/tv/${id}/${s}/${e}` },
  { name: "cineplay", movieUrl: (id) => `https://www.cineplay.to/movie/${id}`, tvUrl: (id, s, e) => `https://www.cineplay.to/tv/${id}/${s}/${e}` },
  { name: "fmovies", movieUrl: (id) => `https://www.fmovies.gd/movie/${id}`, tvUrl: (id, s, e) => `https://www.fmovies.gd/tv/${id}/${s}/${e}` },
  { name: "bingebox", movieUrl: (id) => `https://bingebox.to/movie/${id}`, tvUrl: (id, s, e) => `https://bingebox.to/tv/${id}/${s}/${e}` },
  { name: "corsflix", movieUrl: (id) => `https://watch.corsflix.net/movie/${id}`, tvUrl: (id, s, e) => `https://watch.corsflix.net/tv/${id}/${s}/${e}` },
  { name: "flixer", movieUrl: (id) => `https://flixer.su/movie/${id}`, tvUrl: (id, s, e) => `https://flixer.su/tv/${id}/${s}/${e}` },
  { name: "hexa", movieUrl: (id) => `https://hexa.su/movie/${id}`, tvUrl: (id, s, e) => `https://hexa.su/tv/${id}/${s}/${e}` },
  { name: "meowtv", movieUrl: (id) => `https://meowtv.ru/movie/${id}`, tvUrl: (id, s, e) => `https://meowtv.ru/tv/${id}/${s}/${e}` },
  { name: "cinemora", movieUrl: (id) => `https://cinemora.ru/movie/${id}`, tvUrl: (id, s, e) => `https://cinemora.ru/tv/${id}/${s}/${e}` },
  { name: "67movies", movieUrl: (id) => `https://67movies.net/movie/${id}`, tvUrl: (id, s, e) => `https://67movies.net/tv/${id}/${s}/${e}` },
  { name: "coreflix", movieUrl: (id) => `https://coreflix.tv/movie/${id}`, tvUrl: (id, s, e) => `https://coreflix.tv/tv/${id}/${s}/${e}` },
  { name: "bcine", movieUrl: (id) => `https://bcine.ru/movie/${id}`, tvUrl: (id, s, e) => `https://bcine.ru/tv/${id}/${s}/${e}` },
  { name: "cinemabz", movieUrl: (id) => `https://cinema.bz/movie/${id}`, tvUrl: (id, s, e) => `https://cinema.bz/tv/${id}/${s}/${e}` },
  { name: "cinevibe", movieUrl: (id) => `https://cinevibe.asia/movie/${id}`, tvUrl: (id, s, e) => `https://cinevibe.asia/tv/${id}/${s}/${e}` },
  { name: "cinezo", movieUrl: (id) => `https://www.cinezo.net/movie/${id}`, tvUrl: (id, s, e) => `https://www.cinezo.net/tv/${id}/${s}/${e}` },
  { name: "flikhub", movieUrl: (id) => `https://www.flikhub.net/movie/${id}`, tvUrl: (id, s, e) => `https://www.flikhub.net/tv/${id}/${s}/${e}` },
  { name: "vyla", movieUrl: (id) => `https://vyla.cc/movie/${id}`, tvUrl: (id, s, e) => `https://vyla.cc/tv/${id}/${s}/${e}` },
  { name: "cinetaro", movieUrl: (id) => `https://cinetaro.tv/movie/${id}`, tvUrl: (id, s, e) => `https://cinetaro.tv/tv/${id}/${s}/${e}` },
  { name: "shuttletv", movieUrl: (id) => `https://shuttletv.su/movie/${id}`, tvUrl: (id, s, e) => `https://shuttletv.su/tv/${id}/${s}/${e}` },
  { name: "cinegram", movieUrl: (id) => `https://cinegram.tv/movie/${id}`, tvUrl: (id, s, e) => `https://cinegram.tv/tv/${id}/${s}/${e}` },
  { name: "stigstream", movieUrl: (id) => `https://stigstream.ru/movie/${id}`, tvUrl: (id, s, e) => `https://stigstream.ru/tv/${id}/${s}/${e}` },
  { name: "lunara", movieUrl: (id) => `https://lunara.watch/movie/${id}`, tvUrl: (id, s, e) => `https://lunara.watch/tv/${id}/${s}/${e}` },
  { name: "goated", movieUrl: (id) => `https://goated.cx/movie/${id}`, tvUrl: (id, s, e) => `https://goated.cx/tv/${id}/${s}/${e}` },
  { name: "willow", movieUrl: (id) => `https://willowmovies.com/movie/${id}`, tvUrl: (id, s, e) => `https://willowmovies.com/tv/${id}/${s}/${e}` },
  { name: "overlook", movieUrl: (id) => `https://overlook.cx/movie/${id}`, tvUrl: (id, s, e) => `https://overlook.cx/tv/${id}/${s}/${e}` },
  { name: "frame", movieUrl: (id) => `https://frameweb.pages.dev/movie/${id}`, tvUrl: (id, s, e) => `https://frameweb.pages.dev/tv/${id}/${s}/${e}` },
  { name: "sanuflix", movieUrl: (id) => `https://sanuflix2.pages.dev/movie/${id}`, tvUrl: (id, s, e) => `https://sanuflix2.pages.dev/tv/${id}/${s}/${e}` },
  { name: "netplay", movieUrl: (id) => `https://netplayz.top/movie/${id}`, tvUrl: (id, s, e) => `https://netplayz.top/tv/${id}/${s}/${e}` },
  { name: "smovies", movieUrl: (id) => `https://smovies.co/movie/${id}`, tvUrl: (id, s, e) => `https://smovies.co/tv/${id}/${s}/${e}` },
  { name: "vidplay", movieUrl: (id) => `https://vidplay.to/movie/${id}`, tvUrl: (id, s, e) => `https://vidplay.to/tv/${id}/${s}/${e}` },
  // Dedicated-Server
  { name: "nepu", movieUrl: (id) => `https://nepu.to/movie/${id}`, tvUrl: (id, s, e) => `https://nepu.to/tv/${id}/${s}/${e}` },
  { name: "ee3", movieUrl: (id) => `https://ee3.me/movie/${id}`, tvUrl: (id, s, e) => `https://ee3.me/tv/${id}/${s}/${e}` },
  { name: "rips", movieUrl: (id) => `https://rips.cc/movie/${id}`, tvUrl: (id, s, e) => `https://rips.cc/tv/${id}/${s}/${e}` },
  { name: "bingr", movieUrl: (id) => `https://bingr.live/movie/${id}`, tvUrl: (id, s, e) => `https://bingr.live/tv/${id}/${s}/${e}` },
  { name: "watchflix", movieUrl: (id) => `https://watchflix.to/movie/${id}`, tvUrl: (id, s, e) => `https://watchflix.to/tv/${id}/${s}/${e}` },
  { name: "cinestream", movieUrl: (id) => `https://cinestream.kje.us/movie/${id}`, tvUrl: (id, s, e) => `https://cinestream.kje.us/tv/${id}/${s}/${e}` },
  { name: "cinemacity", movieUrl: (id) => `https://cinemacity.cc/movie/${id}`, tvUrl: (id, s, e) => `https://cinemacity.cc/tv/${id}/${s}/${e}` },
  { name: "ridomovies", movieUrl: (id) => `https://ridomovies.is/movie/${id}`, tvUrl: (id, s, e) => `https://ridomovies.is/tv/${id}/${s}/${e}` },
  { name: "azmovies", movieUrl: (id) => `https://azmovies.to/movie/${id}`, tvUrl: (id, s, e) => `https://azmovies.to/tv/${id}/${s}/${e}` },
  { name: "onionplay", movieUrl: (id) => `https://onionplay.io/movie/${id}`, tvUrl: (id, s, e) => `https://onionplay.io/tv/${id}/${s}/${e}` },
  { name: "showbox", movieUrl: (id) => `https://www.showbox.media/movie/${id}`, tvUrl: (id, s, e) => `https://www.showbox.media/tv/${id}/${s}/${e}` },
  { name: "uniquestream", movieUrl: (id) => `https://uniquestream.net/movie/${id}`, tvUrl: (id, s, e) => `https://uniquestream.net/tv/${id}/${s}/${e}` },
  { name: "bflix", movieUrl: (id) => `https://bflix.sh/movie/${id}`, tvUrl: (id, s, e) => `https://bflix.sh/tv/${id}/${s}/${e}` },
  { name: "fsharetv", movieUrl: (id) => `https://fsharetv.co/movie/${id}`, tvUrl: (id, s, e) => `https://fsharetv.co/tv/${id}/${s}/${e}` },
  { name: "m4uhd", movieUrl: (id) => `https://m4uhd.vip/movie/${id}`, tvUrl: (id, s, e) => `https://m4uhd.vip/tv/${id}/${s}/${e}` },
  { name: "levidia", movieUrl: (id) => `https://www.levidia.ch/movie/${id}`, tvUrl: (id, s, e) => `https://www.levidia.ch/tv/${id}/${s}/${e}` },
  { name: "primewire", movieUrl: (id) => `https://www.primewire.mov/movie/${id}`, tvUrl: (id, s, e) => `https://www.primewire.mov/tv/${id}/${s}/${e}` },
  { name: "yesmovie", movieUrl: (id) => `https://ww1.yesmovies.ag/movie/${id}`, tvUrl: (id, s, e) => `https://ww1.yesmovies.ag/tv/${id}/${s}/${e}` },
  { name: "projectfreetv", movieUrl: (id) => `https://projectfreetv.sx/movie/${id}`, tvUrl: (id, s, e) => `https://projectfreetv.sx/tv/${id}/${s}/${e}` },
  { name: "hollymoviehd", movieUrl: (id) => `https://hollymoviehd.cc/movie/${id}`, tvUrl: (id, s, e) => `https://hollymoviehd.cc/tv/${id}/${s}/${e}` },
  { name: "lookmovie2", movieUrl: (id) => `https://lookmovie2.to/movies/view/${id}`, tvUrl: (id, s, e) => `https://lookmovie2.to/tv/view/${id}` },
  { name: "playimdb", movieUrl: (id) => `https://playimdb.domains/movie/${id}`, tvUrl: (id, s, e) => `https://playimdb.domains/tv/${id}/${s}/${e}` },
  { name: "movienestbd", movieUrl: (id) => `https://movienestbd.pics/movie/${id}`, tvUrl: (id, s, e) => `https://movienestbd.pics/tv/${id}/${s}/${e}` },
];

let browser: Browser | null = null;
let isRunning = false;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

async function scrapeTarget(
  context: BrowserContext,
  target: ScrapeTarget,
  url: string,
): Promise<ScrapeResult[]> {
  const page = await context.newPage();
  const streams: ScrapeResult[] = [];

  try {
    // Intercept network responses to catch m3u8/mp4 URLs
    page.on("response", async (response) => {
      const reqUrl = response.url();
      const ct = response.headers()["content-type"] || "";
      if (
        reqUrl.includes("master.m3u8") ||
        reqUrl.includes(".m3u8") ||
        ct.includes("mpegurl") ||
        ct.includes("vnd.apple.mpegurl") ||
        (reqUrl.includes(".mp4") && ct.includes("video"))
      ) {
        streams.push({ target: target.name, url: reqUrl, label: target.name });
      }
    });

    // Navigate and wait for video/iframe to appear
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

    // Wait a bit for dynamic players to load
    await page.waitForTimeout(3000);

    // Try clicking play buttons or iframe elements
    const iframes = await page.$$("iframe");
    for (const iframe of iframes) {
      const src = await iframe.getAttribute("src");
      if (src?.includes("embed") || src?.includes("player") || src?.includes("video")) {
        try {
          // Navigate into the iframe
          const frame = await iframe.contentFrame();
          if (frame) {
            const frameUrl = frame.url();
            if (frameUrl.includes("m3u8") || frameUrl.includes("mp4")) {
              streams.push({ target: target.name, url: frameUrl, label: target.name });
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn(`[Headless] ${target.name} failed:`, (err as Error).message);
  } finally {
    await page.close();
  }

  return streams;
}

/**
 * Scrape all configured SPA targets for a given movie/TV show.
 * Returns stream URLs found by intercepting network requests.
 */
export async function scrapeHeadless(
  tmdbId: string,
  type: "movie" | "tv",
  season?: string,
  episode?: string,
  limit?: number,
): Promise<ScrapeResult[]> {
  if (isRunning) {
    console.log("[Headless] Already running, skipping");
    return [];
  }
  isRunning = true;
  try {
    return await doScrape(tmdbId, type, season, episode, limit);
  } finally {
    isRunning = false;
  }
}

async function doScrape(
  tmdbId: string,
  type: "movie" | "tv",
  season?: string,
  episode?: string,
  limit?: number,
): Promise<ScrapeResult[]> {
  const browser = await getBrowser();
  const results: ScrapeResult[] = [];

  const targets = limit ? TARGETS.slice(0, limit) : TARGETS;
  const urls = targets.map((t) => ({
    target: t,
    url:
      type === "movie"
        ? t.movieUrl(tmdbId)
        : t.tvUrl(tmdbId, season || "1", episode || "1"),
  }));

  // Scrape 4 targets at a time to limit memory usage
  console.log(`[Headless] Starting scrape of ${urls.length} targets for ${type} ${tmdbId}`);
  const startTime = Date.now();

  for (let i = 0; i < urls.length; i += 4) {
    const batch = urls.slice(i, i + 4);
    const batchResults = await Promise.allSettled(
      batch.map(async ({ target, url }) => {
        const t0 = Date.now();
        console.log(`[Headless] → ${target.name}: opening...`);
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        });
        try {
          const r = await scrapeTarget(context, target, url);
          console.log(`[Headless] ← ${target.name}: ${r.length} streams (${Date.now() - t0}ms)`);
          return r;
        } catch (err) {
          console.warn(`[Headless] ✗ ${target.name}: ${(err as Error).message}`);
          return [];
        } finally {
          await context.close();
        }
      }),
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(...r.value);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  console.log(`[Headless] Done: ${deduped.length} unique streams from ${urls.length} targets (${Date.now() - startTime}ms)`);
  return deduped;
}

/**
 * Clean up the browser instance.
 */
export async function closeHeadless(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
