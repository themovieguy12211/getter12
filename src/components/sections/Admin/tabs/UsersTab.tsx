"use client";

import { addToast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { AdminDashboardResponse } from "../types";
import { formatCompactId, formatDateTime } from "../types";

async function updateAdminUser(input: {
  id: string;
  is_admin?: boolean;
  username?: string;
}): Promise<{ message: string }> {
  const response = await fetch(`/api/admin/users/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to update user");
  }
  return response.json();
}

type Props = {
  dashboard: AdminDashboardResponse | undefined;
};

const UsersTab: React.FC<Props> = ({ dashboard }) => {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userEditUsername, setUserEditUsername] = useState("");
  const [userEditAdmin, setUserEditAdmin] = useState(false);

  const selectedUser = useMemo(
    () => dashboard?.data.users.find((u) => u.id === selectedUserId) ?? null,
    [dashboard, selectedUserId],
  );

  const userMutation = useMutation({
    mutationFn: updateAdminUser,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  return (
    <>
      <h2 className="mb-4">Users</h2>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">All Users</h5>
              <span className="badge bg-primary">{dashboard?.data.users.length ?? 0}</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Last Sign In</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard?.data.users.length ? (
                    dashboard.data.users.map((user) => (
                      <tr
                        key={user.id}
                        role="button"
                        className={selectedUserId === user.id ? "table-primary" : undefined}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setUserEditUsername(user.username ?? "");
                          setUserEditAdmin(user.is_admin);
                        }}
                      >
                        <td>
                          <div className="fw-semibold">{user.username ?? "No username"}</div>
                          <small className="text-body-secondary">
                            {user.email ?? formatCompactId(user.id)}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`badge ${user.is_admin ? "bg-success" : "bg-secondary"}`}
                          >
                            {user.is_admin ? "admin" : "member"}
                          </span>
                        </td>
                        <td>{formatDateTime(user.created_at)}</td>
                        <td>{formatDateTime(user.last_sign_in_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-body-secondary">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Edit User</h5>
            </div>
            <div className="card-body">
              {selectedUser ? (
                <>
                  <div className="alert alert-secondary">
                    <div className="fw-semibold">{selectedUser.email ?? "No email"}</div>
                    <small>{formatCompactId(selectedUser.id)}</small>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="user-username" className="form-label">
                      Username
                    </label>
                    <input
                      id="user-username"
                      className="form-control"
                      value={userEditUsername}
                      onChange={(e) => setUserEditUsername(e.target.value)}
                    />
                  </div>
                  <div className="form-check mb-3">
                    <input
                      id="user-admin"
                      className="form-check-input"
                      type="checkbox"
                      checked={userEditAdmin}
                      onChange={(e) => setUserEditAdmin(e.target.checked)}
                    />
                    <label htmlFor="user-admin" className="form-check-label">
                      Admin access
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    disabled={userMutation.isPending}
                    onClick={() =>
                      userMutation.mutate({
                        id: selectedUser.id,
                        username: userEditUsername.trim(),
                        is_admin: userEditAdmin,
                      })
                    }
                  >
                    {userMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <p className="text-body-secondary mb-0">Select a user from the table to edit.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UsersTab;
