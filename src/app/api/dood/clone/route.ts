import { NextRequest, NextResponse } from "next/server";
import { cloneFromTmdb, cloneDoodFile, doodFileCode } from "@/utils/doodClone";

export const runtime = "nodejs";

// POST /api/dood/clone
// Body: { tmdbId: "60233" }  OR  { doodUrl: "https://dood.watch/d/xxxx" }  OR  { fileCode: "xxxx" }
// Optional: { folderId: "0" }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.tmdbId) {
      const r = await cloneFromTmdb(String(body.tmdbId), {
        folderId: body.folderId ? String(body.folderId) : undefined,
        type: body.type === "tv" ? "tv" : "movie",
      });
      return NextResponse.json(r);
    }

    if (body.doodUrl) {
      const code = doodFileCode(String(body.doodUrl));
      if (!code) return NextResponse.json({ error: "Could not parse dood URL" }, { status: 400 });
      const result = await cloneDoodFile(code, body.folderId ? String(body.folderId) : undefined);
      return NextResponse.json({ fileCode: code, result });
    }

    if (body.fileCode) {
      const result = await cloneDoodFile(String(body.fileCode), body.folderId ? String(body.folderId) : undefined);
      return NextResponse.json({ fileCode: String(body.fileCode), result });
    }

    return NextResponse.json({ error: "Pass tmdbId, doodUrl, or fileCode" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
