mod winget;

use winget::{Package, PackageDetail, OperationResult};

#[tauri::command]
async fn search_packages(query: String, settings: winget::WingetSettings) -> Result<Vec<Package>, String> {
    winget::search_packages(&query, settings).await
}

#[tauri::command]
async fn list_installed() -> Result<Vec<Package>, String> {
    winget::list_installed().await
}

#[tauri::command]
async fn check_upgrades() -> Result<Vec<Package>, String> {
    winget::check_upgrades().await
}

#[tauri::command]
async fn show_package(id: String) -> Result<PackageDetail, String> {
    winget::show_package(&id).await
}

#[tauri::command]
async fn install_package(id: String, version: Option<String>, settings: winget::WingetSettings, app: tauri::AppHandle) -> Result<OperationResult, String> {
    winget::install_package(&id, version, settings, app).await
}

#[tauri::command]
async fn uninstall_package(id: String, settings: winget::WingetSettings, app: tauri::AppHandle) -> Result<OperationResult, String> {
    winget::uninstall_package(&id, settings, app).await
}

#[tauri::command]
async fn upgrade_package(id: String, settings: winget::WingetSettings, app: tauri::AppHandle) -> Result<OperationResult, String> {
    winget::upgrade_package(&id, settings, app).await
}

#[tauri::command]
async fn upgrade_all(settings: winget::WingetSettings) -> Result<OperationResult, String> {
    winget::upgrade_all(settings).await
}

#[tauri::command]
async fn get_winget_version() -> Result<String, String> {
    winget::get_winget_version().await
}

#[tauri::command]
async fn get_package_versions(id: String) -> Result<Vec<String>, String> {
    winget::get_package_versions(&id).await
}

#[tauri::command]
async fn install_winget_env() -> Result<OperationResult, String> {
    winget::install_winget_env().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            search_packages,
            list_installed,
            check_upgrades,
            show_package,
            install_package,
            uninstall_package,
            upgrade_package,
            upgrade_all,
            get_winget_version,
            get_package_versions,
            install_winget_env
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
