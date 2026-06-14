"use client";

import { useState } from "react";
import type { AdminDashboardResponse } from "../types";
import { formatCompactId, formatDateTime } from "../types";

type SubTab = "history" | "watchlist";

type Props = {
  dashboard: AdminDashboardResponse | undefined;
};

const ActivityTab: React.FC<Props> = ({ dashboard }) => {
  const [subTab, setSubTab] = useState<SubTab>("history");

  return (
    <>
      <h2 className="mb-4">Activity</h2>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${subTab === "history" ? "active" : ""}`}
            onClick={() => setSubTab("history")}
          >
            Watch History
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${subTab === "watchlist" ? "active" : ""}`}
            onClick={() => setSubTab("watchlist")}
          >
            Watchlist
          </button>
        </li>
      </ul>

      {subTab === "history" && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Recent Watch History</h5>
            <span className="badge bg-primary">
              {dashboard?.data.watch.histories.length ?? 0}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Progress</th>
                  <th>Completed</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.data.watch.histories.length ? (
                  dashboard.data.watch.histories.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <div className="fw-semibold">{h.username ?? "Unknown"}</div>
                        <small className="text-body-secondary">
                          {h.user_email ?? formatCompactId(h.user_id)}
                        </small>
                      </td>
                      <td style={{ maxWidth: 250 }} className="text-truncate">
                        {h.title}
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {h.type}
                          {h.type === "tv" ? ` S${h.season}E${h.episode}` : ""}
                        </span>
                      </td>
                      <td>
                        {Math.round(h.last_position)}/{Math.round(h.duration)}
                      </td>
                      <td>
                        <span className={`badge ${h.completed ? "bg-success" : "bg-warning"}`}>
                          {h.completed ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>{formatDateTime(h.updated_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-body-secondary">
                      No watch history.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "watchlist" && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Watchlist Entries</h5>
            <span className="badge bg-primary">
              {dashboard?.data.watch.watchlist.length ?? 0}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Rating</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.data.watch.watchlist.length ? (
                  dashboard.data.watch.watchlist.map((item) => (
                    <tr key={`${item.user_id}-${item.id}-${item.type}`}>
                      <td>
                        <div className="fw-semibold">{item.username ?? "Unknown"}</div>
                        <small className="text-body-secondary">
                          {item.user_email ?? formatCompactId(item.user_id)}
                        </small>
                      </td>
                      <td style={{ maxWidth: 250 }} className="text-truncate">
                        {item.title}
                      </td>
                      <td>
                        <span className="badge bg-secondary">{item.type}</span>
                      </td>
                      <td>{item.vote_average.toFixed(1)}</td>
                      <td>{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-body-secondary">
                      No watchlist entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};

export default ActivityTab;
