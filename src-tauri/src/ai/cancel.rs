use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

pub const CANCELLED_MSG: &str = "Execução cancelada.";

/// Controle de cancelamento do chat/CLI (um job por vez).
pub struct AiJobControl {
    cancel: AtomicBool,
    pid: Mutex<Option<u32>>,
}

impl AiJobControl {
    pub fn new() -> Self {
        Self {
            cancel: AtomicBool::new(false),
            pid: Mutex::new(None),
        }
    }

    pub fn begin(&self) {
        self.cancel.store(false, Ordering::SeqCst);
        *self.pid.lock() = None;
    }

    pub fn request_cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
        if let Some(pid) = self.pid.lock().take() {
            kill_process_tree(pid);
        }
    }

    pub fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::SeqCst)
    }

    pub fn set_pid(&self, pid: Option<u32>) {
        *self.pid.lock() = pid;
    }

    pub fn clear_pid(&self) {
        *self.pid.lock() = None;
    }
}

impl Default for AiJobControl {
    fn default() -> Self {
        Self::new()
    }
}

pub fn is_cancelled_msg(msg: &str) -> bool {
    msg.contains(CANCELLED_MSG)
}

fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }

    #[cfg(unix)]
    {
        use std::process::Command;
        let _ = Command::new("kill")
            .args(["-TERM", &format!("-{pid}")])
            .output();
        let _ = Command::new("kill")
            .args(["-KILL", &pid.to_string()])
            .output();
    }
}
