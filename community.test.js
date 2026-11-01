/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react"), jsx = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports, console, require: name => {
      if (name in dependencies) return dependencies[name];
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsx;
      if (name === "next/link") return "a";
      if (name.endsWith(".module.css")) return {};
      throw new Error(`Unexpected dependency ${name} in ${file}`);
    },
  }, { filename: file });
  return exports;
}
const community = load("src/lib/community.ts");
const fixture = (id, overrides = {}) => ({
  id, data: () => ({
    authorId: "demo-author", authorDisplayName: "Local fixture author", title: `Local fixture discussion ${id}`,
    body: "Demonstration data for tests only, never stored in production.", category: "general_discussion",
    region: "Demo region", rigType: null, createdAt: null, updatedAt: null, ...overrides,
  }),
});
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object") return "";
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  return text(tree.props?.children);
}
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function harness(getDocs, signedIn = false) {
  const slots = [], routes = [], queries = [];
  let index = 0, effects = [];
  const memo = (callback, deps) => {
    const slot = index++;
    if (!slots[slot] || deps.some((v, i) => !Object.is(v, slots[slot].deps[i]))) slots[slot] = { deps, value: callback() };
    return slots[slot].value;
  };
  const hooks = {
    useState: initial => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], value => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef: initial => { const slot = index++; return slots[slot] ?? (slots[slot] = { current: initial }); },
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
    useEffect: (callback, deps) => {
      const slot = index++;
      if (!slots[slot] || deps.some((v, i) => !Object.is(v, slots[slot].deps[i]))) effects.push(() => {
        slots[slot]?.cleanup?.();
        slots[slot] = { deps, cleanup: callback() };
      });
    },
  };
  const Card = () => null;
  const Page = load("src/app/community/page.tsx", {
    react: hooks, "next/navigation": { useRouter: () => ({ push: route => routes.push(route) }) },
    "@/lib/firebase": { db: {} }, "@/lib/auth-context": { useAuth: () => ({ user: signedIn ? { uid: "demo-user" } : null }) },
    "@/lib/community": community, "./components/CommunityHeader": () => null, "./components/CommunitySidebar": () => null,
    "./components/DiscussionCard": Card, "./components/PinnedGuideCard": () => null,
    "firebase/firestore": {
      collection: (_, name) => name, where: (...args) => ["where", ...args], orderBy: (...args) => ["orderBy", ...args],
      limit: count => ["limit", count], startAfter: cursor => ["startAfter", cursor.id], query: (...args) => args,
      getDocs: query => { queries.push(query); return getDocs(query); },
    },
  }).default;
  return {
    routes, queries, render: () => { index = 0; effects = []; return Page(); },
    flush: () => effects.forEach(effect => effect()),
    dispose: () => slots.forEach(slot => slot?.cleanup?.()),
    cards: tree => nodes(tree, node => node.type === Card),
  };
}
const button = (tree, label) => nodes(tree, node => node.type === "button" && text(node).trim() === label)[0];

test("sidebar contains supported actions and guidelines, not invented activity or saving", () => {
  const Sidebar = load("src/app/community/components/CommunitySidebar.tsx", { "@/lib/community": community }).default;
  for (const user of [null, { uid: "demo-user", displayName: "Local member" }]) {
    const html = renderToStaticMarkup(React.createElement(Sidebar, { user, onSignIn: () => {} }));
    assert.doesNotMatch(html, /Trending now|Upcoming meetup|Top contributors|helpful votes|going|save discussions|Demo/);
    assert.match(html, /Community guidelines/);
    assert.match(html, /Protect private information/);
    for (const category of ["general_discussion", "routes_road_conditions"]) {
      const next = `/community/new?category=${category}`;
      assert.ok(html.includes(user ? next : `/login?next=${encodeURIComponent(next)}`));
    }
  }
  const create = readFileSync("src/app/community/new/page.tsx", "utf8");
  assert.match(create, /searchParams\.get\("category"\)/);
  assert.equal(existsSync("src/app/community/mockData.ts"), false);
});

test("cards use independent native links and disclosures with owner edit/nonowner report destinations", () => {
  const Card = load("src/app/community/components/DiscussionCard.tsx", { "@/lib/community": community }).default;
  const post = { id: "demo-post", ...fixture("demo-post").data() };
  for (const [currentUserId, expected, absent] of [["demo-author", "?edit=1", "?report=1"], ["other", "?report=1", "?edit=1"], [null, "Open discussion", "?report=1"]]) {
    const html = renderToStaticMarkup(React.createElement(Card, { post, currentUserId }));
    assert.match(html, /href="\/members\/demo-author"/);
    assert.match(html, /href="\/community\/posts\/demo-post"/);
    assert.match(html, /<details/); assert.match(html, /<summary/);
    assert.ok(html.includes(expected)); assert.ok(!html.includes(absent));
    assert.doesNotMatch(html, /<a[^>]*>(?:(?!<\/a>)[\s\S])*<a/);
  }
  const Guide = load("src/app/community/components/PinnedGuideCard.tsx").default;
  const guide = renderToStaticMarkup(React.createElement(Guide));
  assert.match(guide, /Not a member discussion/); assert.doesNotMatch(guide, /weeks ago|✓|Verified/);
  const detail = readFileSync("src/app/community/posts/[id]/page.tsx", "utf8");
  assert.match(detail, /searchParams\.get\("edit"\)/); assert.match(detail, /searchParams\.get\("report"\)/);
  const disclosure = nodes(Card({ post, currentUserId: "other" }), node => node.type === "details")[0];
  let focused = false;
  const target = { open: true, querySelector: () => ({ focus: () => { focused = true; } }) };
  disclosure.props.onKeyDown({ key: "Escape", currentTarget: target });
  assert.equal(target.open, false); assert.equal(focused, true);
});

test("feed distinguishes loading, empty, filter-empty and retryable errors", async () => {
  let fail = true;
  const h = harness(async () => { if (fail) throw new Error("demo offline"); return { docs: [] }; });
  let tree = h.render(); assert.match(text(tree), /Loading discussions/); h.flush(); await tick();
  tree = h.render(); assert.match(text(tree), /Could not load discussions/);
  assert.doesNotMatch(text(tree), /No discussions yet/);
  fail = false; button(tree, "Retry discussions").props.onClick();
  tree = h.render(); h.flush(); await tick(); tree = h.render();
  assert.match(text(tree), /No discussions yet/);
  button(tree, "Sign In to Participate").props.onClick();
  assert.equal(h.routes.at(-1), "/login?next=%2Fcommunity");
  button(tree, "Families & Pets").props.onClick();
  tree = h.render(); h.flush(); await tick(); tree = h.render();
  assert.match(text(tree), /No matches for these filters/);
  assert.equal(button(tree, "Families & Pets").props["aria-pressed"], true);
  assert.ok(JSON.stringify(h.queries.at(-1)).includes("families_pets"));
  button(tree, "Clear filters").props.onClick();
  tree = h.render(); h.flush(); await tick(); tree = h.render();
  assert.match(text(tree), /No discussions yet/);
  h.dispose();
});

test("permission failures offer retry and sign-in, not empty-success messaging", async () => {
  const h = harness(async () => { throw { code: "permission-denied" }; });
  h.render(); h.flush(); await tick(); const tree = h.render();
  assert.match(text(tree), /permission to view discussions/);
  assert.ok(button(tree, "Retry discussions")); assert.ok(button(tree, "Sign in"));
  assert.doesNotMatch(text(tree), /No discussions yet/); h.dispose();
});

test("real queries retain sorting, paging, search of full loaded text and load-more errors", async () => {
  let calls = 0, failMore = true;
  const first = Array.from({ length: 18 }, (_, i) => fixture(String(i), { body: "x".repeat(250) + " searchable-tail" }));
  const h = harness(async () => {
    calls++;
    if (calls === 1) return { docs: first };
    if (failMore) throw new Error("demo load more offline");
    return { docs: [fixture("next")] };
  }, true);
  h.render(); h.flush(); await tick(); let tree = h.render();
  assert.equal(h.cards(tree).length, 18);
  assert.ok(JSON.stringify(h.queries[0]).includes('["limit",18]'));
  assert.ok(JSON.stringify(h.queries[0]).includes('["orderBy","createdAt","desc"]'));
  nodes(tree, node => node.type === "input" && node.props.type === "search")[0].props.onChange({ target: { value: "searchable-tail" } });
  tree = h.render(); assert.equal(h.cards(tree).length, 18);
  assert.match(text(tree), /not the entire board/); assert.ok(button(tree, "Load more discussions"));
  await button(tree, "Load more discussions").props.onClick(); tree = h.render();
  assert.match(text(tree), /Could not load more discussions/); assert.equal(h.cards(tree).length, 18);
  assert.equal(nodes(tree, node => node.props.role === "alert").length, 1);
  failMore = false; await button(tree, "Load more discussions").props.onClick();
  tree = h.render(); assert.ok(JSON.stringify(h.queries.at(-1)).includes('["startAfter","17"]'));
  nodes(tree, node => node.type === "input" && node.props.type === "search")[0].props.onChange({ target: { value: "" } });
  tree = h.render(); assert.equal(h.cards(tree).length, 19);
  const sort = nodes(tree, node => node.type === "select")[0];
  sort.props.onChange({ target: { value: "oldest" } }); tree = h.render(); h.flush(); await tick(); tree = h.render();
  assert.ok(JSON.stringify(h.queries.at(-1)).includes('["orderBy","createdAt","asc"]'));
  button(tree, "Start a discussion →").props.onClick(); assert.equal(h.routes.at(-1), "/community/new");
  h.dispose();
});

test("late load-more results cannot enter another category; double clicks do not duplicate queries", async () => {
  let finish;
  const first = Array.from({ length: 18 }, (_, i) => fixture(String(i)));
  const h = harness(async query => {
    if (JSON.stringify(query).includes('"startAfter"')) return new Promise(resolve => { finish = resolve; });
    return { docs: JSON.stringify(query).includes('"families_pets"') ? [fixture("family", { category: "families_pets" })] : first };
  });
  h.render(); h.flush(); await tick(); let tree = h.render();
  const more = button(tree, "Load more discussions").props.onClick;
  const pending = more(); await more(); assert.equal(h.queries.length, 2);
  button(tree, "Families & Pets").props.onClick(); tree = h.render(); h.flush(); await tick(); tree = h.render();
  assert.equal(h.cards(tree)[0].props.post.id, "family");
  finish({ docs: [fixture("stale")] }); await pending; tree = h.render();
  assert.equal(h.cards(tree).length, 1); assert.equal(h.cards(tree)[0].props.post.id, "family");
  h.dispose();
});

test("late initial responses cannot replace newer filters", async () => {
  let finishInitial;
  const h = harness(async query => JSON.stringify(query).includes('"families_pets"')
    ? { docs: [fixture("family", { category: "families_pets" })] }
    : new Promise(resolve => { finishInitial = resolve; }));
  let tree = h.render(); h.flush();
  button(tree, "Families & Pets").props.onClick(); tree = h.render(); h.flush(); await tick();
  finishInitial({ docs: [fixture("old")] }); await tick(); tree = h.render();
  assert.equal(h.cards(tree).length, 1); assert.equal(h.cards(tree)[0].props.post.id, "family");
  h.dispose();
});

test("unmount invalidates outstanding pagination", async () => {
  let finishMore;
  const h = harness(async query => JSON.stringify(query).includes('"startAfter"')
    ? new Promise(resolve => { finishMore = resolve; })
    : { docs: Array.from({ length: 18 }, (_, i) => fixture(String(i))) });
  h.render(); h.flush(); await tick(); let tree = h.render();
  const pending = button(tree, "Load more discussions").props.onClick();
  h.dispose(); finishMore({ docs: [fixture("after-unmount")] }); await pending;
  tree = h.render(); assert.equal(h.cards(tree).length, 18);
});
