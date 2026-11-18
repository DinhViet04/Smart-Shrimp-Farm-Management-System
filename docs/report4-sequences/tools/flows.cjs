/* Target workflows. Proposed additions are explicitly scoped in the diagrams. */
function define({features,add}){
 const f=(id,actor,fn)=>{const feature=features[id-1];return add(feature.id,feature.title,actor,fn,feature);};
 const detail=(id,suffix,title,actor,fn)=>add(`FE-${String(id).padStart(2,'0')}-${suffix}`,title,actor,fn);
 const overview=(id,actor,options)=>f(id,actor,x=>x.overview(options));
 function cropRead(x){x.data('Load crop and pond','Crop or not found');x.fail('Crop not found','Crop not found');x.access();}
 function createCrop(x){
  x.data('Load selected pond and farm','Pond or not found');x.fail('Pond not found','Pond not found');x.access();
  x.fail('Stocking density too high','Stocking density rejected');
  x.opt('New crop will be active',()=>x.data('Find another active crop in the pond','Active crop or none'));
  x.fail('Another active crop exists','Pond already has an active crop');
  x.fail('Dates, growth targets or crop stage invalid','Crop details rejected');
  x.data('Save crop details','New crop');
  x.notify('Notify crop creation','createCropCreatedNotification','Creator is a Farm Manager');
 }
 function harvest(x){cropRead(x);x.fail('Crop status or harvest date invalid','Harvest rejected');x.fail('Harvested count exceeds stocking','Harvest quantity rejected');
  x.data('Load previous harvest for comparison','Previous harvest or none');
  x.call('REV','crop-review.generator.ts','Prepare harvest evaluation and next-crop advice','Evaluation and advice');
  x.file('backend/src/modules/crops/crop-review.generator.ts','generateHarvestReview');
  x.data('Save harvest quantities, finances and review','Harvest summary');}
 function pondRead(x){x.data('Load selected pond','Pond or not found');x.fail('Pond not found','Pond not found');x.access();}
 function feeding(x){x.access();x.data('Load pond and selected crop','Pond and crop');x.fail('Pond or crop does not match the farm','Invalid farming context');
  x.data('Load existing feeding sessions','Previous daily sessions');x.data('Load selected feed and stock','Feed item and available stock');
  x.fail('Feed item invalid or stock insufficient','Feeding entry rejected');
  x.data('Save feeding sessions and adjust stock together','Daily sessions and synchronized usage');
 }
 function historyScope(x,kind){x.access(false,true);x.ref(kind,'Apply selected farm, pond and period filters','S');x.fail('Selected scope missing or access denied','Invalid or inaccessible scope');}
 function waterRead(x){pondRead(x);x.data('Load latest pond water records','Water records');}
 function waterCreate(x){x.data('Load pond, farm and recorder','Pond and recorder');x.fail('Pond not found','Pond not found');x.access();x.data('Save water measurements','Water record');x.background('Start water notification task','dispatchWaterQualityNotification','WATER-NOTIFICATION');}
 function sample(x){x.use('ShrimpSizeService','assertCanAccessPond');pondRead(x);x.fail('Five casts missing or sample totals invalid','Sample rejected');x.data('Load active crop and pond area','Active crop or none');
  x.fail('No active crop or sampling date precedes stocking','Sampling date or crop rejected');x.data('Load previous sample in the crop','Previous sample or none');
  x.data('Save sample with size, growth and biomass estimates','Sample and calculated estimates');x.background('Start growth notification task','dispatchGrowthNotification','GROWTH-NOTIFICATION');}
 function overviewData(x){x.data('Load farms, ponds and latest crops in user scope','Pond overview');}
 function report(x){cropRead(x);x.data('Load crop records and costs','Feeding, water, samples, health, incidents, materials and mortality');}
 function weather(x){x.opt('Farm selected',()=>x.data('Load farm address','Farm location'));x.call('W','Open-Meteo','Find location and load current weather','Weather data or error');
  x.choice([['Weather request succeeds',()=>x.note('S','Use the returned current weather.')],['Weather service unavailable',()=>x.note('S','Use the fixed fallback weather; it is not a live observation.')]]);}

 f(1,'User',x=>{
  x.request('AuthController','AuthService','register','Submit registration details',()=>{
   x.opt('Invitation supplied',()=>x.ref('CHECK-INVITATION','Validate invitation','S'));
   x.fail('Invitation supplied but invalid','Invitation rejected');
   x.use('UsersService','findByEmail');x.use('UsersService','create');
   x.call('US','UsersService','Check whether email is registered','Existing account or none');
   x.fail('Email already registered','Email already registered');
   x.call('US','UsersService','Create account','New account');
   x.opt('Valid invitation',()=>x.ref('JOIN-FARM','Join the invited farm','S'));
   x.use('AuthService','generateTokens');x.data('Create sign-in session','Sign-in tokens and session');
   x.notify('Send welcome notification','createWelcomeNotification','No invitation');
  },'Account and sign-in result',{public:true,display:'Show registration result'});
 });
 detail(2,'EMAIL','Sign in with email and password','User',x=>x.request('AuthController','AuthService','login','Submit email and password',()=>{
  x.use('UsersService','findByEmail');x.call('US','UsersService','Find account','Account or not found');
  x.fail('Account missing, locked or credentials incorrect','Sign-in rejected');
  x.opt('Invitation supplied',()=>x.ref('JOIN-FARM','Validate invitation and join farm','S'));
  x.fail('Invitation details invalid','Invitation rejected');x.use('AuthService','generateTokens');x.data('Create sign-in session','Sign-in session');
 },'Signed-in user',{public:true,display:'Show sign-in result'}));
 detail(2,'GOOGLE','Sign in with Google','User',x=>x.request('AuthController','AuthService','loginWithGoogle','Choose Google sign-in',()=>{
  x.call('G','Google Identity','Verify Google identity','Verified identity or error');x.fail('Google identity invalid or email unverified','Google sign-in rejected');
  x.use('UsersService','findByEmail');x.call('US','UsersService','Find account by email','Account or none');
  x.choice([['Existing account',()=>x.call('US','UsersService','Link Google identity if needed','Linked account')],['New account',()=>{x.call('US','UsersService','Create Google-linked account','New account');x.notify('Send welcome notification','createWelcomeNotification');}]]);
  x.fail('Account locked','Sign-in rejected');x.opt('Invitation supplied',()=>x.ref('JOIN-FARM','Process invitation; Google invitation errors are caught','S'));
  x.use('AuthService','generateTokens');x.data('Create sign-in session','Sign-in session');
 },'Signed-in user',{public:true}));
 overview(2,'User',[['Email and password','FE-02-EMAIL','Sign in with email and password'],['Google sign-in','FE-02-GOOGLE','Sign in with Google']]);
 f(3,'Signed-in User',x=>x.request('AuthController','AuthService','logout','Sign out',()=>{
  x.opt('Valid refresh session supplied',()=>x.data('Revoke refresh session','Refresh session ended'));
  x.proposed('Complete session invalidation',()=>x.data('Invalidate remaining access to the ended session','Session no longer usable'));
  x.assumptions.push('Immediate access-token invalidation is a proposed extension; current logout revokes refresh sessions only. The revocation mechanism is not prescribed by Report 4.');
 },'Sign-out result',{public:true,checks:'SIGNOUT-CHECKS',display:'Clear local sign-in state and show sign-in screen'}));
 detail(4,'REQUEST-CODE','Request a password reset code','User',x=>x.request('AuthController','AuthService','forgotPassword','Request password reset',()=>{
  x.use('UsersService','findByEmail');x.call('US','UsersService','Find account by email','Account or none');
  x.opt('Account exists',()=>x.data('Check recent reset request','Reset request history'));
  x.opt('Account exists and resend is allowed',()=>{x.data('Save a new reset code','Reset request');x.call('M','SMTP Server','Email reset code','Accepted or send error');
   x.opt('Email delivery fails',()=>x.data('Remove the undelivered code','Code removed'));});
  x.fail('Email delivery fails','Reset email could not be sent');
 },'Generic response without disclosing account existence',{public:true}));
 detail(4,'RESET','Verify reset code and change password','User',x=>x.request('AuthController','AuthService','resetPassword','Submit reset code and new password',()=>{
  x.data('Load reset request','Reset code and validity');x.fail('Code missing, expired or already used','Reset code rejected');
  x.opt('Code incorrect',()=>x.data('Record failed reset attempt','Failed attempt recorded'));
  x.fail('Code incorrect or passwords do not match','Password reset rejected');
  x.data('Claim code, save password and revoke sessions atomically','Reset accepted or code unavailable');x.fail('Code was claimed by another request','Reset code unavailable');
 },'Password reset confirmation',{public:true,display:'Show confirmation and request sign-in'}));
 detail(4,'CHANGE','Change password while signed in','Signed-in User',x=>x.request('UsersController','UsersService','changePassword','Submit password change',()=>{
  x.data('Load account','Account and password status');x.fail('Account missing or passwords invalid','Password change rejected');
  x.data('Save new password','Password updated');x.data('Revoke existing refresh sessions','Sessions ended');
  x.opt('Email configured',()=>x.call('M','SMTP Server','Send password change notice','Sent or error caught'));
 },'Password changed',{display:'Show confirmation and request sign-in'}));
 overview(4,'User',[['Forgot password','FE-04-REQUEST-CODE','Request reset code'],['Reset code received','FE-04-RESET','Reset password'],['Already signed in','FE-04-CHANGE','Change current password']]);
 f(5,'User',x=>x.request('PondsController','PondsService','findAll','Open a role-restricted feature',()=>{
  x.access(false,true);x.data('Load records in accessible farms','Authorized records');
 },'Authorized view',{display:'Show allowed content or access error'}));
 f(6,'Admin',x=>x.request('UsersController','UsersService','findAll','View user list',()=>x.data('Load users without password data','User list'),'User list'));
 detail(7,'OWN-PROFILE','View and update own profile','Signed-in User',x=>{
  x.request('UsersController','UsersService','findById','View own profile',()=>x.data('Load own profile','Profile'),'Profile');
  x.request('UsersController','UsersService','updateProfile','Submit profile changes',()=>{x.data('Load own account','Account');x.fail('Account not found','Profile update rejected');x.data('Save profile changes','Updated profile');},'Updated profile');
 });
 detail(7,'ADMIN-PROFILE','Admin views and edits another profile','Admin',x=>{
  x.request('UsersController','UsersService',null,'View and update selected user profile',()=>{
   x.proposed('Admin profile editing',()=>{x.data('Load selected user','User or none');x.fail('Selected user not found','User not found');x.data('Save permitted profile changes','Updated profile');});
  },'Updated profile',{proposed:true});
  x.assumptions.push('An administrator may edit another user profile. Current profile endpoints only edit the signed-in account; role/status actions already exist separately.');
 });
 overview(7,'User / Admin',[['Own profile','FE-07-OWN-PROFILE','View and edit own profile'],['Admin edits another user','FE-07-ADMIN-PROFILE','Admin profile editing (proposed)']]);
 f(8,'Admin',x=>x.request('UsersController','UsersService',null,'Submit new user details',()=>{
  x.proposed('Admin account creation',()=>{x.data('Check email availability','Existing account or none');x.fail('Email already registered','Email already registered');x.data('Save new account with permitted role','New account');});
  x.assumptions.push('The administrator supplies initial account details. Account delivery or invitation policy is unspecified, so no email step is invented.');
 },'New account',{proposed:true,wholly:true,display:'Show account creation result'}));
 f(9,'Admin',x=>x.request('UsersController','UsersService','updateStatus','Lock or unlock selected account',()=>{
  x.data('Save account access status','Updated account');
 },'Account status',{display:'Show updated account status'}));
 f(10,'Farm User',x=>x.request('FarmsController','FarmsService','findAll','View farm list',()=>x.data('Load farms and ponds allowed by the user role','Farm list'),'Farm list'));
 detail(11,'CREATE','Create farm','Farm Manager',x=>x.request('FarmsController','FarmsService','create','Submit farm details',()=>{
  x.data('Check farm name','Matching farm or none');x.fail('Farm name already exists or owner missing','Farm creation rejected');x.data('Save farm and farming model','New farm');
  x.opt('Staff selected',()=>x.data('Load selected users and save staff assignments','Assigned staff'));
  x.data('Load owner role','Farm owner');x.notify('Notify farm creation','createFarmCreatedNotification','Owner is a Farm Manager');
 },'New farm'));
 detail(11,'UPDATE','Update farm profile and farming model','Farm Manager',x=>x.request('FarmsController','FarmsService','update','Submit farm changes',()=>{
  x.data('Load farm','Farm or none');x.fail('Farm not found','Farm not found');x.access();x.access(true);
  x.data('Check name and total pond area','Existing names and occupied area');x.fail('Duplicate name or farm area too small','Farm changes rejected');
  x.data('Save farm changes','Updated farm');x.opt('Staff list supplied',()=>x.data('Replace farm staff assignments','Updated assignments'));
 },'Updated farm'));
 detail(11,'DELETE','Delete farm','Farm Manager',x=>x.request('FarmsController','FarmsService','remove','Confirm farm deletion',()=>{
  x.data('Load farm','Farm or none');x.fail('Farm not found','Farm not found');x.access();x.access(true);x.data('Delete farm','Farm deleted');
 },'Deletion confirmation'));
 overview(11,'Farm Manager',[['Create farm','FE-11-CREATE','Create farm'],['Edit farm','FE-11-UPDATE','Update farm profile'],['Delete farm','FE-11-DELETE','Delete farm']]);
 detail(12,'STAFF','View and manage existing staff assignments','Farm Manager / Admin',x=>{
  x.request('FarmsController','FarmsService','getStaff','View farm staff',()=>{x.data('Load farm','Farm');x.access();x.access(true);x.data('Load staff and user details','Staff list');},'Staff list');
  x.request('FarmsController','FarmsService','assignStaff','Assign an existing user',()=>{
   x.access(true);x.data('Load user and existing assignment','User and assignment');x.fail('User missing, role invalid or already assigned','Assignment rejected');
   x.data('Save staff assignment and load farm','Assignment and farm');x.notify('Notify farm membership','createFarmJoinNotification','Farm found');
  },'Assignment result');
  x.request('FarmsController','FarmsService','unassignStaff','Remove selected assignment',()=>{x.access(true);x.data('Load assignment','Assignment or none');x.fail('Assignment not found','Assignment not found');x.data('Remove assignment','Assignment removed');},'Removal confirmation');
 });
 detail(12,'INVITE','Invite staff by email','Farm Manager',x=>x.request('FarmsController','FarmsService','inviteStaffByEmail','Send staff invitation',()=>{
  x.access(true);x.data('Load farm and check invited email','Farm and existing account or none');x.fail('Farm not found','Invitation rejected');
  x.use('EmailService','sendFarmInvitationExistingUser');x.use('EmailService','sendFarmInvitationNewUser');
  x.choice([['Account already exists',()=>{x.data('Align invited role and activate farm assignment','Active assignment');x.call('E','EmailService','Email sign-in invitation','Email attempt completed');x.notify('Notify farm membership','createFarmJoinNotification');x.notify('Notify farm owner','createStaffJoinedNotification','Newly joined and owner differs from invitee');}],
   ['New email',()=>x.call('E','EmailService','Email registration invitation','Email attempt completed')]]);
 },'Invitation result'));
 overview(12,'Farm Manager / Admin',[['Manage assigned users','FE-12-STAFF','Manage staff assignments'],['Invite by email','FE-12-INVITE','Invite staff by email']]);
 f(13,'Farm User',x=>x.request('PondsController','PondsService','findAll','View pond list',()=>{x.access(false,true);x.data('Load ponds in accessible farms','Pond list');},'Pond list'));
 detail(14,'CREATE','Create pond','Farm Manager / Admin',x=>x.request('PondsController','PondsService','create','Submit pond details',()=>{
  x.access(true);x.data('Load farm and occupied pond area','Farm and existing pond area');x.fail('Farm missing or available area insufficient','Pond creation rejected');
  x.data('Save pond and farm association','New pond');x.notify('Notify pond creation','createPondCreatedNotification','Creator is a Farm Manager');
 },'New pond'));
 detail(14,'UPDATE','Update pond specifications','Farm Manager / Admin',x=>x.request('PondsController','PondsService','update','Submit pond changes',()=>{
  pondRead(x);x.access(true);x.opt('Pond area changes',()=>x.data('Load occupied area of other ponds','Other pond area'));x.fail('Total pond area would exceed farm area','Pond changes rejected');x.data('Save pond specifications','Updated pond');
 },'Updated pond'));
 detail(14,'DELETE','Delete pond','Farm Manager / Admin',x=>x.request('PondsController','PondsService','remove','Confirm pond deletion',()=>{pondRead(x);x.access(true);x.data('Delete selected pond','Pond deleted');},'Deletion confirmation'));
 overview(14,'Farm Manager / Admin',[['Create pond','FE-14-CREATE','Create pond'],['Edit pond','FE-14-UPDATE','Update pond'],['Delete pond','FE-14-DELETE','Delete pond']]);
 f(15,'Farm Manager / Farmer',x=>{
  x.request('CropsController','CropsService','create','Assign a new crop to the pond',()=>createCrop(x),'New crop');
  x.assumptions.push('An active pond is inferred from its active crop. No separate pond active-status update is invented.');
 });
 detail(16,'LIST','View crops','Farm User',x=>x.request('CropsController','CropsService','findAll','View crops',()=>{x.access(false,true);x.data('Load crops matching accessible farms and filters','Crop list');},'Crop list'));
 detail(16,'CREATE','Create crop','Farm Manager / Farmer',x=>x.request('CropsController','CropsService','create','Submit crop details',()=>createCrop(x),'New crop'));
 detail(16,'UPDATE','Update crop','Farm Manager / Farmer',x=>x.request('CropsController','CropsService','update','Submit crop changes',()=>{
  cropRead(x);x.opt('Changing crop to active',()=>x.data('Find another active crop in the pond','Competing crop or none'));x.fail('Competing crop or invalid crop details','Crop changes rejected');x.data('Save crop changes','Updated crop');
 },'Updated crop'));
 detail(16,'DELETE','Delete crop','Farm Manager / Farmer',x=>x.request('CropsController','CropsService','remove','Confirm crop deletion',()=>{cropRead(x);x.data('Delete crop','Crop deleted');},'Deletion confirmation'));
 overview(16,'Farm User',[['View crops','FE-16-LIST','View crops'],['Create crop','FE-16-CREATE','Create crop'],['Edit crop','FE-16-UPDATE','Update crop'],['Delete crop','FE-16-DELETE','Delete crop']]);
 f(17,'Farm Manager / Farmer',x=>{
  x.request('CropsController','CropsService','create','Record shrimp stocking',()=>createCrop(x),'Stocked crop');x.assumptions.push('Stocking details are crop fields; no separate multi-batch stocking ledger is assumed.');
 });
 f(18,'Farm Manager / Farmer',x=>x.request('CropsController','CropsService','splitCrop','Submit nursery transfer plan',()=>{
  cropRead(x);x.fail('Source not an active high-tech nursery crop or allocations invalid','Transfer rejected');
  x.data('Load destination ponds and active crops','Destination availability');x.fail('Destination unavailable, wrong farm, excessive density or invalid date','Destination plan rejected');
  x.data('Close nursery crop and create linked commercial crops atomically','Source crop and child crops');
 },'Transfer confirmation'));
 detail(19,'COSTS','Load suggested harvest costs','Farm Manager / Admin / Farmer',x=>x.request('CropsController','CropsService','getHarvestSummary','Review harvest cost suggestions',()=>{cropRead(x);x.data('Load feeding, material usage and prices','Suggested feed and material costs');},'Harvest cost suggestions'));
 detail(19,'CONFIRM','Confirm harvest and financial summary','Farm Manager / Admin',x=>x.request('CropsController','CropsService','harvest','Submit confirmed harvest details',()=>harvest(x),'Harvest finances and review'));
 overview(19,'Farm Manager / Admin',[['Review suggested costs','FE-19-COSTS','Load harvest costs'],['Confirm harvest','FE-19-CONFIRM','Record harvest and calculate financial summary']]);
 f(20,'Farm User',x=>x.request('CropsController','CropsService','findOne','View crop lifecycle',()=>{cropRead(x);x.use('CropsService','findOne');},'Crop dates, milestones and parent-child links'));
 f(21,'Farmer / Farm Manager / Admin',x=>x.request('FeedingLogsController','FeedingLogsService','createOrUpdateDailyLog','Submit daily feeding sessions',()=>feeding(x),'Saved feeding sessions'));
 f(22,'Farm User',x=>{
  x.request('SurvivalRateController','SurvivalRateService','createMortalityLog','Record shrimp mortality',()=>{cropRead(x);x.data('Save mortality record','Mortality record');},'Mortality confirmation');
  x.assumptions.push('Recording mortality does not change stocking count. Current survival estimates do not subtract mortality totals automatically.');
 });
 f(23,'Farmer / Technician',x=>x.request('ShrimpHealthController','ShrimpHealthService','create','Submit shrimp health observations',()=>{
  x.fail('Observation time is in the future','Observation time rejected');x.data('Load farm, pond, crop and recorder','Farming context');x.fail('Farm not found','Farm not found');x.access();
  x.fail('Pond or crop mismatch, or crop not active','Health record rejected');x.data('Save shrimp health observations','Health record');x.background('Start health notification task','dispatchShrimpHealthNotification','HEALTH-NOTIFICATION');
 },'Health record confirmation'));
 f(24,'Farmer / Farm Manager',x=>x.request('DailyNotesController','DailyNotesService',null,'Submit daily farming note',()=>{
  x.use('FeedingLogsService','createOrUpdateDailyLog');x.file('backend/prisma/schema.prisma','model FeedingLog');
  x.proposed('Independent daily notes',()=>{x.access();x.data('Check selected farm, pond and crop','Farming context');x.fail('Selected context invalid','Daily note rejected');x.data('Save daily note and observations','Daily note');});
  x.assumptions.push('A standalone daily note is proposed. Current code stores notes only inside feeding, water, mortality and health records. Detailed note fields and retention are unspecified.');
 },'Daily note confirmation',{proposed:true,wholly:true}));
 f(25,'Technician / Admin',x=>x.request('WaterQualityController','WaterQualityService','create','Submit water measurements',()=>waterCreate(x),'Water record confirmation'));
 f(26,'Farm User',x=>x.request('WaterQualityController','WaterQualityService','findHistory','View water quality history',()=>{
  historyScope(x,'WATER-HISTORY-FILTERS');x.data('Load water history and total','History page');
 },'Water records and status'));
 f(27,'Farm User',x=>x.request('WaterQualityController','WaterQualityService','findTrends','View water quality trends',()=>{
  x.ref('WATER-TREND-FILTERS','Apply pond, crop or farm scope','S');x.fail('Selected pond missing or access denied','Trend scope rejected');x.data('Load measurements in time order','Water trend series');
 },'Trend series and status'));
 f(28,'Farm User',x=>x.request('InventoryController','InventoryService','findAll','View inventory and current stock',()=>{
  x.access(false,true);x.opt('Specific farm selected',()=>x.ref('FARM-SCOPE-CHECK','Check selected farm access','S'));x.fail('Selected farm access denied','Access denied');x.data('Load matching inventory and total','Inventory page and stock quantities');
 },'Inventory and stock levels'));
 detail(29,'CREATE','Create inventory item','Farm Manager',x=>x.request('InventoryController','InventoryService','create','Submit inventory item',()=>{
  x.access(true);x.opt('Supplier selected',()=>x.data('Check supplier belongs to farm','Supplier check'));x.data('Check item name','Duplicate item or none');x.fail('Supplier invalid or item name already used','Inventory item rejected');
  x.data('Save inventory and initial stock log atomically','Inventory item');
  x.proposed('Automatic low-stock alert',()=>x.opt('Stock at or below threshold',()=>x.notify('Notify responsible users of low stock')));
 },'New inventory item'));
 detail(29,'UPDATE','Update inventory item and threshold','Farm Manager',x=>x.request('InventoryController','InventoryService','update','Submit inventory changes',()=>{
  x.data('Load inventory item','Item or none');x.fail('Item not found','Item not found');x.access(true);
  x.opt('Destination farm differs',()=>x.ref('MANAGE-SCOPE-CHECK','Check destination farm management rights','S'));x.fail('Destination farm access denied','Access denied');
  x.data('Check supplier and duplicate name','Supplier and name checks');x.fail('Supplier invalid or duplicate name','Inventory changes rejected');x.data('Save inventory and threshold','Updated inventory');
  x.proposed('Automatic low-stock alert',()=>x.opt('Stock at or below threshold',()=>x.notify('Notify responsible users of low stock')));
 },'Updated inventory item'));
 detail(29,'DELETE','Delete inventory item','Farm Manager',x=>x.request('InventoryController','InventoryService','remove','Confirm inventory deletion',()=>{
  x.data('Load inventory item','Item or none');x.fail('Item not found','Item not found');x.access(true);x.data('Count linked usage records','Usage count');x.fail('Usage records exist','Item cannot be deleted');x.data('Mark item as deleted','Item removed from active inventory');
 },'Deletion confirmation'));
 overview(29,'Farm Manager',[['Create item','FE-29-CREATE','Create inventory and check low stock'],['Edit item or threshold','FE-29-UPDATE','Update inventory and check low stock'],['Delete item','FE-29-DELETE','Delete inventory item']]);
 detail(30,'USE','Record material usage','Farm User',x=>x.request('InventoryController','InventoryService','recordUsage','Submit material usage',()=>{
  x.data('Load inventory item','Item and stock');x.fail('Item not found','Item not found');x.access();x.fail('Requested quantity exceeds stock','Usage rejected');x.data('Save usage and reduce stock atomically','Usage record and remaining stock');
 },'Usage confirmation'));
 detail(30,'HISTORY','View inventory usage history','Farm User',x=>x.request('InventoryController','InventoryService','findUsageLogs','View material usage history',()=>{
  x.access(false,true);x.opt('Farm selected',()=>x.ref('FARM-SCOPE-CHECK','Check selected farm access','S'));x.fail('Selected farm access denied','Access denied');x.data('Load filtered import and usage records','Material movement history');
 },'Usage history'));
 overview(30,'Farm User',[['Record usage','FE-30-USE','Record inventory usage'],['Review history','FE-30-HISTORY','View usage and depletion history']]);
 detail(31,'LIST','View suppliers and linked products','Farm User',x=>x.request('SuppliersController','SuppliersService','findAll','View suppliers and products',()=>{
  x.access(false,true);x.opt('Farm selected',()=>x.ref('FARM-SCOPE-CHECK','Check selected farm access','S'));x.fail('Farm access denied','Access denied');x.data('Load suppliers and linked inventory products','Supplier product list');
 },'Suppliers and products'));
 detail(31,'SAVE','Create or update supplier','Farm Manager',x=>{
  x.request('SuppliersController','SuppliersService','create','Submit new supplier',()=>{x.access(true);x.data('Check supplier name in farm','Existing supplier or none');x.fail('Supplier name already used','Supplier rejected');x.data('Save supplier','New supplier');},'New supplier');
  x.request('SuppliersController','SuppliersService','update','Submit supplier changes',()=>{x.data('Load supplier','Supplier or none');x.fail('Supplier not found','Supplier not found');x.access(true);x.opt('Destination farm differs',()=>x.ref('MANAGE-SCOPE-CHECK','Check destination farm rights','S'));x.fail('Destination farm access denied','Access denied');x.data('Check name uniqueness','Duplicate or none');x.fail('Supplier name already used','Supplier rejected');x.data('Save supplier changes','Updated supplier');},'Updated supplier');
 });
 detail(31,'DELETE','Delete supplier','Farm Manager',x=>x.request('SuppliersController','SuppliersService','remove','Confirm supplier deletion',()=>{
  x.data('Load supplier','Supplier or none');x.fail('Supplier not found','Supplier not found');x.access(true);x.data('Count linked active inventory','Linked product count');x.fail('Linked inventory still exists','Supplier cannot be deleted');x.data('Mark supplier as deleted','Supplier removed');
 },'Deletion confirmation'));
 f(31,'Farm User',x=>{x.overview([['Browse suppliers and products','FE-31-LIST','View supplier product catalog'],['Create or edit supplier','FE-31-SAVE','Manage supplier details'],['Delete supplier','FE-31-DELETE','Delete supplier'],['Manage linked products','FE-29','Manage supplier-linked inventory products']]);x.assumptions.push('The supplied product catalog is represented by supplier-linked Inventory items. No separate supplier-product master is invented.');});
 f(32,'Technician',x=>x.request('ShrimpSizeController','ShrimpSizeService','createSample','Submit five shrimp sample casts',()=>sample(x),'Shrimp size and growth estimates'));
 f(33,'Technician',x=>x.request('ShrimpSizeController','ShrimpSizeService','createSample','Submit casts for biomass estimation',()=>sample(x),'Estimated population and biomass'));
 f(34,'Farm User',x=>x.request('SurvivalRateController','SurvivalRateService','calculateSurvivalRate','View crop survival and population',()=>{
  cropRead(x);x.fail('Stocking count missing or zero','Survival cannot be calculated');x.use('ShrimpSizeService','getCurrentShrimpCount');x.call('SS','ShrimpSizeService','Load latest population estimate','Estimate or none');
  x.choice([['Harvest count available',()=>x.note('S','Use the recorded harvested population.')],['No harvest but sample estimate available',()=>x.note('S','Use the latest sample estimate.')],['No estimate available',()=>x.note('S','Use initial stocking count.')]]);
 },'Population, survival rate and comparison with target'));
 f(35,'Farm User',x=>x.request('ShrimpSizeController','ShrimpSizeService','analyzeFCR','View feed conversion analysis',()=>{
  pondRead(x);x.data('Load active crop','Active crop or none');x.fail('No active crop','Feed conversion unavailable');x.data('Load biomass samples','Samples');
  x.choice([['Biomass samples available',()=>{x.data('Load non-skipped feeding records','Feed quantities');x.note('S','Compare feed used with positive biomass gain.\nNo positive gain gives an unavailable ratio.');}],['No biomass samples',()=>x.note('S','Return no current ratio and an empty history.')]]);
 },'Current feed conversion and history'));
 f(36,'Farm User',x=>{
  x.request('CropsController','CropsService','getGrowthTrajectory90d','Compare actual shrimp growth',()=>{
   x.access(false,true);x.ref('GROWTH-SCOPE','Resolve selected farm, pond and crop','S');x.fail('Farm access denied','Growth view rejected');x.data('Load actual shrimp samples','Actual growth series');
  },'Actual growth trajectory');x.note('UI','Compare actual points with the fixed reference curves.');x.file('frontend-web/src/features/growth/TechnicianOverviewDashboard.tsx','fetchGrowthData');
  x.assumptions.push('The standard/reference curve is the existing frontend reference, not an invented server-calculated 5T interpolation.');
 });
 f(37,'Farm Manager / Farmer',x=>x.request('FeedingRecommendationController','FeedingRecommendationService',null,'Request daily feeding recommendation',()=>{
  x.file('frontend-web/src/features/environment/EnvironmentAIAssessment.tsx','const aiEvaluation');
  x.proposed('Adaptive ration calculation',()=>{x.access();x.data('Load active crop, growth and feeding history','Farming data');x.fail('No active crop or required data missing','Recommendation unavailable');
   x.call('W','WeatherService','Load relevant weather','Weather context or fallback');x.data('Load approved feeding rules and targets','Approved ration rules');
   x.note('S','Calculate the daily ration using approved rules.\nThe formula and safe adjustment limits still need specification.');});
  x.assumptions.push('Controller, service and ration calculation are proposed. Current UI only suggests feed reductions from fixed water rules; no adaptive daily-ration algorithm exists. The design leaves formula details open.');
 },'Recommended daily ration and explanation',{proposed:true,wholly:true}));
 f(38,'Technician / Admin',x=>{x.request('WaterQualityController','WaterQualityService','create','Record water quality for alert checks',()=>waterCreate(x),'Water record confirmation');x.ref('WATER-NOTIFICATION','Evaluate water status and notify recipients','S');});
 f(39,'Farm User',x=>x.request('WeatherController','WeatherService','getWeather','View current weather',()=>{
  // Controller starts this task before awaiting the current-weather service call.
  x.use('WeatherService','syncDisasterAlerts');weather(x);
 },'Current weather and short forecast advice',{before:()=>{
  x.opt('Farm selected',()=>{x.call('S','WeatherService','Start weather risk check','Task started; not awaited','C');x.references.push('FE-40');});
 }}));
 f(40,'Farm User',x=>x.request('WeatherController','WeatherService','syncDisasterAlerts','Check weather risks for the farm',()=>{
  x.data('Load farm and active recipients','Farm and recipients');x.opt('Farm and active recipients exist',()=>{
   x.call('W','Open-Meteo','Load location and 14-day forecast','Forecast or error');
   x.choice([['Forecast available',()=>x.loop('Forecast days; first alert of each risk type',()=>{
    x.opt('Storm, heavy rain or high heat detected',()=>x.loop('Each active recipient',()=>x.notify('Create a non-duplicate weather alert','createDisasterNotification')));
   })],['Forecast unavailable',()=>x.note('S','Log the failure; no new forecast alert is created.')]]);
  });
 },'Risk synchronization result'));
 f(41,'Farm User / Farm Manager',x=>x.request('EnvironmentController','EnvironmentService',null,'View environmental warning history',()=>{
  x.use('WaterQualityService','findHistory');x.use('IncidentsService','resolve');
  x.proposed('Warning resolution history',()=>{x.access();x.data('Load warnings and recorded resolutions','Warning history');
   x.opt('Authorized user records a resolution',()=>x.data('Save resolution and warning status','Updated warning history'));});
  x.assumptions.push('A warning-resolution record is proposed. Current water history has computed status; current incident treatment history is a separate workflow. Report 4 does not specify resolution fields or approval rules.');
 },'Warnings and resolution history',{proposed:true,wholly:true}));
 detail(42,'REPORT','Create an incident record','Farmer / Technician / Farm Manager',x=>x.request('IncidentsController','IncidentsService','create','Report a farming incident',()=>{
  x.data('Load crop and farm','Crop or none');x.fail('Crop not found','Crop not found');x.access();x.fail('Crop not active','Incident rejected');
  x.data('Save incident and first timeline event atomically','New incident');x.note('S','A technician reporter is assigned automatically.');
 },'Incident confirmation'));
 detail(42,'ASSIGN','Assign incident technician','Farm Manager',x=>x.request('IncidentsController','IncidentsService','assign','Assign a technician',()=>{
  x.data('Load incident and farm','Incident or none');x.fail('Incident not found','Incident not found');x.access(true);x.fail('Incident already resolved','Assignment rejected');
  x.data('Check active technician assignment to the farm','Technician or none');x.fail('Technician not available in farm','Assignment rejected');x.data('Save assignment and timeline event atomically','Assigned incident');
 },'Assignment confirmation'));
 overview(42,'Farm User',[['Report incident','FE-42-REPORT','Create incident record'],['Assign technician','FE-42-ASSIGN','Assign technician']]);
 detail(43,'VIEW','View incident treatment timeline','Farm User',x=>x.request('IncidentsController','IncidentsService','findOne','Open incident timeline',()=>{
  x.data('Load incident and ordered treatment updates','Incident or none');x.fail('Incident not found','Incident not found');x.access();
 },'Incident timeline'));
 for(const [suffix,method,title,guard]of [['START','startTreatment','Start incident treatment','Incident already resolved'],['UPDATE','addTreatmentUpdate','Record treatment progress','Incident already resolved'],['RESOLVE','resolve','Resolve incident','Incident already resolved'],['REOPEN','reopen','Reopen incident','Incident is not resolved']]){
  detail(43,suffix,title,'Farm Manager / Assigned Technician',x=>x.request('IncidentsController','IncidentsService',method,title,()=>{
   x.data('Load incident and farm','Incident or none');x.fail('Incident not found','Incident not found');x.access();
   x.fail('User is neither manager nor assigned technician','Treatment permission denied');x.fail(guard,'Incident state rejected');
   x.data('Save treatment event and incident state atomically','Updated treatment timeline');
  },'Updated incident'));
 }
 f(43,'Farm User',x=>{x.overview([['View history','FE-43-VIEW','View treatment timeline'],['Begin treatment','FE-43-START','Start treatment'],['Add clinical progress','FE-43-UPDATE','Record treatment progress'],['Finish treatment','FE-43-RESOLVE','Resolve incident'],['Continue after resolution','FE-43-REOPEN','Reopen incident']]);x.assumptions.push('Current service treatment checks reject Admin despite some route role lists including Admin. Treatment remains restricted to a manager or assigned technician.');});
 f(44,'Farm User',x=>x.request('EnvironmentController','EnvironmentService',null,'Request water risk assessment',()=>{
  x.file('frontend-web/src/features/environment/EnvironmentAIAssessment.tsx','const aiEvaluation');
  x.proposed('AI water assessment',()=>{pondRead(x);x.data('Load recent water measurements','Measurements or none');x.fail('No measurements available','Assessment unavailable');
   x.call('AI','FastAPI AI Service','Assess water condition and explain risks','Assessment or service error');x.fail('Assessment service unavailable','Assessment unavailable');});
  x.assumptions.push('The server AI assessment endpoint is proposed. Current EnvironmentAIAssessment uses frontend rules/defaults and does not call AI. The target avoids presenting default measurements as observed pond data.');
 },'Water status, risks and recommended actions',{proposed:true}));
 function chatbot(id){f(id,'Farm User',x=>x.request('ChatbotController','ChatbotService','ask','Submit a farming question',()=>{
  x.opt('Pond selected',()=>{x.data('Load pond, crop and latest water readings','Pond context');x.ref('FARM-SCOPE-CHECK','Check selected pond farm access','S');});
  x.fail('Selected pond access denied','Pond access denied');x.ref('CHAT-INVENTORY','Load permitted medicine and chemical context','S');
  x.opt('Question asks about weather',()=>x.call('W','Chatbot WeatherService','Load weather for the question','Weather context or unavailable'));
  x.call('AI','FastAPI AI Service','Request farming advice','Answer or service error',x.s,()=>x.ref('RAG-ANSWER','Retrieve knowledge and prepare answer','AI'));
  x.opt('AI service unavailable',()=>x.ref('CHAT-FALLBACK','Prepare backend fallback answer','S'));
 },'Advice with available pond and weather context'));
 }
 chatbot(45);
 f(46,'Farm Manager / Admin',x=>{x.request('CropsController','CropsService','harvest','Confirm harvest and request review',()=>harvest(x),'Evaluation, lessons and next-crop recommendations');x.assumptions.push('Review generation follows the current deterministic rules. The FE title does not specify an LLM, so no new LLM call is invented.');});
 chatbot(47);
 detail(48,'INGEST','Create and ingest a knowledge document','Admin / Farm Manager / Technician',x=>x.request('ChatbotController','ChatbotService','createDocument','Submit knowledge document',()=>{
  x.data('Save source document','Knowledge document');
  x.proposed('Unified AI knowledge ingestion',()=>x.call('AI','FastAPI AI Service','Extract, divide and index document text','Indexing result',x.s,()=>x.ref('KNOWLEDGE-INDEX','Build the planned searchable knowledge store','AI')));
  x.fail('Proposed AI indexing fails','Document saved; indexing incomplete');
  x.assumptions.push('Unified ingestion into planned ChromaDB is proposed. Current NestJS document ingestion writes PostgreSQL chunks; Python keeps an independent JSON vector store.');
 },'Document and indexing status'));
 detail(48,'MANAGE','View and delete knowledge documents','Admin / Farm Manager',x=>{
  x.request('ChatbotController','ChatbotService','getAllDocuments','View knowledge documents',()=>x.data('Load document summaries','Document list'),'Document list');
  x.request('ChatbotController','ChatbotService','deleteDocument','Delete selected document',()=>{x.data('Delete document and stored passages','Document deleted');x.proposed('Keep the AI store consistent',()=>x.call('AI','FastAPI AI Service','Remove document from the knowledge index','Removal result'));},'Deletion result');
 });
 detail(48,'DRIVE','Synchronize knowledge from Drive','Admin / Farm Manager',x=>x.request('ChatbotController','ChatbotService','syncDriveDocuments','Synchronize knowledge folder',()=>{
  x.call('AI','FastAPI AI Service','Synchronize Drive documents','Sync summary or error',x.s,()=>x.ref('DRIVE-IMPORT','Read and ingest changed folder documents','AI'));x.fail('AI synchronization request fails','Synchronization failed');
 },'Synchronization summary'));
 overview(48,'Authorized User',[['Add document','FE-48-INGEST','Create and ingest document'],['Browse or remove documents','FE-48-MANAGE','Manage knowledge documents'],['Synchronize Drive','FE-48-DRIVE','Synchronize knowledge folder']]);
 chatbot(49);
 f(50,'User',x=>{
  x.use('NotificationsGateway','handleConnection');x.use('NotificationsService','notifyWaterQualityUpdate');
  x.part('GW','NotificationsGateway');x.msg('U','UI','Open notifications');x.activate('UI');x.msg('UI','GW','Connect for live notifications');x.activate('GW');
  x.choice([['Session invalid',()=>x.msg('GW','UI','Connection refused','-->>')],['Session valid',()=>x.msg('GW','UI','Connected to own notification channel','-->>')]]);
  x.deactivate('GW');x.msg('UI','U','Show notification center','-->>');x.deactivate('UI');x.ref('NOTIFICATION-DELIVERY','Deliver notifications created by business events','UI,GW');
  x.proposed('Delivery while disconnected',()=>x.ref('MOBILE-PUSH','Deliver an alert through the planned push channel','U,UI'));
  x.assumptions.push('Live gateway delivery exists for active web clients; mobile currently polls. Unified live clients and Expo/FCM/APNs push are target-design extensions, not implemented channels.');
 });
 detail(51,'LIST','View and filter own notifications','User',x=>x.request('NotificationsController','NotificationsService','getUserNotifications','View notifications',()=>{
  x.data('Load own recent notifications and pond names','Notifications');
 },'Notification list',{display:'Show notifications and apply selected severity filter'}));
 detail(51,'READ','Mark notifications as read','User',x=>{
  x.request('NotificationsController','NotificationsService','markAsRead','Mark a notification as read',()=>x.data('Update read status scoped to current user','Update result'),'Read confirmation');
  x.request('NotificationsController','NotificationsService','markAllAsRead','Mark all notifications as read',()=>x.data('Update own unread notifications','Update result'),'Read confirmation');
 });
 detail(51,'DELETE','Delete own notifications','User',x=>{
  x.request('NotificationsController','NotificationsService','deleteNotification','Delete selected notification',()=>x.data('Delete notification scoped to current user','Deletion result'),'Deletion confirmation');
  x.request('NotificationsController','NotificationsService','clearAllNotifications','Clear own notifications',()=>x.data('Delete own notifications','Deletion result'),'Clear confirmation');
 });
 overview(51,'User',[['View or filter','FE-51-LIST','View and filter notifications'],['Mark as read','FE-51-READ','Update read status'],['Remove notifications','FE-51-DELETE','Delete own notifications']]);
 f(52,'Farm Manager',x=>{
  x.msg('U','UI','Open executive dashboard');x.activate('UI');
  x.parallel([['Overview',()=>x.ref('OVERVIEW-DATA','Load farms and pond overview','UI')],['Active incidents',()=>x.ref('INCIDENT-LIST','Load active incidents','UI')]]);
  x.opt('Harvest performance section shown',()=>x.ref('MANAGER-SUMMARY','Load harvest performance','UI'));
  x.opt('Environmental section shown',()=>x.ref('MANAGER-WATER','Load environmental trends','UI'));
  x.msg('UI','U','Show executive indicators and charts','-->>');x.deactivate('UI');x.file('frontend-web/src/features/manager/ManagerDashboardHome.tsx','loadDashboard');
 });
 f(53,'Technician',x=>{
  x.msg('U','UI','Open environmental and health dashboard');x.activate('UI');x.ref('GROWTH-DATA','Load growth trajectory','UI');x.ref('WATER-TREND-DATA','Load water trend series','UI');x.msg('UI','U','Show growth, water trends and pond status','-->>');x.deactivate('UI');
  x.file('frontend-web/src/features/growth/TechnicianOverviewDashboard.tsx','fetchGrowthData');
 });
 f(54,'Farmer',x=>{
  x.msg('U','UI','Open daily farming dashboard');x.activate('UI');x.ref('OVERVIEW-DATA','Load farm and pond overview','UI');x.ref('WATER-HISTORY-DATA','Load water observations','UI');x.ref('FEEDING-LIST','Load grouped daily feeding records','UI');x.ref('INCIDENT-LIST','Load active incidents','UI');x.ref('HEALTH-LIST','Load shrimp health observations','UI');x.msg('UI','U','Show daily pond cards and farming work','-->>');x.deactivate('UI');
  x.file('frontend-web/src/features/farmer/FarmerDashboardHome.tsx','fetchAllData');
  x.assumptions.push('Daily tasks are assembled from logs and incidents. No independent task-assignment model is assumed. Client fallback lists can be used if the optimized overview fails.');
 });
 f(55,'Admin',x=>{
  x.request('AdminController','AdminService','getDashboardStats','Open system administration dashboard',()=>{
   x.data('Load user, farm, active pond and crop totals','Entity counts');x.data('Load daily registrations and role distribution','Registration statistics');x.data('Load recent user and farm activity','Recent activity');
  },'Administration statistics');x.assumptions.push('System metrics mean the existing business/entity statistics. CPU, uptime and infrastructure-health telemetry are not specified in the FE and are not invented.');
 });
 f(56,'Farm User',x=>{
  x.request('CropsController','CropsService','getDetailedReport','Request farming performance report',()=>report(x),'Detailed crop report');x.assumptions.push('The report covers the selected crop. Parent/child crop links provide context, not automatic aggregation of every child log into the parent report.');
 });
 f(57,'Farm User',x=>{
  x.file('frontend-web/src/components/CropDetailReportModal.tsx','handlePrint');
  x.request('CropsController','CropsService','getDetailedReport','Load report for export',()=>report(x),'Detailed report');
  x.msg('U','UI','Choose export format');x.activate('UI');
  x.choice([['PDF',()=>x.call('PRINT','Print Dialog','Open report printing','Print dialog closed','UI')],
   ['Excel or CSV',()=>x.proposed('Spreadsheet and CSV export',()=>x.call('EXPORT','Report Exporter','Create selected report file','Downloadable file','UI'))]]);
  x.msg('UI','U','Show print result or downloaded file','-->>');x.deactivate('UI');
  x.assumptions.push('PDF currently uses browser print / Save as PDF. Excel/CSV formatting is a proposed client export component; no server file-export API is invented. Saving PDF occurs within the print dialog.');
 });
 require('./supporting.cjs')({add});
}
module.exports={define};
