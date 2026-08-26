pub const DLC_BASE: &str = "__dlc_base__";
pub const GROUP_NONE: &str = "__group_none__";

const LEGACY_DLC_BASE: &str = "Jogo base";
const LEGACY_GROUP_NONE: &str = "Sem Grupo";

pub fn is_base_dlc(value: &str) -> bool {
    let v = value.trim();
    v.is_empty() || v == DLC_BASE || v == LEGACY_DLC_BASE
}

pub fn is_placeholder_group(value: &str) -> bool {
    let v = value.trim();
    v.is_empty() || v == GROUP_NONE || v == LEGACY_GROUP_NONE
}
