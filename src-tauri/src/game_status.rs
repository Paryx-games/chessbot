use serde::Serialize;
use shakmaty::{fen::Fen, CastlingMode, Chess, Color, Position};

#[derive(Debug, Serialize)]
pub struct GameStatus {
    kind: &'static str,
    message: String,
    checked_square: Option<u8>,
    terminal: bool,
}

fn position(fen: &str) -> Result<Chess, String> {
    crate::engine::validate_fen(fen)?;
    fen.parse::<Fen>()
        .map_err(|e| e.to_string())?
        .into_position(CastlingMode::Standard)
        .map_err(|e| e.to_string())
}

pub fn inspect(fen: &str, history: &[String]) -> GameStatus {
    let pos = match position(fen) {
        Ok(pos) => pos,
        Err(error) => {
            return GameStatus {
                kind: "invalid",
                message: error,
                checked_square: None,
                terminal: false,
            }
        }
    };
    let side = if pos.turn() == Color::White {
        "White"
    } else {
        "Black"
    };
    let checked_square = if pos.is_check() {
        pos.board()
            .king_of(pos.turn())
            .map(|sq| (7 - u8::from(sq) / 8) * 8 + u8::from(sq) % 8)
    } else {
        None
    };
    let repetitions = 1 + history
        .iter()
        .rev()
        .take(1000)
        .filter_map(|fen| position(fen).ok())
        .filter(|previous| previous == &pos)
        .count();
    let (kind, message, terminal) = if pos.is_checkmate() {
        let winner = if pos.turn() == Color::White {
            "Black"
        } else {
            "White"
        };
        ("checkmate", format!("Checkmate — {winner} wins"), true)
    } else if pos.is_stalemate() {
        ("draw", "Stalemate — draw".into(), true)
    } else if pos.is_insufficient_material() {
        ("draw", "Draw — insufficient material".into(), true)
    } else if pos.halfmoves() >= 150 {
        ("draw", "Draw — seventy-five-move rule".into(), true)
    } else if repetitions >= 5 {
        ("draw", "Draw — fivefold repetition".into(), true)
    } else if pos.halfmoves() >= 100 {
        (
            "draw",
            "Draw available — fifty-move rule (claimable)".into(),
            true,
        )
    } else if repetitions >= 3 {
        (
            "draw",
            "Draw available — threefold repetition (claimable)".into(),
            true,
        )
    } else if checked_square.is_some() {
        ("check", format!("Check — {side} to move"), false)
    } else {
        ("playing", format!("{side} to move"), false)
    };
    GameStatus {
        kind,
        message,
        checked_square,
        terminal,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn distinguishes_mate_stalemate_and_check() {
        let mate = inspect("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", &[]);
        assert_eq!(mate.message, "Checkmate — White wins");
        assert_eq!(mate.checked_square, Some(7));
        assert!(mate.terminal);
        let stale = inspect("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1", &[]);
        assert_eq!(stale.message, "Stalemate — draw");
        assert_eq!(stale.checked_square, None);
        let check = inspect("7k/8/8/8/8/8/8/K6R b - - 0 1", &[]);
        assert_eq!(check.kind, "check");
        assert!(!check.terminal);
    }
    #[test]
    fn draw_rules_and_mate_precedence() {
        assert_eq!(
            inspect("7k/8/8/8/8/8/8/K7 w - - 0 1", &[]).message,
            "Draw — insufficient material"
        );
        let fen = "7k/8/8/8/8/8/8/KR6 w - - 100 51";
        assert!(inspect(fen, &[]).message.contains("fifty-move"));
        assert!(inspect(&fen.replace("100", "150"), &[])
            .message
            .contains("seventy-five"));
        let current = fen.replace("100", "0");
        assert!(inspect(&current, &[fen.into(), fen.into()])
            .message
            .contains("threefold"));
        assert!(inspect(&current, &vec![fen.into(); 4])
            .message
            .contains("fivefold"));
        assert_eq!(
            inspect("7k/6Q1/5K2/8/8/8/8/8 b - - 150 76", &[]).kind,
            "checkmate"
        );
        assert_eq!(inspect("8/8/8/8/8/8/8/8 w - - 0 1", &[]).kind, "invalid");
    }
}
