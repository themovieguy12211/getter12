"use client";

import type { AdminDashboardResponse, RewardsApiResponse } from "../types";
import { formatDateTime, formatUsd } from "../types";

type Props = {
  dashboard: AdminDashboardResponse | undefined;
  rewards: RewardsApiResponse | undefined;
};

const OverviewTab: React.FC<Props> = ({ dashboard, rewards }) => {
  const summary = dashboard?.summary;

  const rewardPointsBalance =
    dashboard?.data.rewards.accounts.reduce((sum, a) => sum + a.points_balance, 0) ?? 0;
  const rewardRequestedUsd =
    rewards?.data.reduce((sum, r) => sum + Number(r.requested_value_usd ?? 0), 0) ?? 0;
  const completedHistories =
    dashboard?.data.watch.histories.filter((h) => h.completed).length ?? 0;
  const averageRating = (() => {
    const ratings = dashboard?.data.community.ratings ?? [];
    if (!ratings.length) return 0;
    return Number(
      (ratings.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / ratings.length).toFixed(1),
    );
  })();

  return (
    <>
      <h2 className="mb-4">Overview</h2>

      {/* KPI Row */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card text-white bg-primary">
            <div className="card-body">
              <h6 className="card-title text-uppercase small opacity-75">Total Users</h6>
              <p className="card-text fs-3 fw-bold mb-0">{summary?.users_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card text-white bg-success">
            <div className="card-body">
              <h6 className="card-title text-uppercase small opacity-75">Downloads</h6>
              <p className="card-text fs-3 fw-bold mb-0">{summary?.download_count ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card text-white bg-info">
            <div className="card-body">
              <h6 className="card-title text-uppercase small opacity-75">Watch Histories</h6>
              <p className="card-text fs-3 fw-bold mb-0">{summary?.histories_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card text-white bg-warning">
            <div className="card-body">
              <h6 className="card-title text-uppercase small opacity-75">Pending Rewards</h6>
              <p className="card-text fs-3 fw-bold mb-0">{summary?.reward_pending_total ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Admins</h6>
              <p className="card-text fs-4 fw-bold mb-0">{summary?.admins_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Comments</h6>
              <p className="card-text fs-4 fw-bold mb-0">{summary?.comments_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Avg Rating</h6>
              <p className="card-text fs-4 fw-bold mb-0">{averageRating}/10</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle text-body-secondary small">Active Codes</h6>
              <p className="card-text fs-4 fw-bold mb-0">
                {summary?.active_premium_codes_total ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details row */}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Platform Stats</h5>
            </div>
            <ul className="list-group list-group-flush">
              <li className="list-group-item d-flex justify-content-between">
                <span>Premium Redemptions</span>
                <strong>{summary?.premium_redemptions_total ?? 0}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Party Rooms</span>
                <strong>{summary?.party_rooms_total ?? 0}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Completed Watches</span>
                <strong>{completedHistories}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Reward Points Live</span>
                <strong>{rewardPointsBalance}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>USD Requested</span>
                <strong>{formatUsd(rewardRequestedUsd)}</strong>
              </li>
            </ul>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Latest Activity</h5>
            </div>
            <ul className="list-group list-group-flush">
              <li className="list-group-item d-flex justify-content-between">
                <span>Last download update</span>
                <strong>{formatDateTime(dashboard?.data.downloads?.updated_at)}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Last party room</span>
                <strong>{formatDateTime(dashboard?.data.parties.rooms[0]?.created_at)}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Last redemption</span>
                <strong>
                  {formatDateTime(dashboard?.data.premium.redemptions[0]?.redeemed_at)}
                </strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Last reward request</span>
                <strong>{formatDateTime(rewards?.data[0]?.created_at)}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Watchlist entries</span>
                <strong>{summary?.watchlist_total ?? 0}</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default OverviewTab;
