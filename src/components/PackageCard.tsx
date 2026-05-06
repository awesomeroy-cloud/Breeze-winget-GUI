import { Package } from "../api";

interface Props {
  pkg: Package;
  onClick: (pkg: Package) => void;
  actionButton?: React.ReactNode;
  showUpgrade?: boolean;
}

/** Derive a deterministic icon emoji from the package name */
function getIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("code") || lower.includes("studio") || lower.includes("ide")) return "💻";
  if (lower.includes("chrome") || lower.includes("firefox") || lower.includes("browser") || lower.includes("edge")) return "🌐";
  if (lower.includes("git")) return "🔀";
  if (lower.includes("node") || lower.includes("python") || lower.includes("java") || lower.includes("rust")) return "⚡";
  if (lower.includes("music") || lower.includes("spotify") || lower.includes("player")) return "🎵";
  if (lower.includes("photo") || lower.includes("image") || lower.includes("paint")) return "🎨";
  if (lower.includes("video") || lower.includes("vlc") || lower.includes("pot")) return "🎬";
  if (lower.includes("chat") || lower.includes("discord") || lower.includes("telegram") || lower.includes("wechat")) return "💬";
  if (lower.includes("office") || lower.includes("word") || lower.includes("excel")) return "📄";
  if (lower.includes("zip") || lower.includes("7z") || lower.includes("rar")) return "📁";
  if (lower.includes("driver") || lower.includes("amd") || lower.includes("nvidia")) return "🖥️";
  if (lower.includes("game") || lower.includes("steam")) return "🎮";
  if (lower.includes("vpn") || lower.includes("proxy")) return "🔒";
  if (lower.includes("terminal") || lower.includes("shell") || lower.includes("powershell")) return "⌨️";
  return "📦";
}

export default function PackageCard({ pkg, onClick, actionButton, showUpgrade }: Props) {
  return (
    <div className="package-card" onClick={() => onClick(pkg)}>
      <div className="package-card-header">
        <div className="package-icon">{getIcon(pkg.name)}</div>
        <div className="package-info">
          <div className="package-name" title={pkg.name}>{pkg.name}</div>
          <div className="package-id" title={pkg.id}>{pkg.id}</div>
        </div>
      </div>

      <div className="package-meta">
        <span className="package-version">v{pkg.version}</span>
        {showUpgrade && pkg.available && (
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
