use crate::ai::cancel::{AiJobControl, CANCELLED_MSG};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

/// Monta um `Command` que funciona com shims npm (`.cmd`/`.bat`) no Windows.
pub fn build_cli_command(bin: &str, args: &[&str]) -> Command {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/D");
        cmd.arg("/C");
        cmd.arg(bin);
        for a in args {
            cmd.arg(a);
        }
        return cmd;
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new(bin);
        cmd.args(args);
        cmd
    }
}

#[allow(dead_code)]
pub fn build_cli_command_owned(bin: &str, args: &[String]) -> Command {
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    build_cli_command(bin, &refs)
}

/// Preferir nome sem `.cmd`/`.bat` quando for só o executável no PATH.
pub fn normalize_cli_bin(bin: &str) -> String {
    let trimmed = bin.trim();
    let lower = trimmed.to_ascii_lowercase();
    if (lower.ends_with(".cmd") || lower.ends_with(".bat"))
        && !trimmed.contains('\\')
        && !trimmed.contains('/')
    {
        let stem = trimmed.rsplit_once('.').map(|(s, _)| s).unwrap_or(trimmed);
        return stem.to_string();
    }
    trimmed.to_string()
}

pub fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let _ = cmd;
}

pub fn apply_new_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x00000010;
        cmd.creation_flags(CREATE_NEW_CONSOLE);
    }
    let _ = cmd;
}

pub fn null_stdio(cmd: &mut Command) {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
}

fn quote_bat(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn write_temp_prompt(prompt: &str) -> Result<PathBuf, String> {
    let path = std::env::temp_dir().join(format!(
        "guia-ai-prompt-{}.txt",
        std::process::id()
    ));
    let mut file =
        File::create(&path).map_err(|e| format!("Falha ao criar prompt temporário: {e}"))?;
    // UTF-8 BOM ajuda alguns CLIs no Windows a ler acentos corretamente
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Falha ao gravar prompt: {e}"))?;
    file.write_all(prompt.as_bytes())
        .map_err(|e| format!("Falha ao gravar prompt: {e}"))?;
    file.flush()
        .map_err(|e| format!("Falha ao gravar prompt: {e}"))?;
    Ok(path)
}

/// Script .cmd que redireciona o prompt para o CLI.
/// Usa `call` + `<` (não pipe) — pipe para `.cmd` no Windows é instável.
fn write_windows_runner(bin: &str, args: &[&str], prompt_path: &Path) -> Result<PathBuf, String> {
    let runner = std::env::temp_dir().join(format!(
        "guia-ai-run-{}.cmd",
        std::process::id()
    ));
    let mut body = String::new();
    body.push_str("@echo off\r\n");
    body.push_str("chcp 65001 >nul\r\n");
    body.push_str("call ");
    body.push_str(&quote_bat(bin));
    for a in args {
        body.push(' ');
        // flags curtas sem espaços
        if a.chars()
            .any(|c| c.is_whitespace() || "\"&<>|^".contains(c))
        {
            body.push_str(&quote_bat(a));
        } else {
            body.push_str(a);
        }
    }
    body.push_str(" < ");
    body.push_str(&quote_bat(&prompt_path.to_string_lossy()));
    body.push_str("\r\n");

    std::fs::write(&runner, body).map_err(|e| format!("Falha ao criar runner: {e}"))?;
    Ok(runner)
}

fn decode_cli_bytes(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    // Fallback Windows ANSI/OEM aproximado (bytes 0x80-0xFF como latin-1)
    bytes.iter().map(|&b| b as char).collect()
}

fn wait_child_cancellable(
    mut child: std::process::Child,
    job: Option<&AiJobControl>,
    on_tick: Option<&dyn Fn(u64)>,
) -> Result<(i32, String, String), String> {
    let pid = child.id();
    if let Some(j) = job {
        j.set_pid(Some(pid));
        if j.cancelled() {
            let _ = child.kill();
            j.request_cancel();
            j.clear_pid();
            return Err(CANCELLED_MSG.into());
        }
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let out_h = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut r) = stdout {
            let _ = r.read_to_end(&mut buf);
        }
        buf
    });
    let err_h = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut r) = stderr {
            let _ = r.read_to_end(&mut buf);
        }
        buf
    });

    let started = std::time::Instant::now();
    let mut last_tick = 0u64;

    let status = loop {
        if job.map(|j| j.cancelled()).unwrap_or(false) {
            let _ = child.kill();
            if let Some(j) = job {
                j.request_cancel();
                j.clear_pid();
            }
            let _ = out_h.join();
            let _ = err_h.join();
            return Err(CANCELLED_MSG.into());
        }
        let secs = started.elapsed().as_secs();
        if secs >= last_tick + 3 {
            last_tick = secs;
            if let Some(cb) = on_tick {
                cb(secs);
            }
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(Duration::from_millis(60)),
            Err(e) => {
                if let Some(j) = job {
                    j.clear_pid();
                }
                let _ = out_h.join();
                let _ = err_h.join();
                return Err(format!("Falha ao aguardar CLI: {e}"));
            }
        }
    };

    if let Some(j) = job {
        j.clear_pid();
    }

    let stdout = decode_cli_bytes(&out_h.join().unwrap_or_default());
    let stderr = decode_cli_bytes(&err_h.join().unwrap_or_default());
    Ok((status.code().unwrap_or(1), stdout, stderr))
}

pub fn run_cli_with_prompt_file_job_tick(
    bin: &str,
    args: &[&str],
    prompt: &str,
    api_key: &str,
    job: Option<&AiJobControl>,
    on_tick: Option<&dyn Fn(u64)>,
) -> Result<(i32, String, String), String> {
    let prompt_path = write_temp_prompt(prompt)?;
    let result = run_cli_with_prompt_path(bin, args, &prompt_path, api_key, job, on_tick);
    let _ = std::fs::remove_file(&prompt_path);
    result
}

fn run_cli_with_prompt_path(
    bin: &str,
    args: &[&str],
    prompt_path: &Path,
    api_key: &str,
    job: Option<&AiJobControl>,
    on_tick: Option<&dyn Fn(u64)>,
) -> Result<(i32, String, String), String> {
    if job.map(|j| j.cancelled()).unwrap_or(false) {
        return Err(CANCELLED_MSG.into());
    }

    #[cfg(windows)]
    {
        let runner = write_windows_runner(bin, args, prompt_path)?;
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/D");
        cmd.arg("/C");
        cmd.arg(&runner);
        cmd.stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        apply_no_window(&mut cmd);
        if !api_key.trim().is_empty() {
            cmd.env("ANTHROPIC_API_KEY", api_key.trim());
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Falha ao executar {bin}: {e}"))?;
        let result = wait_child_cancellable(child, job, on_tick);
        let _ = std::fs::remove_file(&runner);
        return result;
    }

    #[cfg(not(windows))]
    {
        let file = File::open(prompt_path).map_err(|e| format!("Falha ao ler prompt: {e}"))?;
        let mut cmd = build_cli_command(bin, args);
        cmd.stdin(Stdio::from(file))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if !api_key.trim().is_empty() {
            cmd.env("ANTHROPIC_API_KEY", api_key.trim());
        }
        let child = cmd
            .spawn()
            .map_err(|e| format!("Falha ao executar {bin}: {e}"))?;
        wait_child_cancellable(child, job, on_tick)
    }
}

/// Helper para código que só tem Arc (ex.: enrich sem cancel).
#[allow(dead_code)]
pub fn job_ref(job: &Option<Arc<AiJobControl>>) -> Option<&AiJobControl> {
    job.as_deref()
}
