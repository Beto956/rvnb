/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadLib(name) {
  const path = `src/lib/${name}.ts`;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, console, require: (d) => { throw new Error(`Unexpected dependency ${d}`); } }, { filename: path });
  return exports;
}

const { safeNextPath } = loadLib("safe-next-path");

test("safeNextPath allows legitimate internal paths", () => {
  assert.equal(safeNextPath("/listings"), "/listings");
  assert.equal(safeNextPath("/account/requests?requestId=abc123"), "/account/requests?requestId=abc123");
  assert.equal(safeNextPath("/transport#request"), "/transport#request");
  assert.equal(safeNextPath("/request-spot?requestId=xyz"), "/request-spot?requestId=xyz");
  assert.equal(safeNextPath("/host/listings/new"), "/host/listings/new");
});

test("safeNextPath falls back for missing or empty input", () => {
  assert.equal(safeNextPath(null), "/listings");
  assert.equal(safeNextPath(undefined), "/listings");
  assert.equal(safeNextPath(""), "/listings");
  assert.equal(safeNextPath("   "), "/listings");
  assert.equal(safeNextPath(null, "/account"), "/account");
});

test("safeNextPath rejects external and protocol-relative URLs", () => {
  assert.equal(safeNextPath("https://evil.com"), "/listings");
  assert.equal(safeNextPath("http://evil.com"), "/listings");
  assert.equal(safeNextPath("//evil.com"), "/listings");
  assert.equal(safeNextPath("evil.com"), "/listings");
  assert.equal(safeNextPath("javascript:alert(1)"), "/listings");
});

test("safeNextPath rejects backslash and encoded protocol-relative bypasses", () => {
  // Browsers normalize "\" to "/", so "/\evil.com" becomes "//evil.com".
  assert.equal(safeNextPath("/\\evil.com"), "/listings");
  assert.equal(safeNextPath("/\\/evil.com"), "/listings");
  assert.equal(safeNextPath("/%2f%2fevil.com"), "/listings");
  assert.equal(safeNextPath("/%5c%5cevil.com"), "/listings");
  assert.equal(safeNextPath("/%2Fevil.com"), "/listings");
});

test("safeNextPath rejects control characters and whitespace smuggling", () => {
  assert.equal(safeNextPath("/listings\x00.evil.com"), "/listings");
  assert.equal(safeNextPath("/listings\nevil"), "/listings");
  assert.equal(safeNextPath("/\tevil.com"), "/listings");
});

test("safeNextPath preserves query strings and fragments on valid paths", () => {
  assert.equal(safeNextPath("/account/requests?requestId=a%20b"), "/account/requests?requestId=a%20b");
  assert.equal(safeNextPath("/transport#request"), "/transport#request");
});
