use shakmaty::{fen::Fen, uci::UciMove, CastlingMode, Chess, EnPassantMode, Position};

pub fn position(fen: &str) -> Result<Chess, String> {
    crate::engine::validate_fen(fen)?;
    fen.parse::<Fen>()
        .map_err(|e| e.to_string())?
        .into_position(CastlingMode::Standard)
        .map_err(|e| e.to_string())
}

pub fn analysis_fen(fen: &str, castling: bool) -> String {
    if castling {
        return fen.to_owned();
    }
    let mut fields: Vec<_> = fen.split_whitespace().collect();
    if fields.len() >= 3 {
        fields[2] = "-";
    }
    fields.join(" ")
}

pub fn legal_moves(fen: &str, castling: bool) -> Result<Vec<String>, String> {
    let pos = position(fen)?;
    Ok(pos
        .legal_moves()
        .iter()
        .filter(|m| castling || !m.is_castle())
        .map(|m| UciMove::from_move(*m, CastlingMode::Standard).to_string())
        .collect())
}

pub fn make_move(fen: &str, uci: &str, castling: bool) -> Result<String, String> {
    let mut pos = position(fen)?;
    let mv = uci
        .parse::<UciMove>()
        .map_err(|_| "Invalid move")?
        .to_move(&pos)
        .map_err(|_| "That move is not legal in this position")?;
    if mv.is_castle() && !castling {
        return Err("Castling is disabled".into());
    }
    pos.play_unchecked(mv);
    Ok(Fen::from_position(&pos, EnPassantMode::Always).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn castling_moves_both_pieces_and_checks_attacks_and_rights() {
        let fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
        let moves = legal_moves(fen, true).unwrap();
        assert!(moves.contains(&"e1g1".into()) && moves.contains(&"e1c1".into()));
        assert!(make_move(fen, "e1g1", true)
            .unwrap()
            .starts_with("r3k2r/8/8/8/8/8/8/R4RK1 b kq"));
        assert!(make_move(fen, "e1c1", true)
            .unwrap()
            .starts_with("r3k2r/8/8/8/8/8/8/2KR3R b kq"));
        assert!(make_move(fen, "e1g1", false).is_err());
        assert!(!legal_moves(fen, false).unwrap().contains(&"e1g1".into()));
        let attacked = "r3kr1r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
        assert!(make_move(attacked, "e1g1", true).is_err());
        assert!(make_move(&fen.replace("KQkq", "-"), "e1g1", true).is_err());
        let black = fen.replace(" w ", " b ");
        assert!(make_move(&black, "e8g8", true)
            .unwrap()
            .starts_with("r4rk1/"));
    }
    #[test]
    fn legal_rules_enforce_turn_pins_en_passant_and_promotion() {
        let start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        assert!(make_move(start, "e2e5", true).is_err());
        assert!(make_move(start, "e7e5", true).is_err());
        assert!(make_move(start, "e2e4", true)
            .unwrap()
            .ends_with("b KQkq e3 0 1"));
        assert!(make_move("4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1", "e2d2", true).is_err());
        assert!(make_move("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1", "e5d6", true)
            .unwrap()
            .starts_with("7k/8/3P4/8/"));
        assert!(make_move("7k/P7/8/8/8/8/8/K7 w - - 0 1", "a7a8n", true)
            .unwrap()
            .starts_with("N6k/"));
    }
}
