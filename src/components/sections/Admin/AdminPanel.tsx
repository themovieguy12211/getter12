"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { RewardRequestStatus } from "@/types/rewards";
import AdminSidebar from "./AdminSidebar";
import type { AdminDashboardResponse, AdminTab, RewardsApiResponse } from "./types";
import OverviewTab from "./tabs/OverviewTab";
import UsersTab from "./tabs/UsersTab";
import CommunityTab from "./tabs/CommunityTab";
import PremiumTab from "./tabs/PremiumTab";
import ActivityTab from "./tabs/ActivityTab";
import RewardsTab from "./tabs/RewardsTab";
import EmbedsTab from "./tabs/EmbedsTab";
import PlaymateTab from "./tabs/PlaymateTab";

async function fetchDashboard(search: string): Promise<AdminDashboardResponse> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(
    `/api/admin/dashboard${params.toString() ? `?${params.toString()}` : ""}`,
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("Failed to load admin dashboard");
  return response.json();
}

async function fetchRewardRequests(
  status: RewardRequestStatus | "all",
  search: string,
): Promise<RewardsApiResponse> {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(
    `/api/admin/rewards${params.toString() ? `?${params.toString()}` : ""}`,
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("Failed to load reward requests");
  return response.json();
}

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [rewardStatus, setRewardStatus] = useState<RewardRequestStatus | "all">("all");

  const { data: dashboard, isFetching } = useQuery({
    queryKey: ["admin-dashboard", search],
    queryFn: () => fetchDashboard(search),
  });

  const { data: rewards } = useQuery({
    queryKey: ["admin-reward-requests", rewardStatus, search],
    queryFn: () => fetchRewardRequests(rewardStatus, search),
  });

  return (
    <>
      <header className="navbar sticky-top bg-dark flex-md-nowrap p-0 shadow" data-bs-theme="dark">
        <a className="navbar-brand col-md-3 col-lg-2 me-0 px-3 fs-6 text-white" href="/admin">
          321movies Admin
        </a>
        <input
          className="form-control form-control-dark w-100 rounded-0 border-0"
          type="text"
          placeholder="Search users, emails, IDs..."
          aria-label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="navbar-nav">
          <div className="nav-item text-nowrap">
            {isFetching && (
              <span className="nav-link px-3 text-white-50 small">Loading...</span>
            )}
          </div>
        </div>
      </header>

      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="admin-main-content">
        <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
          <h1 className="h2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
        </div>

        {activeTab === "overview" && <OverviewTab dashboard={dashboard} rewards={rewards} />}
        {activeTab === "users" && <UsersTab dashboard={dashboard} />}
        {activeTab === "community" && <CommunityTab dashboard={dashboard} />}
        {activeTab === "premium" && <PremiumTab dashboard={dashboard} />}
        {activeTab === "activity" && <ActivityTab dashboard={dashboard} />}
        {activeTab === "rewards" && (
          <RewardsTab
            dashboard={dashboard}
            rewards={rewards}
            rewardStatus={rewardStatus}
            onStatusChange={setRewardStatus}
          />
        )}
        {activeTab === "embeds" && <EmbedsTab />}
        {activeTab === "playmate" && <PlaymateTab />}
      </div>
    </>
  );
};

export default AdminPanel;
