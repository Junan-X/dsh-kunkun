#!/usr/bin/env node
/**
 * 把动图放进皮肤：转成「精灵条」并写进 assets/anim/manifest.json。
 *
 * 两种用法：
 *   1) 转换成可调速的精灵条（推荐）
 *      node scripts/make-anim.mjs 你的动图.gif --id kunkun2 --zh 坤坤二号 --en Kunkun 2
 *   2) 原样使用（.webp / .gif 直接拷贝，不做逐帧，滑块调速对它无效）
 *      node scripts/make-anim.mjs 你的动图.webp --id kunkun2 --native --zh 坤坤二号
 *
 * 参数：
 *   --id       动图标识（字母、数字、- 和 _），默认取源文件名
 *   --frames   帧数，默认按源文件实际帧数；源帧更多时会等间隔抽帧
 *   --frame-ms 每帧毫秒，默认按源文件时长均分
 *   --width    每帧宽度，默认 180（高度按原图比例，自动取偶数）
 *   --zh       中文名
 *   --en       英文名
 *   --out      输出文件，默认 assets/anim/<id>.webp
 *   --native   不转换，直接拷贝源文件（只支持 .webp / .gif）
 *   --quality  WebP 质量，默认 82
 *
 * 依赖系统里的 ffmpeg（macOS：brew install ffmpeg）。ffmpeg 没带 libwebp 时，
 * 会改用 cwebp 或 ImageMagick 编码。
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = join(ROOT, "assets");
const MANIFEST = join(ASSET_DIR, "anim", "manifest.json");

function fail(message) {
  console.error("✗ " + message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) options[key] = true;
    else { options[key] = next; i += 1; }
  }
  return { options, positional };
}

function run(file, args) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function probe(file) {
  const out = run("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-count_frames",
    "-show_entries", "stream=nb_read_frames,width,height,duration,avg_frame_rate",
    "-of", "json", file,
  ]);
  const stream = JSON.parse(out).streams?.[0];
  if (!stream) fail("源文件里没有视频流：" + file);
  return {
    frames: Number(stream.nb_read_frames) || 0,
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    duration: Number(stream.duration) || 0,
    fps: Number(String(stream.avg_frame_rate || "0/1").split("/")[0]) || 0,
  };
}

function hasEncoder(name) {
  try {
    return run("ffmpeg", ["-hide_banner", "-encoders"]).includes(" " + name + " ");
  } catch {
    return false;
  }
}

function hasCommand(name) {
  try {
    run(name, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

function upsertManifest(item) {
  let manifest = { version: 1, items: [] };
  if (existsSync(MANIFEST)) {
    try {
      manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    } catch {
      fail("assets/anim/manifest.json 不是合法 JSON，请先修好它");
    }
  }
  if (!Array.isArray(manifest.items)) manifest.items = [];
  const index = manifest.items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) manifest.items[index] = item;
  else manifest.items.push(item);
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

const { options, positional } = parseArgs(process.argv.slice(2));
const source = positional[0];
if (!source) {
  console.log(
    "用法: node scripts/make-anim.mjs <源动图> --id <标识> [--frames N] [--frame-ms MS] [--width W] [--zh 名字] [--en Name] [--native]"
  );
  process.exit(1);
}
if (!existsSync(source)) fail("找不到源文件：" + source);

try {
  run("ffmpeg", ["-version"]);
} catch {
  fail("没有找到 ffmpeg，请先安装（macOS: brew install ffmpeg）");
}

const id = String(options.id || basename(source, extname(source)))
  .trim()
  .replace(/[^a-zA-Z0-9_-]+/g, "-");
if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/.test(id)) fail("--id 只能用字母、数字、- 和 _：" + id);

const out = resolve(ROOT, String(options.out || join("assets", "anim", id + ".webp")));
const relativeOut = relative(ASSET_DIR, out).split(sep).join("/");
if (relativeOut.startsWith("..")) fail("输出文件必须放在 assets/ 目录内：" + out);
mkdirSync(dirname(out), { recursive: true });

const info = probe(source);
if (!info.width || !info.height) fail("读不到源文件尺寸：" + source);
const label = { zh: String(options.zh || id), en: String(options.en || id) };
const rev = String(Date.now());

/* ---------- 原样使用：直接拷贝，不逐帧 ---------- */
if (options.native) {
  const ext = extname(source).toLowerCase();
  if (![".webp", ".gif"].includes(ext)) fail("--native 只支持 .webp 或 .gif 文件：" + source);
  copyFileSync(resolve(source), out);
  upsertManifest({
    id,
    file: relativeOut,
    frames: 1,
    aspect: Number((info.width / info.height).toFixed(6)),
    rev,
    label,
  });
  console.log(`✓ 图片已直接放入 ${out}（${info.width}×${info.height}，${(statSync(out).size / 1024).toFixed(1)} KB）`);
  console.log("✓ 清单已更新 assets/anim/manifest.json → " + id);
  console.log("· 原样使用（frames: 1）由浏览器自己播放，滑块的播放速度对它无效。");
  console.log("· 想让它跟着滑块调速：去掉 --native 重新跑一次，会转成精灵条。");
  process.exit(0);
}

/* ---------- 转成可调速的精灵条 ---------- */
const frames = Number(options.frames) || info.frames;
if (!Number.isInteger(frames) || frames < 2 || frames > 400) {
  fail(
    info.frames > 400
      ? `源动图有 ${info.frames} 帧，超过 400 帧上限；请用 --frames 指定要取多少帧（会等间隔抽帧），例如 --frames 60`
      : "帧数不合法（需要 2–400），可以用 --frames 指定；探测到 " + info.frames
  );
}
// 帧多的源（比如几秒的视频）按等间隔抽帧，避免只取开头几帧。
const stride = frames < info.frames ? Math.max(1, Math.floor(info.frames / frames)) : 1;
const frameMs =
  Number(options["frame-ms"]) ||
  Math.max(20, Math.round(((info.duration * 1000) / frames) || 1000 / (info.fps || 12)));
const width = Math.max(16, Math.round(Number(options.width) || 180));
const height = Math.round((width * info.height) / info.width / 2) * 2;
// 精灵条是一张图，总宽度受浏览器纹理上限（16384）限制。
if (frames * width > 16384) {
  fail(
    `精灵条总宽 ${frames * width} px 太大（上限 16384）：请用 --frames 减少帧数，或用 --width 缩小每帧宽度`
  );
}

const quality = String(Number(options.quality) || 82);
const tileFilter = [
  stride > 1 ? `select=not(mod(n\\,${stride}))` : null,
  `scale=${width}:${height}:flags=lanczos`,
  `tile=${frames}x1`,
].filter(Boolean).join(",");
const tempDir = mkdtempSync(join(tmpdir(), "dsh-kunkun-anim-"));
const tilePng = join(tempDir, "strip.png");

try {
  // ffmpeg 直接出 webp 最好；这个构建若没带 libwebp，就先拼成 PNG 再交给
  // cwebp / ImageMagick 编码（两者任一可用即可）。
  if (hasEncoder("libwebp")) {
    run("ffmpeg", [
      "-v", "error", "-y", "-i", resolve(source),
      "-vf", tileFilter, "-frames:v", "1",
      "-c:v", "libwebp", "-lossless", "0", "-q:v", quality, "-compression_level", "6",
      out,
    ]);
  } else {
    run("ffmpeg", [
      "-v", "error", "-y", "-i", resolve(source),
      "-vf", tileFilter, "-frames:v", "1",
      tilePng,
    ]);
    if (hasCommand("cwebp")) {
      run("cwebp", ["-quiet", "-q", quality, "-m", "6", tilePng, "-o", out]);
    } else if (hasCommand("magick")) {
      run("magick", [tilePng, "-quality", quality, out]);
    } else {
      fail("ffmpeg 没有 libwebp 编码器，请安装 cwebp 或 ImageMagick：brew install webp imagemagick");
    }
  }
} catch (err) {
  const detail = String(err.stderr || err.message || err).trim();
  fail(
    "转换失败。若源动图不足 " + frames + " 帧，请用 --frames 指定实际帧数。\n" + detail
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const strip = probe(out);
const expected = width * frames;
if (strip.width !== expected) {
  fail(`生成的精灵条宽度是 ${strip.width}，应为 ${expected}（${frames} 帧 × ${width}）`);
}

upsertManifest({
  id,
  file: relativeOut,
  frames,
  frameMs,
  aspect: Number((width / height).toFixed(6)),
  rev,
  label,
});

const kb = (statSync(out).size / 1024).toFixed(1);
const sampled = stride > 1 ? `，源 ${info.frames} 帧每 ${stride} 帧取 1 帧` : "";
console.log(`✓ 精灵条已写入 ${out}（${strip.width}×${strip.height}，${frames} 帧，${kb} KB${sampled}）`);
console.log(`✓ 清单已更新 assets/anim/manifest.json → ${id}`);
console.log("重启 DSH 后即可在「设置 → 坤坤皮肤」里看到这张动图，滑块可以调它的速度。");
