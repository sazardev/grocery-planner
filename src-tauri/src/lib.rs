pub mod commands;
pub mod domain;
pub mod error;
pub mod persist;
pub mod state;
pub mod store;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            let state = state::AppState::default();
            app.manage(state);

            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(10));
                let app_state = handle.state::<state::AppState>().inner();
                if let Ok(mut store) = app_state.store.lock() {
                    store.presence.prune();
                }
            });

            // Guardado en segundo plano (no pierde datos al cerrar/reiniciar).
            let saver_handle = app.handle().clone();
            std::thread::spawn(move || {
                let path = crate::persist::default_data_path();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    let app_state = saver_handle.state::<state::AppState>().inner();
                    if let Ok(store) = app_state.store.lock() {
                        if let Err(e) = crate::persist::save(&store, &path) {
                            eprintln!("persist: {e}");
                        }
                    }
                }
            });

            // Tareas de fondo: recordatorios de eventos y planes recurrentes
            // (SPEC §7.1, §9.2 y §13). Persiste al instante si algo cambió.
            let bg_handle = app.handle().clone();
            std::thread::spawn(move || {
                let path = crate::persist::default_data_path();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                    let app_state = bg_handle.state::<state::AppState>().inner();
                    if let Ok(mut store) = app_state.store.lock() {
                        if crate::commands::background::tick(&mut store) {
                            let _ = crate::persist::save(&store, &path);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::greet,
            commands::app::app_info,
            commands::health::live,
            commands::health::ready,
            commands::health::healthy,
            commands::auth::auth_register,
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_me,
            commands::auth::auth_sessions,
            commands::auth::auth_revoke_session,
            commands::auth::auth_change_password,
            commands::auth::auth_reset_password,
            commands::auth::auth_set_pin,
            commands::auth::auth_remove_pin,
            commands::auth::auth_has_pin,
            commands::auth::auth_login_pin,
            commands::chat::chat_list,
            commands::chat::chat_send,
            commands::chat::chat_react,
            commands::chat::chat_pin,
            commands::chat::chat_count,
            commands::chat::chat_page,
            commands::chat::chat_search,
            commands::rules::rules_get,
            commands::rules::rules_update,
            commands::rules::rules_store_add,
            commands::rules::rules_store_rename,
            commands::rules::rules_store_remove,
            commands::rules::rules_aisle_add,
            commands::rules::rules_aisle_remove,
            commands::rules::notifications_list,
            commands::rules::notifications_unread_count,
            commands::rules::notifications_mark_read,
            commands::rules::notifications_mark_all_read,
            commands::rules::notifications_mentions_unread_count,
            commands::rules::notifications_mentions_mark_read,
            commands::rules::notifications_settings_get,
            commands::rules::notifications_settings_update,
            commands::rules::projection_decide,
            commands::items::item_flows,
            commands::items::item_transition,
            commands::items::parse_quick_entry,
            commands::items::validate_new_item,
            commands::items::items_list,
            commands::items::items_query,
            commands::items::item_create,
            commands::items::item_get,
            commands::items::item_update,
            commands::items::item_set_priority,
            commands::items::item_move,
            commands::items::item_delete,
            commands::items::item_change_status,
            commands::items::item_assign,
            commands::items::item_unassign,
            commands::items::item_cancel,
            commands::items::item_history,
            commands::items::item_add_comment,
            commands::items::item_set_price,
            commands::items::item_set_section,
            commands::items::item_set_store,
            commands::items::item_set_brand,
            commands::items::item_set_quantity_max,
            commands::items::item_add_fallback,
            commands::items::item_remove_fallback,
            commands::items::item_use_fallback,
            commands::items::item_add_photo,
            commands::items::item_remove_photo,
            commands::items::item_recover,
            commands::items::items_purchased_between,
            commands::timeline::timeline_get,
            commands::presence::presence_list,
            commands::presence::presence_heartbeat,
            commands::presence::presence_leave,
            commands::trips::trips_list,
            commands::trips::trips_create,
            commands::trips::trips_get,
            commands::trips::trips_add_item,
            commands::trips::trips_remove_item,
            commands::trips::trips_assign,
            commands::trips::trips_activate,
            commands::trips::trips_complete,
            commands::trips::trips_cancel,
            commands::trips::trips_confirm_received,
            commands::home::home_create,
            commands::home::home_info,
            commands::home::home_add_member,
            commands::home::home_remove_member,
            commands::home::home_change_role,
            commands::home::home_invite_create,
            commands::home::home_invite_revoke,
            commands::home::home_invite_accept,
            commands::home::home_backup_key_regenerate,
            commands::events::events_list,
            commands::events::events_list_range,
            commands::events::event_create,
            commands::events::event_get,
            commands::events::event_delete,
            commands::events::event_add_item,
            commands::events::event_remove_item,
            commands::events::event_merge_to_home,
            commands::events::event_discard_list,
            commands::plans::plans_list,
            commands::plans::plan_create,
            commands::plans::plan_get,
            commands::plans::plan_activate,
            commands::plans::plan_complete,
            commands::plans::plan_cancel,
            commands::sections::sections_list,
            commands::sections::section_create,
            commands::sections::section_rename,
            commands::sections::section_delete,
            commands::sections::section_move,
            commands::reports::reports_top_products,
            commands::reports::reports_spending,
            commands::reports::reports_trips_by_member,
            commands::reports::reports_projection,
            commands::backup::backup_export,
            commands::backup::backup_import,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
