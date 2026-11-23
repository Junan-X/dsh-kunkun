/**
 * Host 半边：为皮肤素材注册静态资源路由。
 *
 * 素材不再以 base64 内嵌进 client.js，而是由宿主 webServer 伺服：
 *   /plugins/dsh-kunkun/assets/<任意子路径>
 * 一条 prefix 路由覆盖整个 assets 目录，所以新增素材（例如 assets/anim/ 里的
 * 动图）只放文件即可，不需要再改这个文件。
 */
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, resolve, sep } from "node:path";

export const PACKAGE_ID = "dsh-kunkun";
export const ASSET_PREFIX = `/plugins/${PACKAGE_ID}/assets`;

// 只伺服白名单里的类型：既省得给每个素材登记，也不把任意文件暴露出去。
const MIME = {
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
};

const ASSET_DIR = resolve(fileURLToPath(new URL("./assets/", import.meta.url)));

function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function serve(request) {
  let pathname = "";
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return notFound();
  }
  if (!pathname.startsWith(ASSET_PREFIX + "/")) return notFound();

  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
  } catch {
    return notFound(); // 非法的百分号编码
  }
  // 目录穿越防护：解析后必须仍落在 assets 目录内。
  const target = resolve(ASSET_DIR, "." + relative);
  if (target !== ASSET_DIR && !target.startsWith(ASSET_DIR + sep)) return notFound();

  const type = MIME[extname(target).toLowerCase()];
  if (!type || target === ASSET_DIR) return notFound();

  let body;
  try {
    if (!statSync(target).isFile()) return notFound();
    body = readFileSync(target);
  } catch {
    return notFound();
  }

  const isManifest = type.startsWith("application/json");
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(body.byteLength),
      // 清单必须每次取最新的（用户改完 manifest 重启即生效）；
      // 图片按 URL 里的 ?v= 做版本，可以放心缓存。
      "Cache-Control": isManifest ? "no-cache" : "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const inject = ["webServer"];

export function apply(ctx) {
  ctx.effect(() => {
    let dispose;
    try {
      dispose = ctx.webServer.register({
        kind: "prefix",
        path: ASSET_PREFIX,
        resource: async (request) => serve(request),
      });
    } catch (err) {
      console.error("[dsh-kunkun] 素材路由注册失败:", err);
      return () => {};
    }
    return () => {
      try { dispose(); } catch { /* ignore */ }
    };
  }, "dsh-kunkun: 静态素材路由");
}
