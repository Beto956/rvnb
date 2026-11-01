/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const { readFileSync } = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
const React = require("react"), jsx = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");
const event = { preventDefault() {} };
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function loadLib(name) {
  const path = `src/lib/${name}.ts`, exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, {
    exports,
    require: dep => {
      if (dep === "./request-spot-contract") return loadLib("request-spot-contract");
      if (dep === "./transport-options") return loadLib("transport-options");
      throw Error(`Unexpected dependency ${dep}`);
    },
  }, { filename: path });
  return exports;
}
function harness(file, { user = { uid: "demo-user", email: "owner@example.test" }, draft, add = async () => {}, storageFails = false, transport, props = {} } = {}) {
  const slots = [], writes = [], routes = [], logs = [], storage = new Map();
  if (draft) storage.set(draft.key, JSON.stringify(draft.value));
  let index = 0;
  const sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { if (storageFails) throw Error("local storage blocked"); storage.set(key, value); },
    removeItem: key => { storage.delete(key); },
  };
  const hooks = {
    ...React,
    useState: initial => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], value => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef: initial => { const slot = index++; return slots[slot] ?? (slots[slot] = { current: initial }); },
    useMemo: callback => callback(),
    useEffect: () => {},
    useSyncExternalStore: (_, snapshot) => snapshot(),
  };
  const exports = {};
  const source = readFileSync(file, "utf8") + (file.includes("request") ? "\nexport { validateStep, normalizeRequest, initialForm };" : file.includes("provider") ? "\nexport { initialForm };" : "");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, URLSearchParams, sessionStorage, window: { sessionStorage, dispatchEvent() {} }, Event: class {},
    console: { error: (...args) => logs.push(args) },
    require: name => {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return jsx;
      if (name === "next/link") return "a";
      if (name === "next/image") return "img";
      if (name.endsWith(".module.css")) return {};
      if (name === "next/navigation") return { useRouter: () => ({ push: route => routes.push(route) }) };
      if (name === "@/lib/firebase") return { db: {} };
      if (name === "@/lib/auth-context") return { useAuth: () => ({ user, loading: false }) };
      if (name === "../components/authnav") return () => null;
      if (name === "@/lib/use-my-transport") return { useMyTransport: () => transport || { requests: [], providers: [], loading: false, error: "", retry: () => routes.push("retry") } };
      if (name === "@/lib/transport-options") return loadLib("transport-options");
      if (name === "firebase/firestore") return {
        collection: (_, name) => name, serverTimestamp: () => "demo-server-time",
        addDoc: async (collection, payload) => { writes.push({ collection, payload }); return add(); },
      };
      throw Error(`Unexpected dependency ${name}`);
    },
  }, { filename: file });
  return { ...exports, writes, routes, logs, storage, render: () => { index = 0; return exports.default(props); } };
}
const pageFile = "src/app/transport/page.tsx", requestFile = "src/app/transport/request/page.tsx", providerFile = "src/app/transport/provider/page.tsx";
const formNode = tree => nodes(tree, node => node.type === "form")[0];
const html = tree => renderToStaticMarkup(tree);
function validRequest() {
  const base = harness(requestFile).initialForm;
  return { ...base, rvType: "Motorhome", lengthFt: "30", condition: "Roadworthy and ready to move", movementMethod: "Drive my motorhome",
    tires: "Yes", lightsBrakes: "Yes", slidesAwnings: "Yes", connectedUtilities: "No",
    pickupCity: "Demo pickup", pickupState: "TX", pickupLocationType: "Storage facility", destinationCity: "Demo destination", destinationState: "AZ", destinationLocationType: "Campground or RV park",
    pickupDate: "2099-01-02", fullName: "Demo owner", email: "owner@example.test", phone: "555-0100", confirmsAccuracy: true, confirmsNoGuarantee: true };
}
function validProvider() {
  return { ...harness(providerFile).initialForm, step: 3, name: "Demo provider", email: "provider@example.test", phone: "555-0101",
    homeCity: "Demo base", homeState: "TX", providerType: "company", operatingScope: "regional", services: ["driveaway"],
    equipment: ["chase_vehicle"], serviceArea: "Demo operating corridor", cdlStatus: "not_applicable", insuranceStatus: "in_process",
    experienceYears: "1_to_3", confirmsAccuracy: true, confirmsEarlyAccess: true };
}
test("Transport keeps one top audience entry each, honest status, and no invented route/provider activity", () => {
  const output = html(harness(pageFile).render());
  assert.equal((output.match(/href="\/transport\/request"/g) || []).length, 1);
  assert.equal((output.match(/href="\/transport\/provider"/g) || []).length, 2);
  assert.match(output, /matching, quotes, bookings, scheduling, messaging, tracking, payments, and transport reviews are not available/i);
  assert.match(output, /Start planning your move/);
  assert.match(output, /Ways to transport your RV/);
  assert.match(output, /Prepare for a smoother handoff/);
  assert.doesNotMatch(output, /existing three-step form|current form|onboarding form/);
  assert.doesNotMatch(output, /Dallas|Phoenix|Provider match|liveIndicator/);
  assert.match(output, /Tow-away/); assert.match(output, /Drive-away/); assert.match(output, /Trailer or flatbed/);
  assert.match(output, /self-reported and have not been verified/);
});
test("interest validates email, preserves cleared input, and retains draft through sign-in", async () => {
  const h = harness(pageFile, { user: null });
  let tree = h.render();
  nodes(tree, node => node.props.id === "transport-interest-email")[0].props.onChange({ target: { value: "invalid" } });
  await formNode(h.render()).props.onSubmit(event);
  assert.equal(h.writes.length, 0); assert.match(html(h.render()), /Enter a valid email/);
  nodes(h.render(), node => node.props.id === "transport-interest-email")[0].props.onChange({ target: { value: "test@example.test" } });
  await formNode(h.render()).props.onSubmit(event);
  assert.equal(h.routes[0], "/login?next=%2Ftransport%23request");
  assert.match(h.storage.get("rvnb-transport-interest-draft"), /test@example.test/);
  const signed = harness(pageFile); tree = signed.render();
  nodes(tree, node => node.props.id === "transport-interest-email")[0].props.onChange({ target: { value: "" } });
  assert.equal(nodes(signed.render(), node => node.props.id === "transport-interest-email")[0].props.value, "");
});
test("interest suppresses duplicate submits, sends private owner payload, and shows honest success", async () => {
  let finish;
  const h = harness(pageFile, { add: () => new Promise(resolve => { finish = resolve; }) });
  const submit = formNode(h.render()).props.onSubmit;
  const pending = submit(event); await submit(event); assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].payload.userId, "demo-user"); assert.equal(h.writes[0].collection, "transportInterest");
  finish(); await pending; await submit(event); assert.equal(h.writes.length, 1);
  assert.match(html(h.render()), /not a move request or provider registration/); assert.equal(formNode(h.render()), undefined);
});
test("interest error preserves values and allows retry; blocked storage prevents losing sign-in draft", async () => {
  let fail = true;
  const h = harness(pageFile, { add: async () => { if (fail) throw Error("demo offline"); } });
  await formNode(h.render()).props.onSubmit(event);
  assert.match(html(h.render()), /entries are still here/);
  assert.equal(nodes(h.render(), node => node.props.id === "transport-interest-email")[0].props.value, "owner@example.test");
  fail = false; await formNode(h.render()).props.onSubmit(event); assert.equal(h.writes.length, 2);
  const blocked = harness(pageFile, { user: null, storageFails: true, draft: { key: "rvnb-transport-interest-draft", value: { email: "demo@example.test", interestType: "host" } } });
  await formNode(blocked.render()).props.onSubmit(event);
  assert.equal(blocked.routes.length, 0); assert.match(html(blocked.render()), /could not save this draft/);
});
test("request validates all sections and rejects unsupported drive-away combinations", () => {
  const h = harness(requestFile), form = validRequest();
  for (const step of [1, 2, 3]) assert.equal(h.validateStep(form, step).length, 0);
  assert.match(h.validateStep({ ...form, rvType: "Fifth wheel" }, 1)[0], /Drive-away is for motorhomes/);
  assert.match(h.validateStep({ ...form, condition: "Not currently roadworthy" }, 1)[0], /cannot be driven/);
  assert.equal(h.validateStep({ ...form, lengthFt: "Infinity" }, 1).length, 1);
  const trailer = { ...form, movementMethod: "Transport on a trailer", lightsBrakes: "" };
  assert.equal(h.validateStep(trailer, 1).length, 0);
  const trailerPage = harness(requestFile, { draft: { key: "rvnb-transport-request-draft", value: trailer } });
  assert.doesNotMatch(html(trailerPage.render()), /Are the lights and brakes working/);
  assert.equal(h.normalizeRequest(trailer, "demo-user").rv.lightsBrakes, "");
  assert.equal(h.validateStep({ ...form, deliveryDate: "2098-01-01" }, 2).length, 1);
  const payload = h.normalizeRequest(form, "demo-user");
  assert.equal(payload.rv.lengthFt, 30); assert.equal(payload.contact.preferredMethod, "Email");
  assert.equal(payload.logistics.specialInstructions, ""); assert.equal(payload.requesterId, "demo-user");
});
test("request retains fields across steps and refresh, final revalidation prevents stale invalid drafts", async () => {
  const draft = { key: "rvnb-transport-request-draft", value: validRequest() };
  const h = harness(requestFile, { draft });
  let tree = h.render();
  const stepOne = nodes(tree, node => typeof node.type === "function" && node.type.name === "StepOne")[0];
  stepOne.props.update("weightLb", "12345");
  assert.equal(JSON.parse(h.storage.get(draft.key)).weightLb, "12345");
  formNode(h.render()).props.onSubmit(event); formNode(h.render()).props.onSubmit(event);
  tree = h.render();
  const stepThree = nodes(tree, node => typeof node.type === "function" && node.type.name === "StepThree")[0];
  stepThree.props.update("lengthFt", "");
  await formNode(h.render()).props.onSubmit(event);
  assert.equal(h.writes.length, 0); assert.match(html(h.render()), /approximate RV length/);
});
test("request suppresses duplicate writes and preserves input for retry after failure", async () => {
  let finish, fail = true;
  const h = harness(requestFile, { draft: { key: "rvnb-transport-request-draft", value: validRequest() }, add: () => fail ? Promise.reject(Error("demo offline")) : new Promise(resolve => { finish = resolve; }) });
  formNode(h.render()).props.onSubmit(event); formNode(h.render()).props.onSubmit(event);
  await formNode(h.render()).props.onSubmit(event); assert.match(html(h.render()), /could not submit/);
  fail = false; const submit = formNode(h.render()).props.onSubmit, pending = submit(event); await submit(event);
  assert.equal(h.writes.length, 2); finish(); await pending; await submit(event); assert.equal(h.writes.length, 2);
  const success = html(h.render());
  assert.match(success, /Request received/);
  assert.match(success, /href="\/account"/);
  assert.match(success, /review it in My Account/);
});
test("provider requires explicit declarations and preserves valid legacy drafts", () => {
  const h = harness(providerFile);
  assert.equal(h.initialForm.insuranceStatus, ""); assert.equal(h.initialForm.experienceYears, "");
  assert.equal(h.initialForm.equipment.length, 0); assert.equal(h.initialForm.services.length, 0);
  const restored = harness(providerFile, { draft: { key: "rvnb-transport-provider-draft", value: { ...validProvider(), step: 1 } } });
  const output = html(restored.render());
  assert.match(output, /provider@example.test/);
  assert.match(output, /Illustration only/); assert.match(output, /this form does not verify them/);
  assert.doesNotMatch(output, /Verified equipment readiness|receive first review/);
});
test("provider validates boundary lengths, blocks duplicates, and retains data on errors", async () => {
  let finish, fail = true;
  const h = harness(providerFile, { draft: { key: "rvnb-transport-provider-draft", value: validProvider() },
    add: () => fail ? Promise.reject(Error("demo offline")) : new Promise(resolve => { finish = resolve; }) });
  await formNode(h.render()).props.onSubmit(event); assert.match(html(h.render()), /Could not submit your provider/);
  fail = false; const submit = formNode(h.render()).props.onSubmit, pending = submit(event); await submit(event);
  assert.equal(h.writes.length, 2); finish(); await pending; await submit(event); assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1].payload.userId, "demo-user");
  assert.equal(h.writes[1].payload.insuranceStatus, "in_process");
  const success = html(h.render());
  assert.match(success, /Registration received/);
  assert.match(success, /does not create a public listing or guarantee work/);
  assert.match(success, /href="\/account"/);
  const invalid = harness(providerFile, { draft: { key: "rvnb-transport-provider-draft", value: { ...validProvider(), serviceArea: "x".repeat(501) } } });
  await formNode(invalid.render()).props.onSubmit(event); assert.equal(invalid.writes.length, 0);
  assert.match(html(invalid.render()), /500 characters/);
});
test("malformed draft structures do not crash forms or invent provider declarations", () => {
  const request = harness(requestFile, { draft: { key: "rvnb-transport-request-draft", value: { rvType: [] } } });
  assert.doesNotThrow(() => html(request.render())); assert.equal(request.logs.length, 1);
  const provider = harness(providerFile, { draft: { key: "rvnb-transport-provider-draft", value: { services: null } } });
  assert.doesNotThrow(() => html(provider.render())); assert.ok(provider.logs.length > 0);
});

test("signed-out request and provider submissions retain drafts and redirect without writing", async () => {
  const request = harness(requestFile, { user: null, draft: { key: "rvnb-transport-request-draft", value: validRequest() } });
  formNode(request.render()).props.onSubmit(event); formNode(request.render()).props.onSubmit(event);
  await formNode(request.render()).props.onSubmit(event);
  assert.equal(request.writes.length, 0); assert.equal(request.routes[0], "/login?next=%2Ftransport%2Frequest");
  assert.equal(JSON.parse(request.storage.get("rvnb-transport-request-draft")).pickupCity, "Demo pickup");
  const provider = harness(providerFile, { user: null, draft: { key: "rvnb-transport-provider-draft", value: validProvider() } });
  await formNode(provider.render()).props.onSubmit(event);
  assert.equal(provider.writes.length, 0); assert.equal(provider.routes[0], "/login?next=%2Ftransport%2Fprovider");
  assert.equal(JSON.parse(provider.storage.get("rvnb-transport-provider-draft")).services[0], "driveaway");
});

test("request validation follows the selected movement method without inventing suitability", () => {
  const h = harness(requestFile), form = validRequest();
  const tow = { ...form, rvType: "Travel trailer", movementMethod: "Tow my RV", lightsBrakes: "" };
  assert.match(h.validateStep(tow, 1)[0], /preparation questions/);
  const flatbed = { ...tow, movementMethod: "Transport on a trailer" };
  assert.equal(h.validateStep(flatbed, 1).length, 0);
  assert.equal(h.validateStep({ ...flatbed, movementMethod: "Tow my RV" }, 1).length, 1);
  assert.equal(h.validateStep({ ...flatbed, movementMethod: "Help me determine the right method" }, 1).length, 1);
  const unsure = { ...form, tires: "Unsure", lightsBrakes: "Unsure", condition: "Unsure" };
  assert.equal(h.validateStep(unsure, 1).length, 0);
  const payload = h.normalizeRequest(unsure, "demo-user");
  assert.equal(payload.rv.tires, "Unsure");
  assert.equal(payload.rv.lightsBrakes, "Unsure");
  assert.equal(payload.rv.condition, "Unsure");
  const switched = h.normalizeRequest({ ...form, movementMethod: "Transport on a trailer", lightsBrakes: "No" }, "demo-user");
  assert.equal(switched.rv.lightsBrakes, "No");
  assert.equal(switched.rv.movementMethod, "Transport on a trailer");
});

test("account transport normalizers omit missing details honestly", () => {
  const lib = loadLib("my-transport");
  const emptyRequest = lib.normalizeMyTransportRequest("r1", {});
  assert.equal(emptyRequest.route, "Route not provided");
  assert.equal(emptyRequest.rvSummary, "RV details not provided");
  assert.equal(emptyRequest.method, "");
  assert.equal(emptyRequest.pickupDate, "");
  assert.equal(emptyRequest.status, "Status unknown");
  assert.equal(emptyRequest.createdAt, 0);
  const full = lib.normalizeMyTransportRequest("r2", {
    status: "submitted",
    rv: { type: "Fifth wheel", lengthFt: 36, movementMethod: "Tow my RV" },
    pickup: { city: "Dallas", state: "TX" },
    destination: { city: "Phoenix", state: "AZ" },
    timing: { pickupDate: "2099-01-10" },
    createdAt: { seconds: 2000000000 },
  });
  assert.equal(full.route, "Dallas, TX → Phoenix, AZ");
  assert.equal(full.rvSummary, "Fifth wheel • 36 ft");
  assert.equal(full.method, "Tow my RV");
  assert.equal(full.status, "Submitted");
  assert.ok(full.pickupDate.length > 0);
  assert.equal(full.createdAt, 2000000000000);
  const partial = lib.normalizeMyTransportRequest("r3", { pickup: { city: "Dallas", state: "TX" }, timing: { pickupDate: "not-a-date" } });
  assert.equal(partial.route, "Dallas, TX → Destination not provided");
  assert.equal(partial.pickupDate, "");
  const provider = lib.normalizeMyTransportProvider("p1", {
    name: "  Bob Hauling  ", providerType: "independent", operatingScope: "regional",
    services: ["driveaway", "unknown_service"], serviceArea: "Texas and Southwest corridor",
    createdAt: { seconds: 2000000000 },
  });
  assert.equal(provider.name, "Bob Hauling");
  assert.equal(provider.typeLabel, "Independent transporter / Hotshot driver");
  assert.equal(provider.scopeLabel, "Regional & multi-state corridors");
  assert.deepEqual([...provider.services], ["Motorhome drive-away"]);
  const emptyProvider = lib.normalizeMyTransportProvider("p2", { services: "not-a-list" });
  assert.equal(emptyProvider.name, "Provider registration");
  assert.equal(emptyProvider.typeLabel, "");
  assert.deepEqual([...emptyProvider.services], []);
  assert.equal(emptyProvider.serviceArea, "");
});

test("account transport panel covers loading, error, empty, and private data states", () => {
  const panelFile = "src/app/account/components/AccountTransportPanel.tsx";
  const panelProps = { uid: "demo-user" };
  const loading = harness(panelFile, { props: panelProps, transport: { requests: [], providers: [], loading: true, error: "", retry() {} } });
  assert.match(html(loading.render()), /Loading your transport activity/);
  const failing = harness(panelFile, { props: panelProps, transport: { requests: [], providers: [], loading: false, error: "We couldn't load your transport activity. Please try again.", retry: () => failing.routes.push("retry") } });
  const errorHtml = html(failing.render());
  assert.match(errorHtml, /role="alert"/);
  nodes(failing.render(), node => node.type === "button")[0].props.onClick();
  assert.equal(failing.routes[0], "retry");
  const empty = harness(panelFile, { props: panelProps });
  const emptyHtml = html(empty.render());
  assert.match(emptyHtml, /No transport activity yet/);
  assert.match(emptyHtml, /href="\/transport\/request"/);
  assert.match(emptyHtml, /href="\/transport\/provider"/);
  const filled = harness(panelFile, { props: panelProps, transport: {
    requests: [{ id: "r1", route: "Dallas, TX → Phoenix, AZ", rvSummary: "Fifth wheel • 36 ft", method: "Tow my RV", pickupDate: "Jan 10, 2099", status: "Submitted", createdAt: 1 }],
    providers: [{ id: "p1", name: "Bob Hauling", typeLabel: "Independent transporter / Hotshot driver", scopeLabel: "Regional & multi-state corridors", services: ["Motorhome drive-away"], serviceArea: "Texas and Southwest corridor", createdAt: 2 }],
    loading: false, error: "", retry() {},
  } });
  const filledHtml = html(filled.render());
  assert.match(filledHtml, /Dallas, TX → Phoenix, AZ/);
  assert.match(filledHtml, /Fifth wheel • 36 ft/);
  assert.match(filledHtml, /Submitted/);
  assert.match(filledHtml, /Bob Hauling/);
  assert.match(filledHtml, /Motorhome drive-away/);
  assert.match(filledHtml, /Only you can see these/);
  assert.doesNotMatch(filledHtml, /owner@example.test|555-01/);
});
