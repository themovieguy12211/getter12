import { NextRequest, NextResponse } from "next/server";

/**
 * ─── M3U8 SEGMENT ROTATION PROXY ────────────────────────────────────────────
 * Fetches M3U8 from source and rewrites segment URLs to route through ts-rotate
 * This enables proxy rotation every 50 segments
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36";

export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  
  const m3u8ProxyUrl = searchParams.get("url");
  if (!m3u8ProxyUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Fetch the M3U8 from the proxy
    const response = await fetch(m3u8ProxyUrl, {
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch M3U8: ${response.status}` },
        { status: response.status }
      );
    }

    let m3u8Content = await response.text();

    // Get the origin for absolute URL construction
    const origin = request.nextUrl.origin;

    // Rewrite segment URLs to route through ts-rotate distributor
    let segmentIndex = 0;
    const lines = m3u8Content.split('\n');
    const modifiedLines = lines.map((line) => {
      // Skip metadata and comments
      if (line.startsWith('#')) return line;
      
      // Check if this is a segment URL (relative or absolute)
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Could be a relative URL or absolute URL
        let segmentUrl = trimmed;
        
        // If relative, resolve against the M3U8 base URL
        if (!segmentUrl.startsWith('http')) {
          try {
            const baseUrl = new URL(m3u8ProxyUrl);
            const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
            segmentUrl = `${baseUrl.protocol}//${baseUrl.host}${basePath}${segmentUrl}`;
          } catch {
            return line;
          }
        }
        
        // Route through our ts-rotate distributor with absolute URL
        const rotateUrl = `${origin}/api/player/ts-rotate?url=${encodeURIComponent(segmentUrl)}&seg=${segmentIndex}`;
        segmentIndex++;
        return rotateUrl;
      }
      
      return line;
    });

    const modifiedM3u8 = modifiedLines.join('\n');

    return new NextResponse(modifiedM3u8, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[M3U8 Rotate] Error:", error);
    return NextResponse.json(
      { error: "Failed to process M3U8" },
      { status: 500 }
    );
  }
};
