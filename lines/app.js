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
    ['shippy',   'shippy'],
    ['action',   'action'],
    ['lyric',    'lyrics'],
    ['scenario', 'settings'],
    ['film-tv',  'film / tv'],
    ['smut',     'sinday']
  ];
  var SIZES = [1, 3, 5];

  var el = {
    chips:   document.getElementById('chips'),
    sizes:   document.getElementById('sizes'),
    mature:  document.getElementById('mature'),
    deal:    document.getElementById('deal'),
    copy:    document.getElementById('copy'),
    copyLabel: document.querySelector('#copy .cmd-text'),
    lines:   document.getElementById('lines'),
    credit:  document.getElementById('credit'),
    ledger:  document.getElementById('ledger-count'),
    recent:  document.getElementById('recent'),
    recentW: document.getElementById('recent-wrap'),
    built:   document.getElementById('built')
  };

  var state = {
    cat: 'all',
    size: 1,
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
     colour per letter walking a grey ramp. */
  var RAMP = ['#484848', '#5a5a5a', '#6c6c6c', '#7e7e7e', '#909090', '#a2a2a2', '#b4b4b4', '#c6c6c6'];
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

  /* which lines survive the current filters? */
  function pool() {
    var cat = state.cat, wantMature = state.mature, i, out = [];
    for (i = 0; i < LINES.length; i++) {
      var li = LINES[i], src = SRC[li[1]];
      if (cat !== 'all' && src.c !== cat) continue;
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

    if (state.size > 1) {
      // a hand of several lines should come out of ONE meme, the way a real
      // ohisms post reads. find memes deep enough to fill the hand.
      var bySource = {};
      list.forEach(function (i) { (bySource[LINES[i][1]] = bySource[LINES[i][1]] || []).push(i); });
      var deep = Object.keys(bySource).filter(function (k) {
        return bySource[k].length >= state.size;
      });
      if (deep.length) {
        var pick = deep[Math.floor(Math.random() * deep.length)];
        var bag = bySource[pick].slice();
        while (hand.length < state.size && bag.length) {
          var j = Math.floor(Math.random() * bag.length);
          hand.push(makeRec(bag.splice(j, 1)[0]));
        }
      }
    }

    if (!hand.length) {
      var want = state.size, guard = 0;
      while (hand.length < want && guard++ < 200) {
        var li = drawOne(list, avoid);
        if (!avoid[li]) { avoid[li] = 1; hand.push(makeRec(li)); }
        else if (hand.length === 0 && guard > 150) hand.push(makeRec(li));
      }
    }

    // a session that has seen everything gets a fresh shuffle
    if (Object.keys(avoid).length > list.length * 0.85) state.exhausted[state.cat] = {};

    state.drawn = hand;
    render(true);
  }

  /* ── rendering ───────────────────────────────────────────────────── */
  function render(animate) {
    var hand = state.drawn;
    if (!hand.length) return;

    var src = hand[0].src;
    var mixed = hand.some(function (r) { return r.src !== src; });
    var name = mixed ? 'a mixed hand' : src.n;

    var html = '';
    hand.forEach(function (r, i) {
      html += '<li style="--d:' + i + '" data-li="' + r.li + '">' + slots(esc(r.text)) + '</li>';
    });
    el.lines.innerHTML = html;

    // with the header gone the credit is where the meme names itself, so it
    // carries the grey letter ramp the titles used to have
    var dates = hand.map(function (r) { return r.src.d; }).sort();
    var c = '<div class="credit-name">' + rampTitle(name) + '</div>' +
            '<div class="credit-meta">' + (mixed ? 'several memes' : esc(catWord(src.c))) +
            ' &nbsp;·&nbsp; ' + fmtDate(dates[0]) + ' &nbsp;·&nbsp; ' +
            (mixed
              ? '<a href="https://ohisms.tumblr.com/" target="_blank" rel="noopener">the archive ↗</a>'
              : '<a href="https://ohisms.tumblr.com/post/' + hand[0].post + '" target="_blank" rel="noopener">the original post ↗</a>') +
            '</div>';
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

    if (!mixed && hand[0].src) {
      var n = state.seen.length + 1;
      state.seen.unshift({ text: hand[0].text, src: hand[0].src.n, li: hand[0].li });
      state.seen = state.seen.slice(0, 6);
      renderRecent();
    }

    if (animate && !reduce()) scramble(hand);
  }

  function catWord(c) {
    return ({ dialogue: 'dialogue', shippy: 'shippy', action: 'action', lyric: 'lyric',
              scenario: 'setting', 'film-tv': 'film & tv', smut: 'sinday', other: 'assorted' })[c] || c;
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
    if (!state.seen.length) { el.recentW.hidden = true; return; }
    el.recentW.hidden = false;
    el.recent.innerHTML = state.seen.map(function (r, i) {
      return '<li style="animation-delay:' + (i * 30) + 'ms"><button data-li="' + r.li + '">' +
             esc(r.text) + '<span class="r-src">' + esc(r.src.toLowerCase()) + '</span></button></li>';
    }).join('');
  }

  /* ── controls ────────────────────────────────────────────────────── */
  function buildChips() {
    var counts = { all: 0 };
    LINES.forEach(function (li) {
      var c = SRC[li[1]].c;
      counts[c] = (counts[c] || 0) + 1;
      counts.all++;
    });

    el.chips.innerHTML = CATS.map(function (pair) {
      var key = pair[0];
      var n = counts[key] || 0;
      return '<button class="chip" data-cat="' + key + '" aria-pressed="' +
        (key === state.cat) + '">' + pair[1] + '<span class="tally">' + num(n) + '</span></button>';
    }).join('');

    el.sizes.innerHTML = SIZES.map(function (n) {
      return '<button class="chip" data-size="' + n + '" aria-pressed="' + (n === state.size) +
        '">' + (n === 1 ? 'one line' : n + ' lines') + '</button>';
    }).join('');
  }

  function syncMatureAvailability() {
    var on = state.mature;
    el.chips.querySelectorAll('.chip').forEach(function (c) {
      var key = c.getAttribute('data-cat');
      var needs = key === 'smut';
      c.disabled = needs && !on;
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

  function setSize(n) {
    state.size = n;
    el.sizes.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(+c.getAttribute('data-size') === n));
    });
    remember();
  }

  function remember() {
    if (!history.replaceState) return;
    var q = [];
    if (state.cat !== 'all') q.push('cat=' + state.cat);
    if (state.size !== 1) q.push('n=' + state.size);
    if (state.mature) q.push('mature=1');
    try { history.replaceState(null, '', q.length ? '?' + q.join('&') : location.pathname); } catch (e) {}
  }

  function restore() {
    var q = new URLSearchParams(location.search);
    if (q.get('mature') === '1' && hasMature()) { state.mature = true; el.mature.setAttribute('aria-checked', 'true'); }
    var n = parseInt(q.get('n'), 10);
    if (SIZES.indexOf(n) > -1) state.size = n;
    var c = q.get('cat');
    if (c && CATS.some(function (p) { return p[0] === c; })) state.cat = c;
  }

  /* ── clipboard ───────────────────────────────────────────────────── */
  function asText() {
    var hand = state.drawn;
    if (!hand.length) return '';
    var name = hand[0].src.n;
    var out = ['✱ ˚｡⋆ ↪ ' + name.toUpperCase(), ''];
    hand.forEach(function (r, i) {
      out.push((i + 1 < 10 ? '0' : '') + (i + 1) + '. ' + r.text);
    });
    out.push('');
    out.push('( pulled from ohisms.tumblr.com — est. 2016 )');
    return out.join('\n');
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
    try { document.execCommand('copy'); done(); } catch (e) { toast('copy blocked — select by hand'); }
    document.body.removeChild(ta);
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

  el.sizes.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    setSize(+b.getAttribute('data-size'));
    deal();
  });

  el.mature.addEventListener('click', function () {
    state.mature = !state.mature;
    el.mature.setAttribute('aria-checked', String(state.mature));
    syncMatureAvailability();
    remember();
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
    var rec = makeRec(+b.getAttribute('data-li'));
    state.drawn = [rec];
    render(false);
    el.lines.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault();
      el.deal.click();
    } else if (e.key === 'c' || e.key === 'C') {
      copy();
    }
  });

  /* ── boot ────────────────────────────────────────────────────────── */
  restore();
  buildChips();
  syncMatureAvailability();
  el.sizes.querySelectorAll('.chip').forEach(function (c) {
    c.setAttribute('aria-pressed', String(+c.getAttribute('data-size') === state.size));
  });

  var total = LINES.length;
  el.ledger.innerHTML = '<b>' + num(total) + '</b> lines &nbsp;·&nbsp; <b>' + num(SRC.length) +
    '</b> memes&nbsp;&nbsp;—&nbsp;&nbsp;the whole pile, one deal at a time';
  if (el.built) el.built.textContent = BANK.built;

  if (location.hash === '#draw') el.deal.click();

  // deal the first hand on arrival, a beat after paint so the shuffle reads
  // as the page waking up rather than a flash of content
  setTimeout(function () { deal(); }, reduce() ? 0 : 140);
})();
