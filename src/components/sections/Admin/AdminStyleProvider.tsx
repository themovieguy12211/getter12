"use client";

import { useEffect } from "react";

const AdminStyleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const bs = document.createElement("link");
    bs.id = "admin-bs-css";
    bs.rel = "stylesheet";
    bs.href = "/vendor/bootstrap.min.css";
    document.head.appendChild(bs);

    const icons = document.createElement("link");
    icons.id = "admin-bs-icons";
    icons.rel = "stylesheet";
    icons.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
    document.head.appendChild(icons);

    document.body.classList.add("admin-body-active");
    document.documentElement.setAttribute("data-bs-theme", "dark");

    return () => {
      document.body.classList.remove("admin-body-active");
      document.documentElement.removeAttribute("data-bs-theme");
      document.getElementById("admin-bs-css")?.remove();
      document.getElementById("admin-bs-icons")?.remove();
    };
  }, []);

  return <div className="admin-route-shell">{children}</div>;
};

export default AdminStyleProvider;
