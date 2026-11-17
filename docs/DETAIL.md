# Kunkun skin

A decorative skin for DeepSeek Harness (Web and Desktop share the Web client).

## What it does

- Draws the Kunkun mascot as a fixed image at the bottom-right corner of the shell.
- The mascot is `pointer-events: none`, so it never blocks clicks or scrolling.
- A settings panel — **Settings → Kunkun skin** and the bundle page under **Plugins → dsh-kunkun**, both rendering the same component — offers:
  - a switch to show or hide the mascot;
  - a choice between the still Kunkun image, the basketball animation, and a custom image;
  - an upload button for your own GIF/WebP/PNG/JPEG image (≤ 5 MB), stored in the browser's IndexedDB and deleted by the Remove button.
- Built-in images are embedded in the client module as data URIs; no asset route or network access is needed.
- An effort slider in the composer toolbar (`conversation.input.left`) drives two things at once: while dragging it continuously changes the basketball animation's playback speed (0.5×–2×, played from a 17-frame sprite strip with CSS `steps()` because native image animations cannot be retimed), and on release it commits the nearest reasoning-effort stop through the official ModelDirectory. The slider never disappears: when the model advertises fewer than two efforts (common for third-party providers), when the session is an addressed subagent, or when the model-directory service is unavailable, it degrades to a speed-only slider that still controls the animation. The settings panel shows a live diagnostics box (registration, props resolution, last render mode).

## What it does not do

- It does not change colors, fonts, layout, or any other part of the interface.
- It does not touch the host theme preference.

## Install

```sh
dsh plugin add github:Junan-X/dsh-kunkun
```

Restart DSH after installing.
