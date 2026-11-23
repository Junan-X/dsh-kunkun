# Kunkun skin

A decorative skin for DeepSeek Harness (Web and Desktop share the Web client).

## What it does

- Draws the Kunkun mascot as a fixed image at the bottom-right corner of the shell.
- The mascot is `pointer-events: none`, so it never blocks clicks or scrolling.
- A settings panel — **Settings → Kunkun skin** and the bundle page under **Plugins → dsh-kunkun**, both rendering the same component — offers:
  - a switch to show or hide the mascot;
  - a choice between the still Kunkun image, the basketball animation, and a custom image;
  - an upload button for your own GIF/WebP/PNG/JPEG image (≤ 5 MB), stored in the browser's IndexedDB and deleted by the Remove button.
  - a placement switch: a small mascot at the bottom-right corner, or a full-background layer mounted behind the interface (negative z-index on the document body) that is slightly translucent and fades out from right to left.
- Built-in artwork is served by the bundle's Host half through one prefix route (`/plugins/dsh-kunkun/assets/*`) that covers the whole `assets/` folder, so new artwork only needs a file drop; the client references those URLs and the browser caches them. Uploaded images stay in the browser's IndexedDB and never leave the machine.
- Animations are listed in `assets/anim/manifest.json`: `frames >= 2` renders a horizontal sprite strip so the slider can retime it, while `frames: 1` (or no `frames`) plays the original GIF/animated WebP as-is and ignores the slider. `node scripts/make-anim.mjs <source>` converts a GIF/MP4/WebP into a strip and appends the manifest entry; `--native` copies the file as-is instead.
- An effort slider in the composer toolbar (`conversation.input.right`) drives two things at once: while dragging it continuously changes the basketball animation's playback speed (30%–300%, any value, played from a 17-frame sprite strip with CSS `steps()` because native image animations cannot be retimed), The track is divided into N equal regions (N = effort count): the region the knob sits in is the reasoning level, and on release that region's effort is committed through the official ModelDirectory. The slider never disappears: when the model advertises fewer than two efforts (common for third-party providers), when the session is an addressed subagent, or when the model-directory service is unavailable, it degrades to a speed-only slider that still controls the animation. The settings panel shows a live diagnostics box (registration, props resolution, last render mode).

## What it does not do

- It does not change colors, fonts, layout, or any other part of the interface.
- It does not touch the host theme preference.

## Install

```sh
dsh plugin add github:Junan-X/dsh-kunkun
```

Restart DSH after installing.
