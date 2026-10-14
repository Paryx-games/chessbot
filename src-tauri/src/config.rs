use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

type Section = BTreeMap<String, String>;
type Ini = BTreeMap<String, Section>;
const GROUPS: &[&str] = &[
    "depth",
    "strength",
    "side",
    "rules",
    "automation",
    "position",
    "orientation",
    "workspace",
];

#[derive(Default, Deserialize, Serialize)]
pub struct Config {
    pub settings: Section,
    pub saved: Ini,
    #[serde(default)]
    pub settings_exists: bool,
    #[serde(default)]
    pub directory: String,
}

pub struct Store(pub PathBuf);

fn boolean(value: &str) -> bool {
    matches!(value, "true" | "false")
}
fn number(value: &str, low: u32, high: u32) -> bool {
    value
        .parse::<u32>()
        .is_ok_and(|n| (low..=high).contains(&n))
}
fn valid_setting(key: &str, value: &str) -> bool {
    match key {
        "theme" => matches!(value, "green" | "brown" | "blue" | "purple"),
        "appearance" => matches!(value, "system" | "light" | "dark"),
        "reducedMotion" | "coordinates" | "suggestions" | "soundEffects" | "saveEnabled" => {
            boolean(value)
        }
        _ => {
            key.strip_prefix("save_")
                .is_some_and(|group| GROUPS.contains(&group))
                && boolean(value)
        }
    }
}
fn group(key: &str) -> Option<&str> {
    match key {
        "depth" | "depthPreset" | "customDepth" => Some("depth"),
        "elo" | "fullStrength" => Some("strength"),
        "sfSide" => Some("side"),
        "legalRules" | "allowCastling" => Some("rules"),
        "auto" | "both" => Some("automation"),
        "fen" | "history" | "plies" => Some("position"),
        "flip" => Some("orientation"),
        "activeView" => Some("workspace"),
        _ => None,
    }
}
fn valid_saved(key: &str, value: &str) -> bool {
    match key {
        "depth" | "customDepth" => number(value, 1, 48),
        "depthPreset" => matches!(value, "6" | "8" | "12" | "16" | "24" | "custom"),
        "elo" => number(value, 1320, 3190),
        "sfSide" => matches!(value, "off" | "w" | "b"),
        "activeView" => matches!(value, "analyzer" | "training"),
        "plies" => number(value, 0, 200),
        "fen" => value.len() <= 200 && value.parse::<shakmaty::fen::Fen>().is_ok(),
        "history" => value.len() <= 220_000 && value.starts_with('[') && value.ends_with(']'),
        "fullStrength" | "legalRules" | "allowCastling" | "auto" | "both" | "flip" => {
            boolean(value)
        }
        _ => false,
    }
}
fn clean(config: &mut Config) {
    config
        .settings
        .retain(|key, value| valid_setting(key, value));
    let enabled = config
        .settings
        .get("saveEnabled")
        .is_none_or(|v| v == "true");
    config.saved.retain(|section, values| {
        if !enabled || !matches!(section.as_str(), "analyzer" | "training" | "app") {
            return false;
        }
        values.retain(|key, value| {
            let permitted = group(key).is_some_and(|group| {
                config
                    .settings
                    .get(&format!("save_{group}"))
                    .is_none_or(|v| v == "true")
            });
            permitted && valid_saved(key, value) && (section == "app") == (key == "activeView")
        });
        if section == "training" {
            values.remove("both");
        }
        !values.is_empty()
    });
}
fn parse(text: &str) -> Ini {
    let mut result = Ini::new();
    let mut section = String::new();
    for line in text.trim_start_matches('\u{feff}').lines().map(str::trim) {
        if line.is_empty() || line.starts_with([';', '#']) {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            section = line[1..line.len() - 1].to_string();
        } else if let Some((key, value)) = line.split_once('=') {
            result
                .entry(section.clone())
                .or_default()
                .insert(key.trim().into(), value.trim().into());
        }
    }
    result
}
fn encode(ini: &Ini) -> Result<String, String> {
    let mut output = String::new();
    for (section, values) in ini {
        output.push_str(&format!("[{section}]\n"));
        for (key, value) in values {
            if value.contains(['\r', '\n', '\0']) {
                return Err("Invalid configuration value".into());
            }
            output.push_str(&format!("{key}={value}\n"));
        }
        output.push('\n');
    }
    Ok(output)
}
fn read(path: &Path) -> Result<Ini, String> {
    match fs::metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Ini::new()),
        Err(e) => return Err(e.to_string()),
        Ok(metadata) if metadata.len() > 1_000_000 => {
            return Err("Configuration file is too large".into())
        }
        _ => {}
    }
    fs::read_to_string(path)
        .map(|s| parse(&s))
        .map_err(|e| e.to_string())
}
fn write(path: &Path, text: &str) -> Result<(), String> {
    let pending = path.with_extension("ini.tmp");
    let mut file = fs::File::create(&pending).map_err(|e| e.to_string())?;
    file.write_all(text.as_bytes())
        .and_then(|()| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(pending, path).map_err(|e| e.to_string())
}
impl Store {
    pub fn load(&self) -> Result<Config, String> {
        let settings_path = self.0.join("settings.ini");
        let mut settings = read(&settings_path)?;
        let mut config = Config {
            settings: settings.remove("settings").unwrap_or_default(),
            saved: read(&self.0.join("saved.ini"))?,
            settings_exists: settings_path.exists(),
            directory: self.0.to_string_lossy().into_owned(),
        };
        clean(&mut config);
        Ok(config)
    }
    pub fn save(&self, mut config: Config) -> Result<(), String> {
        clean(&mut config);
        let settings = encode(&BTreeMap::from([("settings".into(), config.settings)]))?;
        let saved = encode(&config.saved)?;
        fs::create_dir_all(&self.0).map_err(|e| e.to_string())?;
        write(&self.0.join("settings.ini"), &settings)?;
        write(&self.0.join("saved.ini"), &saved)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ini_round_trip_filters_categories_and_keeps_settings() {
        let mut config = Config { settings: parse("[settings]\ntheme=blue\nsave_depth=false\n").remove("settings").unwrap(), saved: parse("[analyzer]\ndepth=24\nelo=1800\n[training]\nboth=true\n[app]\nactiveView=training\n"), ..Config::default() };
        clean(&mut config);
        assert!(!config.saved["analyzer"].contains_key("depth"));
        assert_eq!(config.saved["analyzer"]["elo"], "1800");
        assert!(!config.saved.contains_key("training"));
        assert_eq!(parse(&encode(&config.saved).unwrap()), config.saved);
        config.settings.insert("saveEnabled".into(), "false".into());
        clean(&mut config);
        assert!(config.saved.is_empty());
        assert_eq!(config.settings["theme"], "blue");
    }
    #[test]
    fn invalid_and_unknown_values_do_not_restore() {
        let mut config = Config { settings: parse("[settings]\ntheme=unknown\nsave_strength=oops\n").remove("settings").unwrap(), saved: parse("[analyzer]\ndepth=49\nelo=1\nfen=invalid\nauto=true\nunknown=test\n[untrusted]\nflip=true\n"), ..Config::default() };
        clean(&mut config);
        assert!(config.settings.is_empty());
        assert_eq!(config.saved.len(), 1);
        assert_eq!(
            config.saved["analyzer"],
            BTreeMap::from([("auto".into(), "true".into())])
        );
    }
    #[test]
    fn every_save_choice_filters_its_keys_on_load_and_save() {
        let original = parse("[analyzer]\ndepth=16\ndepthPreset=16\ncustomDepth=24\nelo=1800\nfullStrength=false\nsfSide=b\nlegalRules=true\nallowCastling=true\nauto=true\nboth=true\nfen=8/8/8/8/8/8/8/8 w - - 0 1\nhistory=[]\nplies=12\nflip=true\n[app]\nactiveView=training\n");
        for choice in GROUPS {
            let mut config = Config {
                settings: BTreeMap::from([(format!("save_{choice}"), "false".into())]),
                saved: original.clone(),
                ..Config::default()
            };
            clean(&mut config);
            for values in config.saved.values() {
                for key in values.keys() {
                    assert_ne!(group(key), Some(*choice));
                }
            }
            let remaining: usize = config.saved.values().map(BTreeMap::len).sum();
            assert!(remaining > 0);
        }
        let mut config = Config {
            settings: Section::new(),
            saved: original,
            ..Config::default()
        };
        clean(&mut config);
        assert!(config.saved["analyzer"].contains_key("fen"));
    }

    #[test]
    fn old_playing_mode_values_are_discarded_without_losing_strength() {
        let mut config = Config {
            settings: BTreeMap::from([
                ("save_mode".into(), "true".into()),
                ("save_strength".into(), "true".into()),
            ]),
            saved: parse("[analyzer]\nplayMode=playful\nelo=1800\nfullStrength=false\n"),
            ..Config::default()
        };
        clean(&mut config);
        assert!(!config.settings.contains_key("save_mode"));
        assert!(!config.saved["analyzer"].contains_key("playMode"));
        assert_eq!(config.saved["analyzer"]["elo"], "1800");
        assert_eq!(config.saved["analyzer"]["fullStrength"], "false");
    }

    #[test]
    fn disk_round_trip_replaces_existing_files_and_handles_missing_files() {
        let root = std::env::temp_dir().join(format!(
            "chessbot-config-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = Store(root.clone());
        assert!(!store.load().unwrap().settings_exists);
        let mut config = Config::default();
        config.settings.insert("theme".into(), "blue".into());
        store.save(config).unwrap();
        let mut config = store.load().unwrap();
        assert!(config.settings_exists);
        config.settings.insert("theme".into(), "purple".into());
        store.save(config).unwrap();
        assert_eq!(store.load().unwrap().settings["theme"], "purple");
        fs::write(root.join("saved.ini"), "[analyzer]\ndepth=broken\n").unwrap();
        assert!(store.load().unwrap().saved.is_empty());
        fs::remove_file(root.join("settings.ini")).unwrap();
        fs::remove_file(root.join("saved.ini")).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
