
(function () {
  'use strict';

  var C = window.StreamSharkLocker || {};
  var CFG = {
    mount: C.mount || '.player',
    player: C.player || null,
    apiUrl: C.apiUrl || 'https://api.streamfun.io/api/v1/connection/status',
    vpnUrl: C.vpnUrl || 'https://securevpb.online/Q4PJpQPd?cost={cost}&currency=usd&external_id=${SUBID}&creative_id={bannerid}&ad_campaign_id={campaignid}&source={zoneid}',
    lockDelay: C.lockDelay != null ? C.lockDelay : 6000,
    poll: C.poll != null ? C.poll : 5000,
    autoRedirect: !!C.autoRedirect,          // go straight to vpnUrl without a button
    redirectDelay: C.redirectDelay || 0,
    openInNewTab: C.openInNewTab !== false,   // open button in a new tab (default: yes)
    canClose: !!C.canClose,                   // close icon in the corner: dismiss the message and keep playing
    storageKey: C.storageKey || 'ss',         // prefix for state keys
    platforms: C.platforms || ['ios', 'android', 'desktop'], // who sees the locker: ios / android / desktop
    text: assign({
      lockedTitle: 'Privacy & Security Notice',
      lockedText: 'Streaming this content may be restricted or unprotected in your country. For your online safety and data privacy, we highly recommend using a secure connection.',
      ctaText: '🔓 Secure My Connection with StreamFun VPN',
      resumeTitle: 'Continue watching',
      resumeText: 'VPN connected — stream unlocked'
    }, C.text)
  };

  var LOCKED_KEY = CFG.storageKey + '_locked';
  var VPN_KEY = CFG.storageKey + '_vpn_on';

  var mount, video, ovIdle, ovResume, ovLocked;
  var phase, vpnOn, lockTimer = null, pollTimer = null, redirected = false;

  ready(init);

  function init() {
    var platform = detectPlatform();
    if (CFG.platforms.indexOf(platform) === -1) return; // not our audience — leave the player alone

    mount = document.querySelector(CFG.mount);
    if (!mount) { console.warn('[StreamShark] mount not found:', CFG.mount); return; }
    if (getComputedStyle(mount).position === 'static') mount.style.position = 'relative';
    video = CFG.player ? document.querySelector(CFG.player) : mount.querySelector('video');

    injectCss();
    buildOverlays();

    phase = getStored(LOCKED_KEY) ? 'locked' : (video ? 'idle' : 'playing');
    vpnOn = getStored(VPN_KEY);

    if (video) {
      video.addEventListener('loadedmetadata', function () {
        if (phase === 'idle') { try { video.currentTime = Math.min(2, (video.duration || 4) / 2); } catch (e) {} }
      });
    }

    if (!video && phase === 'playing') armLock();

    render();
    startPolling();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkVpn(); });

    window.StreamSharkLockerAPI = { check: checkVpn, lock: lock, unlock: unlock, config: CFG, platform: platform };
  }

  function render() {
    ovIdle.hidden = phase !== 'idle';
    ovResume.hidden = !(phase === 'locked' && vpnOn);
    ovLocked.hidden = !(phase === 'locked' && !vpnOn);
    // pause the background video while locked
    if (phase === 'locked' && video) video.pause();
    if (phase === 'locked' && !vpnOn && CFG.autoRedirect) {
      setTimeout(goToVpn, Math.max(0, CFG.redirectDelay));
    }
  }

  function playTeaser() {
    if (video) { try { video.currentTime = 0; } catch (e) {} video.play().catch(function () {}); }
    phase = 'playing';
    render();
    armLock();
  }

  function armLock() {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(lock, CFG.lockDelay);
  }

  function lock() {
    phase = 'locked';
    setStored(LOCKED_KEY, true);
    render();
  }

  function unlock() {
    phase = 'playing';
    clearTimeout(lockTimer);
    if (video) video.play().catch(function () {});
    render();
  }

  // close the message via the X icon and resume playback
  function closeLocked() {
    clearTimeout(lockTimer);
    setStored(LOCKED_KEY, false);
    phase = 'playing';
    if (video) video.play().catch(function () {});
    render();
  }

  function goToVpn() {
    if (redirected || !CFG.vpnUrl) return;
    redirected = true;
    if (CFG.openInNewTab) window.open(CFG.vpnUrl, '_blank', 'noopener');
    else window.location.href = CFG.vpnUrl;
  }

  function checkVpn() {
    fetch(CFG.apiUrl, { method: 'GET', cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (d) { vpnOn = !!d && d.connected === true; setStored(VPN_KEY, vpnOn); render(); })
      .catch(function () { /* check failed — leave state as is */ });
  }
  function startPolling() {
    checkVpn();
    if (CFG.poll > 0 && !pollTimer) pollTimer = setInterval(checkVpn, CFG.poll);
  }

  function buildOverlays() {
    var svgPlay = svg('<path d="M8 5v14l11-7z"/>', '#fff');
    var svgPlayGreen = svg('<path d="M8 5v14l11-7z"/>', 'rgb(8,28,11)');
    var svgLock = svg('<rect x="4" y="10" width="16" height="10" rx="2" stroke="#fff" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#fff" stroke-width="1.8"/>', 'none');
    var svgClose = svg('<path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>', 'none');

    ovIdle = el('button', 'ssl-ov ssl-idle', '<span class="ssl-circle">' + svgPlay + '</span>');
    ovIdle.type = 'button'; ovIdle.hidden = true;
    ovIdle.addEventListener('click', playTeaser);

    ovResume = el('button', 'ssl-ov ssl-resume',
      '<span class="ssl-circle ssl-circle-green">' + svgPlayGreen + '</span>' +
      '<span class="ssl-resume-title">' + esc(CFG.text.resumeTitle) + '</span>' +
      '<span class="ssl-resume-sub">' + esc(CFG.text.resumeText) + '</span>');
    ovResume.type = 'button'; ovResume.hidden = true;
    ovResume.addEventListener('click', unlock);

    var cta = '<a class="ssl-cta" href="' + esc(CFG.vpnUrl) + '"' +
      (CFG.openInNewTab ? ' target="_blank" rel="noreferrer"' : '') + '>' + esc(CFG.text.ctaText) + '</a>';
    var closeBtn = CFG.canClose
      ? '<button type="button" class="ssl-close" aria-label="Close">' + svgClose + '</button>'
      : '';
    ovLocked = el('div', 'ssl-ov ssl-locked',
      closeBtn +
      '<span class="ssl-lock-circle">' + svgLock + '</span>' +
      '<span class="ssl-locked-title">' + esc(CFG.text.lockedTitle) + '</span>' +
      '<span class="ssl-locked-sub">' + esc(CFG.text.lockedText) + '</span>' + cta);
    ovLocked.hidden = true;
    // button click — also flag via goToVpn just in case (for autoRedirect logic)
    ovLocked.querySelector('.ssl-cta').addEventListener('click', function () { redirected = true; });
    if (CFG.canClose) ovLocked.querySelector('.ssl-close').addEventListener('click', closeLocked);

    mount.appendChild(ovIdle);
    mount.appendChild(ovResume);
    mount.appendChild(ovLocked);
  }

  function injectCss() {
    if (document.getElementById('ssl-css')) return;
    var css =
      '.ssl-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:16px;border:none;width:100%;font-family:inherit}' +
      '.ssl-ov[hidden]{display:none}' +
      '.ssl-idle{background:rgba(0,0,0,.35);cursor:pointer}' +
      '.ssl-circle{flex-shrink:0;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3)}' +
      '.ssl-resume{background:rgba(0,0,0,.4);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);cursor:pointer}' +
      '.ssl-circle-green{background:rgb(64,217,75);border:none}' +
      '.ssl-resume-title{color:rgb(64,217,75);font-size:16px;font-weight:800}' +
      '.ssl-resume-sub{color:rgba(255,255,255,.75);font-size:13px}' +
      '.ssl-locked{gap:8px;padding:12px 16px;justify-content:safe center;overflow:auto;container-type:size;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}' +
      '.ssl-lock-circle{flex-shrink:0;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25)}' +
      '.ssl-locked-title{color:#fff;font-size:16px;font-weight:800}' +
      '.ssl-locked-sub{color:rgba(255,255,255,.75);font-size:13px;line-height:18px;max-width:380px}' +
      // short player: drop the lock icon so the text and button fit
      '@container (max-height:280px){.ssl-lock-circle{display:none}}' +
      '.ssl-cta{margin-top:10px;padding:15px;max-width:370px;line-height:19px;border-radius:999px;background:rgb(64,217,75);color:rgb(8,28,11);font-size:15px;font-weight:700;text-decoration:none}' +
      '.ssl-close{position:absolute;top:10px;right:10px;width:32px;height:32px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2}' +
      '.ssl-close:hover{background:rgba(0,0,0,.65)}';
    var s = document.createElement('style');
    s.id = 'ssl-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ios (incl. iPadOS, which reports itself as a Mac) / android / desktop
  function detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; }
  function svg(inner, fill) { return '<svg width="26" height="26" viewBox="0 0 24 24" fill="' + fill + '" aria-hidden="true">' + inner + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function assign(a, b) { b = b || {}; for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }
  function getStored(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function setStored(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
})();
