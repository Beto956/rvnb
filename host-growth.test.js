/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const jsx = require("react/jsx-runtime");

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, { exports, console, ...globals, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } }, { filename: file });
  return exports;
}
const growth = load("src/lib/host-growth.ts");
const valid = (overrides = {}) => ({
  listingId:"",city:"Austin",stateRegion:"TX",category:"Wi-Fi coverage",
  description:"Improve coverage in the RV parking area.",estimatedCost:"600.50",requestedSupport:"500",
  propertyPermission:true,contactEmail:"host@example.test",contactConsent:true,...overrides,
});
const plain = value => JSON.parse(JSON.stringify(value));

test("intake ships closed; deterministic IDs enforce the approved per-property policy", () => {
  assert.equal(growth.HOST_GROWTH_INTAKE_ENABLED,false);
  assert.equal(growth.growthRegistrationId("owner",""),"owner__proposed");
  assert.equal(growth.growthRegistrationId("owner","a"),"owner__listing__a");
  assert.notEqual(growth.growthRegistrationId("owner","a"),growth.growthRegistrationId("owner","b"));
  assert.throws(()=>growth.growthRegistrationId("owner","bad/path"),/Invalid/);
});
test("client validates categories, permission, contact consent, boundaries and estimates without requiring a profile", () => {
  assert.deepEqual(plain(growth.validateGrowth(valid())),{});
  assert.deepEqual(plain(growth.validateGrowth(valid({listingId:"owned",city:"",stateRegion:""}))),{});
  for(const [key,value] of Object.entries({city:"",stateRegion:" ",category:"loan",description:"short",
    estimatedCost:"100000.01",requestedSupport:"500.01",propertyPermission:false,
    contactEmail:"bad@",contactConsent:false})) {
    assert.ok(growth.validateGrowth(valid({[key]:value}))[key],key);
  }
  for(const value of ["","0","-1","Infinity","NaN","1e2","1.001"]) {
    assert.ok(growth.validateGrowth(valid({estimatedCost:value})).estimatedCost,value);
  }
  assert.ok(growth.validateGrowth(valid({estimatedCost:"10",requestedSupport:"20"})).requestedSupport);
  assert.deepEqual(plain(growth.validateGrowth(valid({estimatedCost:"0.01",requestedSupport:"0.01"}))),{});
});

function storageHarness({enabled=true,existing=false,owner="owner",failSave=false}={}) {
  let writes=0,transactions=0;
  const auth={currentUser:{uid:"owner"}};
  const api=load("src/lib/host-growth-storage.ts",{
    "./host-growth":{...growth,HOST_GROWTH_INTAKE_ENABLED:enabled},"./firebase":{auth,db:{}},
    "firebase/firestore":{
      doc:(_,collection,id)=>({collection,id}),serverTimestamp:()=>"server-time",
      runTransaction:async(_,callback)=>{transactions++;return callback({
        get:async ref=>ref.collection==="listings"
          ? {exists:()=>true,data:()=>({hostId:owner})}
          : {exists:()=>existing},
        set:()=>{if(failSave)throw new Error("offline");writes++;},
      });},
    },
  });
  return {api,auth,get writes(){return writes;},get transactions(){return transactions;}};
}
test("storage gate blocks even direct calls; duplicate retries do not overwrite; ownership and failures are explicit",async()=>{
  const closed=storageHarness({enabled:false});
  await assert.rejects(closed.api.saveGrowthRegistration("owner",valid()),/privacy notice/);
  assert.equal(closed.transactions,0);
  const created=storageHarness();
  assert.equal(await created.api.saveGrowthRegistration("owner",valid()),"created");assert.equal(created.writes,1);
  const duplicate=storageHarness({existing:true});
  assert.equal(await duplicate.api.saveGrowthRegistration("owner",valid()),"existing");assert.equal(duplicate.writes,0);
  const other=storageHarness({owner:"other"});
  await assert.rejects(other.api.saveGrowthRegistration("owner",valid({listingId:"a"})),/currently own/);
  assert.equal(other.writes,0);
  const failed=storageHarness({failSave:true});
  await assert.rejects(failed.api.saveGrowthRegistration("owner",valid()),/offline/);
  created.auth.currentUser=null;
  await assert.rejects(created.api.saveGrowthRegistration("owner",valid()),/Sign in again/);
});

function nodes(tree,predicate) {
  if(!tree||typeof tree!=="object")return [];
  if(Array.isArray(tree))return tree.flatMap(value=>nodes(value,predicate));
  return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
function harness(dependencies) {
  const slots=[];let index=0,effects=[];
  const hooks={...React,
    useState:initial=>{const slot=index++;if(!(slot in slots))slots[slot]=typeof initial==="function"?initial():initial;
      return [slots[slot],value=>{slots[slot]=typeof value==="function"?value(slots[slot]):value;}];},
    useRef:initial=>{const slot=index++;return slots[slot]??(slots[slot]={current:initial});},
    useEffect:(callback,deps)=>{const slot=index++;
      if(!slots[slot]||deps.some((dep,i)=>!Object.is(dep,slots[slot].deps[i])))effects.push(()=>{
        slots[slot]?.cleanup?.();slots[slot]={deps,cleanup:callback()};
      });
    },
  };
  const component=load("src/app/host-growth/interest-form.tsx",{
    react:hooks,"react/jsx-runtime":jsx,"next/link":"a","./hostgrowth.module.css":{},
    ...dependencies,
  }).default;
  let inner;
  return {
    outer:()=>component(),
    render:props=>{index=0;effects=[];if(!inner)inner=component().type;return inner(props);},
    flush:()=>effects.forEach(callback=>callback()),
    dispose:()=>slots.forEach(slot=>slot?.cleanup?.()),
  };
}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function formHarness({enabled=true,save=async()=>"created",listingsFail=false}={}) {
  const auth={currentUser:{uid:"owner"}};
  return harness({
    "@/lib/auth-context":{useAuth:()=>({user:{uid:"owner",email:"host@example.test"},loading:false})},
    "@/lib/firebase":{auth,db:{}},"@/lib/host-growth":{...growth,HOST_GROWTH_INTAKE_ENABLED:enabled},
    "@/lib/host-growth-storage":{saveGrowthRegistration:save},
    "firebase/firestore":{collection:()=>({}),where:()=>({}),query:()=>({}),
      getDocsFromServer:async()=>{if(listingsFail)throw new Error("offline");return {docs:[]};}},
  });
}
function fill(h,props) {
  let tree=h.render(props);
  for(const [key,value] of Object.entries(valid())) {
    const control=nodes(tree,node=>node.props.name===key)[0];
    if(control) {control.props.onChange({target:typeof value==="boolean"?{checked:value}:{value}});tree=h.render(props);}
  }
  return tree;
}
test("paused interface has a disabled submit and validates fields on blur without writing",()=>{
  let writes=0;
  const h=formHarness({enabled:false,save:async()=>{writes++;}});
  const props={uid:"owner",initialEmail:"host@example.test"};
  let tree=h.render(props);
  assert.equal(nodes(tree,node=>node.type==="button"&&node.props.type==="submit")[0].props.disabled,true);
  nodes(tree,node=>node.props.name==="city")[0].props.onBlur();
  tree=h.render(props);
  assert.equal(nodes(tree,node=>node.props.name==="city")[0].props["aria-invalid"],true);
  assert.equal(writes,0);
});
test("submission has progress, duplicate-click lock, retry and confirmation without promising funding",async()=>{
  let resolveSave;let calls=0;
  const h=formHarness({save:()=>{calls++;return new Promise(resolve=>{resolveSave=resolve;});}});
  const props={uid:"owner",initialEmail:"host@example.test"};
  let tree=fill(h,props);h.flush();await tick();
  const first=tree.props.onSubmit({preventDefault(){}});
  await tree.props.onSubmit({preventDefault(){}});
  assert.equal(calls,1);
  tree=h.render(props);assert.equal(tree.props["aria-busy"],true);
  resolveSave("created");await first;tree=h.render(props);
  assert.match(JSON.stringify(tree),/Interest registered/);assert.match(JSON.stringify(tree),/No funding is guaranteed/);
  h.dispose();
  let fail=true;
  const retry=formHarness({save:async()=>{if(fail)throw new Error("offline");return "existing";}});
  tree=fill(retry,props);await tree.props.onSubmit({preventDefault(){}});
  tree=retry.render(props);assert.match(JSON.stringify(tree),/couldn.t confirm/);
  fail=false;await tree.props.onSubmit({preventDefault(){}});tree=retry.render(props);
  assert.match(JSON.stringify(tree),/Interest already registered/);retry.dispose();
});
test("sign-in and owned-listing loading failures are distinct and actionable",async()=>{
  const anon=harness({"@/lib/auth-context":{useAuth:()=>({user:null,loading:false})},
    "@/lib/firebase":{},"@/lib/host-growth":growth,"@/lib/host-growth-storage":{},"firebase/firestore":{}});
  assert.match(JSON.stringify(anon.outer()),/login\?next=/);
  const h=formHarness({listingsFail:true});const props={uid:"owner",initialEmail:""};
  let tree=h.render(props);assert.match(JSON.stringify(tree),/Loading your owned listings/);
  h.flush();await tick();tree=h.render(props);
  assert.match(JSON.stringify(tree),/Retry listings/);assert.match(JSON.stringify(tree),/role":"alert/);
  h.dispose();
});

test("demo-only rules: deployed gate denies submission; prospective contract enforces privacy, ownership and duplicates",{
  skip:!process.env.FIRESTORE_EMULATOR_HOST,
},async t=>{
  const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
  const fs=require("firebase/firestore");
  const source=readFileSync("firestore.rules","utf8").replace(/\r\n/g,"\n");
  const marker="function hostGrowthIntakeEnabled() {\n      return false;\n    }";
  assert.ok(source.includes(marker),"Expected closed gate must exist before emulator-only substitution");
  let env;
  const payload=(overrides={})=>({
    schemaVersion:1,pilotId:"pilot-01",ownerId:"owner",listingId:null,city:"Austin",stateRegion:"TX",
    category:"Wi-Fi coverage",description:"Improve coverage in the RV parking area.",
    estimatedCostCents:60050,requestedSupportCents:50000,propertyPermission:true,
    contactEmail:"host@example.test",contactConsent:true,status:"registered",createdAt:fs.serverTimestamp(),...overrides,
  });
  try {
    env=await initializeTestEnvironment({projectId:"demo-rvnb-rules-test",firestore:{rules:source}});
    await env.clearFirestore();
    await assertFails(fs.setDoc(fs.doc(env.authenticatedContext("owner").firestore(),"hostGrowthRegistrations","owner__proposed"),payload()));
    await env.cleanup();
    env=await initializeTestEnvironment({projectId:"demo-rvnb-rules-test",firestore:{rules:source.replace(marker,marker.replace("false","true"))}});
    const owner=env.authenticatedContext("owner").firestore();
    const other=env.authenticatedContext("other").firestore();
    const anon=env.unauthenticatedContext().firestore();
    const ref=fs.doc(owner,"hostGrowthRegistrations","owner__proposed");
    await env.withSecurityRulesDisabled(async context=>{
      for(const [id,hostId] of [["a","owner"],["b","other"],["c","owner"]])await fs.setDoc(fs.doc(context.firestore(),"listings",id),{hostId,title:id});
    });
    await t.test("owner can pre-read missing deterministic IDs, submit, read and list own registrations",async()=>{
      await assertSucceeds(fs.getDoc(ref));
      await assertSucceeds(fs.setDoc(ref,payload()));
      await assertSucceeds(fs.getDoc(ref));
      await assertSucceeds(fs.getDocs(fs.query(fs.collection(owner,"hostGrowthRegistrations"),fs.where("ownerId","==","owner"))));
    });
    await t.test("anonymous, cross-user, unscoped queries, overwrites and deletes are denied",async()=>{
      await assertFails(fs.setDoc(fs.doc(anon,"hostGrowthRegistrations","owner__proposed"),payload()));
      await assertFails(fs.getDoc(fs.doc(anon,"hostGrowthRegistrations","owner__proposed")));
      await assertFails(fs.getDoc(fs.doc(other,"hostGrowthRegistrations","owner__proposed")));
      await assertFails(fs.setDoc(fs.doc(other,"hostGrowthRegistrations","other__proposed"),payload()));
      await assertFails(fs.getDocs(fs.collection(owner,"hostGrowthRegistrations")));
      await assertFails(fs.getDocs(fs.query(fs.collection(other,"hostGrowthRegistrations"),fs.where("ownerId","==","owner"))));
      await assertFails(fs.setDoc(ref,payload()));
      await assertFails(fs.updateDoc(ref,{ownerId:"other"}));
      await assertFails(fs.deleteDoc(ref));
    });
    await t.test("owned-listing boundary, multiple distinct properties, missing listing and arbitrary IDs",async()=>{
      const target=fs.doc(owner,"hostGrowthRegistrations","owner__listing__a");
      await assertSucceeds(fs.getDoc(target));
      await assertSucceeds(fs.setDoc(target,payload({listingId:"a",city:"",stateRegion:""})));
      await assertFails(fs.setDoc(target,payload({listingId:"a",city:"",stateRegion:""})));
      await assertSucceeds(fs.setDoc(fs.doc(owner,"hostGrowthRegistrations","owner__listing__c"),payload({listingId:"c",city:"",stateRegion:""})));
      await assertFails(fs.setDoc(fs.doc(owner,"hostGrowthRegistrations","owner__listing__b"),payload({listingId:"b",city:"",stateRegion:""})));
      await assertFails(fs.setDoc(fs.doc(owner,"hostGrowthRegistrations","owner__listing__missing"),payload({listingId:"missing",city:"",stateRegion:""})));
      await assertFails(fs.setDoc(fs.doc(owner,"hostGrowthRegistrations","random"),payload()));
    });
    await t.test("malformed fields, forbidden data, invalid timestamps, amounts, consent and permissions are denied",async()=>{
      const bad=[
        {bankAccount:"forbidden"},{ownerId:"other"},{schemaVersion:"1"},{pilotId:"other"},
        {city:""},{city:" ".repeat(20)},{city:"x".repeat(81)},{stateRegion:""},{stateRegion:123},
        {category:"loan"},{description:"short"},{description:" ".repeat(25)},{description:"x".repeat(1001)},
        {estimatedCostCents:0},{estimatedCostCents:10000001},{estimatedCostCents:"60000"},
        {requestedSupportCents:50001},{requestedSupportCents:-1},{requestedSupportCents:1.5},
        {estimatedCostCents:10,requestedSupportCents:20},{propertyPermission:false},
        {contactConsent:false},{contactEmail:"bad"},{contactEmail:"a".repeat(250)+"@x.test"},
        {status:"approved"},{createdAt:new Date(0)},
      ];
      // Clear only this fixture, with rules disabled, so every test exercises create rather than update denial.
      await env.withSecurityRulesDisabled(async context=>fs.deleteDoc(fs.doc(context.firestore(),"hostGrowthRegistrations","owner__proposed")));
      for(const overrides of bad)await assertFails(fs.setDoc(ref,payload(overrides)));
      const missing=payload();delete missing.contactEmail;
      await assertFails(fs.setDoc(ref,missing));
      await assertSucceeds(fs.setDoc(ref,payload({estimatedCostCents:1,requestedSupportCents:1})));
    });
    await t.test("real concurrent transactions create only one registration; retry never overwrites",async()=>{
      await env.withSecurityRulesDisabled(async context=>fs.setDoc(fs.doc(context.firestore(),"listings","d"),{hostId:"owner"}));
      const service=load("src/lib/host-growth-storage.ts",{
        "./host-growth":{...growth,HOST_GROWTH_INTAKE_ENABLED:true},
        "./firebase":{db:owner,auth:{currentUser:{uid:"owner"}}},
        "firebase/firestore":{...fs,runTransaction:(db,callback)=>fs.runTransaction(db,transaction=>callback({
          get:ref=>transaction.get(ref),
          // Normalize the VM realm's object prototype, preserving native serverTimestamp values.
          set:(ref,data)=>transaction.set(ref,Object.fromEntries(Object.entries(data))),
        }))},
      });
      const results=await Promise.all([
        service.saveGrowthRegistration("owner",valid({listingId:"d"})),
        service.saveGrowthRegistration("owner",valid({listingId:"d"})),
      ]);
      assert.deepEqual(results.sort(),["created","existing"]);
      assert.equal(await service.saveGrowthRegistration("owner",valid({listingId:"d",description:"A different project should not overwrite."})),"existing");
      const saved=await fs.getDoc(fs.doc(owner,"hostGrowthRegistrations","owner__listing__d"));
      assert.equal(saved.data().description,valid().description);
    });
  } finally {
    if(env)await env.cleanup();
  }
});
