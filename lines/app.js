/* the toybox — draw lines out of the ohisms archive
   ------------------------------------------------------------------
   bank.js gives us:
     s[]  sources: { n: meme name, c: category, d: date, m: explicit }
     l[]  lines:   [ text, sourceIndex, flags, postIndex ]
     p[]  post ids
   flags: 1 = carries [ S ] / [ R ] slots, 2 = explicit material        */
(function () {
  'use strict';

  var BANK = window.OHISMS;
  if (!BANK || !BANK.l || !BANK.l.length) return;

  var SRC = BANK.s, POST = BANK.p, LINES = BANK.l;
  var FLAG_SLOTS = 1, FLAG_EXPLICIT = 2;

  var CATS = [
    ['all',      'everything'],
    ['dialogue', 'dialogue'],
    ['action',   'action'],
    ['setting',  'settings'],
    ['shippy',   'shippy'],
    ['lyric',    'lyrics'],
    ['sinday',   'sinday']
  ];
  var el = {
    chips:   document.getElementById('chips'),
    mature:  document.getElementById('mature'),
    deal:    document.getElementById('deal'),
    copy:    document.getElementById('copy'),
    copyLabel: document.querySelector('#copy .cmd-text'),
    lines:   document.getElementById('lines'),
    credit:  document.getElementById('credit'),
    ledger:  document.getElementById('ledger-count'),
    recent:  document.getElementById('recent'),
    recentW: document.getElementById('recent-wrap'),
    built:   document.getElementById('built'),
    keyhint: document.getElementById('keyhint')
  };

  var state = {
    cat: 'all',
    mature: false,
    drawn: [],       // [{li, text, src, post, flags}]
    seen: [],        // recent draws, newest first
    exhausted: {}    // index set per filter, so a long session doesn't repeat
  };

  /* ── helpers ─────────────────────────────────────────────────────── */
  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // [ S ] / [ R ] / [ NAME ] read as blanks to fill in, so tint them.
  var SLOT = /\[\s*(S|R|NAME|SENDER|RECEIVER|MUSE|YOU|THEM)\s*\]/gi;
  function slots(html) {
    return html.replace(SLOT, function (m) {
      return '<span class="slot">' + m.replace(/\s+/g, ' ').toUpperCase() + '</span>';
    });
  }

  /* the meme title rendered the way ohisms styles its own headers: one
     colour per letter walking a grey ramp. the floor clears 5.4:1 on the page
     background and the ceiling is held at #d5d5d5, just under body-text
     brightness, so the ramp reads as a gradient rather than a fade to nowhere.
     it originally started at #484848, which was 2.2:1 and read as a smudge
     for the first letter of every credit. */
  var RAMP = ['#868686', '#919191', '#9d9d9d', '#a8a8a8', '#b3b3b3', '#bebebe', '#cacaca', '#d5d5d5'];
  function rampTitle(str) {
    var out = '', i = 0, k = 0;
    for (; i < str.length; i++) {
      var ch = str[i];
      if (ch === ' ') { out += ' '; continue; }
      var c = RAMP[Math.min(RAMP.length - 1, Math.floor(k / Math.max(1, (str.length - 1)) * RAMP.length))]
      out += '<span style="color:' + c + '">' + esc(ch) + '</span>';
      k++;
    }
    return out;
  }

  function fmtDate(d) {
    var parts = String(d || '').split('-');
    if (parts.length < 3) return '';
    var M = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return M[+parts[1] - 1] + ' ' + parts[0];
  }

  function num(n) { return n.toLocaleString('en-US'); }

  /* which lines survive the current filters? note 'sinday' is a flag, not a
     drawer -- it cuts across dialogue and setting and stays behind the gate. */
  function pool() {
    var cat = state.cat, wantMature = state.mature, i, out = [];
    for (i = 0; i < LINES.length; i++) {
      var li = LINES[i];
      if (cat === 'sinday') {
        if (!(li[2] & FLAG_EXPLICIT)) continue;
      } else if (cat !== 'all' && SRC[li[1]].c !== cat) {
        continue;
      }
      if (li[2] & FLAG_EXPLICIT && !wantMature) continue;
      out.push(i);
    }
    return out;
  }

  function hasMature() {
    for (var i = 0; i < LINES.length; i++) if (LINES[i][2] & FLAG_EXPLICIT) return true;
    return false;
  }

  function makeRec(li) {
    return { li: li, text: LINES[li][0], src: SRC[LINES[li][1]],
             post: POST[LINES[li][3]], flags: LINES[li][2] };
  }

  /* is this line behind the mature gate? anything that can put a line in front
     of the reader -- the stage, the recent list, a recall click -- has to ask. */
  function gated(li) {
    var l = LINES[li];
    return !!(l && (l[2] & FLAG_EXPLICIT));
  }

  /* the recent list is at most three, newest first. recalling a line promotes
     it instead of filing a second copy, so dedupe on the line index: render()
     used to unshift unconditionally, which let a recalled line show up twice
     in its own history. */
  function pushSeen(rec) {
    state.seen = state.seen.filter(function (r) { return r.li !== rec.li; });
    state.seen.unshift({ text: rec.text, src: rec.src.n, li: rec.li });
    state.seen = state.seen.slice(0, 3);
  }

  /* what the recent list may show under the current gate */
  function visibleSeen() {
    return state.seen.filter(function (r) { return state.mature || !gated(r.li); });
  }

  /* ── drawing ─────────────────────────────────────────────────────── */
  function drawOne(list, avoid) {
    // prefer something not already served this session; relax if we run dry
    var tries = 0, pick;
    do {
      pick = list[Math.floor(Math.random() * list.length)];
      tries++;
    } while (avoid && avoid[pick] && tries < 40);
    return pick;
  }

  function deal() {
    var list = pool();
    if (!list.length) return;

    var avoid = state.exhausted[state.cat] || (state.exhausted[state.cat] = {});
    var hand = [];

    // one line, one pick -- prefer something this session hasn't already
    // served, and if the drawer is nearly spent, reshuffle rather than repeat
    if (Object.keys(avoid).length > list.length * 0.85) {
      state.exhausted[state.cat] = {};
      avoid = state.exhausted[state.cat];
    }
    var pick = drawOne(list, avoid);
    avoid[pick] = 1;
    hand.push(makeRec(pick));

    state.drawn = hand;
    pushSeen(hand[0]);
    renderRecent();
    render(true);
  }

  /* ── rendering ───────────────────────────────────────────────────── */
  function render(animate) {
    var hand = state.drawn;
    if (!hand.length) return;

    var src = hand[0].src;

    var html = '';
    hand.forEach(function (r, i) {
      html += '<li style="--d:' + i + '" data-li="' + r.li + '">' + slots(esc(r.text)) + '</li>';
    });
    el.lines.innerHTML = html;

    // with the header gone the credit is where the meme names itself, so it
    // carries the grey letter ramp the titles used to have
    var c = '<div class="credit-name">' + rampTitle(src.n) + '</div>' +
            '<div class="credit-meta">' + esc(catWord(src.c)) +
            ' &nbsp;·&nbsp; ' + fmtDate(src.d) + ' &nbsp;·&nbsp; ' +
            '<a href="https://ohisms.tumblr.com/post/' + hand[0].post +
            '" target="_blank" rel="noopener">the original post ↗</a></div>';
    if (hand.some(function (r) { return r.flags & FLAG_SLOTS; })) {
      c += '<div class="credit-note">[ s ] speaks&nbsp;&nbsp;·&nbsp;&nbsp;[ r ] listens&nbsp;&nbsp;·&nbsp;&nbsp;swap them to taste</div>';
    }
    if (hand.some(function (r) { return r.flags & FLAG_EXPLICIT; })) {
      c += '<div class="credit-note warn">explicit — this one came out of a sinday meme.</div>';
    }
    el.credit.innerHTML = c;
    el.credit.hidden = false;

    el.copy.disabled = false;
    el.copy.classList.remove('done');
    el.copyLabel.textContent = 'copy';

    // render() is display only. it used to record the draw into state.seen,
    // which meant every re-render (e.g. recalling a recent line) filed a
    // duplicate, and nothing could be filtered out of the list without also
    // losing the record. recording lives in pushSeen(), called by the only two
    // paths that actually draw: deal() and the recent-list recall.
    if (animate && !reduce()) scramble(hand);
  }

  function catWord(c) {
    return ({ dialogue: 'dialogue', action: 'action', setting: 'setting',
              shippy: 'shippy', lyric: 'lyric' })[c] || c;
  }

  function reduce() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // a brief shuffle before the line settles. three swaps, 40ms apart, then done.
  function scramble(hand) {
    var lis = el.lines.querySelectorAll('li');
    var pool2 = pool();
    if (!pool2.length) return;
    var ticks = 0, timer = setInterval(function () {
      ticks++;
      for (var i = 0; i < lis.length; i++) {
        var t = LINES[pool2[Math.floor(Math.random() * pool2.length)]][0];
        lis[i].innerHTML = slots(esc(t));
        lis[i].classList.add('scramble');
      }
      if (ticks >= 3) {
        clearInterval(timer);
        for (var j = 0; j < lis.length; j++) {
          lis[j].innerHTML = slots(esc(hand[j] ? hand[j].text : hand[0].text));
          lis[j].classList.remove('scramble');
        }
      }
    }, 42);
  }

  function renderRecent() {
    // the gate applies here too: a line drawn while mature content was allowed
    // must not sit in the recent list waiting to be recalled after opting out
    var vis = visibleSeen();
    if (!vis.length) { el.recentW.hidden = true; el.recent.innerHTML = ''; return; }
    el.recentW.hidden = false;
    el.recent.innerHTML = vis.map(function (r, i) {
      return '<li style="animation-delay:' + (i * 30) + 'ms"><button data-li="' + r.li + '">' +
             esc(r.text) + '<span class="r-src">' + esc(r.src.toLowerCase()) + '</span></button></li>';
    }).join('');
  }

  /* ── controls ────────────────────────────────────────────────────── */
  function buildChips() {
    var counts = { all: LINES.length };
    LINES.forEach(function (li) {
      var c = SRC[li[1]].c;
      counts[c] = (counts[c] || 0) + 1;
      // sinday cuts across the drawers, so it tallies separately
      if (li[2] & FLAG_EXPLICIT) counts.sinday = (counts.sinday || 0) + 1;
    });

    el.chips.innerHTML = CATS.map(function (pair) {
      var key = pair[0];
      var n = counts[key] || 0;
      return '<button class="chip" data-cat="' + key + '" aria-pressed="' +
        (key === state.cat) + '">' + pair[1] + '<span class="tally">' + num(n) + '</span></button>';
    }).join('');
  }

  function syncChips() {
    // the only chip that can be dead is sinday, until the gate is on
    el.chips.querySelectorAll('.chip').forEach(function (c) {
      var key = c.getAttribute('data-cat');
      var gated = key === 'sinday' && !state.mature;
      c.disabled = gated;
      if (c.disabled && state.cat === key) setCat('all');
    });
  }

  function setCat(key) {
    state.cat = key;
    el.chips.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-cat') === key));
    });
    remember();
  }

  function remember() {
    if (!history.replaceState) return;
    var q = [];
    if (state.cat !== 'all') q.push('cat=' + state.cat);
    if (state.mature) q.push('mature=1');
    try { history.replaceState(null, '', q.length ? '?' + q.join('&') : location.pathname); } catch (e) {}
  }

  function restore() {
    var q = new URLSearchParams(location.search);
    if (q.get('mature') === '1' && hasMature()) { state.mature = true; el.mature.setAttribute('aria-checked', 'true'); }
    var c = q.get('cat');
    if (c && CATS.some(function (p) { return p[0] === c; })) state.cat = c;
  }

  /* ── clipboard ───────────────────────────────────────────────────── */
  function asText() {
    var hand = state.drawn;
    if (!hand.length) return '';
    // one line: hand over the line itself, then name where it came from
    return hand[0].text + '\n' +
           '— ' + hand[0].src.n.toLowerCase() + '\n\n' +
           '( pulled from ohisms.tumblr.com — est. 2016 )';
  }

  function copy() {
    var text = asText();
    if (!text) return;
    var done = function () {
      copied();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    } else {
      fallback(text, done);
    }
  }

  function copied() {
    el.copy.classList.add('done');
    el.copyLabel.textContent = 'copied';
    toast('copied ' + state.drawn.length + (state.drawn.length > 1 ? ' lines' : ' line'));
    setTimeout(function () {
      el.copy.classList.remove('done');
      el.copyLabel.textContent = 'copy';
    }, 1800);
  }

  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    // execCommand reports whether the copy actually happened. announcing success
    // without reading it claimed a copy on browsers that refused outright.
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) done(); else toast('copy blocked — select by hand');
  }

  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

  /* ── wiring ──────────────────────────────────────────────────────── */
  el.chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b || b.disabled) return;
    setCat(b.getAttribute('data-cat'));
    deal();
  });

  el.mature.addEventListener('click', function () {
    state.mature = !state.mature;
    el.mature.setAttribute('aria-checked', String(state.mature));
    syncChips();
    remember();
    // closing the gate has to reach the recent list, not just the stage
    if (!state.mature) { state.seen = visibleSeen(); renderRecent(); }
    deal();
  });

  el.deal.addEventListener('click', function () {
    el.deal.classList.add('busy');
    setTimeout(function () { el.deal.classList.remove('busy'); }, 220);
    state.exhausted[state.cat] = state.exhausted[state.cat] || {};
    deal();
  });

  el.copy.addEventListener('click', copy);

  el.recent.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-li]');
    if (!b) return;
    var li = +b.getAttribute('data-li');
    if (gated(li) && !state.mature) return;   // the gate closed since it was drawn
    var rec = makeRec(li);
    state.drawn = [rec];
    pushSeen(rec);       // promotes it to the front instead of filing a duplicate
    renderRecent();
    render(false);
    el.lines.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
  });

  /* WCAG 2.1.4 wants a single-character key shortcut to be remappable,
     switchable off, or active only on focus. Space and `c` are both single
     characters, so they can be switched off: `?keys=off` does it and the choice
     sticks -- a URL flag alone would vanish the moment remember() rewrote the
     query string -- and `?keys=on` brings them back. Enter is left alone: it is
     the standard activation key, not a character shortcut. */
  var KEYS_OFF = (function () {
    var q = '';
    try { q = new URLSearchParams(location.search).get('keys') || ''; } catch (err) {}
    try {
      if (q === 'off') localStorage.setItem('ohisms.keys', 'off');
      else if (q === 'on') localStorage.removeItem('ohisms.keys');
      return localStorage.getItem('ohisms.keys') === 'off';
    } catch (err) { return q === 'off'; }
  })();

  /* anything that already owns Enter, Space or a letter: a link, a button, a
     field. Enter on the credit's "the original post" link has to open the post,
     and it used to be swallowed and turned into another draw instead. */
  function interactive(node) {
    if (!node || !node.closest) return false;
    return !!node.closest('a[href], button, input, textarea, select, summary, ' +
                          '[contenteditable], [role="button"], [role="link"], [role="switch"]');
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (interactive(e.target)) return;
    if (e.key === 'Enter') { e.preventDefault(); el.deal.click(); return; }
    if (KEYS_OFF) return;          // space falls back to scrolling the page
    if (e.key === ' ') { e.preventDefault(); el.deal.click(); }
    else if (e.key === 'c' || e.key === 'C') { copy(); }
  });

  /* ── boot ────────────────────────────────────────────────────────── */
  restore();
  buildChips();
  syncChips();

  var total = LINES.length;
  el.ledger.innerHTML = '<b>' + num(total) + '</b> lines &nbsp;·&nbsp; <b>' + num(SRC.length) +
    '</b> memes&nbsp;&nbsp;—&nbsp;&nbsp;pick your poison! <span class="heart">♡</span>';
  if (el.built) el.built.textContent = BANK.built;

  // the hint advertises keys that are switched off; don't lie about them
  if (KEYS_OFF && el.keyhint) el.keyhint.hidden = true;

  // one line on arrival, a beat after paint so the shuffle reads as the page
  // waking up rather than a flash of content. #draw is the same thing with no
  // wait -- these two used to run together and both called deal(), so the hash
  // draw was overwritten and a single page load filed two entries.
  if (location.hash === '#draw') {
    el.deal.click();
  } else {
    setTimeout(function () { deal(); }, reduce() ? 0 : 140);
  }
})();
