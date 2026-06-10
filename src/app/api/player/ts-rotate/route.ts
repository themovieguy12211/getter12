import { NextRequest, NextResponse } from "next/server";

/**
 * ─── PROXY ROTATION ENDPOINT ─────────────────────────────────────────────────
 * Routes .ts segment requests through different CF Workers
 * Switches proxies every 50 segments to avoid rate limiting on single proxy
 */

const PROXY_WORKERS = [
  "https://cdn.piracy.cloud/",
  "https://muddy-grass-267d.piracya.workers.dev/",
  "https://small-cake-fdee.piracya.workers.dev/",
  "https://holy-math-0b13.piracya.workers.dev/",
];

const SEGMENTS_PER_PROXY = 50;

export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  
  let tsUrl = searchParams.get("url");
  const segmentIndex = parseInt(searchParams.get("seg") || "0", 10);
  
  if (!tsUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Calculate which proxy to use: rotates every 50 segments
  const proxyIndex = Math.floor(segmentIndex / SEGMENTS_PER_PROXY) % PROXY_WORKERS.length;
  const selectedProxy = PROXY_WORKERS[proxyIndex];

  // Ensure tsUrl is absolute
  if (!tsUrl.startsWith('http')) {
    tsUrl = `https://example.com${tsUrl.startsWith('/') ? '' : '/'}${tsUrl}`;
  }

  // Build the proxied URL
  const proxiedUrl = `${selectedProxy}ts-proxy?url=${encodeURIComponent(tsUrl)}&headers=${encodeURIComponent(JSON.stringify({}))}`;

  // Redirect to the selected proxy worker
  return NextResponse.redirect(proxiedUrl, { status: 307 });
};
