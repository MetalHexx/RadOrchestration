---
project: "ORCHESTRATION-REORG"
phase: 5
task: 3
title: "Create Assets Directory & Placeholder Screenshot"
status: "pending"
skills_required: ["file-operations"]
skills_optional: []
estimated_files: 1
---

# Create Assets Directory & Placeholder Screenshot

## Objective

Create the `assets/` directory at workspace root and add a valid minimal PNG placeholder at `assets/dashboard-screenshot.png` so that existing image references in `README.md` and `docs/dashboard.md` resolve to a real file.

## Context

Both `README.md` (line 49) and `docs/dashboard.md` (line 5) already contain image links to a dashboard screenshot that does not yet exist. `README.md` uses `![Monitoring Dashboard](assets/dashboard-screenshot.png)` (relative from workspace root). `docs/dashboard.md` uses `![Monitoring Dashboard](../assets/dashboard-screenshot.png)` (relative from `docs/`). Both paths resolve to the same file: `assets/dashboard-screenshot.png` at workspace root. The PNG must have valid magic bytes so renderers recognize it as a real image.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `assets/dashboard-screenshot.png` | Valid 1×1 transparent PNG placeholder — creates `assets/` directory implicitly |

## Implementation Steps

1. **Create the `assets/` directory** at workspace root if it does not already exist:
   ```bash
   mkdir -p assets
   ```

2. **Generate a valid 1×1 transparent PNG** using Node.js and write it to `assets/dashboard-screenshot.png`. Use the following script:

   ```js
   const fs = require('fs');
   const path = require('path');

   // Minimal valid 1×1 transparent PNG (67 bytes)
   // Structure: PNG signature + IHDR chunk + IDAT chunk + IEND chunk
   const png = Buffer.from([
     // PNG Signature (8 bytes)
     0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
     // IHDR chunk (25 bytes: 4 length + 4 type + 13 data + 4 CRC)
     0x00, 0x00, 0x00, 0x0D,  // chunk length: 13
     0x49, 0x48, 0x44, 0x52,  // chunk type: IHDR
     0x00, 0x00, 0x00, 0x01,  // width: 1
     0x00, 0x00, 0x00, 0x01,  // height: 1
     0x08,                     // bit depth: 8
     0x06,                     // color type: 6 (RGBA)
     0x00,                     // compression: 0
     0x00,                     // filter: 0
     0x00,                     // interlace: 0
     0x1F, 0x15, 0xC4, 0x89,  // CRC of IHDR
     // IDAT chunk (22 bytes: 4 length + 4 type + 10 data + 4 CRC)
     0x00, 0x00, 0x00, 0x0A,  // chunk length: 10
     0x49, 0x44, 0x41, 0x54,  // chunk type: IDAT
     0x78, 0x9C, 0x62, 0x00,  // zlib-compressed data:
     0x00, 0x00, 0x05, 0x00,  //   deflate stream for 1 row of
     0x01, 0x0D,              //   filter-none + 4 zero bytes (transparent RGBA)
     0x0A, 0x2D, 0xB4, 0x00,  // CRC of IDAT
     // IEND chunk (12 bytes: 4 length + 4 type + 0 data + 4 CRC)
     0x00, 0x00, 0x00, 0x00,  // chunk length: 0
     0x49, 0x45, 0x4E, 0x44,  // chunk type: IEND
     0xAE, 0x42, 0x60, 0x82   // CRC of IEND
   ]);

   const dir = path.join(process.cwd(), 'assets');
   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
   fs.writeFileSync(path.join(dir, 'dashboard-screenshot.png'), png);
   console.log('Created assets/dashboard-screenshot.png (' + png.length + ' bytes)');
   ```

   Run the script from workspace root:
   ```bash
   node -e "<paste the script above>"
   ```
   Or save it as a temp file and run it.

3. **Verify the PNG magic bytes** — the first 8 bytes of the file must be:
   ```
   89 50 4E 47 0D 0A 1A 0A
   ```
   Verify with:
   ```bash
   node -e "const b = require('fs').readFileSync('assets/dashboard-screenshot.png'); console.log('Magic:', b.slice(0,8).toString('hex')); console.log('Valid PNG:', b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47);"
   ```

4. **Verify image link resolution** — confirm both referencing files point to this path:
   ```bash
   node -e "const fs=require('fs'); const r=fs.readFileSync('README.md','utf8'); const d=fs.readFileSync('docs/dashboard.md','utf8'); console.log('README ref:', r.includes('assets/dashboard-screenshot.png')); console.log('dashboard ref:', d.includes('../assets/dashboard-screenshot.png'));"
   ```

## Contracts & Interfaces

No code contracts apply. The file is a binary image asset. The only contract is:

- **PNG file format**: Must start with the 8-byte PNG signature `89 50 4E 47 0D 0A 1A 0A`
- **File path**: Must be exactly `assets/dashboard-screenshot.png` relative to workspace root
- **Image references** (already exist, read-only — do NOT modify):
  - `README.md`: `![Monitoring Dashboard](assets/dashboard-screenshot.png)`
  - `docs/dashboard.md`: `![Monitoring Dashboard](../assets/dashboard-screenshot.png)`

## Styles & Design Tokens

Not applicable — this is a binary image asset, not a UI component.

## Test Requirements

- [ ] `assets/` directory exists at workspace root
- [ ] `assets/dashboard-screenshot.png` file exists and is non-empty
- [ ] First 8 bytes of `dashboard-screenshot.png` are `89 50 4E 47 0D 0A 1A 0A` (PNG magic bytes)
- [ ] `README.md` contains the string `assets/dashboard-screenshot.png` (pre-existing, not modified)
- [ ] `docs/dashboard.md` contains the string `../assets/dashboard-screenshot.png` (pre-existing, not modified)

## Acceptance Criteria

- [ ] `assets/` directory exists at workspace root
- [ ] `assets/dashboard-screenshot.png` is a valid PNG file (starts with PNG magic bytes `89 50 4E 47 0D 0A 1A 0A`)
- [ ] File size is > 0 bytes
- [ ] Image link in `README.md` resolves to `assets/dashboard-screenshot.png` (verified by string match)
- [ ] Image link in `docs/dashboard.md` resolves to `../assets/dashboard-screenshot.png` (verified by string match)
- [ ] No other files were created or modified (this task creates exactly 1 file)

## Constraints

- Do NOT modify `README.md` — the image reference already exists
- Do NOT modify `docs/dashboard.md` — the image reference already exists
- Do NOT modify any files under `.github/projects/` (frozen artifact boundary)
- Do NOT create any files other than `assets/dashboard-screenshot.png`
- The PNG MUST be a valid image file, not just random bytes with a `.png` extension — it must have proper IHDR, IDAT, and IEND chunks
