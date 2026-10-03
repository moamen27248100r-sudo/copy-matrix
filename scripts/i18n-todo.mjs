// Prints, for each key still English in some locale: key | en value | locales
import fs from "node:fs"; import path from "node:path";
const dir="src/messages";
const flat=(o,p="",out={})=>{for(const [k,v] of Object.entries(o)){const key=p?p+"."+k:k; if(v&&typeof v==="object")flat(v,key,out); else out[key]=v;} return out;};
const en=flat(JSON.parse(fs.readFileSync(dir+"/en.json","utf8")));
const allow=fs.existsSync("scripts/i18n-allow.json")?JSON.parse(fs.readFileSync("scripts/i18n-allow.json","utf8")):{};
const filter=process.argv[2]?new RegExp(process.argv[2]):null;
const map={};
for(const f of fs.readdirSync(dir)){ if(f==="en.json")continue; const loc=f.replace(".json",""); const d=flat(JSON.parse(fs.readFileSync(path.join(dir,f),"utf8")));
 for(const k of Object.keys(en)){ if(/\.keywords\.\d+$/.test(k))continue; if((d[k]===en[k]||!(k in d))&&/\p{L}{3,}/u.test(String(en[k]))&&!(allow[loc]||[]).includes(k)){ (map[k]??=[]).push(loc);} } }
for(const [k,l] of Object.entries(map)){ if(filter&&!filter.test(k))continue; console.log(k+" | "+JSON.stringify(en[k])+" | "+l.join(",")); }
