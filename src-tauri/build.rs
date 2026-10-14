fn main() {
    println!(
        "cargo:rustc-env=APP_TARGET={}",
        std::env::var("TARGET").unwrap()
    );
    tauri_build::build()
}
