"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server.ts
var import_http = require("http");
var import_promises = require("fs/promises");
var import_path = __toESM(require("path"));
var import_url = require("url");
var import_next = __toESM(require("next"));
var dev = process.env.COZE_PROJECT_ENV !== "PROD";
var hostname = process.env.HOST || process.env.HOSTNAME || "0.0.0.0";
var port = parseInt(process.env.DEPLOY_RUN_PORT || process.env.PORT || "5000", 10);
var app = (0, import_next.default)({ dev, hostname, port });
var handle = app.getRequestHandler();
var root = process.cwd();
var contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
async function serveFile(res, filePath) {
  const normalized = import_path.default.normalize(filePath);
  if (!normalized.startsWith(root)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }
  try {
    const data = await (0, import_promises.readFile)(normalized);
    res.writeHead(200, {
      "Content-Type": contentTypes[import_path.default.extname(normalized).toLowerCase()] || "application/octet-stream"
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}
app.prepare().then(() => {
  const server = (0, import_http.createServer)(async (req, res) => {
    try {
      const parsedUrl = (0, import_url.parse)(req.url, true);
      const pathname = parsedUrl.pathname || "/";
      if (pathname === "/" || pathname === "/campus-anonymous-wall.html") {
        const served = await serveFile(res, import_path.default.join(root, "campus-anonymous-wall.html"));
        if (served) return;
      }
      if (pathname.startsWith("/public/") || pathname.startsWith("/assets/")) {
        const served = await serveFile(res, import_path.default.join(root, decodeURIComponent(pathname)));
        if (served) return;
      }
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });
  server.once("error", (err) => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${dev ? "development" : process.env.COZE_PROJECT_ENV}`
    );
  });
});
