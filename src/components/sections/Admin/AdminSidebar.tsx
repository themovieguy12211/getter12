"use client";

import type { AdminTab } from "./types";

const NAV_ITEMS: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "bi-speedometer2" },
  { id: "users", label: "Users", icon: "bi-people" },
  { id: "community", label: "Community", icon: "bi-chat-dots" },
  { id: "premium", label: "Premium", icon: "bi-gem" },
  { id: "activity", label: "Activity", icon: "bi-play-circle" },
  { id: "rewards", label: "Rewards", icon: "bi-gift" },
  { id: "embeds", label: "Embeds", icon: "bi-film" },
  { id: "playmate", label: "Playmate", icon: "bi-cloud-upload" },
];

type Props = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
};

const AdminSidebar: React.FC<Props> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="sidebar" id="sidebarMenu">
      <div className="sidebar-sticky pt-3">
        <ul className="nav flex-column">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.id}>
              <button
                type="button"
                className={`nav-link${activeTab === item.id ? " active" : ""}`}
                onClick={() => onTabChange(item.id)}
              >
                <i className={`bi ${item.icon} me-2`} />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default AdminSidebar;
