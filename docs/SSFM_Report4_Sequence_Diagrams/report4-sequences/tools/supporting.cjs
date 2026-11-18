module.exports=({add})=>{
 const start=(x,name,alias='S')=>{x.part(alias,name,'participant');x.s=alias;x.service=name;x.activate(alias);};
 const end=x=>x.deactivate(x.s);
 const scoped=(x,manage=false)=>x.call('FA','FarmAccessService',manage?'Check farm management rights':'Check farm access','Allowed or denied');
 add('PUBLIC-CHECKS','Validate a public request','User',x=>{
  start(x,'NestJS request pipeline','A');x.file('backend/src/main.ts','ValidationPipe');x.file('backend/src/app.module.ts','ThrottlerGuard');
  x.call('T','ThrottlerGuard','Check request rate','Allowed or rate limit exceeded','A');
  x.opt('Rate allowed',()=>x.call('V','ValidationPipe','Validate declared input rules','Valid input or input error','A'));end(x);
 });
 add('SIGNOUT-CHECKS','Validate a sign-out request','User',x=>{
  start(x,'AuthController','A');x.use('AuthController','assertCsrfHeader');x.ref('PUBLIC-CHECKS','Validate request rate and declared input','A');
  x.opt('Session credential not explicitly supplied',()=>x.call('A','AuthController','Check request origin','Allowed or request origin rejected','A'));end(x);
 });
 add('REQUEST-CHECKS','Check a protected request','User',x=>{
  start(x,'NestJS request pipeline','A');x.use('JwtAuthGuard');x.use('JwtStrategy','validate');x.use('UsersService','findById');x.use('RolesGuard','canActivate');
  x.file('backend/src/main.ts','ValidationPipe');x.file('backend/src/app.module.ts','ThrottlerGuard');
  x.call('T','ThrottlerGuard','Check request rate','Allowed or limit exceeded','A');
  x.opt('Rate allowed',()=>{
   x.call('G','JwtAuthGuard','Authenticate request','Current user or authentication error','A',()=>{
    x.choice([['Session credentials invalid',()=>x.note('G','Reject the request before identity loading.')],['Session credentials valid',()=>{
     x.call('J','JwtStrategy','Load current user identity','Active identity or authentication error','G',()=>
      x.call('US','UsersService','Find user and account status','Current user or none','J'));
    }]]);
   });
   x.opt('Authenticated active user',()=>{
    x.call('R','RolesGuard','Check endpoint role restriction','Role allowed or access denied','A');
    x.opt('Role allowed or no role restriction',()=>x.call('V','ValidationPipe','Validate declared input rules','Valid request or input error','A'));
   });
  });end(x);x.assumptions.push('This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.');
 });
 add('CHECK-INVITATION','Validate a farm invitation','User',x=>{
  start(x,'AuthService');x.use('AuthService','register');x.call('JWT','JwtService','Verify invitation','Verified invitation or invalid');
  x.choice([['Invitation identity and role match',()=>x.note('S','Continue with the invitation role.')],['Invitation invalid',()=>x.note('S','Return an invitation error; account creation does not run.')]]);end(x);
 });
 add('JOIN-FARM','Join a farm through an invitation','User',x=>{
  start(x,'AuthService');x.use('AuthService','register');x.use('AuthService','login');x.use('AuthService','loginWithGoogle');
  x.opt('Invitation not yet verified by the caller',()=>x.call('JWT','JwtService','Verify invitation for this account','Valid or invalid invitation'));
  x.opt('Invitation valid',()=>{
   x.opt('Sign-in path and invited role differs; account is not Admin',()=>x.data('Update invited user role','User role aligned'));
   x.data('Load invited farm','Farm or none');x.opt('Farm exists',()=>{
    x.data('Load previous assignment','Previous farm membership');x.data('Activate or create farm assignment','Active membership');
    x.opt('New or reactivated membership',()=>{
     x.notify('Notify the joining user','createFarmJoinNotification');x.notify('Notify farm owner','createStaffJoinedNotification','Owner differs from joining user');
    });
   });
  });end(x);
  x.assumptions.push('Registration validates before creating the user and catches later join failures. Email sign-in rethrows invitation validation errors but catches other join errors. Google sign-in catches invitation errors. The enclosing caller determines the error outcome.');
 });
 for(const [id,manage]of [['FARM-SCOPE-CHECK',false],['MANAGE-SCOPE-CHECK',true]])add(id,manage?'Check farm management scope':'Check farm access scope','Farm User',x=>{
  start(x,'FarmAccessService');x.use('FarmAccessService',manage?'assertCanManageFarm':'assertCanAccessFarm');
  x.choice([['Admin',()=>x.note('S','Farm scope is unrestricted.')],['Farm Manager',()=>x.data('Load owned, active farm','Owned farm or none')],['Assigned Farmer or Technician',()=>{
   if(manage)x.note('S','Reject: management requires a Farm Manager or Admin.');else x.data('Load active farm assignments','Assigned farms');
  }]]);end(x);
 });
 add('WATER-HISTORY-FILTERS','Select water history scope','Farm User',x=>{
  start(x,'WaterQualityService');x.use('WaterQualityService','findHistory');
  x.choice([['Crop selected',()=>{x.data('Load crop and linked season ponds','Crop or none');x.opt('Crop exists',()=>scoped(x));}],
   ['Pond selected without crop',()=>{x.data('Load pond','Pond or none');x.opt('Pond exists',()=>scoped(x));}],
   ['Farm selected without pond or crop',()=>{x.data('Load farm','Farm or none');x.opt('Farm exists',()=>scoped(x));}],
   ['No specific selection',()=>x.note('S','Use accessible farm IDs already obtained by the caller.')]]);
  x.note('S','Missing selected records or denied access return an error.\nAllowed selections define the period and pagination.');end(x);
 });
 add('WATER-TREND-FILTERS','Select water trend scope','Farm User',x=>{
  start(x,'WaterQualityService');x.use('WaterQualityService','findTrends');
  x.choice([['Single pond selected',()=>{x.data('Load selected pond','Pond or none');x.opt('Pond exists',()=>scoped(x));}],
   ['Crop selected without single pond',()=>{x.data('Load crop and linked season','Crop or none');x.opt('Crop exists',()=>scoped(x));}],
   ['Farm selected without pond or crop',()=>scoped(x)],['No selected scope',()=>x.call('FA','FarmAccessService','Find accessible farms','Accessible farms')]]);
  x.opt('Crop selected',()=>x.data('Load crop dates and season links','Time window or none'));end(x);
  x.assumptions.push('A missing selected pond is rejected. Current trend code tolerates a missing crop rather than always returning not found.');
 });
 add('GROWTH-SCOPE','Resolve growth analysis scope','Farm User',x=>{
  start(x,'CropsService');x.use('CropsService','getGrowthTrajectory90d');
  x.opt('No selected farm and no accessible farm ID',()=>x.data('Find first available farm','Farm or none'));
  x.opt('Target farm available',()=>{
   scoped(x);x.opt('Access allowed',()=>{x.data('Load target farm','Farm details');x.opt('Specific pond selected',()=>{x.data('Load pond','Pond or none');x.opt('Pond exists',()=>x.data('Find crop for selected pond and period','Selected crop or none'));});});
  });end(x);
 });
 for(const [id,className,method,notify]of [
  ['WATER-NOTIFICATION','WaterQualityService','dispatchWaterQualityNotification','notifyWaterQualityUpdate'],
  ['HEALTH-NOTIFICATION','ShrimpHealthService','dispatchShrimpHealthNotification','notifyShrimpHealthUpdate'],
  ['GROWTH-NOTIFICATION','ShrimpSizeService','dispatchGrowthNotification','notifyGrowthUpdate']
 ])add(id,'Background '+id.toLowerCase().replaceAll('-',' '),'User',x=>{
  start(x,className);x.use(className,method);x.use('NotificationsService',notify);
  x.note('S','Continuation of a task already started by the request.\nIt does not delay the user confirmation.');
  if(id==='GROWTH-NOTIFICATION')x.data('Load pond and recipient context','Farm, owner, staff and recorder');
  else x.data('Load active recipient assignments','Staff recipients; owner supplied by caller');
  x.opt('Recipients exist',()=>{
   if(id==='GROWTH-NOTIFICATION')x.call('S','ShrimpSizeService','Analyze current feed conversion','Feed conversion or unavailable');
   x.note('S',id==='WATER-NOTIFICATION'?'Classify water condition as normal, warning or danger.':id==='HEALTH-NOTIFICATION'?'Classify health observations by severity.':'Classify growth, survival and feed conversion.');
   x.call('N','NotificationsService','Create and deliver observation notification','Created notifications','S',()=>x.ref('NOTIFICATION-DELIVERY','Save and deliver notifications','N'));
   if(id==='HEALTH-NOTIFICATION')x.opt('Current health observation is dangerous',()=>{
    x.data('Load three most recent health observations','Recent health observations');
    x.opt('Three consecutive critical observations',()=>x.call('N','NotificationsService','Send repeated critical health warning','Created warning','S',()=>x.ref('NOTIFICATION-DELIVERY','Save and deliver warning','N')));
   });
  });end(x);
 });
 add('NOTIFICATION-DELIVERY','Save and deliver an in-app notification','User',x=>{
  start(x,'NotificationsService','N');x.use('NotificationsService','notifyWaterQualityUpdate');x.use('NotificationsService','notifyShrimpHealthUpdate');x.use('NotificationsService','notifyGrowthUpdate');x.use('NotificationsGateway','sendNotificationToUser');
  x.data('Save and load notifications','Created notifications');
  x.loop('Each recipient',()=>{
   x.part('GW','NotificationsGateway');x.msg('N','GW','Deliver saved notification');x.activate('GW');x.msg('GW','UI','New notification','->>');x.activate('UI');x.deactivate('GW');
   x.msg('UI','U','Show notification and unread indicator','->>');x.deactivate('UI');
  });end(x);
 });
 add('MOBILE-PUSH','Planned notification delivery while disconnected','User',x=>{
  x.status='Proposed design';x.proposal=true;start(x,'NotificationsService','N');x.use('NotificationsService');
  x.call('EX','Expo Push Service','Request push delivery','Request accepted or rejected','N');end(x);
  x.part('FCM','FCM / APNs','participant','Delivers the accepted alert to the device.',true);
  x.opt('Push request accepted',()=>{
   x.msg('EX','FCM','Forward notification','->>');x.activate('FCM');
   x.msg('FCM','UI','Deliver device notification','->>');x.activate('UI');x.deactivate('FCM');x.msg('UI','U','Show device alert','->>');x.deactivate('UI');
  });x.assumptions.push('Report 4 section 1.1.2.10 proposes this channel. Device registration, consent, retries and final delivery guarantees require specification; an accepted push request does not guarantee delivery.');
 });
 add('CHAT-INVENTORY','Prepare authorized inventory context for advice','Farm User',x=>{
  start(x,'ChatbotService');x.use('ChatbotService','ask');
  x.opt('Pond context identifies a farm',()=>x.data('Load the pond farm association','Target farm'));
  x.opt('No target farm yet',()=>{x.call('FA','FarmAccessService','Find accessible farms','Accessible farms');x.opt('No accessible farm found',()=>x.data('Find farm owned by or assigned to user','User farm or none'));});
  x.opt('Target farm found',()=>x.data('Load available medicines and chemicals','Inventory context'));end(x);
 });
 add('RAG-ANSWER','Prepare an answer with retrieved knowledge','Farm User',x=>{
  start(x,'RAGService','AI');x.file('ai-service/app/services/rag_service.py','def ask');x.file('ai-service/app/services/vector_store.py','similarity_search');
  x.opt('Question is not a greeting',()=>x.proposed('Planned ChromaDB retrieval',()=>x.call('VS','VectorStoreService','Find relevant knowledge passages','Matching passages','AI',()=>x.call('CH','ChromaDB','Search indexed passages','Matching passages','VS'))));
  x.choice([['OpenAI configured and usable',()=>{
   x.call('OA','OpenAI API','Generate answer using question and context','Answer or service error','AI');
   x.opt('Completion request fails',()=>x.note('AI','Prepare the source-defined fallback answer.'));
  }],['OpenAI unavailable',()=>x.note('AI','Prepare the source-defined fallback answer.')]]);
  end(x);x.assumptions.push('Current Python retrieval uses vector_store.json. ChromaDB is the planned store in Report 4 and is explicitly proposed here.');
 });
 add('CHAT-FALLBACK','Prepare advice when the Python service fails','Farm User',x=>{
  start(x,'ChatbotService');x.use('ChatbotService','ask');x.use('ChatbotService','getEmbedding');x.use('ChatbotService','buildFallbackResponse');
  x.opt('Question is not a greeting',()=>{x.data('Load backend knowledge passages','Stored passages');x.note('S','Rank the relevant passages for the question.');});
  x.choice([['OpenAI available',()=>{x.call('OA','OpenAI API','Generate answer from available context','Answer or service error');x.opt('Completion request fails',()=>x.note('S','Build a local fallback answer.'));}],['OpenAI unavailable',()=>x.note('S','Build a local fallback answer.')]]);end(x);
 });
 add('KNOWLEDGE-INDEX','Build the planned knowledge index','Authorized User',x=>{
  x.status='Proposed design';x.proposal=true;start(x,'FastAPI AI Service','AI');x.file('ai-service/app/services/vector_store.py','add_document');x.file('ai-service/app/services/embedding_service.py','get_embedding');
  x.call('VS','VectorStoreService','Index document text','Indexed document','AI',()=>{
   x.call('CHUNK','ChunkingService','Divide document into passages','Text passages','VS');
   x.loop('Each passage',()=>x.call('E','EmbeddingService','Create passage embedding','Passage embedding','VS'));
   x.call('CH','ChromaDB','Save searchable passages and document links','Saved index','VS');
  });end(x);
  x.assumptions.push('The current chunking/embedding workflow is the basis. The ChromaDB persistence and automatic NestJS-to-Python synchronization are target extensions.');
 });
 add('DRIVE-IMPORT','Import changed knowledge documents from Drive','Authorized User',x=>{
  start(x,'FastAPI AI Service','AI');x.file('ai-service/app/services/drive_sync_service.py','sync_folder');
  x.call('D','DriveSyncService','Synchronize selected folder','Synchronization summary','AI',()=>{
   x.call('G','Google Drive API','List folder documents','Document metadata','D');
   x.loop('Supported document is new, changed or forced',()=>{
    x.call('G','Google Drive API','Download document contents','Document text','D');x.ref('KNOWLEDGE-INDEX','Create searchable document passages','D');
   });
   x.opt('Prune deleted documents requested',()=>x.call('VS','VectorStoreService','Remove documents deleted from Drive','Pruning result','D'));
  });end(x);
 });
 const auto={automatic:true};
 add('OVERVIEW-DATA','Load scoped farm and pond overview','Farm User',x=>x.request('PondsController','PondsService','findOverview','Load pond overview',()=>{
  x.data('Load farms, ponds and latest crops using direct role filters','Farm and pond overview');
 },'Overview',auto));
 add('MANAGER-SUMMARY','Load harvest performance for the manager','Farm Manager',x=>x.request('CropsController','CropsService','getManagerSummary','Load harvest performance',()=>{
  x.fail('Year or quarter invalid','Invalid reporting period');x.opt('Specific farm selected',()=>x.ref('FARM-SCOPE-CHECK','Check selected farm access','S'));x.fail('Farm access denied','Access denied');x.access(false,true);
  x.data('Load harvested crops for current and previous periods','Harvested crops');
 },'Harvest, revenue, cost, profit and survival summary',auto));
 add('MANAGER-WATER','Load recent manager water trends','Farm Manager',x=>x.request('WaterQualityController','WaterQualityService','getManagerTrends','Load environmental trend summary',()=>{
  x.opt('Specific farm selected',()=>x.ref('FARM-SCOPE-CHECK','Check selected farm access','S'));x.fail('Farm access denied','Access denied');x.access(false,true);
  x.data('Load recent records and latest pond observations','Daily averages and latest pond status');
 },'Environmental trend summary',auto));
 add('INCIDENT-LIST','Load incidents visible to the user','Farm User',x=>x.request('IncidentsController','IncidentsService','findAll','Load incidents',()=>{
  x.access(false,true);x.opt('Farm, pond or crop selected',()=>x.ref('INCIDENT-FILTERS','Check selected incident scope','S'));x.fail('Selected scope invalid or inaccessible','Incident scope rejected');x.data('Load matching incidents and total','Incidents');
 },'Incident list',auto));
 add('INCIDENT-FILTERS','Resolve incident season and farm filters','Farm User',x=>{
  start(x,'IncidentsService');x.use('IncidentsService','findAll');
  x.opt('Farm selected',()=>scoped(x));x.opt('Pond selected',()=>{x.data('Load selected pond','Pond or none');x.opt('Pond exists',()=>scoped(x));});
  x.opt('Crop selected',()=>{x.data('Load crop and farm','Crop or none');x.opt('Crop exists',()=>{scoped(x);x.opt('Access allowed',()=>x.data('Load root and child crop IDs','Season crop IDs'));});});end(x);
 });
 add('FEEDING-LIST','Load grouped daily feeding records','Farmer',x=>x.request('FeedingLogsController','FeedingLogsService','findAllGrouped','Load daily feeding records',()=>{
  x.access(false,true);x.opt('Accessible farm scope is not empty',()=>{
   x.opt('Specific farm selected',()=>x.ref('FARM-SCOPE-CHECK','Check selected farm access','S'));
   x.opt('Crop filter supplied',()=>x.data('Load crop and related season IDs','Season scope'));
   x.data('Group daily records and load sessions','Daily feeding groups');
  });
 },'Grouped daily logs or empty result',auto));
 add('HEALTH-LIST','Load shrimp health observations','Farm User',x=>x.request('ShrimpHealthController','ShrimpHealthService','findHistory','Load health observations',()=>{
  x.access(false,true);x.ref('HEALTH-FILTERS','Apply selected pond or farm','S');x.fail('Scope missing or access denied','Health scope rejected');x.data('Load matching observations and total','Health history');
 },'Health observations',auto));
 add('HEALTH-FILTERS','Select shrimp health history scope','Farm User',x=>{
  start(x,'ShrimpHealthService');x.use('ShrimpHealthService','findHistory');
  x.choice([['Pond selected',()=>{x.data('Load pond','Pond or none');x.opt('Pond exists',()=>scoped(x));}],['Farm selected without pond',()=>{x.data('Load farm','Farm or none');x.opt('Farm exists',()=>scoped(x));}],['No specific scope',()=>x.note('S','Use the accessible farm IDs already loaded.')]]);end(x);
 });
 add('GROWTH-DATA','Load growth series for a dashboard','Technician',x=>x.request('CropsController','CropsService','getGrowthTrajectory90d','Load growth trajectory',()=>{
  x.access(false,true);x.ref('GROWTH-SCOPE','Resolve selected farming scope','S');x.fail('Farm access denied','Access denied');x.data('Load actual growth samples','Growth trajectory');
 },'Growth trajectory',auto));
 add('WATER-TREND-DATA','Load water trend data for a dashboard','Farm User',x=>x.request('WaterQualityController','WaterQualityService','findTrends','Load water trends',()=>{
  x.ref('WATER-TREND-FILTERS','Resolve water trend scope','S');x.fail('Pond missing or access denied','Trend scope rejected');x.data('Load time-ordered measurements','Water trend series');
 },'Water trend data',auto));
 add('WATER-HISTORY-DATA','Load water observations for a dashboard','Farm User',x=>x.request('WaterQualityController','WaterQualityService','findHistory','Load water observations',()=>{
  x.access(false,true);x.ref('WATER-HISTORY-FILTERS','Resolve selected farming scope','S');x.fail('Scope missing or access denied','Scope rejected');x.data('Load water history and total','Water observations');
 },'Water history',auto));
};
