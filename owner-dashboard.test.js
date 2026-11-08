/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Minimal recursive loader for the pure src/lib modules used by the dashboard.
function loadLib(name) {
  const filePath = path.join("src", "lib", `${name}.ts`);
  const exports = {};
  const localRequire = (specifier) => {
    if (specifier.startsWith("./")) {
      return loadLib(specifier.slice(2));
    }
    throw new Error(`Unexpected dependency ${specifier}`);
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(filePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, console, require: localRequire }, { filename: filePath });
  return exports;
}

const { hasOwnerClaim } = loadLib("owner-claim");
const {
  normalizeOwnerListing,
  normalizeOwnerBooking,
  normalizeOwnerRequest,
  normalizeOwnerRequestPrivate,
  normalizeOwnerOpportunity,
  normalizeOwnerTransportRequest,
  normalizeOwnerTransportProvider,
  normalizeOwnerTransportInterest,
  normalizeOwnerCommunityReport,
  normalizeOwnerReviewReport,
  normalizeOwnerReportedPost,
  normalizeOwnerReportedReview,
  normalizeOwnerUser,
  formatDateTime,
  OVERVIEW_DATASETS,
} = loadLib("owner-dashboard");

// --- hasOwnerClaim ---------------------------------------------------------

test("hasOwnerClaim accepts only a strict boolean true claim", () => {
  assert.equal(hasOwnerClaim({ owner: true }), true);
  assert.equal(hasOwnerClaim({ owner: true, email: "a@b.c" }), true);
  assert.equal(hasOwnerClaim({ owner: "true" }), false);
  assert.equal(hasOwnerClaim({ owner: 1 }), false);
  assert.equal(hasOwnerClaim({ owner: false }), false);
  assert.equal(hasOwnerClaim({}), false);
  assert.equal(hasOwnerClaim(null), false);
  assert.equal(hasOwnerClaim(undefined), false);
  assert.equal(hasOwnerClaim("owner"), false);
});

// --- overview datasets ------------------------------------------------------

test("overview datasets stay bounded to the intended dashboard collections", () => {
  const ids = OVERVIEW_DATASETS.map((dataset) => dataset.id);
  assert.deepEqual([...ids].sort(), [
    "bookings", "communityPosts", "communityReports", "hostOpportunities", "listings",
    "reviewReports", "reviews", "spotRequests", "transportInterest", "transportProviders",
    "transportRequests", "users",
  ]);
  // Least privilege: no insurance, community interest, host growth, or calendar internals.
  assert.equal(ids.includes("insuranceInterest"), false);
  assert.equal(ids.includes("insuranceProviders"), false);
  assert.equal(ids.includes("communityInterest"), false);
  assert.equal(ids.includes("hostGrowthRegistrations"), false);
  assert.equal(ids.includes("memberProfiles"), false);
  assert.equal(ids.includes("listingReservations"), false);
  assert.equal(ids.includes("dayMeta"), false);
});

// --- normalizers: honest missing-field handling ------------------------------

test("normalizeOwnerListing omits unknown price and location", () => {
  const listing = normalizeOwnerListing("l1", { title: "  ", hostId: "h1" });
  assert.equal(listing.title, "Untitled listing");
  assert.equal(listing.location, "Location not provided");
  assert.equal(listing.priceLabel, "Price not provided");
  assert.equal(listing.createdAt, 0);
  const priced = normalizeOwnerListing("l2", {
    title: "Riverside pad", city: "Dallas", state: "TX", price: 45, pricingType: "Night",
    listingType: "host_rv", hostId: "h1", createdAt: { seconds: 1700000000 },
  });
  assert.equal(priced.priceLabel, "$45 / night");
  assert.equal(priced.typeLabel, "Host RV stay");
  assert.equal(priced.createdAt, 1700000000000);
});

test("normalizeOwnerBooking keeps raw status and never invents one", () => {
  assert.equal(normalizeOwnerBooking("b1", {}).status, "unknown");
  assert.equal(normalizeOwnerBooking("b2", { status: "pending" }).status, "pending");
  const booking = normalizeOwnerBooking("b3", {
    listingId: "l1", guestId: "g1", hostId: "h1", checkIn: "2099-01-01", checkOut: "2099-01-03",
  });
  assert.equal(booking.checkIn, "2099-01-01");
});

test("normalizeOwnerRequest surfaces drafts honestly", () => {
  const draft = normalizeOwnerRequest("r1", { requesterId: "g1", status: "draft", isFinalized: false });
  assert.equal(draft.status, "draft");
  const open = normalizeOwnerRequest("r2", {
    requesterId: "g1", status: "open", isFinalized: true, requestType: "Work Stay",
    city: "Dallas", state: "TX",
  });
  assert.equal(open.status, "open");
  assert.equal(open.title, "Work Stay");
  assert.equal(open.location, "Dallas, TX");
});

test("normalizeOwnerRequestPrivate never fabricates contact details", () => {
  const empty = normalizeOwnerRequestPrivate({});
  assert.equal(empty.contactName, "Not provided");
  assert.equal(empty.contactEmail, "Not provided");
  const full = normalizeOwnerRequestPrivate({ contactName: "Guest One", contactEmail: "g@example.com" });
  assert.equal(full.contactEmail, "g@example.com");
});

test("normalizeOwnerOpportunity distinguishes linked responses from self-reported applications", () => {
  const response = normalizeOwnerOpportunity("o1", {
    requestId: "r1", hostId: "h1", requesterId: "g1", fullName: "Host One",
    cityLocation: "Dallas", stateRegion: "TX", rvSpotsCount: 2, powerOption: "50 amp",
  });
  assert.equal(response.kind, "response");
  assert.equal(response.summary, "2 spots · 50 amp");
  const application = normalizeOwnerOpportunity("o2", { submissionType: "host_interest", city: "Waco", state: "TX" });
  assert.equal(application.kind, "application");
  assert.equal(application.requestId, "");
  assert.equal(application.name, "");
});

test("normalizeOwnerTransportRequest includes contact details for the protected view", () => {
  const request = normalizeOwnerTransportRequest("t1", {
    requesterId: "g1", status: "submitted",
    rv: { type: "Travel trailer", lengthFt: 30, movementMethod: "Tow my RV" },
    pickup: { city: "Dallas", state: "TX" },
    destination: { city: "Phoenix", state: "AZ" },
    timing: { pickupDate: "2099-01-10" },
    contact: { fullName: "Guest One", email: "g@example.com" },
    createdAt: { seconds: 1700000000 },
  });
  assert.equal(request.route, "Dallas, TX → Phoenix, AZ");
  assert.equal(request.contactName, "Guest One");
  assert.equal(request.contactEmail, "g@example.com");
  const sparse = normalizeOwnerTransportRequest("t2", {});
  assert.equal(sparse.route, "Route not provided");
  assert.equal(sparse.contactName, "Not provided");
  assert.equal(sparse.status, "Status unknown");
});

test("normalizeOwnerTransportProvider labels missing contact info", () => {
  const provider = normalizeOwnerTransportProvider("p1", {
    name: "Bob", email: "bob@example.com", phone: "555", providerType: "independent",
    services: ["travel_trailer"], operatingScope: "regional",
  });
  assert.equal(provider.name, "Bob");
  assert.equal(provider.email, "bob@example.com");
  const sparse = normalizeOwnerTransportProvider("p2", {});
  assert.equal(sparse.email, "Not provided");
  assert.equal(sparse.phone, "Not provided");
});

test("normalizeOwnerTransportInterest and reports keep unknowns explicit", () => {
  assert.equal(normalizeOwnerTransportInterest("i1", {}).interestType, "unknown");
  const report = normalizeOwnerCommunityReport("c1", { reporterId: "g1", targetType: "reply", postId: "p1", replyId: "r1" });
  assert.equal(report.reason, "unknown");
  assert.equal(report.status, "unknown");
  assert.equal(normalizeOwnerReviewReport("v1", {}).reviewId, "");
});

test("reported-content normalizers handle missing bodies and authors", () => {
  const post = normalizeOwnerReportedPost({ title: "Hello", body: "World", status: "removed" });
  assert.equal(post.author, "Unknown author");
  assert.equal(post.status, "removed");
  const review = normalizeOwnerReportedReview({ rating: 4, comment: "Fine", reviewerId: "g1", status: "published" });
  assert.equal(review.title, "Review · 4/5");
  assert.equal(normalizeOwnerReportedReview({}).title, "Review · Unrated");
});

test("normalizeOwnerUser constrains roles and never leaks unexpected values", () => {
  assert.equal(normalizeOwnerUser("u1", { role: "owner" }).role, "unknown");
  assert.equal(normalizeOwnerUser("u2", { role: "host", email: "h@example.com" }).role, "host");
  assert.equal(normalizeOwnerUser("u3", {}).displayName, "No display name");
});

test("formatDateTime renders unknown for missing timestamps", () => {
  assert.equal(formatDateTime(0), "Unknown date");
  assert.ok(formatDateTime(1700000000000).includes("2023"));
});
