# Branding assets

- `icon.png`: master icon, used to generate the Windows application icon.
- `social-preview.png`: 1280 x 640 GitHub social preview and README banner.
- `src-tauri/icons/icon.ico`: generated Windows icon with multiple sizes.

I've used an ivory chess knight, charcoal background, and green board-square accent. I created the artwork using OpenAI image generation and include it under this repository's license.

To regenerate platform icons after changing the master, run `cargo tauri icon assets/branding/icon.png --output .cache/generated-icons`, then copy `icon.ico` and `icon.png` from that directory into `src-tauri/icons/`.
