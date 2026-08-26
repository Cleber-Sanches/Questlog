use crate::ai::cancel::AiJobControl;
use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub app_data_dir: PathBuf,
    pub last_backup_request: Mutex<Option<Instant>>,
    pub ai_job: AiJobControl,
}

impl AppState {
    pub fn new(db: Connection, app_data_dir: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            db: Mutex::new(db),
            app_data_dir,
            last_backup_request: Mutex::new(None),
            ai_job: AiJobControl::new(),
        })
    }

    pub fn mark_dirty_for_backup(&self) {
        *self.last_backup_request.lock() = Some(Instant::now());
    }

    pub fn should_auto_backup(&self, debounce: Duration) -> bool {
        let guard = self.last_backup_request.lock();
        match *guard {
            Some(t) => t.elapsed() >= debounce,
            None => false,
        }
    }

    pub fn clear_backup_request(&self) {
        *self.last_backup_request.lock() = None;
    }
}
