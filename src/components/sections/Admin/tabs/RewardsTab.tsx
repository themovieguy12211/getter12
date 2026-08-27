"use client";

import { addToast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { RewardRequestStatus } from "@/types/rewards";
import type { AdminDashboardResponse, RewardsApiResponse } from "../types";
import { formatCompactId, formatDateTime, formatUsd } from "../types";

const STATUS_OPTIONS: Array<{ id: RewardRequestStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "fulfilled", label: "Fulfilled" },
];

async function updateRewardRequest(input: {
  id: number;
  status: RewardRequestStatus;
  admin_notes?: string;
  payout_reference?: string;
}): Promise<{ message: string }> {
  const response = await fetch(`/api/admin/rewards/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to update request");
  }
  return response.json();
}

async function adjustRewardAccount(input: {
  username: string;
  points: number;
  reason: string;
}): Promise<{ message: string }> {
  const response = await fetch("/api/admin/rewards/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to adjust account");
  }
  return response.json();
}

type Props = {
  dashboard: AdminDashboardResponse | undefined;
  rewards: RewardsApiResponse | undefined;
  rewardStatus: RewardRequestStatus | "all";
  onStatusChange: (status: RewardRequestStatus | "all") => void;
};

const RewardsTab: React.FC<Props> = ({ dashboard, rewards, rewardStatus, onStatusChange }) => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [adjustUsername, setAdjustUsername] = useState("");
  const [adjustPoints, setAdjustPoints] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");

  const selectedRequest = useMemo(
    () => rewards?.data.find((r) => r.id === selectedId) ?? null,
    [rewards, selectedId],
  );

  const rewardMutation = useMutation({
    mutationFn: updateRewardRequest,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      setAdminNotes("");
      setPayoutReference("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reward-requests"] }),
      ]);
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  const adjustMutation = useMutation({
    mutationFn: adjustRewardAccount,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      setAdjustUsername("");
      setAdjustPoints("0");
      setAdjustReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reward-requests"] }),
      ]);
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  const handleAction = (status: RewardRequestStatus) => {
    if (!selectedRequest) return;
    rewardMutation.mutate({
      id: selectedRequest.id,
      status,
      admin_notes: adminNotes.trim() || undefined,
      payout_reference: payoutReference.trim() || undefined,
    });
  };

  const rewardPointsBalance =
    dashboard?.data.rewards.accounts.reduce((sum, a) => sum + a.points_balance, 0) ?? 0;
  const rewardRequestedUsd =
    rewards?.data.reduce((sum, r) => sum + Number(r.requested_value_usd ?? 0), 0) ?? 0;

  return (
    <>
      <h2 className="mb-4">Rewards</h2>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Pending</h6>
              <p className="card-text fs-4 fw-bold mb-0">{rewards?.summary.total_pending ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Points Live</h6>
              <p className="card-text fs-4 fw-bold mb-0">{rewardPointsBalance}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Accounts</h6>
              <p className="card-text fs-4 fw-bold mb-0">
                {dashboard?.summary.reward_accounts_total ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">USD Requested</h6>
              <p className="card-text fs-4 fw-bold mb-0">{formatUsd(rewardRequestedUsd)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          {/* Requests table */}
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Requests</h5>
              <div className="btn-group btn-group-sm">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`btn ${rewardStatus === opt.id ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => onStatusChange(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Points</th>
                    <th>USD</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards?.data.length ? (
                    rewards.data.map((req) => (
                      <tr
                        key={req.id}
                        role="button"
                        className={selectedId === req.id ? "table-primary" : undefined}
                        onClick={() => setSelectedId(req.id)}
                      >
                        <td className="fw-semibold">{req.id}</td>
                        <td>
                          <div className="fw-semibold">{req.username ?? "Unknown"}</div>
                          <small className="text-body-secondary">
                            {formatCompactId(req.user_id)}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              req.status === "pending"
                                ? "bg-warning text-dark"
                                : req.status === "approved" || req.status === "fulfilled"
                                  ? "bg-success"
                                  : "bg-danger"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td>{req.requested_points}</td>
                        <td>{formatUsd(Number(req.requested_value_usd))}</td>
                        <td>{formatDateTime(req.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-body-secondary">
                        No requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Accounts table */}
          <div className="card mt-3">
            <div className="card-header">
              <h5 className="card-title mb-0">Accounts</h5>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Referral Code</th>
                    <th>Balance</th>
                    <th>Earned</th>
                    <th>Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards?.summary.reward_accounts.length ? (
                    rewards.summary.reward_accounts.map((account) => (
                      <tr key={account.user_id}>
                        <td>
                          <div className="fw-semibold">{account.username ?? "Unknown"}</div>
                          <small className="text-body-secondary">
                            {formatCompactId(account.user_id)}
                          </small>
                        </td>
                        <td className="fw-semibold">{account.referral_code}</td>
                        <td>{account.points_balance}</td>
                        <td>{account.total_points_earned}</td>
                        <td>{account.total_points_spent}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-body-secondary">
                        No accounts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Review + Adjustment */}
        <div className="col-12 col-xl-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Review</h5>
            </div>
            <div className="card-body">
              {selectedRequest ? (
                <>
                  <div className="alert alert-secondary">
                    <div className="fw-semibold">Request #{selectedRequest.id}</div>
                    <small>
                      {selectedRequest.username ?? "Unknown"} ·{" "}
                      {formatCompactId(selectedRequest.user_id)}
                    </small>
                    <div className="mt-1">
                      <small>
                        {selectedRequest.requested_points} points ·{" "}
                        {formatUsd(Number(selectedRequest.requested_value_usd))}
                      </small>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Payout Reference</label>
                    <input
                      className="form-control"
                      value={payoutReference}
                      onChange={(e) => setPayoutReference(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Admin Notes</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>
                  <div className="d-grid gap-2">
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={rewardMutation.isPending}
                      onClick={() => handleAction("approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      disabled={rewardMutation.isPending}
                      onClick={() => handleAction("rejected")}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      disabled={rewardMutation.isPending}
                      onClick={() => handleAction("fulfilled")}
                    >
                      Mark Fulfilled
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-body-secondary mb-0">Select a request to review.</p>
              )}
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">
              <h5 className="card-title mb-0">Manual Adjustment</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Username</label>
                <input
                  className="form-control"
                  value={adjustUsername}
                  onChange={(e) => setAdjustUsername(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Points (+/-)</label>
                <input
                  className="form-control"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Reason</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={adjustMutation.isPending}
                onClick={() =>
                  adjustMutation.mutate({
                    username: adjustUsername.trim(),
                    points: Number(adjustPoints),
                    reason: adjustReason.trim(),
                  })
                }
              >
                {adjustMutation.isPending ? "Applying..." : "Apply Adjustment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RewardsTab;
