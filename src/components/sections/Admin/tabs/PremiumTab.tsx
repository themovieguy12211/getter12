"use client";

import { addToast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AdminDashboardResponse } from "../types";
import { formatCompactId, formatDateTime } from "../types";

async function createPremiumCode(input: {
  code: string;
  plan: "monthly" | "yearly";
  duration_days: number;
  max_redemptions: number;
  expires_at?: string | null;
}): Promise<{ message: string }> {
  const response = await fetch("/api/admin/premium-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to create premium code");
  }
  return response.json();
}

async function updatePremiumCode(input: {
  id: number;
  active?: boolean;
  expires_at?: string | null;
  max_redemptions?: number;
}): Promise<{ message: string }> {
  const response = await fetch(`/api/admin/premium-codes/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Failed to update premium code");
  }
  return response.json();
}

type Props = {
  dashboard: AdminDashboardResponse | undefined;
};

const PremiumTab: React.FC<Props> = ({ dashboard }) => {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [days, setDays] = useState("30");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  const createMutation = useMutation({
    mutationFn: createPremiumCode,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      setCode("");
      setPlan("monthly");
      setDays("30");
      setMaxRedemptions("1");
      setExpiresAt("");
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  const updateMutation = useMutation({
    mutationFn: updatePremiumCode,
    onSuccess: async ({ message }) => {
      addToast({ title: message, color: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: Error) => addToast({ title: error.message, color: "danger" }),
  });

  return (
    <>
      <h2 className="mb-4">Premium</h2>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Create Code</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Code</label>
                <input
                  className="form-control"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="MTH-XXXX-YYYY"
                />
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label">Plan</label>
                  <select
                    className="form-select"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as "monthly" | "yearly")}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">Days</label>
                  <input
                    className="form-control"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  />
                </div>
              </div>
              <div className="row g-2 mt-1">
                <div className="col-6">
                  <label className="form-label">Max Redemptions</label>
                  <input
                    className="form-control"
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label">Expiry</label>
                  <input
                    className="form-control"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary w-100 mt-3"
                disabled={createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    code,
                    plan,
                    duration_days: Number(days),
                    max_redemptions: Number(maxRedemptions),
                    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                  })
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Code"}
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Premium Codes</h5>
              <span className="badge bg-primary">
                {dashboard?.data.premium.codes.length ?? 0}
              </span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Plan</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard?.data.premium.codes.length ? (
                    dashboard.data.premium.codes.map((c) => (
                      <tr key={c.id}>
                        <td className="fw-semibold">{c.code}</td>
                        <td>{c.plan}</td>
                        <td>
                          {c.redemption_count}/{c.max_redemptions}
                        </td>
                        <td>
                          <span className={`badge ${c.active ? "bg-success" : "bg-danger"}`}>
                            {c.active ? "active" : "inactive"}
                          </span>
                        </td>
                        <td>{formatDateTime(c.expires_at)}</td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${c.active ? "btn-outline-danger" : "btn-outline-success"}`}
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: c.id, active: !c.active })}
                          >
                            {c.active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-body-secondary">
                        No premium codes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Redemptions</h5>
              <span className="badge bg-primary">
                {dashboard?.data.premium.redemptions.length ?? 0}
              </span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Code ID</th>
                    <th>Plan</th>
                    <th>Days</th>
                    <th>Redeemed</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard?.data.premium.redemptions.length ? (
                    dashboard.data.premium.redemptions.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="fw-semibold">{r.username ?? "Unknown"}</div>
                          <small className="text-body-secondary">
                            {r.user_email ?? formatCompactId(r.user_id)}
                          </small>
                        </td>
                        <td>{r.code_id}</td>
                        <td>{r.applied_plan}</td>
                        <td>{r.applied_days}</td>
                        <td>{formatDateTime(r.redeemed_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-body-secondary">
                        No redemptions.
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

export default PremiumTab;
