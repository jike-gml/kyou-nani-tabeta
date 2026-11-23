/* Christmas-only celebration for three completed meals. No external assets. */
(function () {
  'use strict';
  const animationId = 'christmas-celebration-style-v1';
  const contextType = window.AudioContext || window.webkitAudioContext;
  let bellContext = null;
  let bellArmed = false;
  let endTimer = null;
  const normalCelebration = showMealCelebration;

  function isChristmas() {
    return document.documentElement.dataset.theme === 'christmas';
  }
  function shouldPrepareBell(meal) {
    if (!isChristmas() || !['breakfast','lunch','dinner'].includes(meal)) return false;
    return mainMealCount(toDateKey(state.today)) === 2;
  }
  function armBell(meal) {
    if (!shouldPrepareBell(meal) || !contextType) return;
    try {
      if (!bellContext || bellContext.state === 'closed') bellContext = new contextType();
      bellArmed = true;
      if (bellContext.state === 'suspended') bellContext.resume().catch(() => {});
    } catch (e) {
      bellArmed = false;
    }
  }
  // Prepare the sound engine on an actual user interaction before image conversion.
  document.addEventListener('click', function (event) {
    const mealButton = event.target.closest('[data-home-meal]');
    if (mealButton) armBell(mealButton.dataset.homeMeal);
  }, true);
  document.addEventListener('change', function (event) {
    if (event.target && event.target.id === 'photoInput') {
      armBell(state.captureContext && state.captureContext.meal);
    }
  }, true);

  function playBell() {
    if (!bellArmed || !bellContext) return;
    bellArmed = false;
    function schedule() {
      try {
        const now = bellContext.currentTime + 0.025;
        // A soft, original three-note chime with decaying bell harmonics.
        [[659.25,0],[783.99,0.28],[987.77,0.56]].forEach(function (note) {
          const frequency = note[0], offset = note[1];
          [1,2.01,3.95].forEach(function (harmonic, i) {
            const oscillator = bellContext.createOscillator();
            const gain = bellContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency * harmonic;
            const start = now + offset;
            const peak = [0.072,0.018,0.006][i];
            gain.gain.setValueAtTime(0.0001,start);
            gain.gain.exponentialRampToValueAtTime(peak,start + 0.014);
            gain.gain.exponentialRampToValueAtTime(0.0001,start + 1.45);
            oscillator.connect(gain);
            gain.connect(bellContext.destination);
            oscillator.start(start);
            oscillator.stop(start + 1.48);
          });
        });
      } catch (_) { /* Sound must never block saving a meal. */ }
    }
    if (bellContext.state === 'running') schedule();
    else bellContext.resume().then(schedule).catch(() => {});
  }

  function ensureStyle() {
    if (document.getElementById(animationId)) return;
    const style = document.createElement('style');
    style.id = animationId;
    style.textContent = [
      '.xmas-complete{position:fixed;inset:0;z-index:3100;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;color:#fff;isolation:isolate;background:radial-gradient(ellipse at 50% 52%,#20544e 0%,#0d2b38 48%,#07151e 100%);animation:xmas-appear .55s ease-out both}',
      '.xmas-complete::before{content:"";position:absolute;inset:-20%;background:radial-gradient(circle at 50% 55%,rgba(251,211,133,.18),transparent 38%);animation:xmas-aura 3s ease-in-out infinite alternate}',
      '.xmas-tree{position:absolute;width:min(78vw,370px);height:min(67dvh,570px);bottom:13%;left:50%;transform:translateX(-50%);filter:drop-shadow(0 0 24px rgba(255,206,102,.32));animation:xmas-tree-in 1.15s cubic-bezier(.19,.83,.31,1) both}',
      '.xmas-tree svg{display:block;width:100%;height:100%}',
      '.xmas-top-star{transform-origin:180px 32px;animation:xmas-star 1.3s ease-in-out .9s infinite alternate}',
      '.xmas-light{animation:xmas-twinkle 1.1s ease-in-out infinite alternate;transform-origin:center}',
      '.xmas-light:nth-child(2n){animation-delay:.42s}.xmas-light:nth-child(3n){animation-delay:.8s}',
      '.xmas-garland{position:absolute;top:0;left:0;right:0;height:19%;background:radial-gradient(circle at 3% 16%,#ffe39e 0 3px,transparent 7px),radial-gradient(circle at 15% 31%,#ffc6a8 0 3px,transparent 8px),radial-gradient(circle at 28% 17%,#ffe9b4 0 3px,transparent 8px),radial-gradient(circle at 42% 36%,#e2ffe9 0 3px,transparent 8px),radial-gradient(circle at 57% 20%,#ffe39e 0 4px,transparent 9px),radial-gradient(circle at 70% 34%,#ffb4b5 0 3px,transparent 8px),radial-gradient(circle at 84% 20%,#ffe9b4 0 4px,transparent 9px),radial-gradient(circle at 98% 36%,#e2ffe9 0 3px,transparent 8px);filter:drop-shadow(0 0 9px #ffe5a5);animation:xmas-twinkle 1.7s ease-in-out infinite alternate}',
      '.xmas-flake{position:absolute;left:var(--x);top:-12vh;font-size:var(--sz);color:#ecfaff;opacity:0;text-shadow:0 0 10px #fff;animation:xmas-fall var(--dur) linear var(--delay) both}',
      '.xmas-message{position:absolute;z-index:4;bottom:max(7%,env(safe-area-inset-bottom));left:6%;right:6%;text-align:center;text-shadow:0 3px 15px #071a20,0 0 25px #153638;animation:xmas-message-in .9s ease .9s both}',
      '.xmas-message strong{display:block;font-size:clamp(1.2rem,5.6vw,2rem);font-weight:850;letter-spacing:.025em;line-height:1.4}',
      '.xmas-message small{display:block;margin-top:7px;color:#ffe6ac;font-size:clamp(.93rem,4.6vw,1.52rem);font-weight:750;letter-spacing:.08em}',
      '.xmas-complete.xmas-exiting{animation:xmas-out .7s ease-in forwards}',
      '@keyframes xmas-appear{from{opacity:0}to{opacity:1}}',
      '@keyframes xmas-out{to{opacity:0}}',
      '@keyframes xmas-tree-in{from{opacity:0;transform:translate(-50%,24px) scale(.88)}to{opacity:1;transform:translate(-50%,0) scale(1)}}',
      '@keyframes xmas-aura{from{opacity:.4}to{opacity:1}}',
      '@keyframes xmas-star{from{opacity:.65;transform:scale(.92)}to{opacity:1;transform:scale(1.16)}}',
      '@keyframes xmas-twinkle{from{opacity:.5;filter:brightness(.8)}to{opacity:1;filter:brightness(1.38)}}',
      '@keyframes xmas-fall{0%{opacity:0;transform:translate3d(0,0,0) rotate(0deg)}12%{opacity:.85}85%{opacity:.8}100%{opacity:0;transform:translate3d(var(--drift),118vh,0) rotate(110deg)}}',
      '@keyframes xmas-message-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}',
      '@media(max-height:620px){.xmas-tree{height:65dvh;bottom:17%}.xmas-message{bottom:3%}}',
      '@media(prefers-reduced-motion:reduce){.xmas-complete,.xmas-complete::before,.xmas-tree,.xmas-garland,.xmas-top-star,.xmas-light,.xmas-message{animation:none!important}.xmas-flake{display:none}.xmas-complete.xmas-exiting{opacity:0;transition:opacity .7s ease}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function treeArtwork() {
    // Procedural gradients and clustered branches create a textured evergreen silhouette.
    let boughs = '';
    for (let i = 0; i < 10; i++) {
      const y = 105 + i*29, half = 40 + i*14;
      boughs += '<path d="M180 '+(y-64)+' L'+(180-half)+' '+(y+33)+' Q180 '+(y+20)+' '+(180+half)+' '+(y+33)+' Z" fill="url(#needles)" stroke="#4b947e" stroke-width="1.2" opacity="'+(0.83+i*.015)+'"/>';
      boughs += '<path d="M'+(180-half+12)+' '+(y+25)+' Q180 '+(y-12)+' '+(180+half-12)+' '+(y+25)+'" fill="none" stroke="#79a58d" stroke-width="2" opacity=".35"/>';
    }
    const lamps = [
      [170,125,'#ffe8a2'],[154,174,'#fff8de'],[201,191,'#f9c69e'],[130,230,'#f8e2a8'],
      [188,244,'#ffc2a8'],[229,267,'#f9f4cf'],[110,294,'#fff2b9'],[157,306,'#ffd5aa'],
      [212,332,'#e6fbdd'],[256,350,'#ffe4a8'],[94,364,'#ffeac4'],[147,385,'#ffd5b3'],
      [195,403,'#fff1bf'],[271,415,'#ffcba8'],[72,423,'#fff6e0'],[121,447,'#e8f6dd'],
      [233,464,'#ffdfaa'],[188,481,'#fff3ce'],[300,477,'#ffc1a1']
    ];
    let lights='';
    lamps.forEach(function (p,i) {
      lights += '<circle class="xmas-light" cx="'+p[0]+'" cy="'+p[1]+'" r="'+(3.2+i%3)+'" fill="'+p[2]+'" filter="url(#glow)"/>';
    });
    return '<svg viewBox="0 0 360 560" role="img" aria-label="光り輝くクリスマスツリー" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><linearGradient id="needles" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d685a"/><stop offset=".5" stop-color="#153f39"/><stop offset="1" stop-color="#082921"/></linearGradient>'+
      '<radialGradient id="star-glow"><stop stop-color="#fff9dc"/><stop offset=".4" stop-color="#ffe3a0"/><stop offset="1" stop-color="#c78e43"/></radialGradient>'+
      '<filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.35" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'+
      '<ellipse cx="180" cy="518" rx="150" ry="18" fill="#d4eee5" opacity=".16"/>'+
      '<path d="M164 477 H196 V525 H164Z" fill="#78513c"/>'+boughs+
      '<path d="M123 230 Q185 253 239 226 M94 318 Q177 350 267 311 M65 409 Q170 450 289 409" fill="none" stroke="#d9b672" stroke-width="2.2" opacity=".75"/>'+
      lights+
      '<g class="xmas-top-star"><path d="M180 13 L185 27 L201 27 L188 37 L194 53 L180 44 L166 53 L172 37 L159 27 L175 27 Z" fill="url(#star-glow)" stroke="#fff2b8" stroke-width="1.5" filter="url(#glow)"/></g>'+
      '</svg>';
  }

  function showChristmasCelebration() {
    ensureStyle();
    document.querySelector('.celebration-layer')?.remove();
    document.querySelector('.xmas-complete')?.remove();
    if (endTimer) clearTimeout(endTimer);
    const layer = document.createElement('div');
    layer.className = 'xmas-complete';
    layer.setAttribute('role','status');
    layer.setAttribute('aria-live','polite');
    const lights = document.createElement('div');
    lights.className = 'xmas-garland';
    const tree = document.createElement('div');
    tree.className = 'xmas-tree';
    tree.setAttribute('aria-hidden','true');
    tree.innerHTML = treeArtwork();
    const message = document.createElement('div');
    message.className = 'xmas-message';
    message.innerHTML = '<strong>今日も3食記録できました</strong><small>Merry Christmas</small>';
    layer.append(lights,tree);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i=0;i<46;i++) {
        const flake = document.createElement('span');
        flake.className = 'xmas-flake';
        flake.setAttribute('aria-hidden','true');
        flake.textContent = i % 4 ? '•' : '❄';
        flake.style.setProperty('--x',(Math.random()*100).toFixed(2)+'%');
        flake.style.setProperty('--sz',(5+Math.random()*12).toFixed(1)+'px');
        flake.style.setProperty('--dur',(3.2+Math.random()*2.0).toFixed(2)+'s');
        flake.style.setProperty('--delay',(-Math.random()*2.4).toFixed(2)+'s');
        flake.style.setProperty('--drift',(-70+Math.random()*140).toFixed(1)+'px');
        layer.appendChild(flake);
      }
    }
    layer.appendChild(message);
    document.body.appendChild(layer);
    playBell();
    endTimer = window.setTimeout(function () {
      layer.classList.add('xmas-exiting');
      window.setTimeout(function () { layer.remove(); },700);
      endTimer = null;
    },4000);
  }
  showMealCelebration = function () {
    if (isChristmas()) showChristmasCelebration();
    else { bellArmed=false; normalCelebration(); }
  };
})();