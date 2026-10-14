use serde::Deserialize;
use shakmaty::{uci::UciMove, CastlingMode, Chess, Color, Position, Role};

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlayMode {
    #[default]
    Normal,
    QueenCollector,
}

#[derive(Clone, Debug)]
pub struct Candidate {
    pub uci: String,
    pub score: i32,
    pub mate: Option<i32>,
    pub depth: u8,
    pub index: usize,
    pub info: String,
}

impl Candidate {
    pub fn parse(line: &str) -> Option<Self> {
        let words: Vec<_> = line.split_whitespace().collect();
        if words.first()? != &"info"
            || words.contains(&"lowerbound")
            || words.contains(&"upperbound")
        {
            return None;
        }
        let value = |key| {
            words
                .iter()
                .position(|word| *word == key)
                .and_then(|i| words.get(i + 1))
                .copied()
        };
        let pv = words.iter().position(|word| *word == "pv")?;
        let uci = words.get(pv + 1)?.to_string();
        uci.parse::<UciMove>().ok()?;
        let score_kind = words.iter().position(|word| *word == "score")?;
        let number: i32 = words.get(score_kind + 2)?.parse().ok()?;
        let mate = (words.get(score_kind + 1)? == &"mate").then_some(number);
        let score = match mate {
            Some(n) if n > 0 => 100_000 - n,
            Some(n) => -100_000 - n,
            None => number,
        };
        Some(Self {
            uci,
            score,
            mate,
            depth: value("depth")?.parse().ok()?,
            index: value("multipv").unwrap_or("1").parse().ok()?,
            info: line.into(),
        })
    }
}

fn draw(pos: &Chess, history: &[Chess]) -> bool {
    !pos.is_checkmate()
        && (pos.is_stalemate()
            || pos.is_insufficient_material()
            || pos.halfmoves() >= 100
            || history.iter().filter(|old| *old == pos).count() >= 2)
}

fn safe_child(pos: &Chess, history: &[Chess]) -> bool {
    if draw(pos, history) {
        return false;
    }
    if pos.is_checkmate() {
        return true;
    }
    let mut past = history.to_vec();
    past.push(pos.clone());
    // I reject moves that let the opponent end the game with an immediate draw or mate.
    !pos.legal_moves().iter().any(|mv| {
        let mut reply = pos.clone();
        reply.play_unchecked(*mv);
        reply.is_checkmate() || draw(&reply, &past)
    })
}

pub fn choose(
    fen: &str,
    history: &[String],
    candidates: &[Candidate],
    fallback: &str,
) -> (String, String) {
    let Ok(pos) = crate::rules::position(fen) else {
        return (fallback.into(), "Using Stockfish's strongest move.".into());
    };
    let side = pos.turn();
    let has_pawns = pos
        .board()
        .pawns()
        .into_iter()
        .any(|sq| pos.board().color_at(sq) == Some(side));
    let Some(best) = candidates.iter().max_by_key(|candidate| candidate.score) else {
        return (
            fallback.into(),
            "Using Stockfish's strongest move; no complete comparison is available.".into(),
        );
    };
    if !has_pawns || best.score < 200 {
        return (
            fallback.into(),
            if has_pawns {
                "Keeping the strongest move until the position has a clear advantage."
            } else {
                "No pawns left to promote; finishing with Stockfish's strongest move."
            }
            .into(),
        );
    }
    let minimum = if best.mate.is_some_and(|mate| mate > 0) {
        800
    } else {
        (best.score - 100).max(200)
    };
    let mut past = history
        .iter()
        .rev()
        .take(1000)
        .filter_map(|fen| crate::rules::position(fen).ok())
        .collect::<Vec<_>>();
    past.push(pos.clone());
    let mut selected = None;
    for candidate in candidates.iter().filter(|candidate| {
        candidate.score >= minimum && !candidate.mate.is_some_and(|mate| mate < 0)
    }) {
        let Ok(uci) = candidate.uci.parse::<UciMove>() else {
            continue;
        };
        let Ok(mv) = uci.to_move(&pos) else {
            continue;
        };
        let mut child = pos.clone();
        child.play_unchecked(mv);
        if !safe_child(&child, &past) {
            continue;
        }
        let progress = if side == Color::White {
            mv.to().rank().to_u32()
        } else {
            7 - mv.to().rank().to_u32()
        } as i32;
        let promotion = mv.promotion() == Some(Role::Queen);
        let pawn_bonus = if promotion {
            2000
        } else if mv.role() == Role::Pawn {
            80 + progress * 18
        } else {
            0
        };
        let loss = if best.mate.is_some() && candidate.mate.is_some() {
            0
        } else {
            (best.score.min(1500) - candidate.score.min(1500)).max(0)
        };
        let rank = pawn_bonus - loss - if child.is_checkmate() { 5000 } else { 0 };
        if selected
            .as_ref()
            .is_none_or(|(_, best_rank, _)| rank > *best_rank)
        {
            let explanation = if promotion {
                "Promoting another queen while preserving the evaluated advantage."
            } else if mv.role() == Role::Pawn {
                "Advancing a pawn while retaining the advantage and checking immediate draw risks."
            } else if child.is_checkmate() {
                "Taking mate because no safe collecting move is available."
            } else {
                "Keeping the evaluated advantage while preparing the next promotion."
            };
            selected = Some((
                UciMove::from_move(mv, CastlingMode::Standard).to_string(),
                rank,
                explanation,
            ));
        }
    }
    selected
        .map(|(uci, _, reason)| (uci, reason.into()))
        .unwrap_or_else(|| {
            (
                fallback.into(),
                "Falling back to Stockfish's strongest move; collecting would risk the result."
                    .into(),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn candidate(uci: &str, cp: i32) -> Candidate {
        Candidate::parse(&format!("info depth 8 multipv 1 score cp {cp} pv {uci}")).unwrap()
    }
    #[test]
    fn collector_promotes_but_does_not_trade_away_the_advantage() {
        let fen = "7k/P7/8/8/8/8/8/K2Q4 w - - 0 1";
        let lines = [candidate("d1d2", 1100), candidate("a7a8q", 1080)];
        assert_eq!(choose(fen, &[], &lines, "d1d2").0, "a7a8q");
        let lines = [candidate("d1d2", 1100), candidate("a7a8q", 0)];
        assert_eq!(choose(fen, &[], &lines, "d1d2").0, "d1d2");
    }
    #[test]
    fn collector_rejects_stalemate_and_threefold_repetition() {
        let stale = crate::rules::position("7k/5K2/6Q1/8/8/8/P7/8 b - - 0 1").unwrap();
        assert!(!safe_child(&stale, &[]));
        let pos = crate::rules::position("7k/8/8/8/8/8/P7/K2Q4 b - - 0 1").unwrap();
        assert!(!safe_child(&pos, &[pos.clone(), pos.clone()]));
        assert!(Candidate::parse("info depth 8 score cp 50 lowerbound pv e2e4").is_none());
    }
}
