import { Page } from "../App";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  upgradeCount: number;
}

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: "discover", icon: "🔍", label: "发现" },
  { id: "installed", icon: "📦", label: "已安装" },
  { id: "updates", icon: "🔄", label: "更新" },
  { id: "settings", icon: "⚙️", label: "设置" },
];

export default function Sidebar({ currentPage, onNavigate, upgradeCount }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🌊</div>
        <h1>Breeze</h1>
      </div>

      <div className="sidebar-section-label">导航</div>
      {navItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${currentPage === item.id ? "active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
          {item.id === "updates" && upgradeCount > 0 && (
            <span className="nav-badge">{upgradeCount}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
