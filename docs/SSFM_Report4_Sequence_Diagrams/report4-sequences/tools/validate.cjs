/* Independent checks of delivered source, control-flow branches and SVG numbers. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=path.resolve(__dirname,'..'),root=path.resolve(out,'../..');
const manifest=require('../manifest.json'),features=require('./features.json');
const errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg);};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceFiles=new Set(),allIds=new Set(manifest.diagrams.map(d=>d.id));
const featureDocs=manifest.diagrams.filter(d=>d.feature);
const roleOrder={Actor:0,UI:1,Controller:2,Service:3,'Supporting Service':4,PrismaService:5,Database:6,'External Service':7};
check(featureDocs.length===57&&features.length===57,'Expected exactly 57 Report 4 features');
for(const f of features){const d=featureDocs.find(d=>d.id===f.id);check(d&&d.title===f.title&&d.feature.section===f.section,'Report heading mismatch '+f.id);}
let messages=0,branches=0;
function parseInteraction(code){
 const tree=[],frames=[];let nodes=tree,note=false;
 for(const text of code.split('\n')){
  if(note){if(text==='end note')note=false;continue;}
  if(/^note (over|right|left)/.test(text)){if(!text.includes(' : '))note=true;continue;}
  const block=/^(alt|opt|loop|par|group|break) (.*)/.exec(text);
  if(block){const n={type:block[1],operands:[[]]};nodes.push(n);frames.push({node:n,parent:nodes});nodes=n.operands[0];continue;}
  if(/^else\b/.test(text)){const n=frames.at(-1)?.node;check(n&&['alt','par'].includes(n.type),'else without an alternative');if(n){n.operands.push([]);nodes=n.operands.at(-1);}continue;}
  if(text==='end'){const f=frames.pop();check(f,'Unmatched end');if(f)nodes=f.parent;continue;}
  nodes.push({type:'event',text});
 }
 check(!note&&!frames.length,'Unclosed note or fragment');return tree;
}
function verifyReplies(nodes,initial,file){
 let states=initial.map(s=>({stack:s.stack.map(p=>p.slice()),lastReply:s.lastReply}));
 const unique=xs=>[...new Map(xs.map(s=>[JSON.stringify(s),s])).values()];
 const callShapes=xs=>JSON.stringify([...new Set(xs.map(s=>JSON.stringify(s.stack)))].sort());
 for(const n of nodes){
  if(n.type==='event'){
   const m=/^(\w+) (->|-->>|->>) (\w+) : /.exec(n.text),close=/^deactivate (\w+)$/.exec(n.text);
   for(const state of states){const stack=state.stack;
    if(m?.[2]==='->'){stack.push([m[1],m[3]]);state.lastReply=null;}
    if(m?.[2]==='-->>'){
     const top=stack.at(-1);check(top&&top[0]===m[3]&&top[1]===m[1],`${file}: reply to wrong caller: ${n.text}`);
     if(top&&top[0]===m[3]&&top[1]===m[1])stack.pop();state.lastReply=m[1];
    }
    if(m?.[2]==='->>')state.lastReply=null;
    // A reply may be omitted when an execution ends and the caller resumes.
    if(close){if(stack.at(-1)?.[1]===close[1]&&state.lastReply!==close[1])stack.pop();state.lastReply=null;}
   }
  }else if(n.type==='group')states=verifyReplies(n.operands[0],states,file);
  else if(n.type==='alt')states=unique(n.operands.flatMap(operand=>verifyReplies(operand,states,file)));
  else if(n.type==='opt'||n.type==='loop'){
   const after=verifyReplies(n.operands[0],states,file);check(callShapes(after)===callShapes(states),`${file}: optional/loop body leaves an outstanding call`);states=unique([...states,...after]);
  }else if(n.type==='par'){
   for(const operand of n.operands){const after=verifyReplies(operand,states,file);check(callShapes(after)===callShapes(states),`${file}: parallel ref branch changes its caller stack`);}
  }
 }
 return states;
}
for(const d of manifest.diagrams){
 const file=d.id+'.puml',p=path.join(out,file);check(fs.existsSync(p),'Missing '+file);if(!fs.existsSync(p))continue;
 const code=fs.readFileSync(p,'utf8');check(code.startsWith('@startuml\n')&&code.trimEnd().endsWith('@enduml'),file+': bad envelope');
 check(code.includes('skinparam backgroundColor white'),file+': white background missing');
 check(!/^autonumber\b/m.test(code),file+': global autonumber would advance alternative steps');
 for(const s of d.sources){const q=path.join(root,s.file);sourceFiles.add(s.file);check(fs.existsSync(q),file+': missing source '+s.file);if(fs.existsSync(q)&&s.symbol)check(fs.readFileSync(q,'utf8').includes(s.symbol),file+': absent symbol '+s.symbol);}
 for(const ref of d.references)check(allIds.has(ref),file+': missing ref '+ref);
 const declarations=new Set([...code.matchAll(/^(?:actor|participant|boundary|control|database) "[^"\n]+" as (\w+)$/gm)].map(m=>m[1]));
 const roles=[...declarations].map(alias=>roleOrder[d.participants[alias]?.role]);
 check(roles.every((rank,i)=>rank!==undefined&&(i===0||rank>=roles[i-1])),file+': lifelines do not follow the requested layer order');
 if(declarations.has('P'))check(declarations.has('DB')&&/database "PostgreSQL" as DB/.test(code),file+': Prisma storage flow is missing PostgreSQL');
 if(declarations.has('DB'))check(/^P -> DB : /m.test(code)&&/^DB -->> P : /m.test(code),file+': database calls/replies must connect to PrismaService');
 const used=new Set(),activation=new Map(),numbers=[],branchNumbers=[];let note=false;
 for(const line of code.split('\n')){
  if(/^note (over|right|left)/.test(line)){for(const a of /^note (?:over|right|left) ([\w,]+)/.exec(line)?.[1].split(',')||[])used.add(a);if(!line.includes(' : '))note=true;continue;}
  if(line==='end note'){note=false;continue;}if(note||line.startsWith("'"))continue;
  const act=/^(activate|deactivate) (\w+)$/.exec(line);if(act){const count=(activation.get(act[2])||0)+(act[1]==='activate'?1:-1);activation.set(act[2],count);check(count>=0,file+': closed inactive execution '+act[2]);}
  const m=/^(\w+) (->|-->>|->>) (\w+) : (\d+(?:\.\d+)*)\. (.*)/.exec(line);
  if(m){messages++;used.add(m[1]);used.add(m[3]);check(declarations.has(m[1])&&declarations.has(m[3]),file+': undeclared message endpoint');numbers.push(m[4]);check(!/\b(?:this|prisma|dto)\.|\w+\.(?:create|findMany|findUnique)\(/.test(m[5]),file+': low-level expression in label');}
  if(/^\w+ -+>+ \w+ : /.test(line))check(!!m,file+': message without valid number/arrow');
  const ref=/^ref over ([\w,]+) : (\d+(?:\.\d+)*)\. /.exec(line);if(ref){numbers.push(ref[2]);for(const a of ref[1].split(',')){used.add(a);check(declarations.has(a),file+': undeclared ref lifeline');}}
  const condition=/^group (\d+(?:\.\d+)*)\. Evaluate conditions$/.exec(line);if(condition)numbers.push(condition[1]);
  const b=/^(?:alt|else|opt|loop|par|break) (\d+(?:\.\d+)+) /.exec(line);if(b){branchNumbers.push(b[1]);branches++;}
 }
 for(const [a,n] of activation)check(n===0,file+': execution remains open '+a);
 for(const a of declarations)check(used.has(a),file+': unused participant '+a);
 const all=[...numbers,...branchNumbers],set=new Set(all);check(set.size===all.length,file+': duplicate step numbers');
 const main=numbers.filter(n=>!n.includes('.')).map(Number);check(main.every((n,i)=>n===i+1),file+': main steps not sequential');
 const kids=new Map();for(const n of all.filter(n=>n.includes('.'))){const parent=n.slice(0,n.lastIndexOf('.'));check(set.has(parent),file+': missing parent '+parent);if(!kids.has(parent))kids.set(parent,[]);kids.get(parent).push(Number(n.slice(parent.length+1)));}
 for(const [p,k] of kids)check(k.sort((a,b)=>a-b).every((n,i)=>n===i+1),file+': nonsequential children of '+p);
 const final=verifyReplies(parseInteraction(code),[{stack:[],lastReply:null}],file);check(final.every(s=>!s.stack.length),file+': outstanding calls at the end');
 if(d.status!=='Existing workflow')check(code.includes('caption '+d.status),file+': proposed status not visible');
 if(process.argv.includes('--rendered')){
  const svgPath=path.join(out,'svg',d.id+'.svg');check(fs.existsSync(svgPath),file+': SVG missing');if(!fs.existsSync(svgPath))continue;
  const svg=fs.readFileSync(svgPath,'utf8');check(!/Syntax Error|An error has occurred|Activate\/Deactivate already|Assumed diagram type:/.test(svg),file+': PlantUML error image');
  check(!/<a\b/.test(svg),file+': unintended hyperlink in a guard');
  const rendered=[...svg.matchAll(/<text\b[^>]*>(\d+(?:\.\d+)*\.)(?: |<\/text>)/g)].map(m=>m[1].slice(0,-1));
  check(JSON.stringify(rendered.sort())===JSON.stringify(numbers.sort()),file+': rendered step numbers differ from source');
 }
}
const baselineArg=process.argv.indexOf('--baseline');let protectedCount=null;
if(baselineArg>=0){const baseline=JSON.parse(fs.readFileSync(process.argv[baselineArg+1],'utf8'));protectedCount=Object.keys(baseline.files).length;
 for(const [file,digest]of Object.entries(baseline.files))check(fs.existsSync(path.join(root,file))&&hash(path.join(root,file))===digest,'Application file changed: '+file);
 check(hash(manifest.report)===baseline.report,'Original Report 4 file changed');}
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exitCode=1;}else console.log(JSON.stringify({result:'PASS',reportFeatures:57,diagrams:manifest.diagrams.length,messages,branches,sourceFiles:sourceFiles.size,replyOrdering:'PASS',numbering:'PASS',rendered:process.argv.includes('--rendered'),unchangedApplicationFiles:protectedCount},null,2));
