/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const jsx = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports, console, URLSearchParams,
    require: name => {
      if (name in dependencies) return dependencies[name];
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsx;
      if (name === "next/link") return "a";
      if (name.endsWith(".module.css")) return {};
      throw new Error(`Unexpected dependency ${name}`);
    },
  }, { filename: file });
  return exports;
}
function render(Component, props = {}) {
  return renderToStaticMarkup(React.createElement(Component, props));
}

test("homepage keeps boxed hero options without duplicate small buttons", () => {
  const dependencies = {
    "next/image": "img",
    "./components/homequicksearchbar": () => React.createElement("form", { "aria-label": "Quick Search fixture" }),
    "./components/featuredlistingspreview": () => null,
    "./components/ecosystemnav": load("src/app/components/ecosystemnav.tsx").default,
    "./components/HostGrowthIntro": load("src/app/components/HostGrowthIntro.tsx").default,
  };
  for (const signedIn of [false, true]) {
    dependencies["./components/authnav"] = load("src/app/components/authnav.tsx", {
      "next/navigation": { usePathname: () => "/", useRouter: () => ({}) },
      "@/lib/auth-context": { useAuth: () => ({ user: signedIn ? { uid: "demo-user" } : null, loading: false }) },
      "@/lib/use-is-owner": { useIsOwner: () => ({ isOwner: false, loading: false, error: "", retry: () => {}, refreshClaim: () => {} }) },
    }).default;
    const html = render(load("src/app/page.tsx", dependencies).default);
    const hero = html.slice(html.indexOf('aria-labelledby="home-hero-title"'), html.indexOf("</section>"));
    const actions = [...hero.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
    assert.deepEqual(actions.map(match => match[1]), ["/search", "/request-spot", "/host"]);
    for (const [index, title] of ["Find a stay", "Request a spot", "List a property"].entries()) {
      assert.ok(actions[index][2].includes(title));
    }
    assert.match(hero, /Choose your next step/);
    assert.match(hero, /RVNB quick paths/);
    assert.doesNotMatch(hero, /Primary RVNB actions/);
    assert.match(hero, /Find your next RV stay\. Share a place for someone else&#x27;s\./);
    for (const route of ["/requests", "/listings", "/unique-stays", "/host-growth", "/transport", "/insurance", "/community",
      ...(signedIn ? ["/account/requests", "/account", "/host"] : ["/login", "/signup"])]) {
      assert.ok(html.includes(`href="${route}"`), route);
    }
    assert.match(html, /View all listings/);
    assert.match(html, /Start using RVNB/);
  }
  const css = readFileSync("src/app/page.module.css", "utf8");
  assert.match(css, /\.heroCopy\s*\{\s*max-width: 760px;/);
  assert.match(css, /\.journeyCard:focus-visible/);
});

test("Quick Search retains selected parameters rather than becoming redundant plain navigation", () => {
  let values = ["Any", "", "Any"], slot = 0, route;
  const QuickSearch = load("src/app/components/homequicksearchbar.tsx", {
    react: {
      ...React, useMemo: callback => callback(),
      useState: () => { const index = slot++; return [values[index], value => { values[index] = value; }]; },
    },
    "next/navigation": { useRouter: () => ({ push: path => { route = path; } }) },
  }).default;
  const tree = () => { slot = 0; return QuickSearch(); };
  function find(node, predicate) {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  }
  let form = tree();
  form.props.onSubmit({ preventDefault() {} }); assert.equal(route, "/search");
  find(form, node => node.props.id === "qs-state").props.onChange({ target: { value: "TX" } });
  find(form, node => node.props.id === "qs-maxprice").props.onChange({ target: { value: "$60" } });
  find(form, node => node.props.id === "qs-hookups").props.onChange({ target: { value: "Full" } });
  form = tree(); form.props.onSubmit({ preventDefault() {} });
  assert.equal(route, "/search?state=TX&maxPrice=60&hookups=Full");
});

test("featured loading failure relies on its adjacent section listing link without duplicating it", () => {
  const preview = readFileSync("src/app/components/featuredlistingspreview.tsx", "utf8");
  const error = preview.slice(preview.indexOf('if (state.status === "error")'), preview.indexOf("if (state.items.length === 0)"));
  assert.match(error, /Couldn’t load featured listings/);
  assert.doesNotMatch(error, /<Link/);
  assert.match(preview, /href=\{`\/listings\/\$\{encodeURIComponent\(listing\.id\)\}`\}/);
  assert.match(preview, /Create the first listing/);
});

test("homepage keeps a single Unique Stays entry in the hub, without the duplicate lower panel", () => {
  const Hub = load("src/app/components/ecosystemnav.tsx").default;
  // The upper hub card is the retained Unique Stays entry.
  assert.match(render(Hub), /href="\/unique-stays"/);
  const home = readFileSync("src/app/page.tsx", "utf8");
  // The duplicate "Your getaway. Already here." panel below featured listings is removed.
  assert.ok(!home.includes("UniqueStaysIntro"), "homepage must not render the duplicate UniqueStaysIntro panel");
  assert.ok(!require("node:fs").existsSync("src/app/components/UniqueStaysIntro.tsx"), "UniqueStaysIntro component should be removed");
});

test("homepage Hub replaces its presentation with two stays and three truthful resource links", () => {
  const Hub = load("src/app/components/ecosystemnav.tsx").default;
  const html = render(Hub);
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(match => match[1]), ["/listings", "/unique-stays", "/transport", "/insurance", "/community"]);
  assert.equal((html.match(/<nav\b/g) || []).length, 1);
  assert.equal((html.match(/<h2\b/g) || []).length, 1);
  assert.match(html, /Find your stay\. Explore what&#x27;s next\./);
  assert.match(links[0][2], /Bring your RV/);
  assert.match(links[0][2], /Browse all stays/);
  assert.match(links[0][2], /RV spaces and other stays/);
  assert.match(links[2][2], /requests and provider interest/);
  assert.match(links[3][2], /early-access interest/);
  assert.doesNotMatch(html, /<button|<a[^>]*>(?:(?!<\/a>)[\s\S])*<a|Get a quote|Book transport/);
  const home = readFileSync("src/app/page.tsx", "utf8");
  assert.equal((home.match(/<EcosystemNav\s*\/>/g) || []).length, 1);
  assert.ok(home.indexOf("<HomeQuickSearchBar") < home.indexOf("<EcosystemNav"));
  assert.ok(home.indexOf("<EcosystemNav") < home.indexOf("<FeaturedListingsPreview"));
});

test("signed-out and signed-in Search navigation retain Unique Stays and existing account destinations", () => {
  const search = readFileSync("src/app/search/page.tsx", "utf8");
  const nav = search.slice(search.indexOf('<nav className={styles.nav}'), search.indexOf("</nav>") + 6);
  assert.match(nav, /href="\/unique-stays"/);
  assert.match(nav, /href="\/search"/);
  assert.match(nav, /href="\/listings"/);
  assert.match(nav, /<AuthNav/);
  for (const signedIn of [false, true]) {
    const AuthNav = load("src/app/components/authnav.tsx", {
      "next/navigation": { usePathname: () => "/search", useRouter: () => ({}) },
      "@/lib/auth-context": { useAuth: () => ({ user: signedIn ? { uid: "demo-user" } : null, loading: false, logout: async () => {} }) },
      "@/lib/use-is-owner": { useIsOwner: () => ({ isOwner: false, loading: false, error: "", retry: () => {}, refreshClaim: () => {} }) },
    }).default;
    const html = render(AuthNav);
    for (const href of signedIn ? ["/account", "/account/requests", "/host"] : ["/login", "/signup"]) {
      assert.ok(html.includes(`href="${href}"`), href);
    }
    // Owner Dashboard stays hidden without a verified owner claim.
    assert.ok(!html.includes('href="/owner"'), "owner link must be hidden without the claim");
  }
  // Verified owner claim reveals the Owner Dashboard entry.
  const OwnerNav = load("src/app/components/authnav.tsx", {
    "next/navigation": { usePathname: () => "/search", useRouter: () => ({}) },
    "@/lib/auth-context": { useAuth: () => ({ user: { uid: "demo-owner" }, loading: false, logout: async () => {} }) },
    "@/lib/use-is-owner": { useIsOwner: () => ({ isOwner: true, loading: false, error: "", retry: () => {}, refreshClaim: () => {} }) },
  }).default;
  assert.ok(render(OwnerNav).includes('href="/owner"'), "owner link must appear with the claim");
});

test("dashboard accommodation entry reuses the authorized form without unsupported query parameters", () => {
  const Panel = load("src/app/components/HostListingsPanel.tsx", { "./ListingPhoto": () => null }).default;
  const html = render(Panel, { listings: [], loading: false, error: "" });
  assert.match(html, /href="\/host\/listings\/new"><span[^>]*>[\s\S]*?Add a space or accommodation/);
  assert.match(html, /RV spaces, host-provided RVs, mobile homes, and cabins\./);
  assert.doesNotMatch(html, /\/host\/listings\/new\?/);
  const create = readFileSync("src/app/host/listings/new/page.tsx", "utf8");
  assert.match(create, /<HostGuard>/);
  assert.match(create, /<HostListingForm/);
  const form = readFileSync("src/app/components/HostListingForm.tsx", "utf8");
  assert.match(form, /id="listing-offering-type"/);
  assert.match(form, /Object\.entries\(LISTING_TYPES\)/);
  const types = load("src/lib/listing-types.ts");
  for (const offering of ["rv_space", "host_rv", "mobile_home", "cabin"]) assert.ok(types.LISTING_TYPES[offering]);
});
