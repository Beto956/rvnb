/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} = require("firebase/firestore");

let testEnv;

const users = {
  guest: { uid: "guest-1", email: "guest@example.com" },
  host: { uid: "host-1", email: "host@example.com" },
  other: { uid: "other-1", email: "other@example.com" },
};

function dbAs(user) {
  return testEnv.authenticatedContext(user.uid, { email: user.email }).firestore();
}

function dbAsGuest() {
  return dbAs(users.guest);
}

function dbAsHost() {
  return dbAs(users.host);
}

function dbAsOther() {
  return dbAs(users.other);
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

function listing(id = "listing-1", hostId = users.host.uid) {
  return { id, hostId, title: "Test listing", createdAt: new Date() };
}

function pendingBooking(id = "booking-1") {
  return {
    id,
    listingId: "listing-1",
    guestId: users.guest.uid,
    hostId: users.host.uid,
    checkIn: "2099-01-01",
    checkOut: "2099-01-03",
    status: "pending",
    createdAt: new Date(),
  };
}

function draftRequest() {
  return {
    requesterId: users.guest.uid,
    publicVersion: 2,
    status: "draft",
    isFinalized: false,
    createdAt: new Date(),
  };
}

function transportRequest(requesterId = users.guest.uid, overrides = {}) {
  return {
    schemaVersion: 1,
    requesterId,
    status: "submitted",
    rv: {
      type: "Travel trailer",
      year: "2020",
      make: "Test",
      model: "Model",
      lengthFt: 35,
      weightLb: 8000,
      condition: "Roadworthy and ready to move",
      movementMethod: "Tow my RV",
      tires: "Yes",
      lightsBrakes: "Yes",
      slidesAwnings: "Yes",
      connectedUtilities: "No",
    },
    pickup: { city: "Dallas", state: "TX", zip: "75201", locationType: "Residence" },
    destination: { city: "Phoenix", state: "AZ", zip: "85001", locationType: "Storage facility" },
    timing: {
      pickupDate: "2099-01-10",
      flexibleDates: false,
      flexibilityNote: "",
      deliveryDate: "2099-01-12",
      priority: "Standard",
    },
    logistics: {
      tripType: "One-way",
      restrictedAccess: false,
      accessDetails: "",
      specialInstructions: "",
    },
    contact: {
      fullName: "Guest One",
      email: users.guest.email,
      phone: "555-0100",
      preferredMethod: "Email",
    },
    confirmations: { informationAccurate: true, noGuaranteeUnderstood: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function transportInterest(userId = users.guest.uid, overrides = {}) {
  return {
    userId,
    email: users.guest.email,
    interestType: "traveler",
    createdAt: new Date(),
    source: "ecosystem_page",
    page: "Transport Network",
    ...overrides,
  };
}

function transportProvider(userId = users.host.uid, overrides = {}) {
  return {
    userId,
    name: "Transporter Bob",
    email: users.host.email,
    phone: "555-0199",
    company: "Bob Hauling LLC",
    homeCity: "Dallas",
    homeState: "TX",
    providerType: "independent",
    services: ["travel_trailer", "fifth_wheel"],
    equipment: ["heavy_duty_truck", "fifth_wheel_hitch"],
    serviceArea: "Texas and Southwest corridor",
    operatingScope: "regional",
    cdlStatus: "class_a",
    insuranceStatus: "active",
    experienceYears: "5_to_10",
    notes: "Fifth wheel and travel trailer transport with 7 years commercial experience.",
    confirmations: {
      informationAccurate: true,
      earlyAccessUnderstood: true,
    },
    createdAt: new Date(),
    source: "ecosystem_page",
    page: "Transport Network",
    ...overrides,
  };
}

function insuranceInterest(userId = users.guest.uid, overrides = {}) {
  return {
    userId,
    email: users.guest.email,
    state: "TX",
    rvType: "Fifth wheel",
    usageType: "Full-time RV living",
    primaryInterest: "full_time_coverage",
    confirmations: {
      informationAccurate: true,
      earlyAccessUnderstood: true,
    },
    createdAt: new Date(),
    source: "ecosystem_page",
    page: "Insurance Hub",
    ...overrides,
  };
}

function insuranceProvider(userId = users.host.uid, overrides = {}) {
  return {
    userId,
    name: "Agent Alice",
    email: users.host.email,
    phone: "555-0188",
    agency: "Pinnacle RV Insurance Group",
    npn: "18294021",
    residentState: "TX",
    otherStates: "AZ, NM, CO, UT",
    professionalType: "individual_agent",
    experienceYears: "5_to_10",
    customerTypes: ["Full-timer liability", "Class A motorhomes", "Fifth wheels"],
    serviceArea: "Texas and Sunbelt states",
    website: "https://example.com/alice-rv",
    notes: "Specialized in full-timer packages, agreed-value total loss, and custom rig riders.",
    confirmations: {
      informationAccurate: true,
      earlyAccessUnderstood: true,
    },
    createdAt: new Date(),
    source: "ecosystem_page",
    page: "Insurance Hub",
    ...overrides,
  };
}

function communityPost(overrides = {}) {
  return {
    authorId: users.guest.uid,
    authorDisplayName: "Guest One",
    title: "Steep entrance question for a long fifth wheel",
    body: "Has anyone navigated the entrance at this campground recently with a rig over 34 feet?",
    category: "routes_road_conditions",
    region: "Texas and the Southwest",
    rigType: "Fifth wheel",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function communityReply(overrides = {}) {
  return {
    authorId: users.host.uid,
    authorDisplayName: "Host One",
    body: "I took a 36-foot rig through there last month and it was tight but doable.",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function communityReport(overrides = {}) {
  return {
    reporterId: users.guest.uid,
    targetType: "post",
    postId: "post-1",
    replyId: null,
    reason: "spam",
    details: "Looks like unsolicited advertising.",
    createdAt: new Date(),
    status: "open",
    ...overrides,
  };
}

function communityInterest(userId = users.guest.uid, overrides = {}) {
  return {
    userId,
    email: users.guest.email,
    role: "traveler",
    topics: ["destinations_campgrounds", "boondocking_dry_camping"],
    regions: "Texas and the Southwest",
    primaryReason: "share_knowledge",
    notes: "Would love regional road condition reports.",
    confirmations: {
      informationAccurate: true,
      earlyAccessUnderstood: true,
    },
    createdAt: new Date(),
    source: "ecosystem_page",
    page: "Community Hub",
    ...overrides,
  };
}

function publicRequest(requestId = "request-1", overrides = {}) {
  return {
    requestId,
    requesterId: users.guest.uid,
    publicVersion: 2,
    status: "open",
    isFinalized: true,
    createdAt: new Date(),
    finalizedAt: new Date(),
    ...overrides,
  };
}

const safePublicRequestKeys = new Set([
  "requestId", "requesterId", "publicVersion", "status", "isFinalized", "createdAt", "updatedAt",
  "finalizedAt", "requestType", "locationText", "city", "state", "startDate", "endDate",
  "flexibleDates", "employerName", "teamName", "teamLocation", "workersCount", "rigsCount",
  "spotsNeeded", "stayDurationType", "primaryRv", "moreThanOneRv", "additionalRvs",
  "hookupsNeeded", "budgetMax", "budgetPeriod", "rvDetails", "note",
]);

function isSafePublicRequest(data) {
  return data.publicVersion === 2
    && data.status === "open"
    && data.isFinalized === true
    && Object.keys(data).every((key) => safePublicRequestKeys.has(key));
}

function rangesOverlap(leftCheckIn, leftCheckOut, rightCheckIn, rightCheckOut) {
  return leftCheckIn < rightCheckOut && rightCheckIn < leftCheckOut;
}

async function approveBookingInTransaction(db, bookingId) {
  const bookingRef = doc(db, "bookings", bookingId);
  const initialBookingSnap = await getDoc(bookingRef);
  const initialBooking = initialBookingSnap.data();
  const listingId = initialBooking.listingId;
  const listingRef = doc(db, "listings", listingId);
  const ledgerRef = doc(db, "listingReservations", listingId);
  const existingApproved = await getDocs(
    query(collection(db, "bookings"), where("listingId", "==", listingId))
  );
  const seededRanges = existingApproved.docs
    .filter((entry) => ["approved", "confirmed"].includes(entry.data().status))
    .map((entry) => ({
      bookingId: entry.id,
      guestId: entry.data().guestId,
      checkIn: entry.data().checkIn,
      checkOut: entry.data().checkOut,
    }));

  await runTransaction(db, async (transaction) => {
    const currentBookingSnap = await transaction.get(bookingRef);
    const listingSnap = await transaction.get(listingRef);
    const ledgerSnap = await transaction.get(ledgerRef);
    const booking = currentBookingSnap.data();
    const listing = listingSnap.data();
    assert.equal(listing.hostId, users.host.uid);
    assert.equal(booking.listingId, listingId);
    if (!["pending", "requested"].includes(booking.status)) {
      throw new Error("Only pending booking inquiries can be approved.");
    }

    const currentRanges = ledgerSnap.exists()
      ? ledgerSnap.data().approvedRanges || []
      : seededRanges;
    const candidate = {
      bookingId,
      guestId: booking.guestId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    };
    assert.equal(
      currentRanges.some((range) =>
        range.bookingId !== bookingId &&
        rangesOverlap(candidate.checkIn, candidate.checkOut, range.checkIn, range.checkOut)
      ),
      false,
      "conflicting approvals must be rejected before writes"
    );

    transaction.update(bookingRef, {
      status: "approved",
      approvedAt: serverTimestamp(),
    });
    transaction.set(ledgerRef, {
      listingId,
      hostId: listing.hostId,
      approvedRanges: [...currentRanges, candidate],
      updatedAt: serverTimestamp(),
    }, { merge: false });
  });
}

async function declineBookingInTransaction(db, bookingId) {
  const bookingRef = doc(db, "bookings", bookingId);
  const initialBookingSnap = await getDoc(bookingRef);
  const listingRef = doc(db, "listings", initialBookingSnap.data().listingId);

  await runTransaction(db, async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    const listingSnap = await transaction.get(listingRef);
    assert.equal(listingSnap.data().hostId, users.host.uid);
    assert.equal(bookingSnap.data().status, "pending");
    transaction.update(bookingRef, { status: "declined", declinedAt: serverTimestamp() });
  });
}

async function createLinkedResponseInTransaction(db, requestId, hostId = users.host.uid) {
  const requestRef = doc(db, "spotRequestPublic", requestId);
  const responseRef = doc(db, "hostOpportunities", `${requestId}__${hostId}`);

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    const responseSnap = await transaction.get(responseRef);
    if (responseSnap.exists()) throw new Error("duplicate response");
    if (!requestSnap.exists()) throw new Error("missing request");
    const request = requestSnap.data();
    if (request.requesterId === hostId) throw new Error("self response");
    if (!isSafePublicRequest(request)) {
      throw new Error("request is not finalized and open");
    }
    transaction.set(responseRef, {
      requestId,
      hostId,
      requesterId: request.requesterId,
      status: "new",
      reviewStage: "submitted",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

async function finalizeRequestInTransaction(db, requestId, requesterId = users.guest.uid) {
  const requestRef = doc(db, "spotRequests", requestId);
  const publicRef = doc(db, "spotRequestPublic", requestId);
  const privateRef = doc(db, "spotRequestPrivate", requestId);
  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    const publicSnap = await transaction.get(publicRef);
    const privateSnap = await transaction.get(privateRef);
    if (!requestSnap.exists()) throw new Error("missing request");
    const current = requestSnap.data();
    if (current.requesterId !== requesterId) throw new Error("wrong requester");
    if (current.isFinalized === true) throw new Error("already finalized");
    if (current.status !== "draft") throw new Error("invalid status");
    if (privateSnap.exists() && privateSnap.data().requesterId !== requesterId) {
      throw new Error("private owner mismatch");
    }
    transaction.update(requestRef, {
      publicVersion: 2,
      status: "open",
      isFinalized: true,
      finalizedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const publicData = publicRequest(requestId, { createdAt: current.createdAt });
    if (publicSnap.exists()) {
      transaction.update(publicRef, publicData);
    } else {
      transaction.set(publicRef, publicData);
    }
    transaction.set(privateRef, {
      requestId,
      requesterId,
      contactName: "Guest One",
      contactEmail: users.guest.email,
      finalNotes: "Private note",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: false });
  });
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "rvnb-phase4-rules-test",
    firestore: { rules: require("node:fs").readFileSync("firestore.rules", "utf8") },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed("users/guest-1", { email: users.guest.email, role: "guest", displayName: "Guest One", createdAt: new Date() });
  await seed("users/host-1", { email: users.host.email, role: "host", displayName: "Host One", createdAt: new Date() });
  await seed("users/other-1", { email: users.other.email, role: "guest", displayName: "Other One", createdAt: new Date() });
  await seed("listings/listing-1", listing());
});

test("logged-out writes are denied", async () => {
  await assertFails(testEnv.unauthenticatedContext().firestore().collection("listings").add(listing("new-listing", users.host.uid)));
});

test("users can access only their own profile and can upgrade guest to host", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(getDoc(doc(guestDb, "users/guest-1")));
  await assertFails(getDoc(doc(guestDb, "users/other-1")));
  await assertSucceeds(updateDoc(doc(guestDb, "users/guest-1"), { role: "host" }));
  await assertFails(updateDoc(doc(guestDb, "users/guest-1"), { email: "spoof@example.com" }));
});

test("users can create their own profile but cannot spoof another profile", async () => {
  await assertSucceeds(setDoc(doc(dbAs({ uid: "new-guest", email: "new@example.com" }), "users/new-guest"), { role: "guest", email: "new@example.com", createdAt: new Date() }));
  await assertFails(setDoc(doc(dbAsGuest(), "users/not-guest"), { role: "guest", email: "new@example.com", createdAt: new Date() }));
});

function memberProfile(overrides = {}) {
  const now = new Date();
  return {
    userId: users.guest.uid,
    displayName: "Guest One",
    city: "Austin",
    state: "TX",
    bio: "RV traveler exploring the country.",
    photoURL: null,
    visibility: "public",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("member profile: owner can create and read; cross-user reads respect visibility", async () => {
  const guestDb = dbAsGuest();
  const anonDb = testEnv.unauthenticatedContext().firestore();
  const initial = memberProfile({ visibility: "public" });

  // Owner publishes a public profile.
  await assertSucceeds(setDoc(doc(guestDb, "memberProfiles", users.guest.uid), initial));
  await assertSucceeds(getDoc(doc(guestDb, "memberProfiles", users.guest.uid)));
  await assertSucceeds(getDoc(doc(anonDb, "memberProfiles", users.guest.uid)));
  await assertSucceeds(getDoc(doc(dbAsOther(), "memberProfiles", users.guest.uid)));

  // Owner makes the same profile private — visitors lose access immediately.
  await assertSucceeds(
    updateDoc(doc(guestDb, "memberProfiles", users.guest.uid), {
      ...initial,
      visibility: "private",
      updatedAt: new Date(),
    })
  );
  await assertFails(getDoc(doc(anonDb, "memberProfiles", users.guest.uid)));
  await assertFails(getDoc(doc(dbAsOther(), "memberProfiles", users.guest.uid)));
  // The owner can still read their own private profile.
  await assertSucceeds(getDoc(doc(guestDb, "memberProfiles", users.guest.uid)));
});

test("member profile: writes are owner-only and validated", async () => {
  const guestDb = dbAsGuest();

  // A non-owner can never create or edit someone else's profile.
  await assertFails(
    setDoc(doc(dbAsOther(), "memberProfiles", users.guest.uid), memberProfile({ visibility: "public" }))
  );

  await assertSucceeds(setDoc(doc(guestDb, "memberProfiles", users.guest.uid), memberProfile()));
  await assertFails(
    updateDoc(doc(dbAsOther(), "memberProfiles", users.guest.uid), { bio: "hacked" })
  );

  // The document id / userId field must always match the authenticated owner.
  await assertFails(
    setDoc(doc(guestDb, "memberProfiles", users.guest.uid), memberProfile({ userId: users.other.uid }))
  );
  await assertFails(
    updateDoc(doc(guestDb, "memberProfiles", users.guest.uid), { userId: users.other.uid })
  );

  // Unknown / privileged / self-verifying fields are rejected outright.
  await assertFails(
    setDoc(doc(guestDb, "memberProfiles", users.guest.uid), {
      ...memberProfile(),
      role: "admin",
    })
  );
  await assertFails(
    setDoc(doc(guestDb, "memberProfiles", users.guest.uid), {
      ...memberProfile(),
      verified: true,
    })
  );
  await assertFails(
    setDoc(doc(guestDb, "memberProfiles", users.guest.uid), {
      ...memberProfile(),
      ratingAverage: 5,
    })
  );

  // Publishing requires a non-empty display name.
  await assertFails(
    setDoc(doc(guestDb, "memberProfiles", users.guest.uid), memberProfile({ displayName: "" }))
  );

  // Visibility must be one of the two supported values.
  await assertFails(
    setDoc(doc(guestDb, "memberProfiles", users.guest.uid), memberProfile({ visibility: "hidden" }))
  );
});

test("member profile never exposes the private users/{uid} document to visitors", async () => {
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonDb, "users", users.guest.uid)));
  await assertFails(getDoc(doc(dbAsOther(), "users", users.guest.uid)));
});

test("member profile: a never-published profile is safely denied, not erroneously exposed", async () => {
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonDb, "memberProfiles", "never-published-uid")));
  await assertFails(getDoc(doc(dbAsOther(), "memberProfiles", "never-published-uid")));
});

function completedBooking(id = "booking-completed", overrides = {}) {
  return {
    id,
    listingId: "listing-1",
    guestId: users.guest.uid,
    hostId: users.host.uid,
    checkIn: "2020-01-01",
    checkOut: "2020-01-03",
    status: "approved",
    createdAt: new Date(),
    ...overrides,
  };
}

function travelerReview(overrides = {}) {
  return {
    bookingId: "booking-completed",
    listingId: "listing-1",
    reviewerId: users.guest.uid,
    revieweeId: users.host.uid,
    direction: "traveler_to_host",
    rating: 5,
    categoryRatings: { accuracy: 5, communication: 5, location: 4, overall: 5 },
    comment: "Great stay, would book again.",
    status: "published",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function hostReview(overrides = {}) {
  return {
    bookingId: "booking-completed",
    listingId: "listing-1",
    reviewerId: users.host.uid,
    revieweeId: users.guest.uid,
    direction: "host_to_traveler",
    rating: 5,
    categoryRatings: { communication: 5, respect: 5, cleanliness: 5, overall: 5 },
    comment: "Excellent guest, very respectful.",
    status: "published",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function reviewReport(overrides = {}) {
  return {
    reviewId: "booking-completed_guest-1",
    reporterId: users.other.uid,
    reason: "spam",
    details: "This looked like spam.",
    createdAt: serverTimestamp(),
    status: "open",
    ...overrides,
  };
}

test("reviews: eligible traveler and host can each review a completed stay exactly once", async () => {
  await seed("bookings/booking-completed", completedBooking());
  const guestDb = dbAsGuest();
  const hostDb = dbAsHost();

  await assertSucceeds(
    setDoc(doc(guestDb, "reviews", "booking-completed_" + users.guest.uid), travelerReview())
  );
  await assertSucceeds(
    setDoc(doc(hostDb, "reviews", "booking-completed_" + users.host.uid), hostReview())
  );

  // Duplicate deterministic review id is rejected (falls through to the disabled update rule).
  await assertFails(
    setDoc(doc(guestDb, "reviews", "booking-completed_" + users.guest.uid), travelerReview({ rating: 1 }))
  );
});

test("reviews: only real booking participants may review, and direction cannot be impersonated", async () => {
  await seed("bookings/booking-completed", completedBooking());
  const otherDb = dbAsOther();
  const guestDb = dbAsGuest();
  const hostDb = dbAsHost();

  // A non-participant cannot create any review tied to this booking.
  await assertFails(
    setDoc(
      doc(otherDb, "reviews", "booking-completed_" + users.other.uid),
      travelerReview({ reviewerId: users.other.uid, revieweeId: users.host.uid })
    )
  );

  // The traveler cannot claim the host_to_traveler direction, and vice versa.
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-completed_" + users.guest.uid),
      hostReview({ reviewerId: users.guest.uid, revieweeId: users.host.uid })
    )
  );
  await assertFails(
    setDoc(
      doc(hostDb, "reviews", "booking-completed_" + users.host.uid),
      travelerReview({ reviewerId: users.host.uid, revieweeId: users.guest.uid })
    )
  );

  // Reviewing yourself is never allowed.
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-completed_" + users.guest.uid),
      travelerReview({ revieweeId: users.guest.uid })
    )
  );
});

test("reviews: reviewer/reviewee/listing relationships cannot be forged", async () => {
  await seed("bookings/booking-completed", completedBooking());
  const guestDb = dbAsGuest();

  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-completed_" + users.guest.uid),
      travelerReview({ reviewerId: users.other.uid })
    )
  );
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-completed_" + users.guest.uid),
      travelerReview({ revieweeId: users.other.uid })
    )
  );
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-completed_" + users.guest.uid),
      travelerReview({ listingId: "some-other-listing" })
    )
  );
});

test("reviews: only genuinely completed, approved stays are eligible", async () => {
  const guestDb = dbAsGuest();

  await seed("bookings/booking-pending", { ...completedBooking("booking-pending"), status: "pending" });
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-pending_" + users.guest.uid),
      travelerReview({ bookingId: "booking-pending" })
    )
  );

  await seed("bookings/booking-declined", { ...completedBooking("booking-declined"), status: "declined" });
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-declined_" + users.guest.uid),
      travelerReview({ bookingId: "booking-declined" })
    )
  );

  await seed("bookings/booking-cancelled", { ...completedBooking("booking-cancelled"), status: "cancelled" });
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-cancelled_" + users.guest.uid),
      travelerReview({ bookingId: "booking-cancelled" })
    )
  );

  // Approved but the checkout date hasn't arrived yet.
  await seed(
    "bookings/booking-future",
    { ...completedBooking("booking-future"), checkIn: "2099-01-01", checkOut: "2099-01-03" }
  );
  await assertFails(
    setDoc(
      doc(guestDb, "reviews", "booking-future_" + users.guest.uid),
      travelerReview({ bookingId: "booking-future" })
    )
  );

  // Approved and checkout has passed — eligible.
  await seed("bookings/booking-past", completedBooking("booking-past"));
  await assertSucceeds(
    setDoc(
      doc(guestDb, "reviews", "booking-past_" + users.guest.uid),
      travelerReview({ bookingId: "booking-past" })
    )
  );
});

test("reviews: rating, category, and comment content is validated", async () => {
  await seed("bookings/booking-completed", completedBooking());
  const guestDb = dbAsGuest();
  const path = () => doc(guestDb, "reviews", "booking-completed_" + users.guest.uid);

  await assertFails(setDoc(path(), travelerReview({ rating: 0 })));
  await assertFails(setDoc(path(), travelerReview({ rating: 6 })));
  await assertFails(setDoc(path(), travelerReview({ rating: 4.5 })));
  await assertFails(
    setDoc(path(), travelerReview({ categoryRatings: { accuracy: 5, communication: 5, location: 0, overall: 5 } }))
  );
  await assertFails(setDoc(path(), travelerReview({ comment: "a".repeat(1001) })));
  await assertFails(setDoc(path(), { ...travelerReview(), extraField: "not allowed" }));
  await assertFails(setDoc(path(), { ...travelerReview(), createdAt: new Date("2020-01-01") }));
});

test("reviews cannot be edited or deleted after creation", async () => {
  await seed("bookings/booking-completed", completedBooking());
  await seed("reviews/booking-completed_guest-1", travelerReview({ createdAt: new Date() }));
  const guestDb = dbAsGuest();

  await assertFails(updateDoc(doc(guestDb, "reviews/booking-completed_guest-1"), { rating: 1 }));
  await assertFails(deleteDoc(doc(guestDb, "reviews/booking-completed_guest-1")));
});

test("reviews: published reviews are readable and never leak private booking data", async () => {
  await seed("bookings/booking-completed", completedBooking());
  await seed("reviews/booking-completed_guest-1", travelerReview({ createdAt: new Date() }));
  await seed("reviews/draft-review", travelerReview({ bookingId: "booking-completed", createdAt: new Date(), status: "draft" }));

  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonDb, "reviews/booking-completed_guest-1")));
  await assertFails(getDoc(doc(anonDb, "reviews/draft-review")));
  await assertFails(getDoc(doc(anonDb, "users", users.guest.uid)));
});

test("review reports: signed-in members can report once, privately, and cannot impersonate a reporter", async () => {
  await seed("bookings/booking-completed", completedBooking());
  await seed("reviews/booking-completed_guest-1", travelerReview({ createdAt: new Date() }));

  const anonDb = testEnv.unauthenticatedContext().firestore();
  const otherDb = dbAsOther();

  await assertFails(setDoc(doc(anonDb, "reviewReports/booking-completed_guest-1_anon"), reviewReport()));
  await assertSucceeds(
    setDoc(doc(otherDb, "reviewReports", "booking-completed_guest-1_" + users.other.uid), reviewReport())
  );

  // Duplicate report by the same reporter on the same review is rejected.
  await assertFails(
    setDoc(doc(otherDb, "reviewReports", "booking-completed_guest-1_" + users.other.uid), reviewReport())
  );

  // Cannot impersonate another reporter.
  await assertFails(
    setDoc(
      doc(otherDb, "reviewReports", "booking-completed_guest-1_" + users.host.uid),
      reviewReport({ reporterId: users.host.uid })
    )
  );

  // Cannot report a review that doesn't exist.
  await assertFails(
    setDoc(
      doc(otherDb, "reviewReports", "missing-review_" + users.other.uid),
      reviewReport({ reviewId: "missing-review" })
    )
  );

  // Reason must come from the allowlist, and details are length-limited.
  await assertFails(
    setDoc(
      doc(dbAsHost(), "reviewReports", "booking-completed_guest-1_" + users.host.uid),
      reviewReport({ reporterId: users.host.uid, reason: "not-a-real-reason" })
    )
  );
  await assertFails(
    setDoc(
      doc(dbAsHost(), "reviewReports", "booking-completed_guest-1_" + users.host.uid),
      reviewReport({ reporterId: users.host.uid, details: "x".repeat(501) })
    )
  );

  // Reports are never publicly or ordinarily readable, and status can't be changed by clients.
  await assertFails(getDocs(collection(otherDb, "reviewReports")));
  await assertFails(
    updateDoc(
      doc(otherDb, "reviewReports", "booking-completed_guest-1_" + users.other.uid),
      { status: "resolved" }
    )
  );
});

test("hosts can create only their own listings and cannot edit another host listing", async () => {
  await assertSucceeds(setDoc(doc(dbAsHost(), "listings/owned"), listing("owned", users.host.uid)));
  await assertFails(setDoc(doc(dbAsHost(), "listings/spoofed"), listing("spoofed", users.other.uid)));
  await assertFails(updateDoc(doc(dbAsOther(), "listings/listing-1"), { title: "changed" }));
  await assertFails(updateDoc(doc(dbAsHost(), "listings/listing-1"), { hostId: users.other.uid }));
});

test("guests can create their own pending booking but not an approved booking", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "bookings/pending"), pendingBooking("pending")));
  await assertFails(setDoc(doc(guestDb, "bookings/approved"), { ...pendingBooking("approved"), status: "approved" }));
  await assertFails(setDoc(doc(guestDb, "bookings/spoofed"), { ...pendingBooking("spoofed"), guestId: users.other.uid }));
});

test("booking reads are limited to the stored guest or host", async () => {
  await seed("bookings/booking-1", pendingBooking());
  await assertSucceeds(getDoc(doc(dbAsGuest(), "bookings/booking-1")));
  await assertSucceeds(getDoc(doc(dbAsHost(), "bookings/booking-1")));
  await assertFails(getDoc(doc(dbAsOther(), "bookings/booking-1")));
  await assertSucceeds(getDocs(query(collection(dbAsGuest(), "bookings"), where("guestId", "==", users.guest.uid))));
  await assertSucceeds(getDocs(query(collection(dbAsHost(), "bookings"), where("hostId", "==", users.host.uid))));
  await assertFails(getDocs(query(collection(dbAsGuest(), "bookings"))));
  await assertFails(getDocs(query(collection(dbAsGuest(), "bookings"), where("listingId", "==", "listing-1"))));
});

test("host dashboard bookings query (with and without the createdAt ordering) matches rules", async () => {
  await seed("bookings/booking-1", pendingBooking());

  const orderedQuery = query(
    collection(dbAsHost(), "bookings"),
    where("hostId", "==", users.host.uid),
    orderBy("createdAt", "desc")
  );
  await assertSucceeds(getDocs(orderedQuery));
  await assertFails(
    getDocs(
      query(
        collection(dbAsOther(), "bookings"),
        where("hostId", "==", users.host.uid),
        orderBy("createdAt", "desc")
      )
    )
  );

  // Index-free fallback shape used when the composite index isn't available.
  const fallbackQuery = query(collection(dbAsHost(), "bookings"), where("hostId", "==", users.host.uid));
  await assertSucceeds(getDocs(fallbackQuery));
  await assertFails(
    getDocs(query(collection(dbAsOther(), "bookings"), where("hostId", "==", users.host.uid)))
  );
});

test("full host calendar bookings query (ordered by checkIn) and its fallback match rules", async () => {
  await seed("bookings/booking-1", pendingBooking());

  const orderedQuery = query(
    collection(dbAsHost(), "bookings"),
    where("hostId", "==", users.host.uid),
    orderBy("checkIn", "asc")
  );
  await assertSucceeds(getDocs(orderedQuery));
  await assertFails(
    getDocs(
      query(
        collection(dbAsOther(), "bookings"),
        where("hostId", "==", users.host.uid),
        orderBy("checkIn", "asc")
      )
    )
  );

  // Index-free fallback shape used when the composite index isn't available.
  const fallbackQuery = query(collection(dbAsHost(), "bookings"), where("hostId", "==", users.host.uid));
  await assertSucceeds(getDocs(fallbackQuery));
  await assertFails(
    getDocs(query(collection(dbAsOther(), "bookings"), where("hostId", "==", users.host.uid)))
  );
});

test("multiple overlapping pending inquiries can be created without reserving dates", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "bookings/pending-one"), pendingBooking("pending-one")));
  await assertSucceeds(setDoc(doc(guestDb, "bookings/pending-two"), pendingBooking("pending-two")));
});

test("only the booking host can approve or decline and booking ownership is immutable", async () => {
  await seed("bookings/booking-1", pendingBooking());
  await assertFails(updateDoc(doc(dbAsOther(), "bookings/booking-1"), { status: "approved" }));
  await assertSucceeds(updateDoc(doc(dbAsHost(), "bookings/booking-1"), { status: "approved", approvedAt: new Date() }));
  await assertFails(updateDoc(doc(dbAsHost(), "bookings/booking-1"), { guestId: users.other.uid }));
  await assertFails(updateDoc(doc(dbAsHost(), "bookings/booking-1"), { listingId: "other-listing" }));
});

test("Phase 2 approval transaction creates a missing ledger and canonicalizes approval", async () => {
  await seed("bookings/booking-1", pendingBooking());
  await approveBookingInTransaction(dbAsHost(), "booking-1");

  const bookingSnap = await getDoc(doc(dbAsHost(), "bookings/booking-1"));
  const ledgerSnap = await getDoc(doc(dbAsHost(), "listingReservations/listing-1"));
  assert.equal(bookingSnap.data().status, "approved");
  assert.ok(bookingSnap.data().approvedAt);
  assert.deepEqual(ledgerSnap.data().approvedRanges, [{
    bookingId: "booking-1",
    guestId: users.guest.uid,
    checkIn: "2099-01-01",
    checkOut: "2099-01-03",
  }]);
  assert.equal(ledgerSnap.data().listingId, "listing-1");
  assert.equal(ledgerSnap.data().hostId, users.host.uid);
});

test("approval transaction remains host-only, immutable, and rejects conflicting dates", async () => {
  await seed("bookings/booking-1", pendingBooking());
  await assert.rejects(() => approveBookingInTransaction(dbAsGuest(), "booking-1"));
  await assert.rejects(() => approveBookingInTransaction(dbAsOther(), "booking-1"));
  await approveBookingInTransaction(dbAsHost(), "booking-1");
  await assert.rejects(() => approveBookingInTransaction(dbAsHost(), "booking-1"), /Only pending/);

  await seed("bookings/booking-2", { ...pendingBooking("booking-2"), checkIn: "2099-01-02", checkOut: "2099-01-04" });
  await assert.rejects(() => approveBookingInTransaction(dbAsHost(), "booking-2"), /conflicting approvals/);
  const secondBooking = await getDoc(doc(dbAsHost(), "bookings/booking-2"));
  assert.equal(secondBooking.data().status, "pending");
});

test("decline transaction is host-only and does not create a reservation", async () => {
  await seed("bookings/booking-1", pendingBooking());
  await assert.rejects(() => declineBookingInTransaction(dbAsGuest(), "booking-1"));
  await declineBookingInTransaction(dbAsHost(), "booking-1");
  const bookingSnap = await getDoc(doc(dbAsHost(), "bookings/booking-1"));
  const ledgerSnap = await getDoc(doc(dbAsHost(), "listingReservations/listing-1"));
  assert.equal(bookingSnap.data().status, "declined");
  assert.equal(ledgerSnap.exists(), false);
});

test("legacy requested approval is authorized only for the authoritative host", async () => {
  await seed("bookings/legacy-requested", { ...pendingBooking("legacy-requested"), status: "requested" });
  await assert.rejects(() => approveBookingInTransaction(dbAsGuest(), "legacy-requested"));
  await approveBookingInTransaction(dbAsHost(), "legacy-requested");
  assert.equal((await getDoc(doc(dbAsHost(), "bookings/legacy-requested"))).data().status, "approved");
});

test("only the listing host can access and update its reservation ledger", async () => {
  await seed("listingReservations/listing-1", { listingId: "listing-1", hostId: users.host.uid, approvedRanges: [] });
  await assertSucceeds(getDoc(doc(dbAsHost(), "listingReservations/listing-1")));
  await assertFails(getDoc(doc(dbAsGuest(), "listingReservations/listing-1")));
  await assertSucceeds(updateDoc(doc(dbAsHost(), "listingReservations/listing-1"), { approvedRanges: [] }));
  await assertFails(updateDoc(doc(dbAsOther(), "listingReservations/listing-1"), { approvedRanges: [] }));
});

test("only the listing host can manage dayMeta", async () => {
  const path = "dayMeta/listing-1__2099-01-01";
  const data = { listingId: "listing-1", hostId: users.host.uid, date: "2099-01-01", blocked: true };
  await assertSucceeds(setDoc(doc(dbAsHost(), path), data));
  await assertSucceeds(getDoc(doc(dbAsHost(), path)));
  await assertFails(getDoc(doc(dbAsGuest(), path)));
  await assertFails(setDoc(doc(dbAsOther(), path), data));
  await assertFails(setDoc(doc(dbAsHost(), "dayMeta/listing-1__2099-01-02"), { ...data, hostId: users.other.uid, date: "2099-01-02" }));
});

test("calendar dayMeta query uses the exact production constraints", async () => {
  const hostDb = dbAsHost();
  await seed("dayMeta/listing-1__2099-01-01", { listingId: "listing-1", hostId: users.host.uid, date: "2099-01-01", blocked: true });
  await seed("dayMeta/listing-1__2099-01-31", { listingId: "listing-1", hostId: users.host.uid, date: "2099-01-31", blocked: false });
  await seed("dayMeta/listing-1__2100-01-01", { listingId: "listing-1", hostId: users.host.uid, date: "2100-01-01", blocked: true });
  await seed("dayMeta/other-listing__2099-01-01", { listingId: "other-listing", hostId: users.other.uid, date: "2099-01-01", blocked: true });

  const exactQuery = query(
    collection(hostDb, "dayMeta"),
    where("listingId", "==", "listing-1"),
    where("hostId", "==", users.host.uid),
    where("date", ">=", "2099-01-01"),
    where("date", "<=", "2099-01-31"),
    orderBy("date", "asc")
  );
  const exactSnap = await assertSucceeds(getDocs(exactQuery));
  assert.deepEqual(exactSnap.docs.map((entry) => entry.data().date), ["2099-01-01", "2099-01-31"]);
  await assertFails(getDocs(query(collection(dbAsOther(), "dayMeta"), where("listingId", "==", "listing-1"), where("hostId", "==", users.other.uid), where("date", ">=", "2099-01-01"), where("date", "<=", "2099-01-31"), orderBy("date", "asc"))));
  await assertFails(getDocs(query(collection(hostDb, "dayMeta"), where("listingId", "==", "listing-1"), where("date", ">=", "2099-01-01"), where("date", "<=", "2099-01-31"), orderBy("date", "asc"))));
  await assertFails(setDoc(doc(hostDb, "dayMeta/listing-1__2099-02-01"), { listingId: "listing-1", date: "2099-02-01", blocked: true }));
  await assertFails(updateDoc(doc(hostDb, "dayMeta/listing-1__2099-01-01"), { hostId: users.other.uid }));
  await assertFails(updateDoc(doc(hostDb, "dayMeta/listing-1__2099-01-01"), { listingId: "other-listing" }));
});

test("host dashboard dayMeta query (no orderBy) and its index-free fallback match rules", async () => {
  const hostDb = dbAsHost();
  await seed("dayMeta/listing-1__2099-01-01", { listingId: "listing-1", hostId: users.host.uid, date: "2099-01-01", blocked: true });

  // Dashboard preview shape: equality + date range, no orderBy.
  const previewQuery = query(
    collection(hostDb, "dayMeta"),
    where("listingId", "==", "listing-1"),
    where("hostId", "==", users.host.uid),
    where("date", ">=", "2099-01-01"),
    where("date", "<=", "2099-01-31")
  );
  await assertSucceeds(getDocs(previewQuery));
  await assertFails(
    getDocs(
      query(
        collection(dbAsOther(), "dayMeta"),
        where("listingId", "==", "listing-1"),
        where("hostId", "==", users.host.uid),
        where("date", ">=", "2099-01-01"),
        where("date", "<=", "2099-01-31")
      )
    )
  );

  // Index-free fallback shape used when the composite index isn't available.
  const fallbackQuery = query(
    collection(hostDb, "dayMeta"),
    where("listingId", "==", "listing-1"),
    where("hostId", "==", users.host.uid)
  );
  await assertSucceeds(getDocs(fallbackQuery));
  await assertFails(
    getDocs(
      query(
        collection(dbAsOther(), "dayMeta"),
        where("listingId", "==", "listing-1"),
        where("hostId", "==", users.host.uid)
      )
    )
  );
});

test("bulk dayMeta batch writes (range block/unblock) respect per-document ownership", async () => {
  const dates = ["2099-03-01", "2099-03-02", "2099-03-03"];
  const hostDb = dbAsHost();

  const ownerBatch = writeBatch(hostDb);
  dates.forEach((date) => {
    ownerBatch.set(
      doc(hostDb, "dayMeta", `listing-1__${date}`),
      { listingId: "listing-1", hostId: users.host.uid, date, blocked: true, blockReason: "", signal: "none", note: "" },
      { merge: true }
    );
  });
  await assertSucceeds(ownerBatch.commit());

  for (const date of dates) {
    const snap = await getDoc(doc(hostDb, "dayMeta", `listing-1__${date}`));
    assert.equal(snap.data().blocked, true);
  }

  const otherDb = dbAsOther();
  const crossHostBatch = writeBatch(otherDb);
  dates.forEach((date) => {
    crossHostBatch.set(
      doc(otherDb, "dayMeta", `listing-1__${date}`),
      { listingId: "listing-1", hostId: users.host.uid, date, blocked: false, blockReason: "", signal: "none", note: "" },
      { merge: true }
    );
  });
  await assertFails(crossHostBatch.commit());

  // Cross-host batch failure must be all-or-nothing: none of the owner's blocked dates change.
  for (const date of dates) {
    const snap = await getDoc(doc(hostDb, "dayMeta", `listing-1__${date}`));
    assert.equal(snap.data().blocked, true);
  }
});

test("requesters can create, read, and finalize their own request; drafts stay private", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "spotRequests/request-1"), draftRequest()));
  await assertSucceeds(getDoc(doc(guestDb, "spotRequests/request-1")));
  await assertFails(getDoc(doc(dbAsOther(), "spotRequests/request-1")));
  await assertFails(getDocs(query(collection(dbAsHost(), "spotRequests"))));
  await assertFails(updateDoc(doc(dbAsOther(), "spotRequests/request-1"), { status: "open", isFinalized: true }));
  await assertSucceeds(updateDoc(doc(guestDb, "spotRequests/request-1"), { status: "open", isFinalized: true }));
});

test("request finalization transaction owns public and private writes", async () => {
  await seed("spotRequests/request-1", draftRequest());
  await assert.rejects(() => finalizeRequestInTransaction(dbAsOther(), "request-1"));
  await finalizeRequestInTransaction(dbAsGuest(), "request-1");
  const requestSnap = await getDoc(doc(dbAsGuest(), "spotRequests/request-1"));
  const privateSnap = await getDoc(doc(dbAsGuest(), "spotRequestPrivate/request-1"));
  const publicSnap = await getDoc(doc(dbAsHost(), "spotRequestPublic/request-1"));
  assert.equal(requestSnap.data().status, "open");
  assert.equal(requestSnap.data().isFinalized, true);
  assert.equal(requestSnap.data().contactEmail, undefined);
  assert.equal(privateSnap.data().requesterId, users.guest.uid);
  assert.equal(publicSnap.data().requestId, "request-1");
  assert.equal(publicSnap.data().requesterId, users.guest.uid);
  assert.equal(publicSnap.data().status, "open");
  assert.equal(publicSnap.data().isFinalized, true);
  assert.equal(publicSnap.data().contactEmail, undefined);
  await assert.rejects(() => finalizeRequestInTransaction(dbAsGuest(), "request-1"), /already finalized/);
  await assertFails(updateDoc(doc(dbAsGuest(), "spotRequests/request-1"), { contactEmail: "private@example.com" }));
  await assertFails(updateDoc(doc(dbAsGuest(), "spotRequests/request-1"), { requesterId: users.other.uid }));
});

test("hosts can query safe public projections, while source requests stay private", async () => {
  await seed("spotRequestPublic/open", publicRequest("open"));
  await seed("spotRequestPublic/closed-finalized", publicRequest("closed-finalized", { status: "closed" }));
  await seed("spotRequestPublic/draft", publicRequest("draft", { status: "draft", isFinalized: false }));
  await seed("spotRequests/source", { ...draftRequest(), status: "open", isFinalized: true });
  const openQuery = query(collection(dbAsHost(), "spotRequestPublic"), where("publicVersion", "==", 2), where("status", "==", "open"), where("isFinalized", "==", true));
  await assertSucceeds(getDocs(openQuery));
  await assertFails(getDocs(query(collection(dbAsOther(), "spotRequestPublic"), where("publicVersion", "==", 2), where("status", "==", "open"), where("isFinalized", "==", true))));
  await assertFails(getDoc(doc(dbAsHost(), "spotRequestPublic/closed-finalized")));
  await assertFails(getDoc(doc(dbAsHost(), "spotRequests/source")));
  await assertFails(getDocs(query(collection(dbAsHost(), "spotRequests"))));
});

test("public projections are owner-created, deterministic, immutable, and schema-safe", async () => {
  await seed("spotRequests/request-1", { ...draftRequest(), status: "open", isFinalized: true });
  await assertSucceeds(setDoc(doc(dbAsGuest(), "spotRequestPublic/request-1"), publicRequest()));
  await assertFails(setDoc(doc(dbAsGuest(), "spotRequestPublic/request-1"), { ...publicRequest(), contactEmail: "private@example.com" }));
  await assertFails(setDoc(doc(dbAsGuest(), "spotRequestPublic/closed"), publicRequest("closed", { status: "closed" })));
  await assertFails(setDoc(doc(dbAsGuest(), "spotRequestPublic/draft"), publicRequest("draft", { status: "draft", isFinalized: false })));
  await assertFails(setDoc(doc(dbAsGuest(), "spotRequestPublic/spoofed"), publicRequest("spoofed", { requesterId: users.other.uid })));
  await assertFails(setDoc(doc(dbAsOther(), "spotRequestPublic/other"), publicRequest("other")));
  await assertFails(updateDoc(doc(dbAsGuest(), "spotRequestPublic/request-1"), { requestId: "other" }));
  await assertFails(updateDoc(doc(dbAsGuest(), "spotRequestPublic/request-1"), { requesterId: users.other.uid }));
});

test("private request details are requester-only", async () => {
  await seed("spotRequests/request-1", { ...draftRequest(), status: "open", isFinalized: true });
  const privateData = {
    requestId: "request-1",
    requesterId: users.guest.uid,
    contactName: "Guest One",
    contactEmail: users.guest.email,
    finalNotes: "Private note",
  };
  await assertSucceeds(setDoc(doc(dbAsGuest(), "spotRequestPrivate/request-1"), privateData));
  await assertSucceeds(getDoc(doc(dbAsGuest(), "spotRequestPrivate/request-1")));
  await assertSucceeds(updateDoc(doc(dbAsGuest(), "spotRequestPrivate/request-1"), { finalNotes: "Updated" }));
  await assertFails(getDoc(doc(dbAsHost(), "spotRequestPrivate/request-1")));
  await assertFails(getDoc(doc(dbAsOther(), "spotRequestPrivate/request-1")));
  await assertFails(updateDoc(doc(dbAsGuest(), "spotRequestPrivate/request-1"), { requesterId: users.other.uid }));
});

test("linked opportunity creation is host-owned and deterministic duplicates are denied", async () => {
  await seed("spotRequestPublic/request-1", publicRequest());
  const path = "hostOpportunities/request-1__host-1";
  const data = { requestId: "request-1", hostId: users.host.uid, requesterId: users.guest.uid, email: "private@example.com" };
  await assertSucceeds(setDoc(doc(dbAsHost(), path), data));
  await assertFails(setDoc(doc(dbAsHost(), path), data));
  await assertSucceeds(getDoc(doc(dbAsHost(), path)));
  await assertSucceeds(getDoc(doc(dbAsGuest(), path)));
  await assertFails(getDoc(doc(dbAsOther(), path)));
  await assertSucceeds(getDocs(query(collection(dbAsHost(), "hostOpportunities"), where("hostId", "==", users.host.uid))));
  await assertFails(getDocs(query(collection(dbAsOther(), "hostOpportunities"), where("hostId", "==", users.host.uid))));
});

test("linked response transaction validates finalized requests and deterministic ownership", async () => {
  await seed("spotRequestPublic/request-1", publicRequest());
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsOther(), "request-1"));
  await createLinkedResponseInTransaction(dbAsHost(), "request-1");
  const responseSnap = await getDoc(doc(dbAsHost(), "hostOpportunities/request-1__host-1"));
  assert.equal(responseSnap.data().requestId, "request-1");
  assert.equal(responseSnap.data().hostId, users.host.uid);
  assert.equal(responseSnap.data().requesterId, users.guest.uid);
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsHost(), "request-1"), /duplicate response/);

  await seed("spotRequestPublic/closed", publicRequest("closed", { status: "closed" }));
  await seed("spotRequestPublic/unsafe", { ...publicRequest("unsafe"), publicVersion: 1 });
  await seed("spotRequestPublic/malformed-v2", { ...publicRequest("malformed-v2"), contactEmail: "private@example.com" });
  await seed("spotRequestPublic/draft", publicRequest("draft", { status: "draft", isFinalized: false }));
  await seed("spotRequestPublic/self", publicRequest("self", { requesterId: users.host.uid }));
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsHost(), "closed"));
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsHost(), "unsafe"));
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsHost(), "malformed-v2"));
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsHost(), "draft"));
  await assert.rejects(() => createLinkedResponseInTransaction(dbAsHost(), "self"), /self response/);
});

test("anonymous generic opportunities preserve the current creation behavior", async () => {
  const anonymous = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(anonymous, "hostOpportunities/generic"), { submissionType: "host_opportunity", cityLocation: "Somewhere" }));
  await assertFails(getDoc(doc(dbAsOther(), "hostOpportunities/generic")));
});

test("anonymous linked opportunity creation is denied", async () => {
  await seed("spotRequestPublic/request-1", publicRequest());
  await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), "hostOpportunities/request-1__host-1"), {
    requestId: "request-1",
    hostId: users.host.uid,
    requesterId: users.guest.uid,
  }));
});

test("transport request creation requires authentication", async () => {
  await assertFails(setDoc(
    doc(testEnv.unauthenticatedContext().firestore(), "transportRequests/anonymous"),
    transportRequest()
  ));
});

test("transport request owner can create and read a valid private request", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "transportRequests/owned"), transportRequest()));
  await assertSucceeds(getDoc(doc(guestDb, "transportRequests/owned")));
  await assertFails(getDoc(doc(dbAsOther(), "transportRequests/owned")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "transportRequests/owned")));
});

test("transport request ownership and initial status cannot be spoofed", async () => {
  const guestDb = dbAsGuest();
  await assertFails(setDoc(doc(guestDb, "transportRequests/spoofed"), transportRequest(users.other.uid)));
  await assertFails(setDoc(doc(guestDb, "transportRequests/invalid-status"), transportRequest(users.guest.uid, { status: "open" })));
  await assertFails(setDoc(doc(guestDb, "transportRequests/extra-field"), transportRequest(users.guest.uid, { privateNote: "not allowed" })));
});

test("transport request malformed updates are denied", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "transportRequests/immutable"), transportRequest()));
  await assertFails(updateDoc(doc(guestDb, "transportRequests/immutable"), { status: "closed" }));
  await assertFails(updateDoc(doc(guestDb, "transportRequests/immutable"), { requesterId: users.other.uid }));
  await assertFails(updateDoc(doc(dbAsOther(), "transportRequests/immutable"), { status: "submitted" }));
});

test("transport interest creation requires authentication", async () => {
  await assertFails(setDoc(
    doc(testEnv.unauthenticatedContext().firestore(), "transportInterest/anonymous"),
    transportInterest()
  ));
});

test("transport interest owner can create and read a valid private record", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "transportInterest/owned"), transportInterest()));
  await assertSucceeds(getDoc(doc(guestDb, "transportInterest/owned")));
  await assertFails(getDoc(doc(dbAsOther(), "transportInterest/owned")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "transportInterest/owned")));
  await assertFails(getDocs(collection(guestDb, "transportInterest")));
});

test("transport interest ownership and schema validation are enforced", async () => {
  const guestDb = dbAsGuest();
  await assertFails(setDoc(doc(guestDb, "transportInterest/spoofed"), transportInterest(users.other.uid)));
  await assertFails(setDoc(doc(guestDb, "transportInterest/invalid-type"), transportInterest(users.guest.uid, { interestType: "hacker" })));
  await assertFails(setDoc(doc(guestDb, "transportInterest/extra-field"), transportInterest(users.guest.uid, { extra: "malicious" })));
  await assertSucceeds(setDoc(doc(guestDb, "transportInterest/immutable"), transportInterest()));
  await assertFails(updateDoc(doc(guestDb, "transportInterest/immutable"), { interestType: "host" }));
  await assertFails(deleteDoc(doc(guestDb, "transportInterest/immutable")));
});

test("transport provider creation requires authentication", async () => {
  await assertFails(setDoc(
    doc(testEnv.unauthenticatedContext().firestore(), "transportProviders/anonymous"),
    transportProvider()
  ));
});

test("transport provider owner can create and read a valid private record", async () => {
  const hostDb = dbAsHost();
  await assertSucceeds(setDoc(doc(hostDb, "transportProviders/owned"), transportProvider()));
  await assertSucceeds(getDoc(doc(hostDb, "transportProviders/owned")));
  await assertFails(getDoc(doc(dbAsOther(), "transportProviders/owned")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "transportProviders/owned")));
  await assertFails(getDocs(collection(hostDb, "transportProviders")));
});

test("transport provider ownership and schema validation are enforced", async () => {
  const hostDb = dbAsHost();
  await assertFails(setDoc(doc(hostDb, "transportProviders/spoofed"), transportProvider(users.other.uid)));
  await assertFails(setDoc(doc(hostDb, "transportProviders/empty-name"), transportProvider(users.host.uid, { name: "" })));
  await assertFails(setDoc(doc(hostDb, "transportProviders/extra-field"), transportProvider(users.host.uid, { trackingId: 123 })));
  await assertSucceeds(setDoc(doc(hostDb, "transportProviders/immutable"), transportProvider()));
  await assertFails(updateDoc(doc(hostDb, "transportProviders/immutable"), { name: "New Name" }));
  await assertFails(deleteDoc(doc(hostDb, "transportProviders/immutable")));
});

test("insurance interest creation requires authentication", async () => {
  await assertFails(setDoc(
    doc(testEnv.unauthenticatedContext().firestore(), "insuranceInterest/anonymous"),
    insuranceInterest()
  ));
});

test("insurance interest owner can create and read a valid private record", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "insuranceInterest/owned"), insuranceInterest()));
  await assertSucceeds(getDoc(doc(guestDb, "insuranceInterest/owned")));
  await assertFails(getDoc(doc(dbAsOther(), "insuranceInterest/owned")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "insuranceInterest/owned")));
  await assertFails(getDocs(collection(guestDb, "insuranceInterest")));
});

test("insurance interest ownership and schema validation are enforced", async () => {
  const guestDb = dbAsGuest();
  await assertFails(setDoc(doc(guestDb, "insuranceInterest/spoofed"), insuranceInterest(users.other.uid)));
  await assertFails(setDoc(doc(guestDb, "insuranceInterest/invalid-interest"), insuranceInterest(users.guest.uid, { primaryInterest: "invalid" })));
  await assertFails(setDoc(doc(guestDb, "insuranceInterest/extra-field"), insuranceInterest(users.guest.uid, { quoteAmount: 1000 })));
  await assertSucceeds(setDoc(doc(guestDb, "insuranceInterest/immutable"), insuranceInterest()));
  await assertFails(updateDoc(doc(guestDb, "insuranceInterest/immutable"), { state: "CA" }));
  await assertFails(deleteDoc(doc(guestDb, "insuranceInterest/immutable")));
});

test("insurance provider creation requires authentication", async () => {
  await assertFails(setDoc(
    doc(testEnv.unauthenticatedContext().firestore(), "insuranceProviders/anonymous"),
    insuranceProvider()
  ));
});

test("insurance provider owner can create and read a valid private record", async () => {
  const hostDb = dbAsHost();
  await assertSucceeds(setDoc(doc(hostDb, "insuranceProviders/owned"), insuranceProvider()));
  await assertSucceeds(getDoc(doc(hostDb, "insuranceProviders/owned")));
  await assertFails(getDoc(doc(dbAsOther(), "insuranceProviders/owned")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "insuranceProviders/owned")));
  await assertFails(getDocs(collection(hostDb, "insuranceProviders")));
});

test("insurance provider ownership and schema validation are enforced", async () => {
  const hostDb = dbAsHost();
  await assertFails(setDoc(doc(hostDb, "insuranceProviders/spoofed"), insuranceProvider(users.other.uid)));
  await assertFails(setDoc(doc(hostDb, "insuranceProviders/empty-name"), insuranceProvider(users.host.uid, { name: "" })));
  await assertFails(setDoc(doc(hostDb, "insuranceProviders/extra-field"), insuranceProvider(users.host.uid, { rating: 5 })));
  await assertSucceeds(setDoc(doc(hostDb, "insuranceProviders/immutable"), insuranceProvider()));
  await assertFails(updateDoc(doc(hostDb, "insuranceProviders/immutable"), { name: "New Name" }));
  await assertFails(deleteDoc(doc(hostDb, "insuranceProviders/immutable")));
});

test("community interest creation requires authentication", async () => {
  await assertFails(setDoc(
    doc(testEnv.unauthenticatedContext().firestore(), "communityInterest/anonymous"),
    communityInterest()
  ));
});

test("community interest owner can create and read a valid private record", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "communityInterest/owned"), communityInterest()));
  await assertSucceeds(getDoc(doc(guestDb, "communityInterest/owned")));
  await assertFails(getDoc(doc(dbAsOther(), "communityInterest/owned")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "communityInterest/owned")));
  await assertFails(getDocs(collection(guestDb, "communityInterest")));
});

test("community interest ownership and schema validation are enforced", async () => {
  const guestDb = dbAsGuest();
  await assertFails(setDoc(doc(guestDb, "communityInterest/spoofed"), communityInterest(users.other.uid)));
  await assertFails(setDoc(doc(guestDb, "communityInterest/invalid-role"), communityInterest(users.guest.uid, { role: "admin" })));
  await assertFails(setDoc(doc(guestDb, "communityInterest/invalid-reason"), communityInterest(users.guest.uid, { primaryReason: "invalid" })));
  await assertFails(setDoc(doc(guestDb, "communityInterest/extra-field"), communityInterest(users.guest.uid, { badge: "verified" })));
  await assertSucceeds(setDoc(doc(guestDb, "communityInterest/immutable"), communityInterest()));
  await assertFails(updateDoc(doc(guestDb, "communityInterest/immutable"), { role: "host" }));
  await assertFails(deleteDoc(doc(guestDb, "communityInterest/immutable")));
});

test("signed-out users can read active community posts but not create them", async () => {
  await seed("communityPosts/post-1", communityPost());
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonDb, "communityPosts/post-1")));
  await assertSucceeds(getDocs(query(collection(anonDb, "communityPosts"), where("status", "==", "active"))));
  await assertFails(setDoc(doc(anonDb, "communityPosts/anonymous"), communityPost()));
});

test("authenticated member can create a valid community post", async () => {
  const guestDb = dbAsGuest();
  await assertSucceeds(setDoc(doc(guestDb, "communityPosts/post-1"), communityPost()));
  await assertSucceeds(getDoc(doc(guestDb, "communityPosts/post-1")));
});

test("community post creation enforces ownership, schema, and category enum", async () => {
  const guestDb = dbAsGuest();
  await assertFails(setDoc(doc(guestDb, "communityPosts/spoofed"), communityPost({ authorId: users.other.uid })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/spoofed-name"), communityPost({ authorDisplayName: "Someone Else" })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/bad-category"), communityPost({ category: "politics" })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/extra-field"), communityPost({ pinned: true })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/short-title"), communityPost({ title: "Hi" })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/short-body"), communityPost({ body: "Too short" })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/oversized-body"), communityPost({ body: "x".repeat(4001) })));
  await assertFails(setDoc(doc(guestDb, "communityPosts/wrong-status"), communityPost({ status: "removed" })));
});

test("only the post owner may edit or soft-delete their community post", async () => {
  await seed("communityPosts/post-1", communityPost());
  const guestDb = dbAsGuest();
  const otherDb = dbAsOther();

  await assertFails(updateDoc(doc(otherDb, "communityPosts/post-1"), { title: "Hijacked title here" }));
  await assertFails(updateDoc(doc(guestDb, "communityPosts/post-1"), { authorId: users.other.uid }));
  await assertFails(updateDoc(doc(guestDb, "communityPosts/post-1"), { createdAt: new Date() }));
  await assertSucceeds(updateDoc(doc(guestDb, "communityPosts/post-1"), {
    title: "Updated: steep entrance question for a long fifth wheel",
    updatedAt: new Date(),
  }));
  await assertSucceeds(updateDoc(doc(guestDb, "communityPosts/post-1"), {
    status: "removed",
    updatedAt: new Date(),
  }));
  await assertFails(updateDoc(doc(guestDb, "communityPosts/post-1"), { status: "active", updatedAt: new Date() }));
  await assertFails(deleteDoc(doc(guestDb, "communityPosts/post-1")));
});

test("signed-out and mismatched-status reads of community replies are restricted", async () => {
  await seed("communityPosts/post-1", communityPost());
  await seed("communityPosts/post-1/replies/reply-1", communityReply());
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonDb, "communityPosts/post-1/replies/reply-1")));
  await assertFails(setDoc(doc(anonDb, "communityPosts/post-1/replies/anonymous"), communityReply()));
});

test("authenticated member can create a valid reply on an active post", async () => {
  await seed("communityPosts/post-1", communityPost());
  const hostDb = dbAsHost();
  await assertSucceeds(setDoc(doc(hostDb, "communityPosts/post-1/replies/reply-1"), communityReply()));
});

test("community reply creation enforces ownership and schema", async () => {
  await seed("communityPosts/post-1", communityPost());
  const hostDb = dbAsHost();
  await assertFails(setDoc(doc(hostDb, "communityPosts/post-1/replies/spoofed"), communityReply({ authorId: users.other.uid })));
  await assertFails(setDoc(doc(hostDb, "communityPosts/post-1/replies/spoofed-name"), communityReply({ authorDisplayName: "Fake Name" })));
  await assertFails(setDoc(doc(hostDb, "communityPosts/post-1/replies/extra-field"), communityReply({ upvotes: 5 })));
  await assertFails(setDoc(doc(hostDb, "communityPosts/post-1/replies/oversized"), communityReply({ body: "x".repeat(2001) })));
});

test("replies cannot be created on a removed community post", async () => {
  await seed("communityPosts/post-1", communityPost({ status: "removed" }));
  const hostDb = dbAsHost();
  await assertFails(setDoc(doc(hostDb, "communityPosts/post-1/replies/reply-1"), communityReply()));
});

test("only the reply owner may edit or soft-delete their reply", async () => {
  await seed("communityPosts/post-1", communityPost());
  await seed("communityPosts/post-1/replies/reply-1", communityReply());
  const hostDb = dbAsHost();
  const otherDb = dbAsOther();

  await assertFails(updateDoc(doc(otherDb, "communityPosts/post-1/replies/reply-1"), { body: "Hijacked reply text" }));
  await assertFails(updateDoc(doc(hostDb, "communityPosts/post-1/replies/reply-1"), { authorId: users.other.uid }));
  await assertSucceeds(updateDoc(doc(hostDb, "communityPosts/post-1/replies/reply-1"), {
    body: "Updated reply with more detail about the turn radius.",
    updatedAt: new Date(),
  }));
  await assertSucceeds(updateDoc(doc(hostDb, "communityPosts/post-1/replies/reply-1"), {
    status: "removed",
    updatedAt: new Date(),
  }));
  await assertFails(deleteDoc(doc(hostDb, "communityPosts/post-1/replies/reply-1")));
});

test("authenticated members can create a community report but cannot read or list reports publicly", async () => {
  await seed("communityPosts/post-1", communityPost());
  const guestDb = dbAsGuest();
  const anonDb = testEnv.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(anonDb, "communityReports/anonymous"), communityReport()));
  await assertSucceeds(setDoc(doc(guestDb, "communityReports/report-1"), communityReport()));
  await assertSucceeds(getDoc(doc(guestDb, "communityReports/report-1")));
  await assertFails(getDoc(doc(dbAsOther(), "communityReports/report-1")));
  await assertFails(getDocs(collection(guestDb, "communityReports")));
});

test("community report creation enforces reporter identity, reason enum, and immutability", async () => {
  const guestDb = dbAsGuest();
  await assertFails(setDoc(doc(guestDb, "communityReports/spoofed"), communityReport({ reporterId: users.other.uid })));
  await assertFails(setDoc(doc(guestDb, "communityReports/bad-reason"), communityReport({ reason: "because" })));
  await assertFails(setDoc(doc(guestDb, "communityReports/wrong-status"), communityReport({ status: "resolved" })));
  await assertFails(setDoc(doc(guestDb, "communityReports/extra-field"), communityReport({ outcome: "confirmed" })));
  await assertSucceeds(setDoc(doc(guestDb, "communityReports/report-1"), communityReport()));
  await assertFails(updateDoc(doc(guestDb, "communityReports/report-1"), { status: "resolved" }));
  await assertFails(deleteDoc(doc(guestDb, "communityReports/report-1")));
});

