"use client";

import { addToast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AdminDashboardResponse } from "../types";
import { formatCompactId, formatDateTime } from "../types";

async function deleteComment(commentId: number): Promise<{ message: string }> {
  const response = await fetch(`/api/admin/comments/${commentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to delete comment");
  }
  return response.json();
}

async function deletePartyRoom(code: string): Promise<{ message: string }> {
  const response = await fetch(`/api/admin/party-rooms/${code}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to delete party room");
  }
  return response.json();
}

type SubTab = "comments" | "ratings" | "parties";

type Props = {
  dashboard: AdminDashboardResponse | undefined;
};

const CommunityTab: React.FC<Props> = ({ dashboard }) => {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>("comments");

  const commentDeleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  const partyDeleteMutation = useMutation({
    mutationFn: deletePartyRoom,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  return (
    <>
      <h2 className="mb-4">Community</h2>

      {/* Sub-navigation */}
      <ul className="nav nav-tabs mb-4">
        {(["comments", "ratings", "parties"] as SubTab[]).map((tab) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link ${subTab === tab ? "active" : ""}`}
              onClick={() => setSubTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          </li>
        ))}
      </ul>

      {subTab === "comments" && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Comments</h5>
            <span className="badge bg-primary">
              {dashboard?.data.community.comments.length ?? 0}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Media</th>
                  <th>Comment</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.data.community.comments.length ? (
                  dashboard.data.community.comments.map((comment) => (
                    <tr key={comment.id}>
                      <td>
                        <div className="fw-semibold">{comment.username ?? "Unknown"}</div>
                        <small className="text-body-secondary">
                          {comment.user_email ?? formatCompactId(comment.user_id)}
                        </small>
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {comment.media_type} #{comment.media_id}
                        </span>
                      </td>
                      <td style={{ maxWidth: 300 }} className="text-truncate">
                        {comment.content}
                      </td>
                      <td>{formatDateTime(comment.created_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={commentDeleteMutation.isPending}
                          onClick={() => commentDeleteMutation.mutate(comment.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-body-secondary">
                      No comments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "ratings" && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Ratings</h5>
            <span className="badge bg-primary">
              {dashboard?.data.community.ratings.length ?? 0}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Media</th>
                  <th>Rating</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.data.community.ratings.length ? (
                  dashboard.data.community.ratings.map((rating) => (
                    <tr key={`${rating.user_id}-${rating.media_id}-${rating.media_type}`}>
                      <td>
                        <div className="fw-semibold">{rating.username ?? "Unknown"}</div>
                        <small className="text-body-secondary">
                          {rating.user_email ?? formatCompactId(rating.user_id)}
                        </small>
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {rating.media_type} #{rating.media_id}
                        </span>
                      </td>
                      <td className="fw-semibold">{rating.rating}/10</td>
                      <td>{formatDateTime(rating.updated_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-5 text-body-secondary">
                      No ratings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "parties" && (
        <div className="row g-3">
          <div className="col-xl-7">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Party Rooms</h5>
                <span className="badge bg-primary">
                  {dashboard?.data.parties.rooms.length ?? 0}
                </span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Host</th>
                      <th>Media</th>
                      <th>Expires</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard?.data.parties.rooms.length ? (
                      dashboard.data.parties.rooms.map((room) => (
                        <tr key={room.code}>
                          <td className="fw-semibold">{room.code}</td>
                          <td>
                            <div className="fw-semibold">{room.host_username ?? "Unknown"}</div>
                            <small className="text-body-secondary">
                              {room.host_email ?? formatCompactId(room.host_id)}
                            </small>
                          </td>
                          <td style={{ maxWidth: 220 }} className="text-truncate">
                            {room.media_title}
                          </td>
                          <td>{formatDateTime(room.expires_at)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={partyDeleteMutation.isPending}
                              onClick={() => partyDeleteMutation.mutate(room.code)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-body-secondary">
                          No party rooms.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="col-xl-5">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">Recent Messages</h5>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>User</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard?.data.parties.messages.length ? (
                      dashboard.data.parties.messages.map((msg) => (
                        <tr key={msg.id}>
                          <td>{msg.room_code}</td>
                          <td>
                            <div className="fw-semibold">{msg.username}</div>
                            <small className="text-body-secondary">
                              {msg.user_email ?? "Guest"}
                            </small>
                          </td>
                          <td style={{ maxWidth: 240 }} className="text-truncate">
                            {msg.content}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-5 text-body-secondary">
                          No messages.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommunityTab;
