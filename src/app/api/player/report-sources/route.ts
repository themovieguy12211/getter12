import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

interface ReportBody {
    type: "movie" | "tv";
    id: string;
    season?: string;
    episode?: string;
    sources: Array<{
        type: "hls" | "mp4";
        file: string;
        label: string;
        provider?: string;
    }>;
}

const CLIENT_CACHE_ROOT = path.join(process.cwd(), "snapshots", "player_scrape_client_cache");

function buildKey(type: string, id: string, season?: string, episode?: string): string {
    const parts = [type, id];
    if (type === "tv") {
        parts.push(`s${season ?? "0"}`, `e${episode ?? "0"}`);
    }
    return parts.map(p => p.replace(/[^a-zA-Z0-9_-]+/g, "_")).join("_");
}

export const runtime = "nodejs";

export const POST = async (request: NextRequest) => {
    try {
        const body = (await request.json()) as ReportBody;

        if (!body.type || !body.id || !Array.isArray(body.sources)) {
            return NextResponse.json({ error: "Invalid body" }, { status: 400 });
        }

        const key = buildKey(body.type, body.id, body.season, body.episode);
        const filePath = path.join(CLIENT_CACHE_ROOT, `${key}.json`);

        await mkdir(CLIENT_CACHE_ROOT, { recursive: true });

        const entry = {
            cachedAt: new Date().toISOString(),
            sources: body.sources.map(s => ({
                type: s.type || "hls",
                file: s.file,
                label: s.label,
                default: false,
                provider: s.provider ? `client-${s.provider}` : "client",
            })),
        };

        await writeFile(filePath, JSON.stringify(entry, null, 2));

        return NextResponse.json({ ok: true, cached: body.sources.length });
    } catch (err) {
        console.error("[report-sources] Failed:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
};
