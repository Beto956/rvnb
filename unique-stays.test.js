/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const React = require("react"), jsx = require("react/jsx-runtime");

function load(file, dependencies={},globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(file,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText,{exports,console,...globals,require:name=>{
    if(!(name in dependencies))throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }},{filename:file});
  return exports;
}
const types=load("src/lib/listing-types.ts");
const amenities=load("src/lib/stay-amenities.ts",{"./listing-types":types});
const photos=load("src/lib/listing-photos.ts",{}, {URL});
const location=load("src/lib/listing-location.ts");
const discovery=load("src/lib/unique-stays.ts",{
  "./listing-types":types,"./stay-amenities":amenities,"./listing-photos":photos,"./listing-location":location,
});
const plain=value=>JSON.parse(JSON.stringify(value));
const accommodation=(overrides={})=>({...plain(types.EMPTY_ACCOMMODATION),maxGuests:4,beds:{single:0,double:0,queen:1,king:0,bunk:1,sofa:0},
  rvType:"Travel trailer",rvLengthFt:28,...overrides});
const listing=(type="cabin",overrides={})=>({
  listingType:type,hostId:"host",title:"Local demo accommodation",city:"Austin",state:"TX",
  description:"Local fixture description, not live inventory.",price:90,pricingType:"Night",
  accommodation:accommodation(),stayAmenities:{wifi:"shared",bathroom:"private",fullKitchen:"private"},...overrides,
});
test("canonical types never convert legacy or unknown inventory into accommodation",()=>{
  assert.equal(types.listingType(undefined),null);assert.equal(types.listingType("RV_PROVIDED"),null);
  for(const type of ["host_rv","mobile_home","cabin"])assert.equal(types.isAccommodation(type),true);
  for(const type of ["rv_space","land_space",null,"legacy","RV_PROVIDED"])assert.equal(types.isAccommodation(type),false);
  assert.equal(discovery.normalizeUniqueStay("old",{title:"RV space",maxLengthFt:35}),null);
  assert.equal(discovery.normalizeUniqueStay("space",listing("rv_space")),null);
});
test("studio accommodations, guest boundaries, bathrooms, beds and time windows validate",()=>{
  for(const type of ["host_rv","mobile_home","cabin"])assert.equal(types.validateAccommodation(accommodation(),type),null);
  for(const value of [0,31,1.5,NaN,Infinity])assert.ok(types.validateAccommodation(accommodation({maxGuests:value}),"cabin"));
  assert.equal(types.validateAccommodation(accommodation({maxGuests:1,bedrooms:0,bathrooms:.5}),"host_rv"),null);
  assert.equal(types.validateAccommodation(accommodation({maxGuests:30}),"cabin"),null);
  for(const patch of [{bedrooms:-1},{sleepingAreas:0},{bathrooms:.3},{beds:{single:0,double:0,queen:0,king:0,bunk:0,sofa:0}},
    {checkInFrom:"25:00"},{checkInFrom:"17:00",checkInTo:"14:00"},{rvLengthFt:0},{rvType:""}]) {
    assert.ok(types.validateAccommodation(accommodation(patch),"host_rv"),JSON.stringify(patch));
  }
});
test("amenity normalization separates private/shared, explicit absence and unknown; no unrelated utility inference",()=>{
  const normalized=amenities.normalizeStayAmenities({hookups:"Full",water:"Yes",sewer:"Yes",wifi:true,bathrooms:true,showers:false,
    stayAmenities:{wifi:"shared",bathroom:"private",smokeAlarm:"verified",oven:"not_applicable"}});
  assert.equal(normalized.wifi,"shared");assert.equal(normalized.bathroom,"private");
  assert.equal(normalized.shower,"unavailable");assert.equal(normalized.heating,"unknown");
  assert.equal(normalized.smokeAlarm,"unknown");assert.equal(normalized.oven,"not_applicable");
  assert.equal(normalized.connectedPower,"unknown");assert.equal(normalized.potableWater,"unknown");
  assert.equal(normalized.sewerConnection,"unknown");
  assert.equal(amenities.amenityAvailable("unknown"),false);
  assert.equal(amenities.amenityAvailable("private"),true);
  assert.deepEqual(plain(amenities.amenityProjections({wifi:"shared",bathroom:"unavailable",picnicTable:"unknown"})),{wifi:true,bathrooms:false});
});
test("declared capacity, URL filters, shared/private options and missing prices are accurate",()=>{
  const stay=discovery.normalizeUniqueStay("one",listing("cabin"));
  const url=new URLSearchParams("q=Austin&type=cabin&guests=4&amenity=wifi");
  const filter=discovery.readStayFilters(url);
  assert.equal(discovery.matchesUniqueStay(stay,filter),true);
  assert.equal(discovery.matchesUniqueStay(stay,{...filter,privateOnly:true}),false);
  assert.equal(discovery.matchesUniqueStay(stay,{...filter,guests:5}),false);
  assert.equal(discovery.matchesUniqueStay(discovery.normalizeUniqueStay("unknown",listing("cabin",{accommodation:{}})),filter),false);
  assert.equal(discovery.matchesUniqueStay(stay,{...filter,amenities:["heating"]}),false);
  assert.equal(discovery.matchesUniqueStay(discovery.normalizeUniqueStay("bad",listing("cabin",{stayAmenities:{wifi:"not_applicable"}})),filter),false);
  assert.equal(discovery.matchesUniqueStay(stay,{...filter,type:"host_rv"}),false);
  const dormantUtilities=discovery.normalizeUniqueStay("changed",listing("cabin",{stayAmenities:{connectedPower:"available"}}));
  assert.equal(discovery.matchesUniqueStay(dormantUtilities,{...filter,amenities:["connectedPower"]}),false);
  const actualUtilities=discovery.normalizeUniqueStay("rv",listing("host_rv",{stayAmenities:{connectedPower:"available"}}));
  assert.equal(discovery.matchesUniqueStay(actualUtilities,{...filter,type:"host_rv",amenities:["connectedPower"]}),true);
  assert.equal(discovery.normalizeUniqueStay("missing",listing("cabin",{price:undefined,pricingType:undefined})).price,null);
  assert.equal(types.accommodationRate({price:90}).label,"");
  assert.equal(types.accommodationRate({price:Infinity,pricingType:"Night"}).price,null);
  assert.equal(types.accommodationRate({pricePerNight:90}).label,"night");
  assert.equal(discovery.readStayFilters(new URLSearchParams("guests=NaN&amenity=madeup")).guests,0);
  assert.equal(discovery.readStayFilters(new URLSearchParams("guests=NaN&amenity=madeup")).amenities.length,0);
  assert.match(types.sleepingLabel(stay.raw),/1 queen/);
});
test("nightly estimates have no RV premium; weekly/monthly/unknown periods never multiply by nights",()=>{
  assert.equal(types.inquiryEstimate(90,"Night",3),270);
  assert.equal(types.inquiryEstimate(0,"night",2),0);
  for(const period of ["Weekly","Monthly","week","month","unknown"])assert.equal(types.inquiryEstimate(90,period,3),null);
  assert.equal(types.inquiryEstimate(NaN,"Night",3),null);
  assert.equal(types.inquiryBookingType("host_rv"),"RV_PROVIDED");
  assert.equal(types.inquiryBookingType("land_space"),"LAND");
  assert.equal(types.inquiryNights("2026-10-31","2026-11-02"),2);
  assert.equal(types.inquiryNights("2026-02-30","2026-03-02"),0);
  assert.equal(types.inquiryNights("2099-01-04","2099-01-01"),0);
});
test("nested edits preserve untouched/unknown legacy fields instead of replacing whole maps",()=>{
  const initial={listingType:"cabin",title:"Original",accommodation:accommodation(),stayAmenities:{wifi:"unknown",bathroom:"shared"}};
  const next={...initial,title:"Edited",accommodation:{...initial.accommodation,beds:{...initial.accommodation.beds,queen:2}},stayAmenities:{...initial.stayAmenities,bathroom:"private"}};
  assert.deepEqual(plain(types.listingFieldEdits(initial,next)),{title:"Edited","accommodation.beds.queen":2,"stayAmenities.bathroom":"private"});
  assert.deepEqual(plain(types.listingFieldEdits(initial,initial)),{});
});

function nodes(tree,predicate) {
  if(!tree||typeof tree!=="object")return [];
  if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,predicate));
  return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
function harness(file,dependencies,globals={}) {
  const slots=[];let index=0,effects=[];
  const hooks={...React,
    useState:initial=>{const slot=index++;if(!(slot in slots))slots[slot]=typeof initial==="function"?initial():initial;
      return [slots[slot],value=>{slots[slot]=typeof value==="function"?value(slots[slot]):value;}];},
    useRef:initial=>{const slot=index++;return slots[slot]??(slots[slot]={current:initial});},
    useMemo:(callback,deps)=>{const slot=index++;if(!slots[slot]||deps.some((v,i)=>!Object.is(v,slots[slot].deps[i])))slots[slot]={deps,value:callback()};return slots[slot].value;},
    useEffect:(callback,deps)=>{const slot=index++;if(!slots[slot]||deps.some((v,i)=>!Object.is(v,slots[slot].deps[i])))effects.push(()=>{
      slots[slot]?.cleanup?.();slots[slot]={deps,cleanup:callback()};
    });},
  };
  const loaded=load(file,{react:hooks,"react/jsx-runtime":jsx,...dependencies},globals);
  return {module:loaded,render:props=>{index=0;effects=[];return loaded.default(props);},flush:()=>effects.forEach(f=>f()),dispose:()=>slots.forEach(slot=>slot?.cleanup?.())};
}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
test("shared host form supports each type, preserves photos/prices and dormant fields through type switches",async()=>{
  let submitted;
  const h=harness("src/app/components/HostListingForm.tsx",{
    "./HostLocationPicker":()=>null,"./ListingPhotoEditor":()=>null,"./AccommodationFields":()=>null,
    "./stayFields.module.css":{},
    "@/lib/listing-types":types,"@/lib/stay-amenities":amenities,
  });
  const base={...h.module.DEFAULT_LISTING_FORM_VALUES,title:"Demo",city:"Austin",stateCode:"TX",description:"A demo accommodation description.",
    accommodation:accommodation(),stayAmenities:{wifi:"private"},price:123};
  const props={initialValues:base,saving:false,status:"",submitLabel:"Save",savingLabel:"Saving",photoOwnerId:"host",onComplete:()=>{},
    onSubmit:async values=>{submitted=values;return undefined;}};
  let tree=h.render(props);
  for(const type of ["cabin","mobile_home","host_rv","rv_space"]) {
    nodes(tree,node=>node.props.id==="listing-offering-type")[0].props.onChange({target:{value:type}});
    tree=h.render(props);
    assert.equal(nodes(tree,node=>node.props.id==="listing-max-length").length,type==="rv_space"?1:0);
    await nodes(tree,node=>node.type==="button"&&node.props.children==="Save")[0].props.onClick();
    assert.equal(submitted.listingType,type);assert.equal(submitted.price,123);
    assert.equal(submitted.accommodation.maxGuests,4);assert.equal(submitted.maxLengthFt,35);
    const fields=h.module.buildListingFields(submitted);
    assert.equal("hostId" in fields,false);assert.equal("photos" in fields,false);
    assert.equal("maxLengthFt" in fields,type==="rv_space");
  }
});
test("booking panel fixes the offering, validates guests, and writes null weekly totals",async()=>{
  let writes=[],current=listing("cabin",{pricingType:"Weekly",price:400});
  const h=harness("src/app/listings/[id]/bookingpaneltemp.tsx",{
    "next/navigation":{useRouter:()=>({push:()=>{}})},"@/lib/auth-context":{useAuth:()=>({user:{uid:"guest"}})},
    "@/lib/firebase":{db:{}},"@/lib/listing-types":types,"./listingdetail.module.css":{},
    "firebase/firestore":{collection:()=>({}),doc:()=>({}),getDoc:async()=>({exists:()=>true,data:()=>current}),
      addDoc:async(_,data)=>{writes.push(data);},serverTimestamp:()=>"server"},
  });
  const props={listingId:"demo",hostId:"host",nightlyPrice:400,priceLabel:"week",listingType:"cabin",accommodation:accommodation()};
  let tree=h.render(props);
  assert.equal(nodes(tree,node=>node.props.label==="🚌 RV Provided").length,0);
  for(const [id,value] of [["booking-check-in","2099-01-01"],["booking-check-out","2099-01-04"],["booking-guests","5"]]) {
    nodes(tree,node=>node.props.id===id)[0].props.onChange({target:{value}});tree=h.render(props);
  }
  const submit=()=>nodes(tree,node=>node.type==="button"&&node.props.children==="Request Booking")[0].props.onClick();
  await submit();assert.equal(writes.length,0);
  nodes(tree,node=>node.props.id==="booking-guests")[0].props.onChange({target:{value:"4"}});
  tree=h.render(props);assert.match(JSON.stringify(tree),/Total to be confirmed by host/);
  await Promise.all([submit(),submit()]);assert.equal(writes.length,1);
  assert.equal(writes[0].guestCount,4);assert.equal(writes[0].listingType,"cabin");
  assert.equal(writes[0].bookingType,"RV_PROVIDED");assert.equal(writes[0].estimatedTotal,null);
  current=listing("host_rv");
  tree=h.render(props);await submit();assert.equal(writes.length,1);
});
test("unique workspace uses only accommodation query, error/retry and real empty states; URL drives categories",async()=>{
  let params="type=cabin&guests=4",fail=true,captured;
  const h=harness("src/app/unique-stays/workspace.tsx",{
    "next/image":"img","next/link":"a","next/navigation":{useSearchParams:()=>new URLSearchParams(params)},
    "@/lib/firebase":{db:{}},"@/lib/listing-types":types,"@/lib/unique-stays":discovery,"@/lib/stay-amenities":amenities,
    "@/lib/listing-location":location,"../components/ListingPhoto":()=>null,"../components/ListingRating":()=>null,
    "../components/useListingRatings":()=>({ratings:{},retry:()=>{}}),"../components/authnav":()=>null,
    "./uniqueStays.module.css":{},
    "firebase/firestore":{collection:(_,name)=>name,where:(...args)=>args,query:(...args)=>args,
      getDocsFromServer:async query=>{captured=query;if(fail)throw new Error("offline");return {docs:[]};}},
  },{URLSearchParams});
  let tree=h.render({});assert.match(JSON.stringify(tree),/Loading Unique Stays/);h.flush();await tick();
  tree=h.render({});assert.equal(nodes(tree,node=>node.props.role==="alert").length,1);
  assert.deepEqual(plain(captured),["listings",["listingType","in",["host_rv","mobile_home","cabin"]]]);
  fail=false;nodes(tree,node=>node.type==="button"&&node.props.children==="Retry listings")[0].props.onClick();
  tree=h.render({});h.flush();await tick();tree=h.render({});
  assert.match(JSON.stringify(tree),/No matching Unique Stays yet/);
  const cabin=nodes(tree,node=>node.type==="a"&&node.props.children==="Cabins")[0];
  assert.equal(cabin.props["aria-current"],"page");assert.match(cabin.props.href,/guests=4/);
  params="type=host_rv&guests=2";tree=h.render({});
  assert.equal(nodes(tree,node=>node.type==="a"&&node.props.children==="Host-provided RVs")[0].props["aria-current"],"page");
  h.dispose();
});
test("detail accommodation has declared beds, shared/private amenity labels and honest unknowns",()=>{
  const {renderToStaticMarkup}=require("react-dom/server");
  const Amenities=load("src/app/components/StayAmenities.tsx",{"react/jsx-runtime":jsx,"@/lib/stay-amenities":amenities,"./stayFields.module.css":{}}).default;
  const Details=load("src/app/components/AccommodationDetails.tsx",{
    "react/jsx-runtime":jsx,"@/lib/listing-types":types,"./StayAmenities":Amenities,"../listings/[id]/listingdetail.module.css":{},
  }).default;
  const html=renderToStaticMarkup(React.createElement(Details,{data:listing()}));
  assert.match(html,/Studio/);assert.match(html,/1 queen/);assert.match(html,/Private \/ in-unit/);
  assert.match(html,/Shared/);assert.match(html,/Not provided/);assert.match(html,/not RVNB inspections/);
  assert.doesNotMatch(html,/Full hookups|Max RV length/);
});
test("host requests and traveler trips retain offering/guests without turning unknown totals into zero",()=>{
  const {renderToStaticMarkup}=require("react-dom/server");
  const Panel=load("src/app/components/HostBookingRequestsPanel.tsx",{
    "react/jsx-runtime":jsx,"@/lib/listing-types":types,"./hostDashboard.module.css":{},
  }).default;
  const row={id:"demo",listingTitle:"Demo cabin",listingType:"cabin",guestCount:4,guestLabel:"Guest request",
    checkInLabel:"Jan 1",checkOutLabel:"Jan 3",nights:2,estimatedTotal:null,status:"pending",note:""};
  const html=renderToStaticMarkup(React.createElement(Panel,{bookings:[row],loading:false,error:"",updatingId:"",onApprove:()=>{},onDecline:()=>{}}));
  assert.match(html,/Cabin.*4 guests/);assert.match(html,/Total to be confirmed by host/);assert.doesNotMatch(html,/\$0/);
  const Trips=load("src/app/account/components/AccountTripsPanel.tsx",{
    react:React,"react/jsx-runtime":jsx,"next/link":"a","../account.module.css":{},"@/lib/listing-types":types,
  }).default;
  const trips=renderToStaticMarkup(React.createElement(Trips,{loading:false,error:"",trips:[{...row,listingId:"demo",
    destination:"Austin, TX",classification:"upcoming",reviewed:false}]}));
  assert.match(trips,/Cabin.*4 guests/);
  const metrics=load("src/app/components/hostDashboardUtils.ts");
  assert.equal(metrics.getLifetimeRevenue([{...row,listingId:"demo",estimatedTotal:null}]),0);
});

test("demo emulator: canonical listing and inquiry contracts preserve legacy compatibility",{
  skip:!process.env.FIRESTORE_EMULATOR_HOST,
},async t=>{
  const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
  const fs=require("firebase/firestore");
  const env=await initializeTestEnvironment({projectId:"demo-rvnb-rules-test",firestore:{rules:readFileSync("firestore.rules","utf8")}});
  const host=env.authenticatedContext("host").firestore(),other=env.authenticatedContext("other").firestore(),
    guest=env.authenticatedContext("guest").firestore(),anon=env.unauthenticatedContext().firestore();
  const ref=(db,id)=>fs.doc(db,"listings",id);
  const inquiry=(type,overrides={})=>({
    listingId:type,hostId:"host",guestId:"guest",listingType:type,
    bookingType:types.inquiryBookingType(type),guestCount:4,checkIn:"2099-01-01",checkOut:"2099-01-03",
    nights:2,estimatedTotal:180,estimateStatus:"nightly_estimate",note:"",status:"pending",createdAt:fs.serverTimestamp(),...overrides,
  });
  const send=(db,type,overrides={})=>fs.setDoc(fs.doc(fs.collection(db,"bookings")),inquiry(type,overrides));
  try {
    await env.clearFirestore();
    await t.test("owner creates/edits each type, public query works, others cannot mutate",async()=>{
      for(const type of Object.keys(types.LISTING_TYPES)) {
        await assertSucceeds(fs.setDoc(ref(host,type),listing(type)));
        await assertSucceeds(fs.updateDoc(ref(host,type),{title:"Updated local fixture"}));
        await assertFails(fs.updateDoc(ref(other,type),{title:"stolen"}));
        await assertFails(fs.updateDoc(ref(anon,type),{title:"anonymous"}));
        await assertFails(fs.updateDoc(ref(host,type),{hostId:"other"}));
      }
      await assertFails(fs.setDoc(ref(anon,"anon"),listing()));
      await assertFails(fs.setDoc(ref(other,"spoof"),listing()));
      const found=await assertSucceeds(fs.getDocs(fs.query(fs.collection(anon,"listings"),fs.where("listingType","in",["host_rv","mobile_home","cabin"]))));
      assert.equal(found.size,3);
    });
    await t.test("types, capacities, sleeping data, amenities and prices reject malformed writes",async()=>{
      const bad=[{listingType:"yacht"},{accommodation:accommodation({maxGuests:0})},{accommodation:accommodation({maxGuests:31})},
        {accommodation:accommodation({maxGuests:"4"})},{accommodation:accommodation({beds:{queen:1}})},
        {accommodation:accommodation({bathrooms:.3})},{accommodation:accommodation({bedrooms:-1})},
        {accommodation:accommodation({checkInFrom:"25:00"})},{stayAmenities:{wifi:true}},{stayAmenities:{verified:true}},
        {price:-1},{price:Infinity},{price:"90"},{pricingType:"Yearly"}];
      for(const [i,patch] of bad.entries())await assertFails(fs.setDoc(ref(host,`bad-${i}`),listing("cabin",patch)));
      await assertSucceeds(fs.setDoc(ref(host,"boundary"),listing("cabin",{accommodation:accommodation({maxGuests:30,bathrooms:.5})})));
      await assertFails(fs.setDoc(ref(host,"bad-rv"),listing("host_rv",{accommodation:accommodation({rvLengthFt:null})})));
    });
    await t.test("type switching retains dormant fields, photos, prices and unknown legacy data",async()=>{
      await assertSucceeds(fs.setDoc(ref(host,"switch"),listing("rv_space",{maxLengthFt:35,hookups:"Full",imageUrl:"https://example.test/photo.webp",oldCustom:"untouched"})));
      await assertSucceeds(fs.updateDoc(ref(host,"switch"),{listingType:"cabin"}));
      let saved=(await fs.getDoc(ref(host,"switch"))).data();
      assert.equal(saved.maxLengthFt,35);assert.equal(saved.price,90);assert.equal(saved.oldCustom,"untouched");
      await assertSucceeds(fs.updateDoc(ref(host,"switch"),{listingType:"host_rv"}));
      await assertSucceeds(fs.updateDoc(ref(host,"switch"),{listingType:"rv_space"}));
      saved=(await fs.getDoc(ref(host,"switch"))).data();
      assert.equal(saved.accommodation.maxGuests,4);assert.equal(saved.stayAmenities.wifi,"shared");
      assert.equal(saved.imageUrl,"https://example.test/photo.webp");
      await assertFails(fs.updateDoc(ref(host,"switch"),{listingType:fs.deleteField()}));
      await assertSucceeds(fs.setDoc(ref(host,"legacy"),{hostId:"host",title:"Legacy space",power:"special unknown",oldCustom:"preserved"}));
      await assertSucceeds(fs.updateDoc(ref(host,"legacy"),{title:"Legacy title updated"}));
      assert.equal((await fs.getDoc(ref(host,"legacy"))).data().power,"special unknown");
    });
    await t.test("accommodation inquiries enforce exact offering, integer capacity, public/auth boundaries",async()=>{
      for(const type of ["host_rv","mobile_home","cabin"])await assertSucceeds(send(guest,type));
      await assertSucceeds(send(guest,"cabin",{guestCount:1}));
      await assertSucceeds(send(guest,"cabin",{listingId:"boundary",guestCount:30}));
      for(const patch of [{guestCount:0},{guestCount:5},{guestCount:1.5},{guestCount:"2"},
        {listingType:"host_rv"},{bookingType:"RV"},{bookingType:"LAND"},{guestId:"other"},
        {hostId:"other"},{verified:true},{estimatedTotal:Infinity},{nights:0},{nights:3661},
        {checkOut:"2098-01-01"},{createdAt:new Date(0)}])await assertFails(send(guest,"cabin",patch));
      await assertFails(send(anon,"cabin"));await assertFails(send(host,"cabin",{guestId:"host"}));
      await assertSucceeds(send(guest,"rv_space"));
    });
    await t.test("weekly/monthly totals must be null; unsupported choices never create inquiries",async()=>{
      for(const period of ["Weekly","Monthly"]) {
        await assertSucceeds(fs.updateDoc(ref(host,"cabin"),{pricingType:period}));
        await assertFails(send(guest,"cabin"));
        await assertSucceeds(send(guest,"cabin",{estimatedTotal:null,estimateStatus:"host_confirmation_required"}));
      }
      const old={listingId:"legacy",hostId:"host",guestId:"guest",status:"pending",bookingType:"RV",createdAt:fs.serverTimestamp()};
      await assertSucceeds(fs.setDoc(fs.doc(fs.collection(guest,"bookings")),old));
      await assertSucceeds(fs.setDoc(fs.doc(fs.collection(guest,"bookings")),{...old,bookingType:"LAND"}));
      await assertFails(fs.setDoc(fs.doc(fs.collection(guest,"bookings")),{...old,bookingType:"RV_PROVIDED"}));
      await assertFails(send(guest,"rv_space",{bookingType:"LAND"}));
      await assertFails(send(guest,"land_space",{bookingType:"RV"}));
    });
  } finally {await env.cleanup();}
});
