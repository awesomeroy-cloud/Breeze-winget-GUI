import React from "react";
import { Package } from "../types";
import { getPackageIcon } from "../utils/icon";

/**
 * Reusable package card component for grid views.
 * @module components/PackageCard
 */

/**
 * Properties for the PackageCard component.
 */
export interface PackageCardProps {
  /** The package data model displayed on this card */
  pkg: Package;
  /** Click handler triggered when clicking anywhere on the card */
  onClick: (pkg: Package) => void;
  /** Optional custom action button rendered in the footer area */
  actionButton?: React.ReactNode;
  /** Whether to render the available upgrade version badge if available */
  showUpgrade?: boolean;
}

/**
 * Card component presenting an application's icon, name, ID, version, and optional actions.
 */
export default function PackageCard({ pkg, onClick, actionButton, showUpgrade }: PackageCardProps) {
  return (
    <div className="package-card" onClick={() => onClick(pkg)}>
      <div className="package-card-header">
        <div className="package-icon">{getPackageIcon(pkg.name, pkg.id)}</div>
        <div className="package-info">
          <div className="package-name" title={pkg.name}>
            {pkg.name}
          </div>
          <div className="package-id" title={pkg.id}>
            {pkg.id}
          </div>
        </div>
      </div>

      <div className="package-meta">
        <span className="package-version">
          {pkg.version && pkg.version !== "-" && pkg.version.toLowerCase() !== "unknown"
            ? `v${pkg.version}`
            : "未知版本"}
        </span>
        {showUpgrade && pkg.available && pkg.available !== "-" && (
          <span className="package-upgrade-badge">→ {pkg.available}</span>
        )}
        {pkg.source && <span className="package-source">{pkg.source}</span>}
      </div>

      {actionButton && (
        <div className="package-actions" onClick={(e) => e.stopPropagation()}>
          {actionButton}
        </div>
      )}
    </div>
  );
}
