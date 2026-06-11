import { NextRequest, NextResponse } from "next/server";

/**
 * ─── PROXY ROTATION ENDPOINT ─────────────────────────────────────────────────
 * Routes .ts segment requests to CF Workers
 * CF Worker handles per-segment rotation internally via M3U8 rewrite
 */

const DEFAULT_PROXY_WORKER = "https://muddy-grass-267d.piracya.workers.dev/";

export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  
  let tsUrl = searchParams.get("url");
  
  if (!tsUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Ensure tsUrl is absolute
  if (!tsUrl.startsWith('http')) {
    tsUrl = `https://example.com${tsUrl.startsWith('/') ? '' : '/'}${tsUrl}`;
  }

  // Route to default worker (CF Worker M3U8 rewrite already handles rotation)
  const proxiedUrl = `${DEFAULT_PROXY_WORKER}ts-proxy?url=${encodeURIComponent(tsUrl)}&headers=${encodeURIComponent(JSON.stringify({}))}`;

  // Redirect to the worker
  return NextResponse.redirect(proxiedUrl, { status: 307 });
};
