# Kunkun skin

A decorative skin for DeepSeek Harness (Web and Desktop share the Web client).

## What it does

- Draws the Kunkun mascot as a fixed image at the bottom-right corner of the shell.
- The mascot is `pointer-events: none`, so it never blocks clicks or scrolling.
- The image is embedded in the client module as a data URI; no asset route or network access is needed.

## What it does not do

- It does not change colors, fonts, layout, or any other part of the interface.
- It has no settings; disable the bundle in **Plugins** to remove it.

## Install

```sh
dsh plugin add github:Junan-X/dsh-kunkun
```

Restart DSH after installing.
