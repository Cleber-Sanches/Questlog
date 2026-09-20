use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, thiserror::Error)]
enum SetupError {
    #[error("{0}")]
    Message(String),
}

impl serde::Serialize for SetupError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// NSIS do app principal — preenchido por tools/build-questlog-setup.ps1
const NSIS_PAYLOAD: &[u8] = include_bytes!("../resources/Questlog_x64-setup.exe");

fn local_app_dir() -> Result<PathBuf, SetupError> {
    let base = std::env::var_os("LOCALAPPDATA").ok_or_else(|| {
        SetupError::Message("Não foi possível resolver %LOCALAPPDATA%.".into())
    })?;
    Ok(PathBuf::from(base).join("Questlog"))
}

fn app_exe_path() -> Result<PathBuf, SetupError> {
    Ok(local_app_dir()?.join("questlog.exe"))
}

#[tauri::command]
fn run_silent_install() -> Result<(), SetupError> {
    if NSIS_PAYLOAD.len() < 1024 {
        return Err(SetupError::Message(
            "Pacote de instalação ausente. Rode tools/build-questlog-setup.ps1.".into(),
        ));
    }

    let temp_dir = std::env::temp_dir().join("questlog-setup");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| SetupError::Message(format!("Temp dir: {e}")))?;
    let nsis = temp_dir.join("Questlog_x64-setup.exe");
    fs::write(&nsis, NSIS_PAYLOAD)
        .map_err(|e| SetupError::Message(format!("Falha ao extrair instalador: {e}")))?;

    let status = Command::new(&nsis)
        .arg("/S")
        .status()
        .map_err(|e| SetupError::Message(format!("Falha ao iniciar o instalador: {e}")))?;

    let _ = fs::remove_file(&nsis);

    if !status.success() {
        return Err(SetupError::Message(format!(
            "Instalação falhou (código {:?}).",
            status.code()
        )));
    }

    let exe = app_exe_path()?;
    if !exe.is_file() {
        return Err(SetupError::Message(
            "Instalação terminou, mas o Questlog não foi encontrado.".into(),
        ));
    }
    Ok(())
}

#[tauri::command]
fn launch_app() -> Result<(), SetupError> {
    let exe = app_exe_path()?;
    if !exe.is_file() {
        return Err(SetupError::Message(
            "Questlog não está instalado neste PC.".into(),
        ));
    }
    Command::new(&exe)
        .spawn()
        .map_err(|e| SetupError::Message(format!("Não foi possível abrir o Questlog: {e}")))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_silent_install, launch_app])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar Questlog Setup");
}
