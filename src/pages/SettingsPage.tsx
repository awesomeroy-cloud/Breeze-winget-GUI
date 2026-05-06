import { useState, useEffect } from "react";
import { getWingetVersion } from "../api";
import { WingetSettings, loadSettings, saveSettings, DEFAULT_SETTINGS } from "../settings";

export default function SettingsPage() {
  const [wingetVer, setWingetVer] = useState("检测中...");
  const [settings, setSettings] = useState<WingetSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getWingetVersion()
      .then(setWingetVer)
      .catch(() => setWingetVer("未检测到"));
  }, []);

  const update = <K extends keyof WingetSettings>(key: K, value: WingetSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      return next;
    });
  };

  const resetAll = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings(DEFAULT_SETTINGS);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      <div className="header">
        <h2 className="header-title">⚙️ 设置</h2>
        {saved && <span className="settings-saved-badge">✓ 已保存</span>}
      </div>

      <div className="content-area">
        {/* Install Settings */}
        <div className="settings-group">
          <h3>📦 安装 (install)</h3>
          <p className="settings-group-desc">这些选项将应用于所有通过 Breeze 执行的安装操作</p>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">安装模式</span>
              <span className="settings-hint">--silent / --interactive</span>
            </div>
            <select
              className="settings-select"
              value={settings.install_mode}
              onChange={e => update("install_mode", e.target.value as WingetSettings["install_mode"])}
            >
              <option value="silent">静默安装</option>
              <option value="interactive">交互式安装</option>
              <option value="default">默认 (跟随安装包)</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">安装范围</span>
              <span className="settings-hint">--scope user | machine</span>
            </div>
            <select
              className="settings-select"
              value={settings.install_scope}
              onChange={e => update("install_scope", e.target.value as WingetSettings["install_scope"])}
            >
              <option value="default">不指定 (跟随安装包)</option>
              <option value="user">当前用户</option>
              <option value="machine">所有用户 (需要管理员)</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">体系结构</span>
              <span className="settings-hint">--architecture</span>
            </div>
            <select
              className="settings-select"
              value={settings.install_architecture}
              onChange={e => update("install_architecture", e.target.value as WingetSettings["install_architecture"])}
            >
              <option value="default">自动检测</option>
              <option value="x64">x64</option>
              <option value="x86">x86</option>
              <option value="arm64">ARM64</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">自定义安装路径</span>
              <span className="settings-hint">--location &lt;path&gt;</span>
            </div>
            <input
              className="settings-input"
              type="text"
              placeholder="留空使用默认路径"
              value={settings.install_location}
              onChange={e => update("install_location", e.target.value)}
            />
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">强制安装</span>
              <span className="settings-hint">--force (即使已安装也强制覆盖)</span>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.install_force}
                onChange={e => update("install_force", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Upgrade Settings */}
        <div className="settings-group">
          <h3>🔄 更新 (upgrade)</h3>
          <p className="settings-group-desc">控制软件更新时的行为参数</p>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">更新模式</span>
              <span className="settings-hint">--silent / --interactive</span>
            </div>
            <select
              className="settings-select"
              value={settings.upgrade_mode}
              onChange={e => update("upgrade_mode", e.target.value as WingetSettings["upgrade_mode"])}
            >
              <option value="silent">静默更新</option>
              <option value="interactive">交互式更新</option>
              <option value="default">默认</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">包含未知版本</span>
              <span className="settings-hint">--include-unknown</span>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.upgrade_include_unknown}
                onChange={e => update("upgrade_include_unknown", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">强制更新</span>
              <span className="settings-hint">--force</span>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.upgrade_force}
                onChange={e => update("upgrade_force", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Uninstall Settings */}
        <div className="settings-group">
          <h3>🗑️ 卸载 (uninstall)</h3>
          <p className="settings-group-desc">控制软件卸载时的行为参数</p>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">卸载模式</span>
              <span className="settings-hint">--silent / --interactive</span>
            </div>
            <select
              className="settings-select"
              value={settings.uninstall_mode}
              onChange={e => update("uninstall_mode", e.target.value as WingetSettings["uninstall_mode"])}
            >
              <option value="silent">静默卸载</option>
              <option value="interactive">交互式卸载</option>
              <option value="default">默认</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">清除残留</span>
              <span className="settings-hint">--purge (删除所有关联文件和目录)</span>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.uninstall_purge}
                onChange={e => update("uninstall_purge", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Search Settings */}
        <div className="settings-group">
          <h3>🔍 搜索 (search)</h3>
          <p className="settings-group-desc">自定义搜索行为和结果展示</p>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">最大结果数</span>
              <span className="settings-hint">--count (0 = 不限制)</span>
            </div>
            <input
              className="settings-input settings-input-sm"
              type="number"
              min={0}
              max={100}
              value={settings.search_count}
              onChange={e => update("search_count", parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">精确匹配</span>
              <span className="settings-hint">--exact (仅匹配完全一致的名称或 ID)</span>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.search_exact}
                onChange={e => update("search_exact", e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-row">
            <div className="settings-label-wrap">
              <span className="settings-label">搜索源</span>
              <span className="settings-hint">--source</span>
            </div>
            <select
              className="settings-select"
              value={settings.search_source}
              onChange={e => update("search_source", e.target.value as WingetSettings["search_source"])}
            >
              <option value="default">全部</option>
              <option value="winget">winget</option>
              <option value="msstore">Microsoft Store</option>
            </select>
          </div>
        </div>

        {/* About */}
        <div className="settings-group">
          <h3>关于 Breeze</h3>
          <div className="settings-row">
            <span className="settings-label">版本</span>
            <span className="settings-value">0.1.0 (Phase 2)</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">winget 版本</span>
            <span className="settings-value">{wingetVer}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">框架</span>
            <span className="settings-value">Tauri v2 + React</span>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={resetAll}>
            恢复默认设置
          </button>
        </div>
      </div>
    </>
  );
}
