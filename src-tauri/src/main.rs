#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod presets;
mod export;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      presets::list_presets,
      presets::load_preset,
      presets::save_preset,
      presets::delete_preset,
      export::export_begin,
      export::export_write_frame,
      export::export_encode,
      export::export_cleanup
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

