import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/utils/admin";
import { sendNewEmbedNotification } from "@/utils/discord";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminRoute();
  if (adminCheck.response) return adminCheck.response;

  const { adminSupabase } = adminCheck.context;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  let query = adminSupabase
    .from("custom_embeds" as any)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (search) {
    query = query.or(
      `media_id.eq.${Number(search) || 0},title.ilike.%${search}%,embed_url.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminRoute();
  if (adminCheck.response) return adminCheck.response;

  const { adminSupabase } = adminCheck.context;
  const body = await request.json();

  const { media_type, media_id, season, episode, title, embed_url } = body;

  if (!media_type || !media_id || !embed_url) {
    return NextResponse.json(
      { error: "media_type, media_id, and embed_url are required" },
      { status: 400 },
    );
  }

  const { data, error } = await adminSupabase
    .from("custom_embeds" as any)
    .insert({
      media_type,
      media_id: Number(media_id),
      season: season ? Number(season) : null,
      episode: episode ? Number(episode) : null,
      title: title || "Abyss",
      embed_url,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  sendNewEmbedNotification({
    media_type,
    media_id: Number(media_id),
    season: season ? Number(season) : null,
    episode: episode ? Number(episode) : null,
    title: title || "Abyss",
    embed_url,
  }).catch(() => {});

  return NextResponse.json({ message: "Embed created", data });
}
