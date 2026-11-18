/* Documentation-only generator. Reads source; writes only docs/report4-sequences. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.resolve(__dirname,'..');
const features=require('./features.json');
const {define}=require('./flows.cjs');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const classes=new Map(),endpoints=[];
for(const file of walk(path.join(root,'backend/src')).filter(p=>p.endsWith('.ts')&&!p.endsWith('.spec.ts'))){
 const code=fs.readFileSync(file,'utf8'),name=/export class (\w+)/.exec(code)?.[1];if(!name)continue;
 const declarations=[...code.matchAll(/^  (?:(?:private|public|protected|static|async) )*(\w+)\s*\(/gm)];
 classes.set(name,{file:path.relative(root,file).replaceAll('\\','/'),code,methods:Object.fromEntries(declarations.map((m,i)=>[m[1],{line:code.slice(0,m.index).split('\n').length,body:code.slice(m.index,declarations[i+1]?.index)}]))});
 if(!file.endsWith('.controller.ts'))continue;
 const prefix=/@Controller\('([^']*)'\)/.exec(code)?.[1]||'';
 const deps=Object.fromEntries([...code.matchAll(/private\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g)].map(m=>[m[1],m[2]]));
 const routes=[...code.matchAll(/^  @(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/gm)];
 routes.forEach((r,i)=>{const block=code.slice(r.index,routes[i+1]?.index),handler=/^  (?:async )?(\w+)\s*\(/m.exec(block)?.[1];
  for(const call of block.matchAll(/this\.(\w+)\.(\w+)\s*\(/g))if(deps[call[1]])endpoints.push({controller:name,handler,service:deps[call[1]],method:call[2],route:r[1].toUpperCase()+' /api/'+[prefix,r[2]].filter(Boolean).join('/')});});
}
const style=`hide footbox
skinparam backgroundColor white
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam sequenceMessageAlign left
skinparam maxMessageSize 170
skinparam ParticipantPadding 16
skinparam sequence {
 ArrowColor #202020
 LifeLineBorderColor #777777
 ParticipantBackgroundColor white
 ParticipantBorderColor #202020
 ActorBackgroundColor white
 ActorBorderColor #202020
 ActivationBackgroundColor white
 GroupBackgroundColor white
 GroupBorderColor #444444
 ReferenceBackgroundColor white
}
skinparam NoteBackgroundColor #FFFFF0
skinparam NoteBorderColor #777777
`;
const docs=[],objects=new Map();
const implementedIntegrations=new Set(['FastAPI AI Service','RAGService','VectorStoreService','DriveSyncService','EmbeddingService','ChunkingService','OpenAI API','Google Drive API','Google Identity','SMTP Server','Open-Meteo']);
const externalParticipants=new Set(['FastAPI AI Service','OpenAI API','Google Drive API','Google Identity','SMTP Server','Open-Meteo','Expo Push Service','FCM / APNs','Print Dialog']);
const roleOrder={Actor:0,UI:1,Controller:2,Service:3,'Supporting Service':4,PrismaService:5,Database:6,'External Service':7};
function participantRole(alias,p,d){
 if(p.type==='actor')return 'Actor';if(alias==='UI')return 'UI';
 if(alias==='C'||p.name.endsWith('Controller'))return 'Controller';
 if(alias===d.s||alias==='S')return 'Service';
 if(alias==='P'||p.name==='PrismaService')return 'PrismaService';
 if(p.type==='database'||['PostgreSQL','ChromaDB'].includes(p.name))return 'Database';
 if(externalParticipants.has(p.name))return 'External Service';
 return 'Supporting Service';
}
class Diagram{
 constructor(id,title,actor='User',feature=null){this.id=id;this.title=title;this.actor=actor;this.feature=feature;this.parts=new Map();this.nodes=[];this.current=this.nodes;this.failures=[];this.sources=[];this.routes=[];this.references=[];this.assumptions=[];this.status='Existing workflow';this.proposal=false;
  this.part('U',actor,'actor','Initiates the selected workflow.');this.part('UI','SSFM Interface','participant','Collects user input and displays the result; no platform distinction.');}
 part(alias,name,type='participant',responsibility='',proposed=false){if(!this.parts.has(alias))this.parts.set(alias,{name,type,responsibility,proposed});return alias;}
 add(node){this.current.push({...node,proposed:this.proposal});}
 msg(from,to,label,arrow='->'){this.add({type:'message',from,to,label,arrow});}
 activate(alias){this.add({type:'activate',alias});}
 deactivate(alias){this.add({type:'deactivate',alias});}
 note(who,text){this.add({type:'note',who,text});}
 use(className,method){const c=classes.get(className);if(!c)throw new Error(this.id+': unknown source class '+className);if(method&&!c.methods[method])throw new Error(this.id+': unknown method '+className+'.'+method);
  const line=method?c.methods[method].line:c.code.slice(0,c.code.indexOf('export class')).split('\n').length;
  if(!this.sources.some(s=>s.file===c.file&&s.symbol===(method||className)))this.sources.push({file:c.file,symbol:method||className,line});}
 file(file,symbol=''){if(!fs.existsSync(path.join(root,file)))throw new Error('Source absent: '+file);const code=fs.readFileSync(path.join(root,file),'utf8');if(symbol&&!code.includes(symbol))throw new Error('Symbol absent: '+file+' '+symbol);this.sources.push({file,symbol,line:symbol?code.slice(0,code.indexOf(symbol)).split('\n').length:1});}
 block(type,guard,fn){const parent=this.current,node={type,guard,nodes:[]};this.add(node);this.current=node.nodes;fn();this.current=parent;}
 opt(guard,fn){this.block('opt',guard,fn);}
 loop(guard,fn){this.block('loop',guard,fn);}
 group(label,fn){this.block('group',label,fn);}
 proposed(label,fn){if(this.status!=='Proposed design')this.status='Existing + proposed extension';const previous=this.proposal;this.proposal=true;this.note(this.s||'UI','Proposed extension: '+label+'.');fn();this.proposal=previous;}
 choice(choices){const parent=this.current,node={type:'alt',branches:[]};this.add(node);for(const [guard,fn]of choices){const branch={guard,nodes:[]};node.branches.push(branch);this.current=branch.nodes;fn();}this.current=parent;}
 parallel(choices){const parent=this.current,node={type:'par',branches:[]};this.add(node);for(const [guard,fn]of choices){const branch={guard,nodes:[]};node.branches.push(branch);this.current=branch.nodes;fn();}this.current=parent;}
 fail(guard,result='Request rejected',origin=this.s){const parent=this.current,error=[],valid=[],node={type:'reject',guard,error,valid};this.add(node);this.current=error;this.msg(origin,origin===this.s?this.c:'UI',result,'-->>');this.failures.push(parent);this.current=valid;}
 closeFailures(){while(this.failures.length)this.current=this.failures.pop();}
 call(to,name,label,result='Result',from=this.s,fn){this.part(to,name,'participant','Performs the supporting action shown in its messages.',this.proposal&&!classes.has(name)&&!implementedIntegrations.has(name));
  this.msg(from,to,label);this.activate(to);if(fn)fn();this.msg(to,from,result,'-->>');this.deactivate(to);}
 data(label,result='Records',method=''){
  this.part('P','PrismaService','participant','Translates the storage operation into PostgreSQL access.');
  this.part('DB','PostgreSQL','database','Stores and returns the requested application records.');
  this.use('PrismaService');if(method)this.use(this.service,method);
  this.call('P','PrismaService',label,result,this.s,()=>this.call('DB','PostgreSQL',label,result,'P'));
 }
 access(manage=false,scope=false){this.use('FarmAccessService',scope?'getAccessibleFarmIds':manage?'assertCanManageFarm':'assertCanAccessFarm');
  this.call('FA','FarmAccessService',scope?'Find accessible farms':manage?'Check farm management rights':'Check farm access',scope?'Accessible farms':'Allowed or denied');if(!scope)this.fail('Access denied','Access denied');}
 notify(label,method,guard){if(method)this.use('NotificationsService',method);const fn=()=>this.call('N','NotificationsService',label,'Notification result');if(guard)this.opt(guard,fn);else fn();}
 ref(target,label,who='UI'){this.references.push(target);this.add({type:'ref',target,label,who});}
 background(label,method,target){this.use(this.service,method);this.msg(this.s,this.s,label);this.activate(this.s);this.msg(this.s,this.s,'Task started; completion not awaited','-->>');this.deactivate(this.s);this.references.push(target);this.note(this.s,'Background details: '+target+'\nCompletion is independent of the request response.');}
 request(controller,service,method,action,body,result='Result',opts={}){
  this.c='C';this.s='S';this.service=service;this.failures=[];
  const proposed=opts.proposed||!classes.has(controller)||!method;
  this.part('C',controller,'participant','Handles the selected request; the endpoint boundary includes NestJS request checks.',!classes.has(controller));
  this.part('S',service,'participant','Applies the feature rules and coordinates storage or supporting services.',!classes.has(service));
  if(classes.has(controller))this.use(controller);if(classes.has(service))this.use(service,method||undefined);
  if(method){const route=endpoints.find(e=>e.controller===controller&&e.service===service&&e.method===method);if(route)this.routes.push(route);}
  if(proposed)this.status=opts.wholly?'Proposed design':'Existing + proposed extension';
  if(!opts.automatic)this.msg('U','UI',action);this.activate('UI');this.msg('UI','C',action);this.activate('C');
  this.ref(opts.checks||(opts.public?'PUBLIC-CHECKS':'REQUEST-CHECKS'),opts.public?'Validate request':'Verify user, role and input','C');
  this.fail(opts.public?'Invalid request':'Request not allowed','Request rejected','C');const requestFrames=this.failures;this.failures=[];
  if(opts.before)opts.before();
  this.msg('C','S',opts.serviceAction||action);this.activate('S');body();this.msg('S','C',result,'-->>');this.closeFailures();this.deactivate('S');
  this.msg('C','UI','Return result or error','-->>');this.failures=requestFrames;this.closeFailures();this.deactivate('C');
  if(!opts.automatic)this.msg('UI','U',opts.display||'Show result or error','-->>');this.deactivate('UI');
 }
 overview(options){this.msg('U','UI','Choose an action');this.activate('UI');this.msg('UI','U','Show the selected form or view','-->>');this.deactivate('UI');
  this.choice(options.map(([guard,target,label])=>[guard,()=>this.ref(target,label,'U,UI')]));}
}
function render(d){let output=[],numbers=[];const state=prefix=>({prefix,counter:0,last:null,branches:new Map()});
 const next=s=>(s.last=(s.prefix?s.prefix+'.':'')+(++s.counter));
 const child=(s,a)=>{const n=(s.branches.get(a)||0)+1;s.branches.set(a,n);return a+'.'+n;};
 const emit=(nodes,s)=>{for(const n of nodes){
  if(n.type==='message'){const number=next(s);numbers.push({number,kind:'message',from:n.from,to:n.to,label:n.label,arrow:n.arrow,proposed:n.proposed});output.push(`${n.from} ${n.arrow} ${n.to} : ${number}. ${n.label}`);}
  else if(n.type==='activate'||n.type==='deactivate')output.push(n.type+' '+n.alias);
  else if(n.type==='note')output.push(`note over ${n.who}\n${n.text}\nend note`);
  else if(n.type==='ref'){const number=next(s);numbers.push({number,kind:'ref',target:n.target,label:n.label});output.push(`' ref-target: ${n.target}`,`ref over ${n.who} : ${number}. ${n.label}\\n(${n.target})`);}
  else if(n.type==='group'){output.push('group '+n.guard);emit(n.nodes,s);output.push('end');}
  else{
   let initial=false;if(!s.last){const number=next(s);numbers.push({number,kind:'condition'});output.push(`group ${number}. Evaluate conditions`);initial=true;}
   const anchor=s.last;
   if(n.type==='reject'){const number=child(s,anchor);numbers.push({number,kind:'branch',anchor,guard:n.guard});output.push('alt '+number+' '+n.guard);emit(n.error,state(number));output.push('else else');emit(n.valid,s);output.push('end');}
   else if(n.type==='alt'||n.type==='par'){n.branches.forEach((b,i)=>{const number=child(s,anchor);numbers.push({number,kind:'branch',anchor});output.push((i?'else ':n.type+' ')+number+' '+b.guard);emit(b.nodes,state(number));});output.push('end');}
   else{const number=child(s,anchor);numbers.push({number,kind:'branch',anchor});output.push(n.type+' '+number+' '+n.guard);emit(n.nodes,state(number));output.push('end');}
   if(initial)output.push('end');
  }
 }};emit(d.nodes,state(''));
 const used=new Set();const visit=nodes=>{for(const n of nodes){if(n.type==='message'){used.add(n.from);used.add(n.to);}if(n.type==='note'||n.type==='ref')for(const a of n.who.split(','))used.add(a);if(n.nodes)visit(n.nodes);if(n.error){visit(n.error);visit(n.valid);}if(n.branches)for(const b of n.branches)visit(b.nodes);}};visit(d.nodes);
 d.parts=new Map([...d.parts].filter(([a])=>used.has(a)));
 for(const [alias,p]of d.parts){p.role=participantRole(alias,p,d);if(p.role==='Database')p.type='database';}
 d.parts=new Map([...d.parts].sort((a,b)=>roleOrder[a[1].role]-roleOrder[b[1].role]));
 const names=[...d.parts].map(([a,p])=>`${p.type} "${p.name}${p.proposed?'\\n(proposed)':''}" as ${a}`).join('\n');
 const badge=d.status==='Existing workflow'?'':'caption '+d.status+' - target design, not a claim of complete implementation\n';
 const code=`@startuml\n' Report 4: ${d.feature?.section||'supporting interaction'}\ntitle ${d.id} - ${d.title}\n${style}${names}\n${badge}${output.join('\n')}\n' Source references:\n${d.sources.map(s=>`' ${s.file}:${s.line} ${s.symbol}`).join('\n')}\n@enduml\n`;
 return {code,numbers};
}
function add(id,title,actor,fn,feature=null){const d=new Diagram(id,title,actor,feature);fn(d);const r=render(d);objects.set(id,d);fs.writeFileSync(path.join(out,id+'.puml'),r.code);docs.push({id,title,actor,status:d.status,feature,sources:d.sources,routes:d.routes,participants:Object.fromEntries(d.parts),references:[...new Set(d.references)],assumptions:d.assumptions,numbers:r.numbers});return d;}
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'svg'),{recursive:true});
define({features,add,classes,root});
if(docs.filter(d=>d.feature).length!==57)throw new Error('Expected exactly 57 Report 4 feature diagrams');
for(const d of docs)for(const ref of d.references)if(!docs.some(x=>x.id===ref))throw new Error(d.id+': missing interaction '+ref);
let changed=true;while(changed){changed=false;for(const d of docs)if(d.status==='Existing workflow'&&d.references.some(id=>docs.find(x=>x.id===id).status!=='Existing workflow')){d.status='Existing + proposed extension';objects.get(d.id).status=d.status;changed=true;}}
for(const d of docs){const diagram=objects.get(d.id),r=render(diagram);fs.writeFileSync(path.join(out,d.id+'.puml'),r.code);d.numbers=r.numbers;d.participants=Object.fromEntries(diagram.parts);}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({basis:'Target design from Report 4, with implemented basis and proposed gaps distinguished by user instruction.',report:'D:/Report4_Software Design Document (1).docx',features:features.length,diagrams:docs},null,2)+'\n');
require('./guide.cjs')({fs,path,out,docs,features});
console.log(JSON.stringify({features:57,diagrams:docs.length,proposed:docs.filter(d=>d.status!=='Existing workflow').length}));
