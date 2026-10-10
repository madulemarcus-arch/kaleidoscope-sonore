// Faux RouterOS REST pour les tests : port 18080, utilisateur caisse / mot de passe secret
const http=require("http");let id=1;const users=new Map(),active=new Map();
active.set("*A1",{".id":"*A1",user:"VTEST1",address:"10.10.3.200","mac-address":"AA:BB:CC:00:11:22",uptime:"12m3s","bytes-in":"12000","bytes-out":"8500000"});
http.createServer((q,r)=>{let b="";q.on("data",c=>b+=c);q.on("end",()=>{
 const auth=q.headers.authorization||"";if(auth!=="Basic "+Buffer.from("caisse:secret").toString("base64")){r.writeHead(401);return r.end("{}")}
 const u=new URL(q.url,"http://x");const p=u.pathname;const J=(c,o)=>{r.writeHead(c,{"Content-Type":"application/json"});r.end(o===undefined?"":JSON.stringify(o))};
 if(p==="/rest/system/identity") return J(200,{name:"CISPOLstore-WiFiZone"});
 if(p==="/rest/ip/hotspot/user"&&q.method==="PUT"){const d=JSON.parse(b);if([...users.values()].some(x=>x.name===d.name))return J(400,{error:400,message:"Bad Request",detail:"failure: already have user with this name for this server"});if(!["Visiteur-6H","Jour-24H","Semaine-7J","Mois-30J"].includes(d.profile))return J(400,{error:400,detail:"input does not match any value of profile"});const i="*"+(id++).toString(16).toUpperCase();const o={".id":i,...d};users.set(i,o);return J(200,o)}
 if(p==="/rest/ip/hotspot/user"&&q.method==="GET"){const n=u.searchParams.get("name");return J(200,[...users.values()].filter(x=>!n||x.name===n))}
 if(p.startsWith("/rest/ip/hotspot/user/")&&q.method==="DELETE"){users.delete(decodeURIComponent(p.split("/").pop()));return J(204)}
 if(p==="/rest/ip/hotspot/active"&&q.method==="GET") return J(200,[...active.values()]);
 if(p.startsWith("/rest/ip/hotspot/active/")&&q.method==="DELETE"){active.delete(decodeURIComponent(p.split("/").pop()));return J(204)}
 J(404,{error:404})})}).listen(18080,()=>console.log("fake ok"));
process.on("SIGTERM",()=>{console.log("users on router:",users.size);process.exit(0)});
