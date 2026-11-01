/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function load(file, dependencies = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    }, URL, Uint8Array, DataView, crypto: globalThis.crypto, console, ...globals,
  }, { filename: file });
  return exports;
}
const helpers = load("src/lib/listing-photos.ts");
const id = "12345678-1234-4234-8234-123456789abc";
const path = `listingPhotos/owner/listing/${id}.webp`;
const asset = { path, url: "https://example.test/photo.webp" };
function harness({ failUpload = false, failSave = false, failCleanup = false, existingUpload = false, original = {}, server = original, user = "owner" } = {}) {
  const uploads = [], deletes = [], updates = [], retained = [];
  const service = load("src/lib/listing-photo-storage.ts", {
    "./listing-photos": helpers,
    "./firebase": { auth: { currentUser: { uid: user } }, db: {} },
    "firebase/app": { getApp: () => ({ options: { storageBucket: "demo.test" } }) },
    "firebase/storage": {
      getStorage: () => ({}), ref: (_, value) => value,
      getMetadata: async () => {
        if (existingUpload) return { contentType: "image/webp", size: 12 };
        throw Object.assign(new Error("Not found"), { code: "storage/object-not-found" });
      },
      uploadBytesResumable: target => ({ on: (_, progress, reject, done) => {
        uploads.push(target);
        progress({ bytesTransferred: 1, totalBytes: 2 });
        if (failUpload) reject(new Error("Upload failed")); else done();
      } }),
      getDownloadURL: async target => `https://example.test/${target}`,
      deleteObject: async target => { deletes.push(target); if (failCleanup) throw new Error("Cleanup failed"); },
    },
    "firebase/firestore": {
      doc: (_, __, value) => value,
      runTransaction: async (_, callback) => {
        if (failSave) throw new Error("Save failed");
        await callback({
          get: async () => ({ exists: () => true, data: () => ({ hostId: "owner", ...server }) }),
          update: (_, fields) => updates.push(fields),
        });
      },
    },
  });
  return { service, uploads, deletes, updates, retained,
    save: photos => service.saveListingPhotos("listing", "owner", photos, original, () => {}, (photoId, value) => retained.push({ photoId, value })) };
}
test("legacy sources deduplicate in reader priority; unsafe URLs excluded", () => {
  assert.equal(JSON.stringify(helpers.listingPhotos({ imageUrl: "https://example.test/a", photoURL: "https://example.test/b",
    photos: ["https://example.test/a", "/local.png", "javascript:alert(1)", "data:image/png;base64,test"] })),
  JSON.stringify(["https://example.test/a", "https://example.test/b", "/local.png"]));
});
test("ownership paths cannot be derived from external URLs or other owners", () => {
  assert.ok(helpers.managedPhotoPath(path, "owner", "listing"));
  assert.equal(helpers.managedPhotoPath(path, "other", "listing"), false);
  assert.equal(helpers.managedPhotoPath("https://example.test/picture", "owner", "listing"), false);
  assert.equal(helpers.managedPhotoPath(`listingPhotos/owner/listing/../${id}.webp`, "owner", "listing"), false);
});
test("header validates PNG, JPEG, WebP; rejects wrong MIME, unsupported and huge dimensions", () => {
  const png = new Uint8Array(24);
  png.set([137,80,78,71,13,10,26,10],0); png.set([73,72,68,82],12);
  const data = new DataView(png.buffer); data.setUint32(16,100); data.setUint32(20,100);
  assert.equal(helpers.validatePhotoHeader(png,24,"image/png").width,100);
  assert.throws(() => helpers.validatePhotoHeader(png,24,"image/jpeg"), /contents/);
  assert.throws(() => helpers.validatePhotoHeader(png,5*1024*1024+1,"image/png"), /5 MiB/);
  data.setUint32(16,12001);
  assert.throws(() => helpers.validatePhotoHeader(png,24,"image/png"), /dimensions/);
  assert.throws(() => helpers.validatePhotoHeader(new Uint8Array([71,73,70]),3,"image/gif"), /Unsupported/);
  const jpeg = new Uint8Array([255,216,255,192,0,8,8,0,10,0,20,1,0]);
  assert.equal(helpers.validatePhotoHeader(jpeg,jpeg.length,"image/jpeg").width,20);
  const webp = new Uint8Array(30);
  webp.set([82,73,70,70],0);webp.set([87,69,66,80,86,80,56,88],8);
  webp[24]=99;webp[27]=49;
  assert.equal(helpers.validatePhotoHeader(webp,30,"image/webp").width,100);
});
test("browser preparation bounds output and re-encodes rather than retaining original metadata", async () => {
  const png = new Uint8Array(24);
  png.set([137,80,78,71,13,10,26,10],0);png.set([73,72,68,82],12);
  const dimensions=new DataView(png.buffer);dimensions.setUint32(16,4000);dimensions.setUint32(20,2000);
  const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{}}),
    toBlob:(callback,type)=>callback(new Blob(["prepared"],{type}))};
  let closed=false;
  const service=load("src/lib/listing-photo-storage.ts",{
    "./listing-photos":helpers,"./firebase":{},"firebase/app":{},"firebase/firestore":{},"firebase/storage":{},
  },{document:{createElement:()=>canvas},createImageBitmap:async()=>({width:4000,height:2000,close:()=>{closed=true;}})});
  const result=await service.preparePhoto({size:24,type:"image/png",slice:()=>({arrayBuffer:async()=>png.buffer})});
  assert.equal(canvas.width,2400);assert.equal(canvas.height,1200);
  assert.equal(result.file.type,"image/webp");assert.equal(closed,true);
  URL.revokeObjectURL(result.url);
});
test("cover selection and removal sync all readers, preserving external legacy URLs", async () => {
  const original = { imageUrl: "https://legacy.test/one", photoURL: "https://legacy.test/two", photos: [] };
  const h = harness({ original });
  await h.save([{ id: "cover", url: "https://legacy.test/two" },{ id: "other", url: "https://legacy.test/one" }]);
  assert.equal(h.updates[0].imageUrl,"https://legacy.test/two");
  assert.equal(h.updates[0].photoURL,h.updates[0].imageUrl);
  assert.equal(helpers.listingPhotos(h.updates[0]).length,2);
  assert.equal(h.deletes.length,0);
});
test("failed upload does not change photo references or delete saved images", async () => {
  const h = harness({ failUpload:true, original:{ photoAssets:[asset] } });
  await assert.rejects(h.save([{ id, url:"blob:preview", file:{} }]),/Upload failed/);
  assert.equal(h.updates.length,0);assert.equal(h.deletes.length,0);
});
test("failed Firestore photo save retains uploaded results for retry and never deletes originals", async () => {
  const h = harness({ failSave:true });
  await assert.rejects(h.save([{ id, url:"blob:preview", file:{} }]),/Save failed/);
  assert.equal(h.retained.length,1);assert.equal(h.deletes.length,0);
  const retry = harness();
  await retry.save([{id,url:h.retained[0].value.url,file:{},asset:h.retained[0].value}]);
  assert.equal(retry.uploads.length,0);assert.equal(retry.updates.length,1);
});
test("concurrent changes and account changes reject without destructive cleanup", async () => {
  const h = harness({server:{photos:["https://other.test/photo"]}});
  await assert.rejects(h.save([]),/another session/);
  assert.equal(h.deletes.length,0);
  await assert.rejects(harness({user:"other"}).save([]),/account changed/);
});
test("removed managed files are deleted only after successful commit; cleanup failures reported", async () => {
  const h = harness({original:{photoAssets:[asset]},failCleanup:true});
  const result = await h.save([]);
  assert.equal(h.updates.length,1);assert.equal(h.deletes[0],path);assert.equal(result.cleanupFailed,1);
  assert.equal(helpers.listingPhotos(result.fields).length,0);
});
test("lost upload completion response recovers the existing immutable object on retry", async () => {
  const h = harness({existingUpload:true});
  await h.save([{id,url:"blob:preview",file:{size:12}}]);
  assert.equal(h.uploads.length,0);assert.equal(h.updates.length,1);
});
test("lost photo commit response is confirmed idempotently instead of reported as a conflict", async () => {
  const fields={photos:["https://legacy.test/a"],imageUrl:"https://legacy.test/a",photoURL:"https://legacy.test/a",photoAssets:[],photoPaths:[]};
  const h=harness({server:fields});
  const result=await h.save([{id:"legacy",url:"https://legacy.test/a"}]);
  assert.equal(h.updates.length,0);assert.equal(result.cleanupFailed,0);
});
test("photo limit is checked before any writes", async () => {
  const h = harness();
  await assert.rejects(h.save(Array.from({length:9},(_,index)=>({id:String(index),url:`https://legacy.test/${index}`}))),/up to 8/);
  assert.equal(h.uploads.length,0);assert.equal(h.updates.length,0);
});

// Deterministic hook harness exercises the real component event handlers without DOM/network writes.
function componentHarness(file, dependencies) {
  const react = require("react");
  const slots = [];let index = 0;
  const hooks = { ...react,
    useState: initial => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot],value => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef: initial => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = {current:initial};
      return slots[slot];
    },
    useEffect: () => {}, useMemo: callback => callback(),
  };
  const loaded = load(file,{react:hooks,"react/jsx-runtime":require("react/jsx-runtime"),...dependencies});
  return {module:loaded,render:props=>{index=0;return loaded.default(props);}};
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child=>nodes(child,predicate));
  return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
test("editor cover/removal event handlers persist ordered legacy URLs and survive reload", async () => {
  const saves = [];let save;
  const h = componentHarness("src/app/components/ListingPhotoEditor.tsx",{
    "@/lib/listing-photos":helpers,
    "@/lib/listing-photo-storage":{saveListingPhotos:async (_,__,photos)=> {
      const urls=photos.map(photo=>photo.url);saves.push(urls);
      return {fields:{photos:urls,imageUrl:urls[0]||"",photoURL:urls[0]||""},cleanupFailed:0};
    }},
    "./listingPhotos.module.css":{},
  });
  test("photo rendering preserves branded fallback after every candidate fails", () => {
    const h=componentHarness("src/app/components/ListingPhoto.tsx",{});
    const props={photos:["https://legacy.test/a","https://legacy.test/b"],fallback:"RVNB Photos not added",badgeClassName:"badge"};
    let tree=h.render(props);
    nodes(tree,node=>node.type==="img")[0].props.onError();
    tree=h.render(props);
    assert.equal(nodes(tree,node=>node.type==="img")[0].props.src,"https://legacy.test/b");
    nodes(tree,node=>node.type==="img")[0].props.onError();
    tree=h.render(props);
    assert.equal(nodes(tree,node=>node.type==="img").length,0);
    assert.equal(nodes(tree,node=>node.type==="span")[0].props.children,"Photos not added");
  });
  test("detail gallery offers every photo and keyboard-native cover selection controls", () => {
    const h=componentHarness("src/app/components/ListingPhotoGallery.tsx",{
      "./ListingPhoto":()=>null,"./listingPhotos.module.css":{},
    });
    const props={photos:["https://legacy.test/a","https://legacy.test/b"],fallback:"RVNB fallback"};
    let tree=h.render(props);
    const buttons=nodes(tree,node=>node.type==="button");
    assert.equal(buttons.length,2);assert.equal(buttons[0].props["aria-pressed"],true);
    buttons[1].props.onClick();tree=h.render(props);
    assert.equal(nodes(tree,node=>node.type==="button")[1].props["aria-pressed"],true);
    assert.equal(h.render({...props,photos:[]}),"RVNB fallback");
  });
  const props={initial:{imageUrl:"https://legacy.test/a",photoURL:"https://legacy.test/b"},uid:"owner",listingId:"listing",
    busy:false,register:callback=>{save=callback;},onPreparing:()=>{}};
  let tree=h.render(props);
  const cover=nodes(tree,node=>node.type==="button"&&node.props.children==="Use as cover")[1];
  cover.props.onClick();tree=h.render(props);
  assert.equal(nodes(tree,node=>node.type==="img")[0].props.src,"https://legacy.test/b");
  await save("listing");
  assert.equal(JSON.stringify(saves[0]),JSON.stringify(["https://legacy.test/b","https://legacy.test/a"]));
  tree=h.render(props);
  nodes(tree,node=>node.type==="button"&&Array.isArray(node.props.children)&&node.props.children[0]==="Remove photo ")[1].props.onClick();
  h.render(props);await save("listing");
  assert.equal(saves[1].length,1);
  const reload=helpers.listingPhotos({photos:saves[1],imageUrl:saves[1][0],photoURL:saves[1][0]});
  assert.equal(reload[0],"https://legacy.test/b");
});
test("shared form saves details before photos, locks duplicate clicks and never uploads after a failed details save", async () => {
  let resolveDetails;let photoCalls=0;let completes=0;
  const h=componentHarness("src/app/components/HostListingForm.tsx",{
    "./HostLocationPicker":()=>null,"./ListingPhotoEditor":()=>null,
    "./AccommodationFields":()=>null,
    "./stayFields.module.css":{},
    "@/lib/listing-types":load("src/lib/listing-types.ts"),
    "@/lib/stay-amenities":load("src/lib/stay-amenities.ts",{"./listing-types":load("src/lib/listing-types.ts")}),
  });
  const props={initialValues:{...h.module.DEFAULT_LISTING_FORM_VALUES,title:"Test listing",city:"Austin",stateCode:"TX"},saving:false,status:"",submitLabel:"Save",savingLabel:"Saving",
    photoOwnerId:"owner",onComplete:()=>{completes++;},onSubmit:()=>new Promise(resolve=>{resolveDetails=resolve;})};
  let tree=h.render(props);
  nodes(tree,node=>typeof node.type==="function"&&node.props.register)[0].props.register(async ()=>{photoCalls++;return true;});
  const submit=nodes(tree,node=>node.type==="button"&&node.props.children==="Save")[0].props.onClick;
  const first=submit();await submit();
  assert.equal(photoCalls,0);resolveDetails("listing");await first;
  assert.equal(photoCalls,1);assert.equal(completes,1);
  props.onSubmit=async()=>undefined;
  tree=h.render(props);
  await nodes(tree,node=>node.type==="button"&&node.props.children==="Save")[0].props.onClick();
  assert.equal(photoCalls,1);assert.equal(completes,1);
});
