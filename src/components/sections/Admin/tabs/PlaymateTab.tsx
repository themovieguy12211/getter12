"use client";

import { useState } from "react";

interface PendingFile {
  filecode: string;
  name: string;
  uploaded: string;
  parsed: {
    title: string;
    year: number | null;
    season: number | null;
    episode: number | null;
    type: "movie" | "tv";
  };
}

interface SyncResult {
  filecode: string;
  name: string;
  status: "created" | "skipped" | "no_match" | "error";
  tmdb_id?: number;
  embed_id?: number;
  reason?: string;
}

const PlaymateTab = () => {
  const [pending, setPending] = useState<PendingFile[] | null>(null);
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/admin/playmate-sync", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setPending(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/playmate-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResults(data.results ?? []);
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = (status: SyncResult["status"]) => {
    const map: Record<string, string> = {
      created: "success",
      skipped: "secondary",
      no_match: "warning",
      error: "danger",
    };
    return <span className={`badge bg-${map[status] ?? "secondary"}`}>{status}</span>;
  };

  return (
    <div>
      <div className="d-flex gap-2 mb-4">
        <button className="btn btn-outline-secondary" onClick={fetchPending} disabled={loading || syncing}>
          {loading ? <><span className="spinner-border spinner-border-sm me-2" />Scanning...</> : <><i className="bi bi-search me-2" />Scan for new files</>}
        </button>
        <button className="btn btn-primary" onClick={runSync} disabled={loading || syncing}>
          {syncing ? <><span className="spinner-border spinner-border-sm me-2" />Syncing...</> : <><i className="bi bi-lightning-charge me-2" />Run sync now</>}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {pending !== null && (
        <div className="mb-4">
          <h5 className="mb-3">
            {pending.length === 0
              ? "No new files — everything is already synced."
              : `${pending.length} unsynced file${pending.length !== 1 ? "s" : ""} found`}
          </h5>
          {pending.length > 0 && (
            <table className="table table-sm table-dark table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Parsed title</th>
                  <th>Type</th>
                  <th>S / E</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((f) => (
                  <tr key={f.filecode}>
                    <td className="text-truncate" style={{ maxWidth: 220 }}>{f.name}</td>
                    <td>{f.parsed.title || <span className="text-danger">—</span>}</td>
                    <td><span className={`badge bg-${f.parsed.type === "tv" ? "info" : "primary"}`}>{f.parsed.type}</span></td>
                    <td>{f.parsed.season != null ? `S${f.parsed.season} E${f.parsed.episode}` : "—"}</td>
                    <td className="text-white-50 small">{f.uploaded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {results !== null && (
        <div>
          <h5 className="mb-3">
            Sync complete —{" "}
            <span className="text-success">{results.filter((r) => r.status === "created").length} created</span>
            {results.filter((r) => r.status !== "created").length > 0 && (
              <>, <span className="text-warning">{results.filter((r) => r.status !== "created").length} skipped/failed</span></>
            )}
          </h5>
          <table className="table table-sm table-dark table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>TMDB ID</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.filecode}>
                  <td className="text-truncate" style={{ maxWidth: 260 }}>{r.name}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>{r.tmdb_id ?? "—"}</td>
                  <td className="text-white-50 small">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlaymateTab;
