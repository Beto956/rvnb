/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const React = require("react");
const jsx = require("react/jsx-runtime");

function load(file, dependencies = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, ...globals }, { filename: file });
  return exports;
}
const reviews = load("src/lib/reviews.ts");
const location = load("src/lib/listing-location.ts");
const listingTypes = load("src/lib/listing-types.ts");
function ratingService(firestore = {}) {
  return load("src/lib/listing-ratings.ts", { "./reviews": reviews, "firebase/firestore": firestore });
}
const service = ratingService();
const review = (listingId, rating, overrides = {}) => ({
  listingId, rating, direction: "traveler_to_host", status: "published", ...overrides,
});
const plain = value => JSON.parse(JSON.stringify(value));

test("coordinates accept numeric zero and endpoints, reject missing, nonfinite, string and out-of-range values", () => {
  for (const value of [{lat:0,lng:0},{lat:-90,lng:180},{lat:90,lng:-180}]) assert.equal(location.hasListingCoordinates(value),true);
  for (const value of [{},{lat:0},{lat:null,lng:0},{lat:"0",lng:0},{lat:NaN,lng:0},
    {lat:0,lng:Infinity},{lat:90.01,lng:0},{lat:0,lng:-180.01}]) assert.equal(location.hasListingCoordinates(value),false);
});

test("zero, one, and multiple listing ratings exclude unpublished, other listings, and host-to-traveler reviews", () => {
  const result = service.summarizeListingReviewBatch(["empty","one","many"], [
    review("one",4),review("many",5),review("many",4),review("many",5),
    review("many",1,{status:"draft"}),review("many",1,{direction:"host_to_traveler"}),
    review("other",1),
  ],false);
  assert.deepEqual(plain(result.empty.summary),{average:null,count:0});
  assert.deepEqual(plain(result.one.summary),{average:4,count:1});
  assert.deepEqual(plain(result.many.summary),{average:4.7,count:3});
});

test("complete averages include reviews older than the latest 20; invalid or capped data never produce an average", () => {
  const rows = [...Array.from({length:20},()=>review("many",5)),review("many",1)];
  assert.deepEqual(plain(service.summarizeListingReviewBatch(["many"],rows,false).many.summary),{average:4.8,count:21});
  for (const rating of [0,6,2.5,NaN,"5",null]) {
    assert.equal(service.summarizeListingReviewBatch(["many"],[review("many",rating)],false).many.status,"error");
  }
  const overflow = service.summarizeListingReviewBatch(["many","empty"],rows,true);
  assert.equal(overflow.many.status,"error");
  assert.equal(overflow.empty.status,"error");
  assert.equal("summary" in overflow.many,false);
});

test("card queries are scoped to at most 30 IDs with a 501-document sentinel and propagate failures", async () => {
  let captured;
  const firestore = {
    collection: (_,name)=>({name}), where:(field,op,value)=>({field,op,value}),
    limit:count=>({limit:count}),query:(base,...filters)=>({base,filters}),
    getDocsFromServer:async q=>{captured=q;return {size:0,docs:[]};},
  };
  const api = ratingService(firestore);
  await api.loadListingRatingBatch({},["one","two"]);
  assert.deepEqual(plain(captured.filters),[
    {field:"listingId",op:"in",value:["one","two"]},
    {field:"direction",op:"==",value:"traveler_to_host"},
    {field:"status",op:"==",value:"published"},{limit:501},
  ]);
  assert.equal(api.publishedListingReviews({},"one").filters.length,3);
  await assert.rejects(api.loadListingRatingBatch({},[]),/1 to 30/);
  await assert.rejects(api.loadListingRatingBatch({},Array(31).fill("one")),/1 to 30/);
  const failing = ratingService({...firestore,getDocsFromServer:async()=>{throw new Error("offline");}});
  await assert.rejects(failing.loadListingRatingBatch({},["one"]),/offline/);
  const capped = ratingService({...firestore,getDocsFromServer:async()=>({
    size:501,docs:Array.from({length:501},()=>({data:()=>review("one",5)})),
  })});
  assert.equal((await capped.loadListingRatingBatch({},["one"])).one.status,"error");
  const exactCap = ratingService({...firestore,getDocsFromServer:async()=>({
    size:500,docs:Array.from({length:500},()=>({data:()=>review("one",5)})),
  })});
  assert.equal((await exactCap.loadListingRatingBatch({},Array.from({length:30},(_,i)=>i?String(i):"one"))).one.summary.count,500);
});

const Rating = load("src/app/components/ListingRating.tsx",{
  "react/jsx-runtime":jsx,"./listingRating.module.css":{},
}).default;
test("compact summary has five stars, precise accessible text, and distinct loading/error/empty states", () => {
  const {renderToStaticMarkup} = require("react-dom/server");
  const render = state=>renderToStaticMarkup(React.createElement(Rating,{state}));
  assert.match(render({status:"loading"}),/role="status".*Loading reviews/);
  assert.match(render({status:"error",message:"Offline"}),/Ratings unavailable/);
  assert.doesNotMatch(render({status:"error",message:"Offline"}),/No reviews yet/);
  assert.match(render({status:"ready",summary:{average:null,count:0}}),/No reviews yet/);
  const html = render({status:"ready",summary:{average:4.7,count:12}});
  assert.match(html,/4.7 out of 5 from 12 reviews/);
  assert.match(html,/★★★★★/);
  assert.match(render({status:"ready",summary:{average:5,count:1}}),/5.0 out of 5 from 1 review"/);
});

function harness(file, dependencies, globals = {}) {
  const slots = []; let index = 0; let effects = [];
  const changed = (a,b)=>!a||!b||a.length!==b.length||a.some((value,i)=>!Object.is(value,b[i]));
  const hooks = {...React,
    useState:initial=>{
      const slot=index++;if(!(slot in slots))slots[slot]=typeof initial==="function"?initial():initial;
      return [slots[slot],value=>{slots[slot]=typeof value==="function"?value(slots[slot]):value;}];
    },
    useRef:initial=>{const slot=index++;return slots[slot]??(slots[slot]={current:initial});},
    useMemo:(callback,deps)=>{
      const slot=index++;if(changed(slots[slot]?.deps,deps))slots[slot]={deps,value:callback()};
      return slots[slot].value;
    },
    useEffect:(callback,deps)=>{
      const slot=index++;if(changed(slots[slot]?.deps,deps))effects.push(()=>{
        slots[slot]?.cleanup?.();slots[slot]={deps,cleanup:callback()};
      });
    },
  };
  const component=load(file,{react:hooks,"react/jsx-runtime":jsx,...(typeof dependencies==="function"?dependencies(hooks):dependencies)},globals).default;
  return {
    render:props=>{index=0;effects=[];return component(props);},
    flush:()=>{const pending=effects;effects=[];pending.forEach(effect=>effect());},
    dispose:()=>slots.forEach(slot=>slot?.cleanup?.()),
  };
}
function nodes(tree,predicate) {
  if(!tree||typeof tree!=="object")return [];
  if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,predicate));
  return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
const tick = async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const listing = (id,overrides={})=>({
  id,title:`Listing ${id}`,city:"Austin",state:"TX",hookups:"Full",maxLengthFt:40,
  displayPriceValue:50,displayPriceLabel:"night",photos:[],lat:0,lng:0,...overrides,
});
function resultsHarness(loader) {
  return harness("src/app/components/ListingsResults.tsx",hooks=>({
    "next/link":"a","@/lib/firebase":{db:{}},"@/lib/listing-location":location,
    "@/lib/listing-types":listingTypes,
    "./useListingRatings":load("src/app/components/useListingRatings.ts",{
      react:hooks,"@/lib/firebase":{db:{}},
      "@/lib/listing-ratings":{...service,loadListingRatingBatch:loader},
    }).default,
    "@/lib/listing-ratings":{...service,loadListingRatingBatch:loader},
    "./ListingPhoto":()=>null,"./ListingRating":Rating,"./ListingsMapPanel":()=>null,
    "../listings/listings.module.css":{},
  }));
}
test("cards keep independent keyboard-native listing and map actions, numeric-zero pins, and all details", () => {
  const h=resultsHarness(async()=>({}));
  const props={listings:[listing("mapped"),listing("unmapped",{lat:undefined})]};
  let tree=h.render(props);
  const links=nodes(tree,node=>node.type==="a");
  assert.equal(links.length,2);assert.equal(links[0].props.href,"/listings/mapped");
  assert.equal(nodes(links[0],node=>node.type==="button").length,0);
  assert.equal(nodes(tree,node=>node.type==="button").length,1);
  const region=nodes(tree,node=>node.props.id==="listings-map")[0];
  let scrolled=false,focused=false;
  region.props.ref.current={scrollIntoView:()=>{scrolled=true;},focus:()=>{focused=true;}};
  nodes(tree,node=>node.type==="button")[0].props.onClick();
  tree=h.render(props);
  assert.equal(scrolled,true);assert.equal(focused,true);
  assert.equal(nodes(tree,node=>node.props.selection?.id==="mapped").length,1);
  assert.match(JSON.stringify(tree),/Location not mapped yet/);
});

test("card loading runs only two capped batches concurrently and ignores stale results after filter changes", async () => {
  const requests=[];let active=0,maxActive=0;
  const h=resultsHarness((_,ids)=>new Promise(resolve=>{
    active++;maxActive=Math.max(maxActive,active);
    requests.push({ids,finish:()=>{active--;resolve(Object.fromEntries(ids.map(id=>[id,{status:"ready",summary:{average:5,count:1}}])));}});
  }));
  const first={listings:Array.from({length:61},(_,i)=>listing(String(i)))};
  let tree=h.render(first);h.flush();
  assert.equal(requests.length,2);assert.equal(requests[0].ids.length,30);
  assert.equal(nodes(tree,node=>node.type===Rating&&node.props.state.status==="loading").length,61);
  requests[0].finish();await tick();
  assert.equal(requests.length,3);assert.equal(requests[2].ids.length,1);assert.equal(maxActive,2);
  const second={listings:[listing("new")]};
  tree=h.render(second);
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.status,"loading");
  h.flush();
  requests[1].finish();requests[2].finish();await tick();
  tree=h.render(second);
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.status,"loading");
  requests[3].finish();await tick();tree=h.render(second);
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.summary.count,1);
  h.dispose();
});

test("failed card batches expose retry without presenting a false empty result", async () => {
  let fail=true;
  const h=resultsHarness(async(_,ids)=>{
    if(fail)throw new Error("offline");
    return Object.fromEntries(ids.map(id=>[id,{status:"ready",summary:{average:null,count:0}}]));
  });
  const props={listings:[listing("one")]};
  h.render(props);h.flush();await tick();
  let tree=h.render(props);
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.status,"error");
  fail=false;
  nodes(tree,node=>node.type==="button"&&node.props.children==="Retry ratings")[0].props.onClick();
  tree=h.render(props);assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.status,"loading");
  h.flush();await tick();tree=h.render(props);
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.summary.count,0);
  h.dispose();
});

test("map activation opens the corresponding pin, pans, and retains navigation while excluding invalid coordinates", () => {
  const markers=[];const maps=[];const windows=[];
  class Map {
    constructor(){maps.push(this);}setCenter(){}fitBounds(){}getCenter(){return {};}
    setZoom(value){this.zoom=value;}panTo(value){this.pan=value;}
  }
  class Marker {
    constructor(options){this.options=options;markers.push(this);}setMap(){}
    addListener(_,callback){this.click=callback;}getPosition(){return this.options.position;}
  }
  class InfoWindow {constructor(){windows.push(this);}close(){}setContent(value){this.html=value;}open(value){this.anchor=value.anchor;}}
  class LatLngBounds {extend(){}}
  const h=harness("src/app/components/ListingsMapPanel.tsx",{
    "@react-google-maps/api":{useJsApiLoader:()=>({isLoaded:true})},
    "./listingsMapPanel.module.css":{},"@/lib/listing-location":location,
  },{process:{env:{NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:"mock-key"}},
    window:{google:{maps:{Map,Marker,InfoWindow,LatLngBounds,event:{trigger:marker=>marker.click?.()}}}},
    ResizeObserver:class{observe(){}disconnect(){}},
  });
  let props={listings:[listing("zero"),listing("two",{lat:32,lng:-97}),listing("bad",{lat:99})]};
  let tree=h.render(props);h.flush();
  nodes(tree,node=>typeof node.props.ref==="function")[0].props.ref({clientWidth:1000,clientHeight:400});
  h.render(props);h.flush();
  assert.equal(markers.length,2);
  props={...props,selection:{id:"zero",sequence:1}};
  h.render(props);h.flush();
  assert.deepEqual(plain(maps[0].pan),{lat:0,lng:0});assert.equal(maps[0].zoom,12);
  assert.equal(windows[0].anchor,markers[0]);assert.match(windows[0].html,/\/listings\/zero/);
  props={...props,selection:{id:"two",sequence:2}};
  h.render(props);h.flush();
  assert.equal(windows[0].anchor,markers[1]);assert.match(windows[0].html,/Listing two/);
  h.dispose();
});

test("detail header and review section share the complete published query, loading/error states and retry", async () => {
  let resolveReviews;let fail=false;let currentId="one";const queries=[];
  const firestore = {
    collection:(_,name)=>({name}),where:(field,op,value)=>({field,op,value}),
    query:(base,...filters)=>({base,filters}),orderBy:()=>({order:"desc"}),
    doc:(_,collection,id)=>({collection,id}),
    getDoc:async ref=>ref.collection==="listings"
      ? {exists:()=>true,id:ref.id,data:()=>listing(ref.id,ref.id==="two"?{lat:99}:{})}
      : {exists:()=>false},
    getDocsFromServer:async q=>{queries.push(q);if(fail)throw new Error("offline");return new Promise(resolve=>{resolveReviews=resolve;});},
  };
  const api=ratingService(firestore);
  const h=harness("src/app/listings/[id]/page.tsx",{
    "next/link":"a","next/image":"img","next/navigation":{useParams:()=>({id:currentId})},
    "./listingdetail.module.css":{},"@/lib/firebase":{db:{}},"firebase/firestore":firestore,
    "@/lib/reviews":reviews,"@/lib/listing-ratings":api,"@/lib/listing-location":location,
    "@/app/components/ListingRating":Rating,
    "@/app/components/AccommodationDetails":()=>null,"@/lib/listing-types":listingTypes,
    "@/app/components/ReviewCard":()=>null,"@/app/components/ReviewSummary":()=>null,
    "./bookingpaneltemp":()=>null,"../../components/ListingPhotoGallery":()=>null,
    "@/lib/listing-photos":{listingPhotos:()=>[]},
  });
  h.render({});h.flush();await tick();
  let tree=h.render({});
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.status,"loading");
  const rows=[...Array.from({length:20},()=>review("one",5)),review("one",1)];
  resolveReviews({docs:rows.map((row,i)=>({id:String(i),data:()=>row}))});await tick();
  tree=h.render({});
  assert.deepEqual(plain(nodes(tree,node=>node.type===Rating)[0].props.state.summary),{average:4.8,count:21});
  const section=nodes(tree,node=>node.props.title==="Ratings & reviews")[0];
  assert.equal(section.props.average,4.8);assert.equal(section.props.count,21);
  assert.equal(queries.length,1);assert.doesNotMatch(JSON.stringify(queries[0]),/"limit"/);
  assert.equal(nodes(tree,node=>node.props.href==="#listing-location").length,1);
  assert.equal(nodes(tree,node=>node.props.id==="listing-location").length,1);
  fail=true;currentId="two";h.render({});h.flush();await tick();tree=h.render({});
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.status,"error");
  assert.equal(nodes(tree,node=>node.props.href==="#listing-location").length,0);
  assert.match(JSON.stringify(tree),/Location not mapped yet/);
  fail=false;
  nodes(tree,node=>node.type==="button"&&node.props.children==="Retry reviews")[0].props.onClick();
  h.render({});h.flush();await tick();
  resolveReviews({docs:[]});await tick();tree=h.render({});
  assert.equal(nodes(tree,node=>node.type===Rating)[0].props.state.summary.count,0);
  h.dispose();
});

test("demo emulator validates complete published listing queries and bounded anonymous card reads", {
  skip:!process.env.FIRESTORE_EMULATOR_HOST,
},async()=>{
  const {initializeTestEnvironment,assertFails}=require("@firebase/rules-unit-testing");
  const fs=require("firebase/firestore");
  const env=await initializeTestEnvironment({
    projectId:"demo-rvnb-rules-test",firestore:{rules:readFileSync("firestore.rules","utf8")},
  });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context=>{
      const db=context.firestore();
      const rows=[...Array.from({length:20},()=>review("one",5)),review("one",1),
        review("two",3),review("one",1,{status:"draft"}),review("one",1,{direction:"host_to_traveler"})];
      await Promise.all(rows.map((row,i)=>fs.setDoc(fs.doc(db,"reviews",String(i)),{...row,createdAt:new Date(i*1000)})));
    });
    const db=env.unauthenticatedContext().firestore();
    const api=ratingService(fs);
    const result=await api.loadListingRatingBatch(db,["one","two","empty"]);
    assert.deepEqual(plain(result.one.summary),{average:4.8,count:21});
    assert.deepEqual(plain(result.two.summary),{average:3,count:1});
    assert.deepEqual(plain(result.empty.summary),{average:null,count:0});
    const complete=await fs.getDocsFromServer(fs.query(api.publishedListingReviews(db,"one"),fs.orderBy("createdAt","desc")));
    assert.equal(complete.size,21);
    await assertFails(fs.getDocs(fs.collection(db,"reviews")));
  }finally{await env.cleanup();}
});
