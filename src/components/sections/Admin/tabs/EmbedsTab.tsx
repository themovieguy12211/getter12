"use client";

import { addToast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type CustomEmbed = {
  id: number;
  media_type: "movie" | "tv";
  media_id: number;
  season: number | null;
  episode: number | null;
  title: string;
  embed_url: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

async function fetchEmbeds(search: string): Promise<{ data: CustomEmbed[] }> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const res = await fetch(
    `/api/admin/embeds${params.toString() ? `?${params}` : ""}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load embeds");
  return res.json();
}

async function createEmbed(input: {
  media_type: string;
  media_id: number;
  season?: number | null;
  episode?: number | null;
  title: string;
  embed_url: string;
}): Promise<{ message: string }> {
  const res = await fetch("/api/admin/embeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const p = await res.json().catch(() => null);
    throw new Error(p?.error ?? "Failed to create embed");
  }
  return res.json();
}

async function updateEmbed(input: {
  id: number;
  active?: boolean;
  embed_url?: string;
  title?: string;
}): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/embeds/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const p = await res.json().catch(() => null);
    throw new Error(p?.error ?? "Failed to update embed");
  }
  return res.json();
}

async function deleteEmbed(id: number): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/embeds/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const p = await res.json().catch(() => null);
    throw new Error(p?.error ?? "Failed to delete embed");
  }
  return res.json();
}

const EmbedsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [mediaId, setMediaId] = useState("");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [title, setTitle] = useState("Abyss");
  const [embedUrl, setEmbedUrl] = useState("");

  const { data: embedsData } = useQuery({
    queryKey: ["admin-embeds", search],
    queryFn: () => fetchEmbeds(search),
  });

  const createMutation = useMutation({
    mutationFn: createEmbed,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      setEmbedUrl("");
      if (mediaType === "tv" && episode) {
        setEpisode(String(Number(episode) + 1));
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-embeds"] });
    },
    onError: (err: Error) => addToast({ title: err.message, color: "danger" }),
  });

  const updateMutation = useMutation({
    mutationFn: updateEmbed,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-embeds"] });
    },
    onError: (err: Error) => addToast({ title: err.message, color: "danger" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmbed,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-embeds"] });
    },
    onError: (err: Error) => addToast({ title: err.message, color: "danger" }),
  });

  const embeds = embedsData?.data ?? [];

  return (
    <>
      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Add Custom Embed</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as "movie" | "tv")}
                >
                  <option value="movie">Movie</option>
                  <option value="tv">TV Show</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">TMDB ID</label>
                <input
                  className="form-control"
                  value={mediaId}
                  onChange={(e) => setMediaId(e.target.value)}
                  placeholder="e.g. 550"
                />
              </div>
              {mediaType === "tv" && (
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label">Season</label>
                    <input
                      className="form-control"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Episode</label>
                    <input
                      className="form-control"
                      value={episode}
                      onChange={(e) => setEpisode(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Player Title</label>
                <input
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Embed URL</label>
                <input
                  className="form-control"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://abyss.to/embed/..."
                />
              </div>
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={createMutation.isPending || !mediaId || !embedUrl}
                onClick={() =>
                  createMutation.mutate({
                    media_type: mediaType,
                    media_id: Number(mediaId),
                    season: season ? Number(season) : null,
                    episode: episode ? Number(episode) : null,
                    title,
                    embed_url: embedUrl,
                  })
                }
              >
                {createMutation.isPending ? "Adding..." : "Add Embed"}
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Custom Embeds</h5>
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: 200 }}
                placeholder="Filter by TMDB ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>TMDB ID</th>
                    <th>S/E</th>
                    <th>Title</th>
                    <th>Embed URL</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {embeds.length ? (
                    embeds.map((embed) => (
                      <tr key={embed.id}>
                        <td>
                          <span className="badge bg-secondary">{embed.media_type}</span>
                        </td>
                        <td className="fw-semibold">{embed.media_id}</td>
                        <td>
                          {embed.media_type === "tv"
                            ? `S${embed.season ?? "?"}E${embed.episode ?? "?"}`
                            : "—"}
                        </td>
                        <td>{embed.title}</td>
                        <td style={{ maxWidth: 250 }} className="text-truncate">
                          <a
                            href={embed.embed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-info"
                          >
                            {embed.embed_url}
                          </a>
                        </td>
                        <td>
                          <span className={`badge ${embed.active ? "bg-success" : "bg-danger"}`}>
                            {embed.active ? "active" : "disabled"}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className={`btn ${embed.active ? "btn-outline-warning" : "btn-outline-success"}`}
                              disabled={updateMutation.isPending}
                              onClick={() =>
                                updateMutation.mutate({ id: embed.id, active: !embed.active })
                              }
                            >
                              {embed.active ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(embed.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-5 text-body-secondary">
                        No custom embeds yet. Add one from the left panel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmbedsTab;
