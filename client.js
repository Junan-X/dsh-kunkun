window.__ModuleLoader__.load({
  id: "dsh-kunkun",
  factory(require) {
    const React = require("react");
    const h = React.createElement;

    /* 动图 = 横向精灵条（N 帧并排），CSS steps() 播放，用 animation-duration 控制速度
       （原生 <img> 播放的 GIF / 动画 WebP 无法调速，所以统一转成精灵条）。
       素材由 Host 侧静态路由伺服（见 index.js），不再内嵌 base64。 */
    const ASSET_BASE = "/plugins/dsh-kunkun/assets";
    const STATIC_SRC = ASSET_BASE + "/kunkun.webp";
    const MANIFEST_URL = ASSET_BASE + "/anim/manifest.json";

    /* 清单取不到时的兜底：内置的篮球动图。 */
    const FALLBACK_ANIMATION = {
      id: "basketball",
      file: "anim/basketball.webp",
      frames: 17,
      frameMs: 200,
      aspect: 180 / 210,
      rev: "",
      label: { zh: "篮球动图", en: "Basketball" },
    };

    const NS = "settings.dsh-kunkun";
    const SETTINGS_KEY = "dsh-kunkun/settings/v1";
    const DB_NAME = "dsh-kunkun";
    const DB_STORE = "media";
    const DB_KEY = "custom-image";
    const MAX_CUSTOM_BYTES = 5 * 1024 * 1024;
    const ACCEPT = /^image\/(gif|webp|png|jpe?g)$/;

    const zh = {
      nav: "坤坤皮肤",
      title: "坤坤皮肤",
      description: "在界面右下角显示坤坤立绘，可切换静态图或动图，也支持上传自己的图片。",
      enable: "显示坤坤立绘",
      enableHint: "关闭后右下角不再显示立绘；设置入口仍可打开。",
      variant: "立绘样式",
      variantHint: "选择右下角显示的图片，立即生效。",
      static: "静态坤坤",
      gif: "篮球动图",
      custom: "自定义图片",
      customEmpty: "尚未上传",
      upload: "选择图片…",
      remove: "移除",
      busy: "正在读取图片…",
      saved: "已保存",
      errorType: "只支持 GIF、WebP、PNG 或 JPEG 图片。",
      errorSize: "图片太大，请选择 5 MB 以内的文件。",
      errorGeneric: "无法读取这张图片，请换一张再试。",
      "slider.title": "推理等级",
      "slider.speedOnly": "动图速度",
      placement: "动图位置",
      placementHint: "右下角显示小立绘，或铺在整个界面背景（稍微透明，从右到左渐隐）。",
      placementCorner: "右下角",
      placementStage: "全屏背景",
      speedRange: "速度范围",
      speedRangeHint: "滑到最左 / 最右对应的播放速度，可设 10%–1000%，最慢必须小于最快。",
      speedRangeSlow: "最慢",
      speedRangeFast: "最快",
      speedRangeNow: "当前",
      speedRangeInvalid: "范围不合法：需在 10%–1000% 之间，且最慢小于最快。",
      speedRangeDone: "速度范围已更新",
      speedRangeDefault: "恢复默认",
      "diag.title": "滑块诊断（反馈给作者）",
    };
    const en = {
      nav: "Kunkun skin",
      title: "Kunkun skin",
      description: "Show the Kunkun mascot at the bottom-right corner, switch between the still image and the animation, or upload your own picture.",
      enable: "Show the Kunkun mascot",
      enableHint: "Turn off to hide the mascot; the settings entry stays available.",
      variant: "Mascot image",
      variantHint: "Choose what the bottom-right corner shows; applies immediately.",
      static: "Kunkun still",
      gif: "Basketball animation",
      custom: "Custom image",
      customEmpty: "Not uploaded yet",
      upload: "Choose image…",
      remove: "Remove",
      busy: "Reading image…",
      saved: "Saved",
      errorType: "Only GIF, WebP, PNG or JPEG images are supported.",
      errorSize: "Image is too large; pick a file under 5 MB.",
      errorGeneric: "Could not read this image, please try another one.",
      "slider.title": "Reasoning effort",
      "slider.speedOnly": "Animation speed",
      placement: "Mascot placement",
      placementHint: "A small mascot at the bottom-right corner, or a slightly translucent layer across the whole app background that fades out from right to left.",
      placementCorner: "Bottom-right",
      placementStage: "Full background",
      speedRange: "Speed range",
      speedRangeHint: "Playback speed at the far left and far right of the slider. Allowed 10%–1000%; the slow end must stay below the fast end.",
      speedRangeSlow: "Slowest",
      speedRangeFast: "Fastest",
      speedRangeNow: "Now",
      speedRangeInvalid: "Invalid range: keep it within 10%–1000% with the slow end below the fast end.",
      speedRangeDone: "Speed range updated",
      speedRangeDefault: "Defaults",
      "diag.title": "Slider diagnostics (for the author)",
    };

    let translate = (key) => zh[key] ?? en[key] ?? key;

    /* ---------------- speed range limits ----------------
       播放速度上限与下限是硬限制：再小动图几乎静止（10%），再大就是糊影（1000%）。
       用户可在设置里把「滑到最左 / 最右」对应的速度改成范围内任意值。 */
    const SPEED_FLOOR = 0.1;
    const SPEED_CEIL = 10;
    const SPEED_GAP = 1.2; // 最快至少是最慢的 1.2 倍，避免滑轨退化成一个点
    const SPEED_DEFAULTS = { min: 0.3, max: 3 };

    function roundSpeed(value) {
      return Math.round(value * 100) / 100;
    }
    function clampSpeedRangeValue(value, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.min(SPEED_CEIL, Math.max(SPEED_FLOOR, number));
    }
    /* 归一化用户输入的速度范围：夹到硬限制内，并保证 max ≥ min × SPEED_GAP。 */
    function normalizeSpeedRange(min, max) {
      let lo = clampSpeedRangeValue(min, SPEED_DEFAULTS.min);
      let hi = clampSpeedRangeValue(max, SPEED_DEFAULTS.max);
      if (!(hi >= lo * SPEED_GAP)) {
        hi = lo * SPEED_GAP;
        if (hi > SPEED_CEIL) {
          hi = SPEED_CEIL;
          lo = hi / SPEED_GAP;
        }
      }
      return { min: roundSpeed(lo), max: roundSpeed(hi) };
    }

    /* ---------------- settings store ---------------- */
    const defaults = {
      enabled: true,
      variant: "anim:" + FALLBACK_ANIMATION.id,
      placement: "corner",
      speedMin: SPEED_DEFAULTS.min,
      speedMax: SPEED_DEFAULTS.max,
    };
    const PLACEMENTS = ["corner", "stage"];
    const isAnimationVariant = (value) => typeof value === "string" && value.startsWith("anim:");
    let state = { ...defaults };
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved && typeof saved === "object") state = { ...defaults, ...saved };
    } catch {}
    if (state.variant === "gif") state.variant = defaults.variant; // 旧版本只有 static/gif/custom
    if (!(isAnimationVariant(state.variant) || state.variant === "static" || state.variant === "custom")) {
      state.variant = defaults.variant;
    }
    if (!PLACEMENTS.includes(state.placement)) state.placement = defaults.placement;
    const savedRange = normalizeSpeedRange(state.speedMin, state.speedMax);
    state.speedMin = savedRange.min;
    state.speedMax = savedRange.max;
    const listeners = new Set();
    function setState(patch) {
      state = { ...state, ...patch };
      if ("speedMin" in patch || "speedMax" in patch) {
        const range = normalizeSpeedRange(state.speedMin, state.speedMax);
        state.speedMin = range.min;
        state.speedMax = range.max;
        // 新范围可能不包含当前速度：拉回范围内并通知订阅者，避免动图停在旧速度
        const clamped = Math.min(range.max, Math.max(range.min, speedState));
        if (Math.abs(clamped - speedState) > 1e-6) {
          speedState = clamped;
          for (const fn of speedListeners) fn();
        }
      }
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state)); } catch {}
      for (const fn of listeners) fn();
    }
    function useSettings() {
      const [value, update] = React.useState(state);
      React.useEffect(() => {
        // 必须包一层：直接把 update 注册进去，setState 会以 undefined 调用它，
        // React 会把组件状态置空，下一次渲染就崩。
        const fn = () => update(state);
        listeners.add(fn);
        return () => listeners.delete(fn);
      }, []);
      return [value, setState];
    }

    /* ---------------- slider diagnostics (visible in Settings) ---------------- */
    const sliderDiag = {
      registered: "pending",
      props: null,
      render: null,
      react: typeof React.useSyncExternalStore === "function" ? "ok" : "MISSING useSyncExternalStore",
    };
    if (typeof window !== "undefined") window.__dshkunkunSliderDiag = sliderDiag;

    /* ---------------- animation speed store ---------------- */
    // The effort slider drives playback speed live while dragging; the mascot
    // strip reads it through useSpeed. Slider ends map onto the configured
    // range (default 30%–300%) along a geometric ramp.
    let speedState = 1;
    // 已保存的范围可能不包含 1×（例如自定义成 200%–500%），启动时先夹进去
    speedState = Math.min(state.speedMax, Math.max(state.speedMin, speedState));
    const speedListeners = new Set();
    function speedRange() {
      return { min: state.speedMin, max: state.speedMax };
    }
    function speedAtRatio(ratio, range) {
      const span = range || speedRange();
      const x = Math.min(1, Math.max(0, ratio));
      return Math.min(SPEED_CEIL, Math.max(SPEED_FLOOR, span.min * Math.pow(span.max / span.min, x)));
    }
    function ratioAtSpeed(value, range) {
      const span = range || speedRange();
      const clamped = Math.min(span.max, Math.max(span.min, value));
      const ratio = Math.log(clamped / span.min) / Math.log(span.max / span.min);
      return Math.min(1, Math.max(0, ratio));
    }
    function setSpeed(value) {
      const span = speedRange();
      const next = Math.min(span.max, Math.max(span.min, value));
      if (Math.abs(next - speedState) < 1e-6) return;
      speedState = next;
      for (const fn of speedListeners) fn();
    }
    function useSpeed() {
      const [value, update] = React.useState(speedState);
      React.useEffect(() => {
        const fn = () => update(speedState);
        speedListeners.add(fn);
        return () => speedListeners.delete(fn);
      }, []);
      return value;
    }

    /* ---------------- animation catalogue ----------------
       动图列表来自 assets/anim/manifest.json（Host 静态路由伺服）。
       新增一张动图 = 放一个精灵条文件 + 在清单里加一条，不需要改代码。 */
    let animations = [FALLBACK_ANIMATION];
    const animListeners = new Set();
    let manifestRequested = false;

    function normalizeAnimation(raw) {
      if (!raw || typeof raw !== "object") return null;
      const id = typeof raw.id === "string" && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(raw.id) ? raw.id : null;
      const file =
        typeof raw.file === "string" && raw.file.length > 0 && !/^[a-z][a-z0-9+.-]*:/i.test(raw.file) && !raw.file.includes("..")
          ? raw.file.replace(/^\/+/, "")
          : null;
      if (!id || !file) return null;
      // frames 缺省 = 1：原生动图（GIF / 动画 WebP），浏览器自己播放，滑块调速对它无效。
      // frames ≥ 2 才是精灵条，由 CSS steps() 逐帧播放、可调速。
      const rawFrames = Number(raw.frames);
      const frames = Number.isFinite(rawFrames) ? Math.round(rawFrames) : 1;
      if (frames < 1 || frames > 400) return null;
      const frameMs = Math.round(Number(raw.frameMs));
      const aspect = Number(raw.aspect);
      return {
        id,
        file,
        frames,
        frameMs: Number.isFinite(frameMs) && frameMs >= 20 ? Math.min(frameMs, 5000) : 200,
        aspect: Number.isFinite(aspect) && aspect > 0.1 && aspect < 10 ? aspect : 180 / 210,
        rev: typeof raw.rev === "string" ? raw.rev : "",
        label: {
          zh: (raw.label && typeof raw.label.zh === "string" && raw.label.zh) || id,
          en: (raw.label && typeof raw.label.en === "string" && raw.label.en) || id,
        },
      };
    }

    function loadAnimations() {
      if (manifestRequested) return;
      manifestRequested = true;
      if (typeof fetch !== "function") return;
      fetch(MANIFEST_URL, { cache: "no-cache" })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((json) => {
          const items = Array.isArray(json && json.items) ? json.items : [];
          const list = items.map(normalizeAnimation).filter(Boolean);
          if (!list.length) return;
          animations = list;
          for (const fn of animListeners) fn();
        })
        .catch((err) => {
          console.warn("[dsh-kunkun] 动图清单读取失败，使用内置动图:", err);
        });
    }

    function useAnimations() {
      const [value, update] = React.useState(animations);
      React.useEffect(() => {
        const fn = () => update(animations);
        animListeners.add(fn);
        return () => animListeners.delete(fn);
      }, []);
      return value;
    }

    function findAnimation(list, id) {
      return list.find((item) => item.id === id) || list[0] || FALLBACK_ANIMATION;
    }
    function animationSrc(anim) {
      return ASSET_BASE + "/" + anim.file + (anim.rev ? "?v=" + encodeURIComponent(anim.rev) : "");
    }
    function variantAnimation(variant, list) {
      return isAnimationVariant(variant) ? findAnimation(list, variant.slice(5)) : null;
    }
    /* 清单里的名字是双语字段（不进 locale 字典），按当前界面语言挑一个。 */
    function pickLabel(label) {
      let chinese = true;
      try { chinese = translate("nav") === zh.nav; } catch {}
      return chinese ? label.zh : label.en;
    }

    /* 精灵条渲染：容器按帧宽高比裁切，图片靠 steps() 横向跳动。 */
    function StripView(props) {
      const anim = props.anim;
      const speed = props.speed > 0 ? props.speed : 1;
      const cycle = anim.frames * anim.frameMs;
      return h(
        "div",
        {
          className: "dsk-strip" + (props.className ? " " + props.className : ""),
          style: Object.assign({ aspectRatio: String(anim.aspect) }, props.style || {}),
        },
        h("img", {
          src: animationSrc(anim),
          alt: "",
          draggable: false,
          style: {
            animationDuration: Math.max(60, Math.round(cycle / speed)) + "ms",
            animationTimingFunction: "steps(" + anim.frames + ")",
          },
        })
      );
    }

    /* ---------------- model reasoning helpers ---------------- */
    function modelReasoning(state) {
      const current = state?.current;
      if (!current) return null;
      const group = state.groups?.find((item) => item.id === current.provider);
      const model = group?.models?.find((item) => item.id === current.model);
      if (!model?.reasoning?.efforts?.length) return null;
      return {
        selection: current,
        efforts: model.reasoning.efforts,
        defaultEffort: model.reasoning.defaultEffort,
      };
    }
    function selectedEffortIndex(efforts, currentId, defaultId) {
      if (!efforts.length) return -1;
      let index = currentId === undefined ? -1 : efforts.findIndex((e) => e.id === currentId);
      if (index < 0) index = defaultId === undefined ? -1 : efforts.findIndex((e) => e.id === defaultId);
      if (index < 0) index = 0;
      return index;
    }

    /* ---------------- custom image (IndexedDB) ---------------- */
    function openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    async function mediaTx(mode, run) {
      const db = await openDb();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, mode);
          const req = run(tx.objectStore(DB_STORE));
          tx.oncomplete = () => resolve(req ? req.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    }

    let customUrl = null;
    let mediaLoaded = false;
    const mediaListeners = new Set();
    function notifyMedia() { for (const fn of mediaListeners) fn(); }
    async function ensureMedia() {
      if (mediaLoaded) return;
      mediaLoaded = true;
      try {
        const blob = await mediaTx("readonly", (store) => store.get(DB_KEY));
        if (blob instanceof Blob) customUrl = URL.createObjectURL(blob);
      } catch {}
      notifyMedia();
    }
    async function saveCustomImage(blob) {
      await mediaTx("readwrite", (store) => store.put(blob, DB_KEY));
      if (customUrl) URL.revokeObjectURL(customUrl);
      customUrl = URL.createObjectURL(blob);
      notifyMedia();
    }
    async function clearCustomImage() {
      await mediaTx("readwrite", (store) => store.delete(DB_KEY));
      if (customUrl) URL.revokeObjectURL(customUrl);
      customUrl = null;
      notifyMedia();
    }
    function useCustomImage() {
      const [, bump] = React.useReducer((x) => x + 1, 0);
      React.useEffect(() => {
        mediaListeners.add(bump);
        ensureMedia();
        return () => mediaListeners.delete(bump);
      }, []);
      return customUrl;
    }

    /* ---------------- overlay mascot ---------------- */
    /* 全屏背景层：参照 dsh-liang-skin 的做法插入主对话列内部（而不是 body），
       既能让列的不透明底色之上显示图片，也不会把 body 的直接子节点变成
       -webkit-app-region:no-drag（那会破坏双击标题栏最大化/选字）。 */
    const STAGE_HOST_SELECTORS = ['[class*="centerCol"]', '[data-pane="conversation"]'];

    function findStageHost() {
      if (typeof document === "undefined") return null;
      for (const selector of STAGE_HOST_SELECTORS) {
        const host = document.querySelector(selector);
        if (host) return host;
      }
      return null;
    }

    function useStageLayer(active, speed, anim, customUrl) {
      const config = React.useRef({ speed, anim, customUrl });
      config.current = { speed, anim, customUrl };
      const dom = React.useRef(null);

      const paint = () => {
        const current = dom.current;
        if (!current) return;
        const conf = config.current;
        const anim = conf.anim;
        const strip = anim !== null && anim.frames > 1;
        const image = anim ? animationSrc(anim) : conf.customUrl || STATIC_SRC;
        const fit = current.fit;
        fit.dataset.strip = strip ? "true" : "false";
        fit.style.backgroundImage = 'url("' + image + '")';
        if (strip) {
          fit.style.backgroundPosition = "0% 50%";
          fit.style.backgroundSize = anim.frames * 100 + "% 100%";
          fit.style.aspectRatio = String(anim.aspect);
          fit.style.animationDuration =
            Math.max(60, Math.round((anim.frames * anim.frameMs) / conf.speed)) + "ms";
          fit.style.animationTimingFunction = "steps(" + anim.frames + ", jump-none)";
        } else {
          fit.style.backgroundPosition = "center";
          fit.style.backgroundSize = "contain";
          fit.style.aspectRatio = String(anim ? anim.aspect : 180 / 210);
        }
      };

      React.useEffect(() => {
        if (!active || typeof document === "undefined") return undefined;
        let layer = null;
        let host = null;
        let hostBefore = null;
        let observer = null;
        let lastScan = 0;
        const cleared = [];

        // 颜色透明度：用于判断哪个容器是不透明的“会话根”
        const alphaOf = (color) => {
          if (!color) return 0;
          if (color === "transparent") return 0;
          const rgba = color.match(/rgba?\(([^)]+)\)/);
          if (rgba) {
            const parts = rgba[1].split(/[,\/]/).map((part) => part.trim());
            return parts.length >= 4 ? Number(parts[3]) : 1;
          }
          const slash = color.match(/\/\s*([\d.]+)\s*\)/);
          if (slash) return Number(slash[1]);
          return 1;
        };

        const restoreCleared = () => {
          for (const item of cleared) {
            try { item.el.style.background = item.background; } catch { /* ignore */ }
          }
          cleared.length = 0;
        };

        // 会话视图的根容器有不透明底色，会把 z-index:-1 的背景层挡住。
        // 找出列内“覆盖大半列且底色不透明”的容器，临时改为透明（保留原值以便还原）。
        const ensureTransparent = () => {
          if (!host || typeof window === "undefined" || !window.getComputedStyle) return;
          for (let i = cleared.length - 1; i >= 0; i -= 1) {
            if (!cleared[i].el.isConnected) cleared.splice(i, 1);
          }
          if (cleared.length > 0) return;
          let rect;
          try { rect = host.getBoundingClientRect(); } catch { return; }
          if (!rect || !rect.width) return;
          const queue = [host];
          let found = null;
          while (queue.length > 0 && found === null) {
            const node = queue.shift();
            const children = Array.from(node.children || []);
            for (const child of children) {
              if (child === layer || (layer && layer.contains(child))) continue;
              let box;
              try { box = child.getBoundingClientRect(); } catch { continue; }
              if (!box) continue;
              if (box.width < rect.width * 0.8 || box.height < rect.height * 0.4) {
                queue.push(child);
                continue;
              }
              let background = "";
              try { background = window.getComputedStyle(child).backgroundColor || ""; } catch { /* ignore */ }
              if (alphaOf(background) > 0.05) { found = child; break; }
              queue.push(child);
            }
          }
          if (found !== null) {
            cleared.push({ el: found, background: found.style.background });
            found.style.background = "transparent";
          }
        };

        const mount = () => {
          if (layer && layer.isConnected) return;
          const column = findStageHost();
          if (!column) return;
          if (!layer) {
            host = column;
            hostBefore = { position: column.style.position, isolation: column.style.isolation };
            // 给列一个包含块与独立层叠上下文：背景层才能落在列背景之上、内容之下
            let computedPosition = "static";
            try { computedPosition = window.getComputedStyle(column).position; } catch {}
            if (computedPosition === "static") column.style.position = "relative";
            column.style.isolation = "isolate";
            layer = document.createElement("div");
            layer.className = "dsk-stage";
            layer.setAttribute("aria-hidden", "true");
            layer.setAttribute("data-dsh-kunkun", "stage");
            const fit = document.createElement("div");
            fit.className = "dsk-stage-fit";
            layer.appendChild(fit);
            dom.current = { layer, fit };
            paint();
          }
          column.insertBefore(layer, column.firstChild);
        };

        mount();
        ensureTransparent();
        // React 重渲染可能移除外部插入的节点，按参考项目的做法观察并重挂；
        // 视图切换（会话/插件页）后重新扫描需要透明化的根容器（节流）。
        observer = new MutationObserver(() => {
          if (!layer || !layer.isConnected) mount();
          const now = Date.now();
          if (now - lastScan > 400) {
            lastScan = now;
            ensureTransparent();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
          if (observer) observer.disconnect();
          if (layer) layer.remove();
          restoreCleared();
          if (host && hostBefore) {
            host.style.position = hostBefore.position;
            host.style.isolation = hostBefore.isolation;
          }
          dom.current = null;
        };
      }, [active]);

      React.useEffect(() => {
        if (active) paint();
      }, [active, anim && anim.id, customUrl, speed]);
    }

    function Mascot() {
      const [s] = useSettings();
      const animations = useAnimations();
      const customUrlNow = useCustomImage();
      const speed = useSpeed();
      const anim = variantAnimation(s.variant, animations);
      const stage = s.enabled && s.placement === "stage";
      useStageLayer(stage, speed, anim, customUrlNow);
      if (!s.enabled) return null;
      if (stage) return null; // 背景模式下不再显示右下角立绘
      const wrapper = {
        "data-dsh-kunkun": "mascot",
        "aria-hidden": "true",
        style: {
          position: "fixed",
          right: "18px",
          bottom: "18px",
          width: "clamp(96px, 12vw, 168px)",
          zIndex: 60,
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: 0,
          filter: "drop-shadow(0 6px 16px rgba(0, 0, 0, 0.35))",
          opacity: 0.92,
        },
      };
      if (anim) {
        // 精灵条：速度就是 animation-duration（滑块 30%–300%）。
        // 原生动图（frames = 1）由浏览器自己播放，滑块不参与。
        return h(
          "div",
          wrapper,
          anim.frames > 1
            ? h(StripView, { anim, speed })
            : h("img", {
                className: "dsk-native",
                src: animationSrc(anim),
                alt: "",
                draggable: false,
              })
        );
      }
      const src = s.variant === "custom" ? (customUrlNow || STATIC_SRC) : STATIC_SRC;
      return h(
        "div",
        wrapper,
        h("img", {
          src,
          alt: "",
          draggable: false,
          style: {
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: "12px",
          },
        })
      );
    }

    /* ---------------- settings panel ---------------- */
    const CSS = `
      .dsk-panel{display:flex;flex-direction:column;gap:16px;max-width:560px}
      .dsk-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
      .dsk-copy strong{display:block;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
      .dsk-copy span{display:block;margin-top:2px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsk-switch{flex:none;width:42px;height:25px;border:0;border-radius:99px;background:var(--dsw-alias-border-l1);padding:3px;cursor:pointer;transition:background .18s}
      .dsk-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
      .dsk-switch::before{content:"";display:block;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.24);transition:transform .18s}
      .dsk-switch[aria-checked="true"]::before{transform:translateX(17px)}
      .dsk-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary)}
      .dsk-hint{margin:2px 0 8px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsk-choices{display:flex;flex-wrap:wrap;gap:10px}
      .dsk-choice{display:flex;flex-direction:column;align-items:center;gap:6px;width:104px;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer}
      .dsk-choice:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
      .dsk-choice[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
      .dsk-choice:disabled{opacity:.45;cursor:not-allowed}
      .dsk-thumb{width:64px;height:64px;object-fit:contain;border-radius:6px;background:var(--dsw-alias-bg-layer-2)}
      .dsk-choice span{font-size:12px}
      .dsk-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .dsk-button{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;padding:6px 12px;cursor:pointer}
      .dsk-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}
      .dsk-button:disabled{opacity:.5;cursor:default}
      .dsk-message{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsk-message[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}
      .dsk-strip{position:relative;overflow:hidden;width:100%;aspect-ratio:180/210;border-radius:12px;line-height:0;background:transparent}
      .dsk-strip>img{position:absolute;left:0;top:0;height:100%;width:auto;max-width:none;display:block;
        animation:dsk-strip-play 3400ms steps(17) infinite;will-change:transform}
      @keyframes dsk-strip-play{from{transform:translateX(0)}to{transform:translateX(-100%)}}
      .dsk-thumb.dsk-strip{width:auto;height:64px;border-radius:6px}
      .dsk-native{display:block;width:100%;height:auto;border-radius:12px}
      /* LVGL 风格滑块：MAIN 轨道 + INDICATOR 填充 + KNOB 圆旋钮 */
      /* 固定宽度：档位名长短（低/高 vs Off/Low/High）不再撑动轨道位置 */
      /* 整体上移：轨道居中到同行控件文字的光学中线，标签浮在轨道上方不占布局高度 */
      .dsk-effort{display:flex;flex-direction:column;align-items:center;width:132px;min-width:132px;max-width:132px;padding:0 4px;flex:none;box-sizing:border-box;align-self:center;transform:translateY(1px)}
      .dsk-effort-label{position:absolute;bottom:100%;left:0;right:0;margin-bottom:-1px;text-align:center;font-size:10px;line-height:1;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
      .dsk-effort-rail-wrap{position:relative;width:100%;display:flex;align-items:center}
      .dsk-effort-rail{position:relative;width:100%;height:16px;display:flex;align-items:center}
      .dsk-effort-track{position:absolute;left:0;right:0;top:50%;height:8px;transform:translateY(-50%);border-radius:999px;background:var(--dsw-alias-border-l1);overflow:hidden;pointer-events:none}
      .dsk-effort-fill{height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width 60ms linear}
      .dsk-effort-ticks{position:absolute;left:0;right:0;top:0;height:3px;pointer-events:none;opacity:.85}
      .dsk-effort-tick{position:absolute;top:0;width:2px;height:3px;border-radius:1px;background:var(--dsw-alias-border-l2);transform:translateX(-1px)}
      .dsk-effort-range{position:relative;z-index:2;width:100%;height:16px;margin:0;background:transparent;cursor:pointer;-webkit-appearance:none;appearance:none;outline:none}
      .dsk-effort-range::-webkit-slider-runnable-track{height:8px;background:transparent;border-radius:999px}
      .dsk-effort-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;margin-top:-3px;border:0;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 1px 4px rgba(0,0,0,.28),0 0 0 2px var(--dsw-alias-bg-base);transition:box-shadow .15s}
      .dsk-effort-range:active::-webkit-slider-thumb{box-shadow:0 1px 6px rgba(0,0,0,.35),0 0 0 5px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
      .dsk-effort-range:focus-visible::-webkit-slider-thumb{box-shadow:0 1px 4px rgba(0,0,0,.28),0 0 0 5px color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent)}
      .dsk-effort-range::-moz-range-track{height:8px;background:transparent;border:0}
      .dsk-effort-range::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 1px 4px rgba(0,0,0,.28)}
      .dsk-effort[data-pending=true] .dsk-effort-label{opacity:.6}
      .dsk-seg{display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
      .dsk-seg-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;padding:5px 12px;border-radius:8px;cursor:pointer;transition:background .15s,color .15s}
      .dsk-seg-btn[aria-pressed="true"]{background:var(--dsw-alias-brand-primary);color:#fff}
      .dsk-range-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .dsk-range-field{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsk-num{width:66px;padding:5px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;text-align:right;box-sizing:border-box}
      .dsk-num::-webkit-outer-spin-button,.dsk-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
      .dsk-num:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
      .dsk-unit{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsk-range-now{margin-left:auto;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsk-range-reset{padding:4px 10px;font-size:12px}
      /* 全屏背景模式：插入主对话列内部（不挂 body，避免破坏窗口拖拽区）。
         列设为 isolation 后，z-index:-1 位于列背景之上、对话内容之下。 */
      .dsk-stage{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
      .dsk-stage-fit{position:absolute;right:0;top:50%;transform:translateY(-50%);
        height:92%;aspect-ratio:180/210;background-repeat:no-repeat;background-position:0% 50%;
        background-size:contain;opacity:.5;
        -webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.25) 20%,rgba(0,0,0,.7) 46%,#000 76%);
        mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.25) 20%,rgba(0,0,0,.7) 46%,#000 76%)}
      /* 帧数/帧宽比/时长由 StripView 与 useStageLayer 内联给出（每个动图不同）。 */
      .dsk-stage-fit[data-strip="true"]{animation-name:dsk-stage-play;animation-duration:3400ms;
        animation-timing-function:steps(17,jump-none);animation-iteration-count:infinite}
      @keyframes dsk-stage-play{from{background-position:0% 50%}to{background-position:100% 50%}}
      .dsk-diag{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
      .dsk-diag strong{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary)}
      .dsk-diag code{font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);word-break:break-all;white-space:pre-wrap}
    `;

    function SettingsPanel() {
      const [s, set] = useSettings();
      const animations = useAnimations();
      const customUrlNow = useCustomImage();
      const fileRef = React.useRef(null);
      const [busy, setBusy] = React.useState(false);
      const [message, setMessage] = React.useState("");
      const speedNow = useSpeed();
      const [rangeDraft, setRangeDraft] = React.useState({
        min: String(Math.round(s.speedMin * 100)),
        max: String(Math.round(s.speedMax * 100)),
      });
      const [rangeError, setRangeError] = React.useState("");
      React.useEffect(() => {
        setRangeDraft({
          min: String(Math.round(s.speedMin * 100)),
          max: String(Math.round(s.speedMax * 100)),
        });
      }, [s.speedMin, s.speedMax]);

      /* 输入框里是百分比；提交时校验硬限制（10%–1000%）和最慢 < 最快，
         不合法就退回已保存的值，绝不把非法范围写进设置。 */
      function commitRange() {
        const lo = Math.round(Number(rangeDraft.min));
        const hi = Math.round(Number(rangeDraft.max));
        const valid =
          Number.isFinite(lo) && Number.isFinite(hi) &&
          lo >= SPEED_FLOOR * 100 && hi <= SPEED_CEIL * 100 &&
          lo >= SPEED_FLOOR * 100 && hi > lo && hi >= lo * SPEED_GAP;
        if (!valid) {
          setRangeError(translate("speedRangeInvalid"));
          setRangeDraft({
            min: String(Math.round(s.speedMin * 100)),
            max: String(Math.round(s.speedMax * 100)),
          });
          return;
        }
        setRangeError("");
        set({ speedMin: lo / 100, speedMax: hi / 100 });
        setMessage(translate("speedRangeDone"));
      }

      function resetRange() {
        setRangeError("");
        set({ speedMin: SPEED_DEFAULTS.min, speedMax: SPEED_DEFAULTS.max });
        setMessage(translate("speedRangeDone"));
      }

      const blurOnEnter = (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.currentTarget.blur();
      };

      async function onPick(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        if (!ACCEPT.test(file.type)) { setMessage(translate("errorType")); return; }
        if (file.size > MAX_CUSTOM_BYTES) { setMessage(translate("errorSize")); return; }
        setBusy(true);
        setMessage("");
        try {
          await saveCustomImage(file);
          set({ variant: "custom" });
          setMessage(translate("saved"));
        } catch {
          setMessage(translate("errorGeneric"));
        } finally {
          setBusy(false);
        }
      }

      async function onRemove() {
        setBusy(true);
        setMessage("");
        try {
          await clearCustomImage();
          if (s.variant === "custom") set({ variant: "static" });
          setMessage(translate("saved"));
        } catch {
          setMessage(translate("errorGeneric"));
        } finally {
          setBusy(false);
        }
      }

      function choice(value, label, thumb) {
        const disabled = value === "custom" && !customUrlNow;
        // 失效的 anim:id（清单里删掉了）也会落到第一个动图上，选中态跟随实际显示的那张
        const active = isAnimationVariant(value)
          ? isAnimationVariant(s.variant) && findAnimation(animations, s.variant.slice(5)).id === value.slice(5)
          : s.variant === value;
        return h(
          "button",
          {
            key: value,
            type: "button",
            className: "dsk-choice",
            "aria-pressed": active,
            disabled,
            title: disabled ? translate("customEmpty") : undefined,
            onClick: () => set({ variant: value }),
          },
          thumb,
          h("span", null, disabled ? translate("customEmpty") : label)
        );
      }

      return h(
        "div",
        { className: "dsk-panel", "data-dsh-kunkun": "settings" },
                h(
          "div",
          { className: "dsk-row" },
          h(
            "div",
            { className: "dsk-copy" },
            h("strong", null, translate("enable")),
            h("span", null, translate("enableHint"))
          ),
          h("button", {
            type: "button",
            role: "switch",
            className: "dsk-switch",
            "aria-checked": s.enabled,
            "aria-label": translate("enable"),
            onClick: () => set({ enabled: !s.enabled }),
          })
        ),

        h(
          "div",
          null,
          h("div", { className: "dsk-label" }, translate("variant")),
          h("div", { className: "dsk-hint" }, translate("variantHint")),
          h(
            "div",
            { className: "dsk-choices" },
            choice("static", translate("static"), h("img", { className: "dsk-thumb", src: STATIC_SRC, alt: "" })),
            animations.map((item) =>
              choice(
                "anim:" + item.id,
                pickLabel(item.label),
                item.frames > 1
                  ? h(StripView, {
                      anim: item,
                      speed: 1,
                      className: "dsk-thumb",
                      style: { width: "auto", height: "64px" },
                    })
                  : h("img", { className: "dsk-thumb", src: animationSrc(item), alt: "" })
              )
            ),
            choice(
              "custom",
              translate("custom"),
              h("img", { className: "dsk-thumb", src: customUrlNow || STATIC_SRC, alt: "" })
            )
          )
        ),

        h(
          "div",
          null,
          h("div", { className: "dsk-label" }, translate("placement")),
          h("div", { className: "dsk-hint" }, translate("placementHint")),
          h(
            "div",
            { className: "dsk-seg" },
            ["corner", "stage"].map((value) =>
              h(
                "button",
                {
                  key: value,
                  type: "button",
                  className: "dsk-seg-btn",
                  "aria-pressed": s.placement === value,
                  onClick: () => set({ placement: value }),
                },
                translate(value === "corner" ? "placementCorner" : "placementStage")
              )
            )
          )
        ),

        h(
          "div",
          { "data-dsh-kunkun": "speed-range" },
          h("div", { className: "dsk-label" }, translate("speedRange")),
          h("div", { className: "dsk-hint" }, translate("speedRangeHint")),
          h(
            "div",
            { className: "dsk-range-row" },
            h(
              "label",
              { className: "dsk-range-field" },
              h("span", null, translate("speedRangeSlow")),
              h("input", {
                className: "dsk-num",
                type: "number",
                inputMode: "numeric",
                min: Math.round(SPEED_FLOOR * 100),
                max: Math.round(SPEED_CEIL * 100),
                step: 5,
                value: rangeDraft.min,
                "aria-label": translate("speedRangeSlow"),
                onChange: (event) => setRangeDraft({ ...rangeDraft, min: event.target.value }),
                onBlur: commitRange,
                onKeyDown: blurOnEnter,
              }),
              h("span", { className: "dsk-unit" }, "%")
            ),
            h("span", { className: "dsk-range-sep" }, "–"),
            h(
              "label",
              { className: "dsk-range-field" },
              h("span", null, translate("speedRangeFast")),
              h("input", {
                className: "dsk-num",
                type: "number",
                inputMode: "numeric",
                min: Math.round(SPEED_FLOOR * 100),
                max: Math.round(SPEED_CEIL * 100),
                step: 5,
                value: rangeDraft.max,
                "aria-label": translate("speedRangeFast"),
                onChange: (event) => setRangeDraft({ ...rangeDraft, max: event.target.value }),
                onBlur: commitRange,
                onKeyDown: blurOnEnter,
              }),
              h("span", { className: "dsk-unit" }, "%")
            ),
            h("span", { className: "dsk-range-now" }, translate("speedRangeNow") + " " + Math.round(speedNow * 100) + "%"),
            h(
              "button",
              { type: "button", className: "dsk-button dsk-range-reset", onClick: resetRange },
              translate("speedRangeDefault")
            )
          ),
          rangeError && h("div", { className: "dsk-message", "data-tone": "error" }, rangeError)
        ),

        h(
          "div",
          { className: "dsk-actions" },
          h("input", {
            ref: fileRef,
            type: "file",
            accept: "image/gif,image/webp,image/png,image/jpeg",
            style: { display: "none" },
            onChange: onPick,
          }),
          h(
            "button",
            {
              type: "button",
              className: "dsk-button",
              disabled: busy,
              onClick: () => fileRef.current && fileRef.current.click(),
            },
            translate("upload")
          ),
          customUrlNow &&
            h(
              "button",
              { type: "button", className: "dsk-button", disabled: busy, onClick: onRemove },
              translate("remove")
            ),
          h(
            "span",
            {
              className: "dsk-message",
              "data-tone": message.startsWith("只支持") || message.startsWith("Only") || message.startsWith("图片太大") || message.startsWith("Image is") || message.startsWith("无法读取") || message.startsWith("Could not") ? "error" : "info",
              "aria-live": "polite",
            },
            busy ? translate("busy") : message
          )
        ),

        h(
          "div",
          { className: "dsk-diag", "data-dsh-kunkun": "diag" },
          h("strong", null, translate("diag.title")),
          h(
            "code",
            null,
            "react=" + sliderDiag.react +
              " | registered=" + sliderDiag.registered +
              " | props=" + JSON.stringify(sliderDiag.props) +
              " | render=" + JSON.stringify(sliderDiag.render)
          )
        )
      );
    }

    /* ---------------- plugin ---------------- */
    /* ---------------- effort slider (conversation.input.right) ----------------
       One control, two effects: dragging previews the animation speed
       continuously; release commits the nearest reasoning effort through the
       official ModelDirectory. Degrades to a no-op whenever the model
       directory service is unavailable — the skin never hard-depends on it. */
    /* ---------------- 滑块提交同步器 ----------------
       松手提交后宿主选区会异步更新，期间滑块会从"用户拖到的位置"跳回"旧档位"再
       跳到"新档位"，表现为卡顿。这里记住本次提交的目标，在宿主确认前把位置钉在
       提交值上；确认后释放。切换模型/模式时才完全跟随宿主。 */
    function createEffortSync() {
      let submitted = null;   // { value, modelKey, at }
      let settled = false;    // 宿主已确认，下一帧释放
      return {
        /** 提交某档位：位置先钉住它 */
        submit(value, modelKey, wasAtTarget) {
          submitted = { value, modelKey, at: Date.now(), wasAtTarget: wasAtTarget === true };
          settled = false;
        },
        /** 用户取消 / 提交失败：立刻释放，回到宿主真实档位 */
        reset() { submitted = null; settled = false; },
        /** 每次渲染调用：返回应当钉住的值，null 表示跟随宿主 */
        hold(modelKey, committedValue) {
          if (submitted === null) return null;
          // 换了模型（provider/model/档位集合变化）→ 立即释放
          if (submitted.modelKey !== modelKey) { submitted = null; settled = false; return null; }
          // 超时保护：宿主 1.2s 内没响应也不再钉住，避免永久卡住
          if (Date.now() - submitted.at > 1200) { submitted = null; settled = false; return null; }
          // 只有"上一帧还不在目标位置、现在到了"才算宿主确认。
          // 否则提交瞬间的陈旧快照（值恰好等于目标）会被误判为已到位。
          const atTarget = Math.abs(committedValue - submitted.value) < 0.001;
          if (atTarget && !submitted.wasAtTarget) {
            submitted = null;
            settled = true;
            return null;
          }
          submitted.wasAtTarget = atTarget;
          return submitted.value;
        },
      };
    }

    /* 连续位置 ↔ 区域：滑轨按档位数均分为 N 个区域，
       落区即档位，位置本身连续（速度可取任意值）。 */
    function EffortSlider(props) {
      const { available, directory, load, select } = props;
      const [settings] = useSettings();
      // 速度范围来自设置；面板改完范围后，映射与位置会跟着重算。
      const speedSpan = { min: settings.speedMin, max: settings.speedMax };
      const state = React.useSyncExternalStore(
        (listener) => (directory ? directory.subscribe(listener) : () => {}),
        () => (directory ? directory.getSnapshot() : null)
      );
      const speed = useSpeed();
      const reasoning = state ? modelReasoning(state) : null;
      const efforts = reasoning?.efforts ?? [];
      const committedIndex = reasoning
        ? selectedEffortIndex(efforts, reasoning.selection.reasoningEffort, reasoning.defaultEffort)
        : -1;
      // 滑块永不隐藏：≥2 档时同时提交推理等级，否则降级为纯动图调速
      const bindEffort = available && reasoning !== null && efforts.length >= 2 && committedIndex >= 0;
      // N 个区域：有档位时 N = efforts.length，纯调速时 1 个区域
      const regions = bindEffort ? efforts.length : 1;
      const max = regions;
      const baseRegion = bindEffort ? Math.max(0, committedIndex) : 0;
      const regionOf = (v) => Math.min(regions - 1, Math.max(0, Math.floor(v)));
      const centerOf = (r) => r + 0.5;

      const [dragValue, setDragValue] = React.useState(null);
      const [pos, setPos] = React.useState(null); // 松手后的连续位置（任意值）
      const [pending, setPending] = React.useState(false);
      const pendingRef = React.useRef(false);
      const syncRef = React.useRef(null);
      if (syncRef.current === null) syncRef.current = createEffortSync();
      const sync = syncRef.current;
      // 模型身份：provider/model/档位集合任一变化都要放弃"钉住"并归零位置
      const modelKey = reasoning
        ? JSON.stringify([reasoning.selection.provider, reasoning.selection.model, efforts.map((e) => e.id)])
        : "none";
      const heldRegion = dragValue === null ? sync.hold(modelKey, baseRegion) : null;

      // 位置优先级：拖动值 > 提交等待期的钉住位置 > 区域中心（外部改档时归中）
      // 纯调速模式没有区域可言，默认沿用当前速度对应的位置（进入调速模式时不跳变）
      const defaultPos = () => (bindEffort ? centerOf(baseRegion) : Math.min(1, Math.max(0, ratioAtSpeed(speed, speedSpan))));
      let value;
      if (dragValue !== null) value = dragValue;
      else if (heldRegion !== null) value = pos === null ? defaultPos() : pos;
      else value = pos !== null && regionOf(pos) === baseRegion ? pos : defaultPos();

      React.useEffect(() => {
        if (available && directory) load();
      }, [available, directory, load]);

      // 位置即速度：任意连续值都按设置里的范围映射（默认 30%–300%）
      React.useEffect(() => {
        setSpeed(speedAtRatio(max > 0 ? value / max : 0, speedSpan));
      }, [value, max, speedSpan.min, speedSpan.max]);

      // 宿主从别处改了档位（不是本次提交）→ 位置归到那个区域中心
      React.useEffect(() => {
        if (dragValue !== null || pendingRef.current) return;
        if (pos !== null && regionOf(pos) !== baseRegion) setPos(null);
      }, [baseRegion, dragValue, pos]);

      // 换模型：位置清空，回到新模型当前档位的区域中心
      React.useEffect(() => {
        setPos(null);
        setDragValue(null);
        sync.reset();
      }, [modelKey]);

      const mode = bindEffort ? "effort" : "speed-only";
      const degradeReason = !available
        ? "unavailable (no model directory or addressed subagent)"
        : !reasoning
          ? "no reasoning data"
          : efforts.length < 2
            ? "efforts<2 (" + efforts.length + ")"
            : null;
      sliderDiag.render = bindEffort
        ? {
            mode,
            regions,
            efforts: efforts.length,
            current: reasoning.selection.reasoningEffort ?? reasoning.defaultEffort ?? null,
            position: Number(value.toFixed(3)),
          }
        : {
            mode,
            regions,
            reason: degradeReason ?? "n/a",
            snapshotKeys: state ? Object.keys(state) : String(state),
            current: state?.current ?? null,
            groups: state?.groups?.length ?? 0,
            efforts: efforts.length,
            position: Number(value.toFixed(3)),
          };
      if (!EffortSlider.modeLogged) {
        EffortSlider.modeLogged = true;
        console.info(
          "[dsh-kunkun] slider mode: " + mode +
          (degradeReason ? " (" + degradeReason + ")" : " — " + efforts.length + " efforts / " + regions + " regions")
        );
      }

      const commit = async (raw) => {
        setDragValue(null);
        setPos(raw); // 位置保持用户松手处，速度即该位置的值
        setSpeed(speedAtRatio(max > 0 ? raw / max : 0, speedSpan));
        if (!bindEffort) return; // 纯调速：无需提交档位
        const region = regionOf(raw);
        if (region === baseRegion || pendingRef.current) return;
        sync.submit(region, modelKey, false);
        pendingRef.current = true;
        setPending(true);
        let accepted = false;
        try {
          accepted = await select({
            provider: reasoning.selection.provider,
            model: reasoning.selection.model,
            reasoningEffort: efforts[region].id,
          });
        } catch { accepted = false; }
        pendingRef.current = false;
        setPending(false);
        if (!accepted) {
          // 宿主拒绝：释放钉住，回到真实档位的区域中心
          sync.reset();
          setPos(null);
        }
      };

      const onInput = (event) => {
        setDragValue(Number(event.target.value));
      };

      const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
      const region = regionOf(value);
      const label = bindEffort
        ? (efforts[region]?.name ?? "")
        : speed.toFixed(2) + "\u00d7";

      return h(
        "div",
        {
          className: "dsk-effort",
          "data-mode": mode,
          "data-pending": pending ? "true" : undefined,
          title: bindEffort
            ? label + " · " + speed.toFixed(2) + "\u00d7"
            : translate("slider.speedOnly") + " · " + speed.toFixed(2) + "\u00d7",
          "data-dsh-kunkun": "effort-slider",
        },
        h(
          "div",
          { className: "dsk-effort-rail" },
          h("span", { className: "dsk-effort-label" }, label),
          h(
            "div",
            { className: "dsk-effort-track" },
            h("div", { className: "dsk-effort-fill", style: { width: pct + "%" } })
          ),
          h(
            "div",
            { className: "dsk-effort-ticks", "aria-hidden": "true" },
            bindEffort
              ? Array.from({ length: regions - 1 }, (_, i) =>
                  h("i", {
                    key: "b" + i,
                    className: "dsk-effort-tick",
                    style: { left: ((i + 1) / regions) * 100 + "%" },
                  })
                )
              : [
                  h("i", { key: "s0", className: "dsk-effort-tick", style: { left: "0%" } }),
                  h("i", { key: "s1", className: "dsk-effort-tick", style: { left: "100%" } }),
                ]
          ),
          h("input", {
            className: "dsk-effort-range",
            type: "range",
            min: 0,
            max,
            step: "any",
            value,
            "aria-label": translate("slider.title"),
            "aria-valuemin": 0,
            "aria-valuemax": max,
            "aria-valuenow": Number(value.toFixed(3)),
            onInput,
            onChange: onInput,
            onPointerUp: (event) => void commit(Number(event.target.value)),
            onKeyUp: (event) => void commit(Number(event.target.value)),
            onBlur: (event) => void commit(Number(event.target.value)),
          })
        )
      );
    }

    return {
      inject: ["slots", "sessions", "modelDirectories", "locale"],
      apply(ctx) {
        // One stylesheet for the whole skin: settings panel, sprite strip and
        // effort slider. Registered once, removed on dispose.
        if (typeof document !== "undefined") {
          const style = document.createElement("style");
          style.dataset.dshKunkun = "styles";
          style.textContent = CSS;
          document.head.appendChild(style);
          ctx.effect(() => () => style.remove(), "dsh-kunkun: global styles");
        }
        try {
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-kunkun: locale");
          const bound = ctx.locale.bind(NS);
          translate = (key) => {
            try { return bound(key); } catch { return zh[key] ?? en[key] ?? key; }
          };
        } catch {
          // locale 不可用时保持内联中英文案，绝不让它中断下面的 slots 注册。
          translate = (key) => zh[key] ?? en[key] ?? key;
        }

        // 动图清单异步加载；失败时保持内置的篮球动图，界面不空窗。
        loadAnimations();

        const diagnose = (where) => (err) => {
          console.error("[dsh-kunkun] " + where + " registration failed:", err);
        };
        const guard = (where, fn) => () => {
          try { return fn(); } catch (err) {
            if (where.startsWith("conversation.input.right")) {
              sliderDiag.registered = "error: " + String((err && err.message) || err);
            }
            diagnose(where)(err);
          }
        };

        ctx.effect(
          () =>
            ctx.slots.inject(
              "shell.overlay",
              guard("shell.overlay", () =>
                ctx.slots.register(
                  { name: "shell.overlay", id: "kunkun-mascot", order: 100 },
                  Mascot
                )
              )
            ),
          "dsh-kunkun: mascot overlay on native shell"
        );

        ctx.effect(
          () =>
            ctx.slots.inject(
              "settings.section",
              guard("settings.section", () =>
                ctx.slots.register(
                  {
                    name: "settings.section",
                    id: "dsh-kunkun",
                    order: 50,
                    label: () => translate("nav"),
                  },
                  SettingsPanel
                )
              )
            ),
          "dsh-kunkun: settings section"
        );

        ctx.effect(
          () =>
            ctx.slots.inject(
              "plugins.bundle.config",
              guard("plugins.bundle.config", () =>
                ctx.slots.register(
                  { name: "plugins.bundle.config", key: "dsh-kunkun" },
                  SettingsPanel
                )
              )
            ),
          "dsh-kunkun: bundle config"
        );

        ctx.effect(
          () =>
            guard("conversation.input.right", () =>
              ctx.slots.inject(
                "conversation.input.right",
                guard("conversation.input.right:register", () => {
                  const dispose = ctx.slots.register(
                    {
                      name: "conversation.input.right",
                      id: "kunkun-effort-slider",
                      order: 10,
                      label: () => translate("slider.title"),
                      // Session scope: the renderer passes sessionId first.
                      inject: (sessionId) => resolveSliderProps(ctx, sessionId),
                    },
                    EffortSlider
                  );
                  sliderDiag.registered = "ok";
                  return dispose;
                })
              )
            )(),
          "dsh-kunkun: effort slider on composer trailing group"
        );
      },
    };

    /* Resolve per-session slider props without a hard service dependency:
       any failure degrades to { available: false } → the slider renders null
       while the rest of the skin keeps working. */
    function resolveSliderProps(ctx, sessionId) {
      const record = (patch) => { sliderDiag.props = { ...(sliderDiag.props ?? {}), sessionId: String(sessionId), ...patch }; };
      const empty = {
        available: false,
        directory: null,
        load: () => {},
        select: () => Promise.resolve(false),
      };
      try {
        let service;
        try { service = typeof ctx.get === "function" ? ctx.get("modelDirectories") : undefined; } catch { service = undefined; }
        if (!service || typeof service.directoryFor !== "function") service = ctx.modelDirectories;
        if (!service || typeof service.directoryFor !== "function") {
          record({ service: false });
          record({ directory: false, addressed: null });
          if (!resolveSliderProps.logged) {
            resolveSliderProps.logged = true;
            console.warn("[dsh-kunkun] effort mode disabled: modelDirectories service not resolvable");
          }
          return empty;
        }
        record({ service: true });
        const sessions = ctx.sessions;
        const addressed =
          typeof sessions?.subagentAddress === "function"
            ? sessions.subagentAddress(sessionId)
            : undefined;
        const directory = service.directoryFor(sessionId);
        record({ directory: !!(directory && directory.store), addressed: addressed !== undefined });
        if (!directory || !directory.store) {
          if (!resolveSliderProps.logged) {
            resolveSliderProps.logged = true;
            console.warn("[dsh-kunkun] slider hidden: directoryFor(" + JSON.stringify(sessionId) + ") returned no store");
          }
          return empty;
        }
        return {
          available: addressed === undefined,
          directory: directory.store,
          load: () => {
            try { void Promise.resolve(directory.load()).catch(() => {}); } catch { /* ignore */ }
          },
          select: async (selection) => {
            try {
              const result = await directory.select(selection);
              return result?.ok === true;
            } catch { return false; }
          },
        };
      } catch (err) {
        record({ error: String(err && err.message || err) });
        console.error("[dsh-kunkun] effort slider props failed:", err);
        return empty;
      }
    }
  },
});
