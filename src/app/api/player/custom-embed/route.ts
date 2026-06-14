import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const id = params.get("id");
  const season = params.get("season");
  const episode = params.get("episode");

  if (!type || !id) {
    return NextResponse.json({ embeds: [] });
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("custom_embeds" as any)
    .select("title, embed_url")
    .eq("media_type", type)
    .eq("media_id", Number(id))
    .eq("active", true);

  if (type === "tv" && season && episode) {
    query = query.eq("season", Number(season)).eq("episode", Number(episode));
  }

  const { data } = await query;

  return NextResponse.json({
    embeds: (data ?? []).map((row: any) => ({ title: row.title, url: row.embed_url })),
  });
}
