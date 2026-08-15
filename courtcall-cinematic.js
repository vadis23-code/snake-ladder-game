/* CourtCall cinematic landing controller.
   Scroll remains native; video playback is never autonomous. */
;(function(){
  'use strict';

  const STAGES=[
    {period:'PREGAME',clock:'00:00',a:0,b:0,shot:24,side:'a',pace:'READY',momentum:50,ticker:'COURT READY · CALL THE SCORE'},
    {period:'Q1',clock:'00:00',a:0,b:0,shot:24,side:'a',pace:'SET',momentum:50,ticker:'TIP-OFF · THE RUN STARTS HERE'},
    {period:'Q1',clock:'06:24',a:12,b:9,shot:12,side:'a',pace:'FAST',momentum:64,ticker:'ORANGE RUN · THREE STRAIGHT SCORES'},
    {period:'GAME POINT',clock:'00:38',a:19,b:19,shot:3,side:'b',pace:'ONE POSSESSION',momentum:50,ticker:'50% / 50% · EVERY POSSESSION MATTERS'},
    {period:'FINAL',clock:'00:00',a:21,b:19,shot:0,side:'a',pace:'COURTCALL',momentum:58,ticker:'FINAL · YOUR COURT · YOUR CREW · YOUR CALL'}
  ];
  const STILL_NAMES=['01-empty-court','02-tip-off','03-the-run','04-clutch-moment','05-victory'];
  const MOBILE_QUERY='(max-width:760px), (max-height:520px)';
  const REDUCED_QUERY='(prefers-reduced-motion: reduce)';
  const els={};
  let active=false;
  let fallbackMode=false;
  let staticMode=true;
  let modeReason='fallback';
  let targetProgress=0;
  let renderedProgress=0;
  let rafId=0;
  let routeRafId=0;
  let currentStage=-1;
  let staticStage=-1;
  let listeners=[];
  let mediaListeners=[];
  let observer=null;
  let webmSupported=false;

  function cache(){
    els.landing=document.getElementById('s-landing');
    els.root=document.getElementById('cc-cinema');
    els.story=document.getElementById('cc-cinema-story');
    els.stage=document.getElementById('cc-cinema-stage');
    els.poster=document.getElementById('cc-cinema-poster');
    els.status=document.getElementById('cc-cinema-status');
    els.progress=document.getElementById('cc-cinema-progress-fill');
    els.videos=[...document.querySelectorAll('.cc-cinema-video')];
    els.panels=[...document.querySelectorAll('.cc-story-panel[data-stage]')];
    els.chapters=[...document.querySelectorAll('.cc-cinema-chapters button[data-stage]')];
    els.period=document.getElementById('cc-hud-period');
    els.clock=document.getElementById('cc-hud-clock');
    els.scoreA=document.getElementById('cc-hud-score-a');
    els.scoreB=document.getElementById('cc-hud-score-b');
    els.possession=document.getElementById('cc-hud-possession');
    els.shot=document.getElementById('cc-hud-shot-value');
    els.shotRing=document.getElementById('cc-hud-shot-ring');
    els.pace=document.getElementById('cc-hud-pace');
    els.momentum=document.getElementById('cc-hud-momentum-fill');
    els.ticker=document.getElementById('cc-hud-ticker');
    return Boolean(els.root&&els.story&&els.stage&&els.poster);
  }

  function on(target,type,handler,options){
    target?.addEventListener(type,handler,options);
    if(target)listeners.push(()=>target.removeEventListener(type,handler,options));
  }

  function onMediaOnce(target,type,handler){
    target.addEventListener(type,handler,{once:true});
    mediaListeners.push(()=>target.removeEventListener(type,handler));
  }

  function clearMediaListeners(){
    mediaListeners.splice(0).forEach(remove=>{try{remove()}catch{}});
  }

  function clamp(value,min=0,max=1){return Math.min(max,Math.max(min,value))}

  function isReduced(){
    return document.documentElement.dataset.reducedMotion==='true'||window.matchMedia(REDUCED_QUERY).matches;
  }

  function selectMode(){
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const lowMemory=Number.isFinite(navigator.deviceMemory)&&navigator.deviceMemory<=2;
    const noVideo=!document.createElement('video').canPlayType;
    if(fallbackMode||noVideo)return 'fallback';
    if(isReduced())return 'reduced-motion';
    if(connection?.saveData)return 'save-data';
    if(lowMemory)return 'low-memory';
    return 'full-video';
  }

  function mustUseStills(){
    modeReason=selectMode();
    return modeReason!=='full-video';
  }

  function staticStatus(){
    if(modeReason==='reduced-motion')return 'Reduced-motion still sequence';
    if(modeReason==='save-data')return 'Data-saving still sequence';
    if(modeReason==='low-memory')return 'Lightweight still sequence';
    return 'Static arena mode · CourtCall is ready';
  }

  function setStatus(message){
    if(els.status&&els.status.textContent!==message)els.status.textContent=message;
  }

  function stillPath(index){
    const mobile=window.matchMedia(MOBILE_QUERY).matches;
    return `./assets/cinematic/${STILL_NAMES[index]}-${mobile?'mobile':'poster'}.webp`;
  }

  function setStaticStage(index){
    if(!els.poster||index===staticStage)return;
    staticStage=index;
    els.poster.src=stillPath(index);
    els.poster.decoding='async';
    els.poster.onerror=()=>{
      els.root?.classList.add('is-media-fallback');
      setStatus('Cinematic media unavailable · CourtCall is ready');
    };
  }

  function unloadVideos(){
    clearMediaListeners();
    els.videos?.forEach(video=>{
      try{video.pause()}catch{}
      video.classList.remove('is-active');
      video.removeAttribute('src');
      video.dataset.loaded='false';
      video.dataset.failed='false';
      try{video.load()}catch{}
    });
    els.root?.classList.remove('is-video-ready');
  }

  function useStaticFallback(message='Static arena mode · CourtCall is ready'){
    fallbackMode=true;
    staticMode=true;
    modeReason='fallback';
    unloadVideos();
    els.root?.classList.add('is-static','is-media-fallback');
    setStatus(message);
    setStaticStage(Math.max(0,currentStage));
    publishDebug();
  }

  function ensureVideo(index){
    if(staticMode||index<0||index>=els.videos.length)return null;
    const video=els.videos[index];
    if(video.dataset.loaded==='true'||video.dataset.failed==='true')return video;
    video.dataset.loaded='true';
    video.preload=index===0?'auto':'metadata';
    video.poster=video.dataset.poster||'';
    video.src=webmSupported?video.dataset.webm:video.dataset.mp4;
    const ready=()=>{
      if(!active)return;
      if(index===currentStage){
        els.root?.classList.add('is-video-ready','is-ready');
        video.classList.add('is-active');
        seekVideo(video,localProgress(renderedProgress,index),true);
      }
      setStatus('Arena ready');
      publishDebug();
    };
    const failed=()=>{
      video.dataset.failed='true';
      useStaticFallback('Video unavailable · static arena mode');
    };
    onMediaOnce(video,'loadedmetadata',ready);
    onMediaOnce(video,'error',failed);
    try{video.load()}catch{failed()}
    return video;
  }

  function stageFor(progress){return Math.min(STAGES.length-1,Math.floor(clamp(progress)*STAGES.length))}
  function localProgress(progress,index){return clamp(progress*STAGES.length-index)}

  function seekVideo(video,local,force=false){
    if(!video||video.readyState<1||!Number.isFinite(video.duration)||video.duration<=0||video.seeking)return;
    const desired=clamp(local)*Math.max(.01,video.duration-.035);
    if(force||Math.abs(video.currentTime-desired)>.04){
      try{video.currentTime=desired}catch{}
    }
  }

  function updateHud(index){
    const data=STAGES[index];
    if(!data)return;
    els.period.textContent=data.period;
    els.clock.textContent=data.clock;
    els.scoreA.textContent=data.a;
    els.scoreB.textContent=data.b;
    els.possession.dataset.side=data.side;
    els.shot.textContent=data.shot;
    els.shotRing.style.strokeDashoffset=String(113.1*(1-clamp(data.shot/24)));
    els.pace.textContent=data.pace;
    els.momentum.style.transform=`scaleX(${clamp(data.momentum/100)})`;
    els.ticker.textContent=data.ticker;
  }

  function updateStage(index,local){
    if(index!==currentStage){
      currentStage=index;
      els.root.dataset.stage=String(index);
      els.panels.forEach((panel,panelIndex)=>{
        const selected=panelIndex===index;
        panel.classList.toggle('is-active',selected);
        panel.setAttribute('aria-hidden',selected?'false':'true');
      });
      els.chapters.forEach((chapter,chapterIndex)=>{
        const selected=chapterIndex===index;
        chapter.classList.toggle('is-active',selected);
        if(selected)chapter.setAttribute('aria-current','step');else chapter.removeAttribute('aria-current');
      });
      updateHud(index);
      if(staticMode){
        setStaticStage(index);
        if(local>.45&&index<STAGES.length-1){const preload=new Image();preload.src=stillPath(index+1)}
      }else{
        els.videos.forEach((video,videoIndex)=>video.classList.toggle('is-active',videoIndex===index&&video.readyState>=1));
        const video=ensureVideo(index);
        if(video?.readyState>=1)els.root.classList.add('is-video-ready','is-ready');
      }
    }
    if(!staticMode){
      const video=ensureVideo(index);
      seekVideo(video,local);
      if(local>.52)ensureVideo(index+1);
    }
  }

  function render(progress){
    progress=clamp(progress);
    const index=stageFor(progress);
    const local=localProgress(progress,index);
    els.progress.style.transform=`scaleX(${progress})`;
    updateStage(index,local);
  }

  function calculateProgress(){
    const top=window.scrollY+els.story.getBoundingClientRect().top;
    const range=Math.max(1,els.story.offsetHeight-els.stage.offsetHeight);
    return clamp((window.scrollY-top)/range);
  }

  function frame(){
    rafId=0;
    if(!active)return;
    const delta=targetProgress-renderedProgress;
    if(isReduced()||Math.abs(delta)<.001){renderedProgress=targetProgress}else{renderedProgress+=delta*.22}
    render(renderedProgress);
    if(Math.abs(targetProgress-renderedProgress)>=.001)rafId=requestAnimationFrame(frame);
    publishDebug();
  }

  function requestRender(){
    if(!active)return;
    targetProgress=calculateProgress();
    if(!rafId)rafId=requestAnimationFrame(frame);
  }

  function refreshMode(){
    if(!active)return;
    const nextStatic=mustUseStills();
    if(nextStatic!==staticMode){
      staticMode=nextStatic;
      els.root.classList.toggle('is-static',staticMode);
      if(staticMode){
        unloadVideos();
        setStaticStage(Math.max(0,currentStage));
        setStatus(staticStatus());
      }else{
        staticStage=-1;
        els.poster.src='./assets/cinematic/courtcall-master.webp';
        ensureVideo(Math.max(0,currentStage));
        setStatus('Arena loading · the app is ready now');
      }
    }else if(staticMode){
      staticStage=-1;
      setStaticStage(Math.max(0,currentStage));
      setStatus(staticStatus());
    }
    requestRender();
  }

  function publishDebug(){
    const state={
      active,
      rafPending:Boolean(rafId),
      listeners:listeners.length,
      observer:Boolean(observer),
      mode:modeReason,
      fallback:fallbackMode,
      stage:Math.max(0,currentStage),
      progress:Number(renderedProgress.toFixed(4)),
      loadedVideos:(els.videos||[]).filter(video=>video.dataset.loaded==='true').length,
      videoNodes:(els.videos||[]).length,
      mediaListeners:mediaListeners.length
    };
    window.__courtCallCinematicState=state;
    document.documentElement.dataset.cinematicActive=String(state.active);
    document.documentElement.dataset.cinematicRaf=String(state.rafPending);
    document.documentElement.dataset.cinematicListeners=String(state.listeners);
    document.documentElement.dataset.cinematicMode=state.mode;
    document.documentElement.dataset.cinematicLoadedVideos=String(state.loadedVideos);
  }

  function start(){
    if(active||!cache()||!els.landing.classList.contains('active'))return;
    active=true;
    fallbackMode=false;
    staticMode=mustUseStills();
    webmSupported=document.createElement('video').canPlayType('video/webm; codecs="vp9"')!=='';
    els.root.classList.toggle('is-static',staticMode);
    els.root.classList.remove('is-media-fallback');
    currentStage=-1;
    staticStage=-1;
    targetProgress=calculateProgress();
    renderedProgress=targetProgress;
    on(window,'scroll',requestRender,{passive:true});
    on(window,'resize',refreshMode,{passive:true});
    on(document,'visibilitychange',()=>{if(document.hidden&&rafId){cancelAnimationFrame(rafId);rafId=0}else if(!document.hidden)requestRender()});
    on(window,'courtcall-motion-change',refreshMode);
    const reducedMedia=window.matchMedia(REDUCED_QUERY);
    const mobileMedia=window.matchMedia(MOBILE_QUERY);
    on(reducedMedia,'change',refreshMode);
    on(mobileMedia,'change',refreshMode);
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(connection?.addEventListener)on(connection,'change',refreshMode);
    if('IntersectionObserver' in window){
      observer=new IntersectionObserver(entries=>{
        if(entries.some(entry=>entry.isIntersecting)&&!staticMode)ensureVideo(Math.max(0,currentStage));
      },{root:null,rootMargin:'100% 0px',threshold:0});
      observer.observe(els.story);
    }
    if(staticMode){
      setStatus(staticStatus());
    }else{
      setStatus('Arena loading · the app is ready now');
      ensureVideo(0);
    }
    render(renderedProgress);
    publishDebug();
  }

  function stop(options={}){
    if(routeRafId){cancelAnimationFrame(routeRafId);routeRafId=0}
    if(rafId){cancelAnimationFrame(rafId);rafId=0}
    listeners.splice(0).forEach(remove=>{try{remove()}catch{}});
    if(observer){observer.disconnect();observer=null}
    active=false;
    els.videos?.forEach(video=>{try{video.pause()}catch{}});
    if(options.release!==false)unloadVideos();
    publishDebug();
  }

  function goToStage(index){
    if(!active)start();
    if(!els.story||!els.stage)return;
    index=Math.round(clamp(Number(index),0,STAGES.length-1));
    const top=window.scrollY+els.story.getBoundingClientRect().top;
    const range=Math.max(1,els.story.offsetHeight-els.stage.offsetHeight);
    const progress=index===STAGES.length-1 ? .84 : (index/STAGES.length)+.015;
    window.scrollTo({top:top+range*progress,behavior:isReduced()?'auto':'smooth'});
  }

  function enterApp(target='setup'){
    stop({release:true});
    if(typeof window.routeFromLanding==='function')window.routeFromLanding(target);
    else if(target==='setup'&&typeof window.goSetup==='function')window.goSetup();
    else if(typeof window.showScreen==='function')window.showScreen(target);
  }

  function onRouteChange(name){
    if(routeRafId)cancelAnimationFrame(routeRafId);
    routeRafId=requestAnimationFrame(()=>{
      routeRafId=0;
      if(name==='landing'&&document.getElementById('s-landing')?.classList.contains('active'))start();
      else stop({release:true});
    });
  }

  window.CourtCallCinematic={start,stop,goToStage,enterApp,onRouteChange,useStaticFallback,debugState:()=>({...window.__courtCallCinematicState})};
  window.addEventListener('pagehide',()=>stop({release:true}),{once:true});
  document.addEventListener('DOMContentLoaded',()=>{
    cache();
    if(els.landing?.classList.contains('active'))start();
    else publishDebug();
  });
})();
