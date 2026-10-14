#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod config;
mod engine;
mod game_status;
mod rules;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{ipc::Channel, Manager, State};

#[derive(Clone)]
struct Backend {
    engine: Arc<Mutex<Option<engine::Engine>>>,
    latest: Arc<AtomicU64>,
    path: PathBuf,
}

fn sidecar_path() -> PathBuf {
    let filename = if cfg!(windows) {
        "stockfish.exe"
    } else {
        "stockfish"
    };
    let packaged = std::env::current_exe()
        .expect("Executable path unavailable")
        .with_file_name(filename);
    if packaged.exists() {
        return packaged;
    }
    #[cfg(debug_assertions)]
    return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(format!(
            "stockfish-{}{}",
            env!("APP_TARGET"),
            if cfg!(windows) { ".exe" } else { "" }
        ));
    #[cfg(not(debug_assertions))]
    packaged
}

#[tauri::command]
fn engine_max_threads() -> u8 {
    engine::max_threads()
}

#[tauri::command]
async fn engine_start(state: State<'_, Backend>) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = state.engine.lock().map_err(|_| "Engine lock poisoned")?;
        if guard.is_none() {
            *guard = Some(engine::Engine::start(&state.path)?);
        }
        Ok(guard.as_ref().unwrap().name.clone())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn engine_cancel(state: State<'_, Backend>) {
    state.latest.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
fn position_status(
    fen: String,
    history: Vec<String>,
    castling: Option<bool>,
) -> game_status::GameStatus {
    let allowed = castling.unwrap_or(true);
    let history = history
        .iter()
        .map(|fen| rules::analysis_fen(fen, allowed))
        .collect::<Vec<_>>();
    game_status::inspect(&rules::analysis_fen(&fen, allowed), &history)
}

#[tauri::command]
fn legal_moves(fen: String, castling: bool) -> Result<Vec<String>, String> {
    rules::legal_moves(&fen, castling)
}

#[tauri::command]
fn make_move(fen: String, uci: String, castling: bool) -> Result<String, String> {
    rules::make_move(&fen, &uci, castling)
}

#[tauri::command]
async fn engine_analyse(
    fen: String,
    depth: u8,
    on_line: Channel<String>,
    castling: Option<bool>,
    elo: Option<u16>,
    tuning: Option<engine::EngineTuning>,
    state: State<'_, Backend>,
) -> Result<(), String> {
    engine::validate_fen(&fen)?;
    let fen = rules::analysis_fen(&fen, castling.unwrap_or(true));
    let state = state.inner().clone();
    let generation = state.latest.fetch_add(1, Ordering::SeqCst) + 1;
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = state.engine.lock().map_err(|_| "Engine lock poisoned")?;
        if state.latest.load(Ordering::SeqCst) != generation {
            return Ok(());
        }
        if guard.is_none() {
            *guard = Some(engine::Engine::start(&state.path)?);
        }
        let result = guard.as_mut().unwrap().analyse_options(
            engine::SearchOptions {
                fen: &fen,
                depth,
                elo,
                tuning: tuning.unwrap_or_default(),
            },
            generation,
            &state.latest,
            |line| {
                if on_line.send(line.to_owned()).is_err() {
                    state.latest.fetch_add(1, Ordering::SeqCst);
                }
            },
        );
        if result.is_err() {
            *guard = None;
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn config_load(store: State<'_, Mutex<config::Store>>) -> Result<config::Config, String> {
    store
        .lock()
        .map_err(|_| "Configuration lock poisoned")?
        .load()
}

#[tauri::command]
fn config_save(
    config: config::Config,
    store: State<'_, Mutex<config::Store>>,
) -> Result<(), String> {
    store
        .lock()
        .map_err(|_| "Configuration lock poisoned")?
        .save(config)
}

fn main() {
    let backend = Backend {
        engine: Arc::new(Mutex::new(None)),
        latest: Arc::new(AtomicU64::new(0)),
        path: sidecar_path(),
    };
    tauri::Builder::default()
        .manage(backend)
        .setup(|app| {
            app.manage(Mutex::new(config::Store(app.path().app_config_dir()?)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config_load,
            config_save,
            engine_max_threads,
            engine_start,
            engine_analyse,
            engine_cancel,
            position_status,
            legal_moves,
            make_move
        ])
        .build(tauri::generate_context!())
        .expect("Failed to build Chessbot")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let state = app.state::<Backend>();
                state.latest.fetch_add(1, Ordering::SeqCst);
                if let Ok(mut guard) = state.engine.lock() {
                    *guard = None;
                };
            }
        });
}
