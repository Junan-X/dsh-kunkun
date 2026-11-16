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

## What it does not do

- It does not change colors, fonts, layout, or any other part of the interface.
- It does not touch the host theme preference.

## Install

```sh
dsh plugin add github:Junan-X/dsh-kunkun
```

Restart DSH after installing.
