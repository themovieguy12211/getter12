import type { Referral, RewardAccount, RewardRequest, RewardRequestStatus } from "@/types/rewards";

export type AdminTab = "overview" | "users" | "community" | "premium" | "activity" | "rewards" | "embeds" | "playmate";

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  username: string | null;
  is_admin: boolean;
  profile_created_at: string | null;
};

export type AdminComment = {
  id: number;
  user_id: string;
  username: string | null;
  user_email: string | null;
  content: string;
  media_id: number;
  media_type: "movie" | "tv";
  created_at: string;
  updated_at: string;
};

export type AdminRating = {
  user_id: string;
  username: string | null;
  user_email: string | null;
  media_id: number;
  media_type: "movie" | "tv";
  rating: number;
  created_at: string;
  updated_at: string;
};

export type AdminPremiumCode = {
  id: number;
  code: string;
  plan: "monthly" | "yearly";
  duration_days: number;
  max_redemptions: number;
  redemption_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_redeemed_by: string | null;
  last_redeemed_at: string | null;
  created_by_username: string | null;
  last_redeemed_by_username: string | null;
};

export type AdminPremiumRedemption = {
  id: number;
  code_id: number;
  user_id: string;
  username: string | null;
  user_email: string | null;
  redeemed_at: string;
  applied_plan: "monthly" | "yearly";
  applied_days: number;
};

export type AdminPartyRoom = {
  code: string;
  host_id: string | null;
  host_username: string | null;
  host_email: string | null;
  media_id: number;
  media_type: "movie" | "tv";
  media_title: string;
  media_poster: string | null;
  season: number | null;
  episode: number | null;
  created_at: string;
  expires_at: string;
};

export type AdminPartyMessage = {
  id: number;
  room_code: string;
  user_id: string | null;
  username: string;
  user_email: string | null;
  content: string;
  created_at: string;
};

export type AdminHistory = {
  id: number;
  user_id: string;
  username: string | null;
  user_email: string | null;
  media_id: number;
  type: "movie" | "tv";
  season: number;
  episode: number;
  duration: number;
  last_position: number;
  completed: boolean;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AdminWatchlist = {
  user_id: string;
  username: string | null;
  user_email: string | null;
  id: number;
  type: "movie" | "tv";
  title: string;
  vote_average: number;
  created_at: string;
};

export type AdminDashboardResponse = {
  data: {
    users: AdminUser[];
    community: {
      comments: AdminComment[];
      ratings: AdminRating[];
    };
    watch: {
      histories: AdminHistory[];
      watchlist: AdminWatchlist[];
    };
    premium: {
      codes: AdminPremiumCode[];
      redemptions: AdminPremiumRedemption[];
    };
    parties: {
      rooms: AdminPartyRoom[];
      messages: AdminPartyMessage[];
    };
    downloads: {
      count: number;
      updated_at: string;
    } | null;
    rewards: {
      requests: RewardRequest[];
      accounts: RewardAccount[];
      referrals: Referral[];
    };
  };
  summary: {
    users_total: number;
    admins_total: number;
    comments_total: number;
    ratings_total: number;
    premium_codes_total: number;
    active_premium_codes_total: number;
    premium_redemptions_total: number;
    party_rooms_total: number;
    active_party_rooms_total: number;
    party_messages_total: number;
    download_count: number;
    histories_total: number;
    watchlist_total: number;
    reward_requests_total: number;
    reward_pending_total: number;
    reward_accounts_total: number;
    referrals_total: number;
  };
};

export type RewardsApiResponse = {
  data: RewardRequest[];
  summary: {
    total_pending: number;
    total_requests: number;
    reward_accounts: RewardAccount[];
    referrals: Referral[];
  };
};

export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

export const formatDateInput = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export const formatCompactId = (value: string | null | undefined) =>
  value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";

export const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0);
