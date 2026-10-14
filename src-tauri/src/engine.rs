use serde::Deserialize;
use shakmaty::{fen::Fen, CastlingMode, Chess};

pub fn max_threads() -> u8 {
    std::thread::available_parallelism().map_or(1, |count| count.get().min(16) as u8)
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct EngineTuning {
    pub threads: u8,
    pub hash: u16,
    pub lines: u8,
}
impl Default for EngineTuning {
    fn default() -> Self {
        Self {
            threads: max_threads().min(2),
            hash: 64,
            lines: 1,
        }
    }
}
impl EngineTuning {
    fn validate(self) -> Result<(), String> {
        if !(1..=max_threads()).contains(&self.threads) {
            return Err(format!(
                "CPU threads must be between 1 and {}",
                max_threads()
            ));
        }
        if !(16..=1024).contains(&self.hash) {
            return Err("Hash memory must be between 16 and 1024 MiB".into());
        }
        if !(1..=5).contains(&self.lines) {
            return Err("Analysis lines must be between 1 and 5".into());
        }
        Ok(())
    }
}

pub struct SearchOptions<'a> {
    pub fen: &'a str,
    pub depth: u8,
    pub elo: Option<u16>,
    pub tuning: EngineTuning,
}
use std::{
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

pub fn validate_fen(fen: &str) -> Result<(), String> {
    if fen.len() > 200 || fen.contains(['\n', '\r']) {
        return Err("Invalid FEN".into());
    }
    let parsed: Fen = fen.parse().map_err(|e| format!("Invalid FEN: {e}"))?;
    parsed
        .into_position::<Chess>(CastlingMode::Standard)
        .map_err(|e| format!("Position cannot be analysed: {e}"))?;
    Ok(())
}

pub struct Engine {
    child: Child,
    stdin: ChildStdin,
    output: mpsc::Receiver<String>,
    pub name: String,
    tuning: EngineTuning,
}

impl Drop for Engine {
    fn drop(&mut self) {
        let _ = self.send("quit");
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Engine {
    pub fn start(path: &Path) -> Result<Self, String> {
        let mut command = Command::new(path);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("Cannot start Stockfish: {e}"))?;
        let stdin = child.stdin.take().ok_or("Stockfish stdin unavailable")?;
        let stdout = child.stdout.take().ok_or("Stockfish stdout unavailable")?;
        let (tx, output) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                match line {
                    Ok(line) => {
                        if tx.send(line).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        let mut engine = Self {
            child,
            stdin,
            output,
            name: "Stockfish".into(),
            tuning: EngineTuning::default(),
        };
        engine.send("uci")?;
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            let line = engine.read(deadline)?;
            if let Some(name) = line.strip_prefix("id name ") {
                engine.name = name.into();
            }
            if line == "uciok" {
                break;
            }
        }
        engine.send(&format!(
            "setoption name Threads value {}",
            engine.tuning.threads
        ))?;
        engine.send("setoption name Hash value 64")?;
        engine.send("isready")?;
        while engine.read(deadline)? != "readyok" {}
        Ok(engine)
    }

    fn send(&mut self, line: &str) -> Result<(), String> {
        writeln!(self.stdin, "{line}")
            .and_then(|_| self.stdin.flush())
            .map_err(|e| format!("Stockfish input failed: {e}"))
    }

    fn read(&self, deadline: Instant) -> Result<String, String> {
        let remaining = deadline.saturating_duration_since(Instant::now());
        self.output
            .recv_timeout(remaining)
            .map_err(|e| format!("Stockfish stopped responding: {e}"))
    }

    #[cfg(test)]
    pub fn analyse(
        &mut self,
        fen: &str,
        depth: u8,
        generation: u64,
        latest: &AtomicU64,
        emit: impl FnMut(&str),
    ) -> Result<(), String> {
        self.analyse_options(
            SearchOptions {
                fen,
                depth,

                elo: None,
                tuning: EngineTuning::default(),
            },
            generation,
            latest,
            emit,
        )
    }

    pub fn analyse_options(
        &mut self,
        options: SearchOptions<'_>,
        generation: u64,
        latest: &AtomicU64,
        mut emit: impl FnMut(&str),
    ) -> Result<(), String> {
        let SearchOptions {
            fen,
            depth,
            elo,
            tuning,
        } = options;
        tuning.validate()?;
        validate_fen(fen)?;
        if !(1..=48).contains(&depth) {
            return Err("Depth must be between 1 and 48".into());
        }
        if elo.is_some_and(|elo| !(1320..=3190).contains(&elo)) {
            return Err("Elo must be between 1320 and 3190".into());
        }
        if latest.load(Ordering::SeqCst) != generation {
            return Ok(());
        }
        self.send("setoption name Skill Level value 20")?;
        self.send(&format!(
            "setoption name UCI_LimitStrength value {}",
            elo.is_some()
        ))?;
        if let Some(elo) = elo {
            self.send(&format!("setoption name UCI_Elo value {elo}"))?;
        }
        if tuning.threads != self.tuning.threads {
            self.send(&format!("setoption name Threads value {}", tuning.threads))?;
        }
        if tuning.hash != self.tuning.hash {
            self.send(&format!("setoption name Hash value {}", tuning.hash))?;
        }
        self.send(&format!("setoption name MultiPV value {}", tuning.lines))?;
        self.tuning = tuning;
        self.send(&format!("position fen {fen}"))?;
        self.send(&format!("go depth {depth}"))?;
        // Depth-limited searches may take a long time; only cancellation has a timeout.
        let mut deadline = None;
        let mut stopped = false;
        loop {
            if !stopped && latest.load(Ordering::SeqCst) != generation {
                self.send("stop")?;
                stopped = true;
                deadline = Some(Instant::now() + Duration::from_secs(5));
            }
            if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
                return Err("Stockfish search timed out".into());
            }
            match self.output.recv_timeout(Duration::from_millis(30)) {
                Ok(line) => {
                    if !stopped && latest.load(Ordering::SeqCst) == generation {
                        emit(&line);
                    }
                    if line.starts_with("bestmove ") {
                        return Ok(());
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => return Err("Stockfish exited unexpectedly".into()),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const START: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    #[test]
    fn tuning_validates_ranges_and_resets_multipv_between_searches() {
        let defaults = EngineTuning::default();
        for tuning in [
            EngineTuning {
                threads: 0,
                ..defaults
            },
            EngineTuning {
                threads: max_threads() + 1,
                ..defaults
            },
            EngineTuning {
                hash: 15,
                ..defaults
            },
            EngineTuning {
                hash: 1025,
                ..defaults
            },
            EngineTuning {
                lines: 0,
                ..defaults
            },
            EngineTuning {
                lines: 6,
                ..defaults
            },
        ] {
            assert!(tuning.validate().is_err());
        }
        assert!(EngineTuning {
            threads: max_threads(),
            hash: 1024,
            lines: 5
        }
        .validate()
        .is_ok());
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("binaries/stockfish-x86_64-pc-windows-msvc.exe");
        let mut engine = Engine::start(&path).unwrap();
        let latest = AtomicU64::new(1);
        let tuning = EngineTuning {
            threads: 1,
            hash: 32,
            lines: 5,
        };
        let mut variations = std::collections::BTreeSet::new();
        engine
            .analyse_options(
                SearchOptions {
                    fen: START,
                    depth: 4,
                    elo: None,
                    tuning,
                },
                1,
                &latest,
                |line| {
                    let words = line.split_whitespace().collect::<Vec<_>>();
                    if let Some(index) = words.iter().position(|word| *word == "multipv") {
                        variations.insert(words[index + 1].to_string());
                    }
                },
            )
            .unwrap();
        assert_eq!(
            variations,
            ["1", "2", "3", "4", "5"]
                .into_iter()
                .map(String::from)
                .collect()
        );
        assert_eq!(engine.tuning, tuning);
        let mut extra_line = false;
        engine
            .analyse(START, 4, 1, &latest, |line| {
                extra_line |= line.contains("multipv 2");
            })
            .unwrap();
        assert!(!extra_line);
        assert_eq!(engine.tuning, defaults);
    }

    #[test]
    fn elo_limits_validate_cancel_and_reset_between_searches() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("binaries/stockfish-x86_64-pc-windows-msvc.exe");
        let mut engine = Engine::start(&path).unwrap();
        let latest = AtomicU64::new(1);
        for elo in [Some(1319), Some(3191)] {
            assert!(engine
                .analyse_options(
                    SearchOptions {
                        fen: START,
                        depth: 4,
                        elo,
                        tuning: EngineTuning::default(),
                    },
                    1,
                    &latest,
                    |_| {}
                )
                .is_err());
        }
        for elo in [Some(1320), Some(3190), None] {
            let mut best = String::new();
            engine
                .analyse_options(
                    SearchOptions {
                        fen: START,
                        depth: 4,
                        elo,
                        tuning: EngineTuning::default(),
                    },
                    1,
                    &latest,
                    |line| {
                        if let Some(mv) = line.strip_prefix("bestmove ") {
                            best = mv.split_whitespace().next().unwrap().into();
                        }
                    },
                )
                .unwrap();
            crate::rules::make_move(START, &best, true).unwrap();
        }
        std::thread::scope(|scope| {
            scope.spawn(|| {
                std::thread::sleep(Duration::from_millis(80));
                latest.store(2, Ordering::SeqCst);
            });
            engine
                .analyse_options(
                    SearchOptions {
                        fen: START,
                        depth: 48,
                        elo: Some(1600),
                        tuning: EngineTuning::default(),
                    },
                    1,
                    &latest,
                    |_| {},
                )
                .unwrap();
        });
        let mut recovered = false;
        engine
            .analyse(START, 4, 2, &latest, |line| {
                recovered |= line.starts_with("bestmove ");
            })
            .unwrap();
        assert!(recovered);
    }
    #[test]
    fn rejects_unsafe_positions() {
        assert!(validate_fen(START).is_ok());
        assert!(validate_fen("8/8/8/8/8/8/8/8 w - - 0 1").is_err());
        assert!(validate_fen("8/8/8/8/8/8/4k3/4K3 w - - 0 1").is_err());
        assert!(validate_fen(&format!("{START}\nquit")).is_err());
    }
    #[test]
    fn native_sidecar_search_and_cancellation() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("binaries/stockfish-x86_64-pc-windows-msvc.exe");
        let mut engine = Engine::start(&path).unwrap();
        assert!(engine.name.contains("Stockfish 19"));
        let latest = std::sync::Arc::new(AtomicU64::new(1));
        let mut best = String::new();
        engine
            .analyse(START, 6, 1, &latest, |line| {
                if line.starts_with("bestmove ") {
                    best = line.into();
                }
            })
            .unwrap();
        assert!(best.starts_with("bestmove ") && !best.contains("(none)"));
        let cancel = latest.clone();
        let worker = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(80));
            cancel.store(2, Ordering::SeqCst);
        });
        let started = Instant::now();
        engine.analyse(START, 48, 1, &latest, |_| {}).unwrap();
        worker.join().unwrap();
        assert!(started.elapsed() < Duration::from_secs(5));
        assert!(engine.analyse(START, 49, 2, &latest, |_| {}).is_err());
        assert!(engine.analyse(START, 0, 2, &latest, |_| {}).is_err());
        best.clear();
        engine
            .analyse(START, 4, 2, &latest, |line| {
                if line.starts_with("bestmove ") {
                    best = line.into();
                }
            })
            .unwrap();
        assert!(best.starts_with("bestmove "));
        let mate = "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1";
        best.clear();
        engine
            .analyse(mate, 4, 2, &latest, |line| {
                if line.starts_with("bestmove ") {
                    best = line.into();
                }
            })
            .unwrap();
        assert!(best.contains("(none)") || best.contains("0000"));
    }
}
