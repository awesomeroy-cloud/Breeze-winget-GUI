import { Page } from "../types";
import { NAV_ITEMS } from "../constants/navigation";
import { usePackages } from "../context";

/**
 * Primary sidebar navigation component.
 * @module components/Sidebar
 */

/**
 * Properties for the Sidebar component.
 */
export interface SidebarProps {
  /** The currently selected active page */
  currentPage: Page;
  /** Navigation callback to switch the active page */
  onNavigate: (page: Page) => void;
}

/**
 * Renders the application brand logo and navigational links.
 * Automatically subscribes to upgradeCount from PackageContext to display the update badge.
 */
export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { upgradeCount } = usePackages();

  return (
    <nav className="sidebar" aria-label="Main Navigation">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🌊</div>
        <h1>Breeze</h1>
      </div>

      <div className="sidebar-section-label">导航</div>
      {NAV_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${currentPage === item.id ? "active" : ""}`}
          onClick={() => onNavigate(item.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate(item.id);
          }}
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
