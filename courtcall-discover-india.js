(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CourtCallDiscoverIndia = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE = Object.freeze({
    listings: 'cc_discovered_tournaments', following: 'cc_followed_tournaments',
    submissions: 'cc_tournament_submissions', claims: 'cc_tournament_claim_intents',
    reports: 'cc_tournament_reports'
  });
  const STATES = Object.freeze({
    'Delhi':['New Delhi'], 'Maharashtra':['Mumbai','Pune','Nagpur'], 'Karnataka':['Bengaluru','Mysuru'],
    'Tamil Nadu':['Chennai','Coimbatore'], 'Telangana':['Hyderabad'], 'West Bengal':['Kolkata'],
    'Gujarat':['Ahmedabad','Surat'], 'Rajasthan':['Jaipur'], 'Uttar Pradesh':['Lucknow','Noida'],
    'Kerala':['Kochi','Thiruvananthapuram'], 'Punjab':['Ludhiana','Chandigarh'], 'Haryana':['Gurugram'],
    'Madhya Pradesh':['Indore','Bhopal'], 'Odisha':['Bhubaneswar'], 'Andhra Pradesh':['Visakhapatnam','Vijayawada'], 'Assam':['Guwahati']
  });
  const VERIFICATION = Object.freeze({ VERIFIED:'VERIFIED', ORGANISER_LISTED:'ORGANISER LISTED', COMMUNITY_LISTED:'COMMUNITY LISTED', SOURCE_LISTED:'SOURCE LISTED', UNVERIFIED:'UNVERIFIED' });
  const text = value => String(value == null ? '' : value).trim();
  const arr = value => Array.isArray(value) ? value : [];
  const enumValue = (value, allowed, fallback) => allowed.includes(text(value).toUpperCase()) ? text(value).toUpperCase() : fallback;
  const dateValue = value => { const raw=text(value), time=Date.parse(raw); return Number.isFinite(time) ? new Date(time).toISOString() : null; };
  const stableId = value => text(value).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
  function safeHttpsUrl(value){ try { const url=new URL(text(value)); return url.protocol==='https:' ? url.href : ''; } catch (_) { return ''; } }
  function normalizeTournament(input, index) {
    const source=input&&typeof input==='object'?input:{};
    const id=stableId(source.id)||`discovered_${index||0}`;
    const verification=enumValue(source.verification,Object.keys(VERIFICATION),'UNVERIFIED');
    return {
      id, slug:text(source.slug), name:text(source.name||source.title)||'Unnamed tournament', organiser:text(source.organiser||source.organiserName)||'Organiser not supplied',
      state:text(source.state), city:text(source.city), venue:text(source.venue), startDate:dateValue(source.startDate||source.start_date),
      endDate:dateValue(source.endDate||source.end_date), format:enumValue(source.format,['3X3','5X5','1X1'],'3X3'),
      ageCategory:text(source.ageCategory||source.age_category)||'Open', gender:enumValue(source.gender,['MEN','WOMEN','MIXED','OPEN'],'OPEN'),
      level:enumValue(source.level,['GRASSROOTS','AMATEUR','COLLEGIATE','ELITE','OPEN'],'OPEN'),
      registrationStatus:enumValue(source.registrationStatus||source.registration_status,['OPEN','CLOSING SOON','CLOSED','ANNOUNCED'],'ANNOUNCED'),
      registrationOpenDate:dateValue(source.registrationOpenDate), registrationDeadline:dateValue(source.registrationDeadline||source.registrationCloseDate||source.registration_deadline), fee:Number.isFinite(Number(source.fee??source.entryFee))?Math.max(0,Number(source.fee??source.entryFee)):null,
      prize:text(source.prize), sourceName:text(source.sourceName||source.source_name)||'Source not supplied', sourceUrl:safeHttpsUrl(source.sourceUrl||source.source_url),
      lastVerifiedAt:dateValue(source.lastVerifiedAt||source.last_verified_at), verification, listingType:enumValue(source.listingType||source.listing_type,['DISCOVERED','COURTCALL HOSTED'],'DISCOVERED'),
      sourceType:enumValue(source.sourceType,['ORGANISER','COMMUNITY','FEDERATION','ASSOCIATION','SCHOOL','COLLEGE','PUBLIC_SOURCE'],'PUBLIC_SOURCE'),
      description:text(source.description), category:text(source.category), eligibility:text(source.eligibility), teamSize:Number(source.teamSize)||null,maxTeams:Number(source.maxTeams)||null,
      contact:text(source.contact), email:text(source.email), whatsapp:text(source.whatsapp), registrationUrl:safeHttpsUrl(source.registrationUrl), rulesUrl:safeHttpsUrl(source.rulesUrl), mapsUrl:safeHttpsUrl(source.mapsUrl), posterUrl:safeHttpsUrl(source.posterUrl), rules:text(source.rules), isSample:source.isSample===true
    };
  }
  function normalizeCollection(value){ return arr(value).map(normalizeTournament).filter((item,index,list)=>item.id&&list.findIndex(candidate=>candidate.id===item.id)===index); }
  function citiesForState(state){ return arr(STATES[text(state)]).slice(); }
  function filterTournaments(items, filters) {
    const f=filters&&typeof filters==='object'?filters:{}; const query=text(f.query).toLocaleLowerCase();
    return normalizeCollection(items).filter(item=>{
      const hay=[item.name,item.organiser,item.city,item.state,item.venue].join(' ').toLocaleLowerCase();
      if(query&&!hay.includes(query))return false;
      if(text(f.state)&&item.state!==text(f.state))return false; if(text(f.city)&&item.city!==text(f.city))return false;
      if(text(f.format)&&item.format!==text(f.format).toUpperCase())return false; if(text(f.gender)&&item.gender!==text(f.gender).toUpperCase())return false;
      if(text(f.level)&&item.level!==text(f.level).toUpperCase())return false; if(text(f.registrationStatus)&&item.registrationStatus!==text(f.registrationStatus).toUpperCase())return false;
      if(text(f.ageCategory)&&item.ageCategory.toLocaleLowerCase()!==text(f.ageCategory).toLocaleLowerCase())return false;
      const feeMax=Number(f.feeMax); if(Number.isFinite(feeMax)&&f.feeMax!==''&&item.fee!==null&&item.fee>feeMax)return false;
      const from=Date.parse(f.dateFrom),to=Date.parse(f.dateTo),start=Date.parse(item.startDate);
      if(Number.isFinite(from)&&(!Number.isFinite(start)||start<from))return false; if(Number.isFinite(to)&&(!Number.isFinite(start)||start>to+86399999))return false;
      if(f.hasPrize===true&&!item.prize)return false; return true;
    }).sort((a,b)=>(Date.parse(a.startDate)||Infinity)-(Date.parse(b.startDate)||Infinity)||a.name.localeCompare(b.name));
  }
  function verificationLabel(item){ return VERIFICATION[item?.verification]||VERIFICATION.UNVERIFIED; }
  function normalizeFollowing(value){ return [...new Set(arr(value).map(stableId).filter(Boolean))].sort(); }
  function toggleFollowing(value,id){ const ids=normalizeFollowing(value),key=stableId(id); return key&&ids.includes(key)?ids.filter(v=>v!==key):normalizeFollowing(ids.concat(key)); }
  function normalizeIntent(input, kind) {
    const source=input&&typeof input==='object'?input:{};
    return { id:stableId(source.id)||`${kind}_${Date.now()}`, tournamentId:stableId(source.tournamentId), name:text(source.name), email:text(source.email).toLocaleLowerCase(), note:text(source.note), status:'PENDING', createdAt:dateValue(source.createdAt)||new Date().toISOString() };
  }
  function validIntent(intent){ return !!(intent.tournamentId&&intent.name&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intent.email)); }
  const SAMPLE = Object.freeze([
    normalizeTournament({id:'sample_delhi_3x3',name:'Delhi Monsoon 3x3 Showcase',organiser:'Sample organiser',state:'Delhi',city:'New Delhi',venue:'Sample Arena',startDate:'2026-09-12',endDate:'2026-09-13',format:'3X3',ageCategory:'Open',gender:'OPEN',level:'AMATEUR',registrationStatus:'OPEN',registrationDeadline:'2026-09-05',fee:1200,prize:'Sample prize: ₹25,000',sourceName:'CourtCall demo dataset',lastVerifiedAt:'2026-08-20',verification:'UNVERIFIED',description:'Demonstration listing only. Confirm every detail with the organiser.',isSample:true},0),
    normalizeTournament({id:'sample_bengaluru_5x5',name:'Bengaluru City 5x5 Cup',organiser:'Sample organiser',state:'Karnataka',city:'Bengaluru',venue:'Sample Sports Complex',startDate:'2026-10-03',format:'5X5',ageCategory:'U18',gender:'MIXED',level:'COLLEGIATE',registrationStatus:'ANNOUNCED',fee:0,sourceName:'CourtCall demo dataset',lastVerifiedAt:'2026-08-18',verification:'UNVERIFIED',description:'Demonstration listing only. No registration is being accepted by CourtCall.',isSample:true},1)
  ]);
  return { STORAGE, STATES, VERIFICATION, SAMPLE, safeHttpsUrl, normalizeTournament, normalizeCollection, citiesForState, filterTournaments, verificationLabel, normalizeFollowing, toggleFollowing, normalizeIntent, validIntent };
}));
