/* DKT Practice — a small vanilla-JS quiz app.
   Data comes from data/questions.js (window.QUESTIONS). Progress lives in localStorage. */
(function () {
  'use strict';

  var ALL = window.QUESTIONS || [];
  var HANDBOOK = window.HANDBOOK || [];
  var GUIDE = window.GUIDE || [];
  var MOCK_SIZE = 45;      // questions in a mock test
  var MOCK_PASS = 41;      // correct answers needed to pass
  var LETTERS = ['A', 'B', 'C', 'D'];
  var STORE_KEY = 'dkt.progress.v1';

  // Section order matches the numbered subfolders the questions were sourced from:
  // 1_General, 2_Alcohol & Drugs, 3_Fatigue & driving, 4_Intersections, 5_Traffic Lanes,
  // 6_Negligent Driving, 7_Pedestrians, 8_Seat Belts, 9_Speed Limits, 10_Street Signs.
  var CATEGORY_ORDER = [
    'General Knowledge',
    'Alcohol and Drugs',
    'Fatigue and Driving',
    'Intersections',
    'Traffic Lanes',
    'Negligent Driving',
    'Pedestrians',
    'Seat Belts',
    'Speed Limits',
    'Street Signs'
  ];

  /* ---------------- storage ---------------- */

  var store = load();

  function load() {
    var blank = { stats: {}, fav: [], shuffle: false, tab: 'dkt', hbSel: null, gdSel: null };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blank;
      var parsed = JSON.parse(raw);
      return {
        stats: parsed.stats || {},
        fav: parsed.fav || [],
        shuffle: !!parsed.shuffle,
        tab: (parsed.tab === 'handbook' || parsed.tab === 'guide') ? parsed.tab : 'dkt',
        hbSel: typeof parsed.hbSel === 'string' ? parsed.hbSel : null,
        gdSel: typeof parsed.gdSel === 'string' ? parsed.gdSel : null
      };
    } catch (err) {
      return blank;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (err) {
      /* private mode / quota — progress just won't persist */
    }
  }

  function statOf(id) {
    return store.stats[id] || { right: 0, wrong: 0, last: null };
  }

  function record(id, wasRight) {
    var s = statOf(id);
    if (wasRight) s.right++; else s.wrong++;
    s.last = wasRight ? 'right' : 'wrong';
    store.stats[id] = s;
    save();
  }

  function isFav(id) { return store.fav.indexOf(id) !== -1; }

  function toggleFav(id) {
    var i = store.fav.indexOf(id);
    if (i === -1) store.fav.push(id); else store.fav.splice(i, 1);
    save();
    return isFav(id);
  }

  function wrongIds() {
    return ALL.filter(function (q) { return statOf(q.id).last === 'wrong'; })
              .map(function (q) { return q.id; });
  }

  /* ---------------- helpers ---------------- */

  var $ = function (id) { return document.getElementById(id); };

  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function byId(id) {
    for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i];
    return null;
  }

  // Turns a bare NSW Government domain or a known AU phone-number format
  // appearing in hand-written Handbook/Guide prose into a real link, so
  // references like "service.nsw.gov.au" or "13 22 13" are clickable/tappable
  // instead of inert text. Narrow, specific patterns on purpose - a generic
  // "any digits" phone regex would misfire on distances/times/percentages
  // that fill the rest of this prose (e.g. "500mm", "3 seconds", "90%").
  function linkify(html) {
    html = html.replace(/\b((?:[a-z0-9-]+\.)*nsw\.gov\.au)\b/g, function (m) {
      return '<a href="https://' + m + '" target="_blank" rel="noopener">' + m + '</a>';
    });
    // No \b around the "(0X) ...." alternative: "(" is a non-word character,
    // so a word boundary never occurs between a preceding space and "(".
    html = html.replace(/\b13\s?\d{2}\s?\d{2}\b|\b1800\s?\d{3}\s?\d{3}\b|\(0\d\)\s?\d{4}\s?\d{4}/g, function (m) {
      return '<a href="tel:' + m.replace(/[()\s]/g, '') + '">' + m + '</a>';
    });
    return html;
  }

  function categories() {
    var names = [];
    ALL.forEach(function (q) { if (names.indexOf(q.cat) === -1) names.push(q.cat); });
    names.sort(function (a, b) {
      var ia = CATEGORY_ORDER.indexOf(a); if (ia === -1) ia = 999;
      var ib = CATEGORY_ORDER.indexOf(b); if (ib === -1) ib = 999;
      return ia - ib;
    });
    return names;
  }

  // "1. General Knowledge" — numbered the same way as the source subfolders.
  function catLabel(cat) {
    var idx = CATEGORY_ORDER.indexOf(cat);
    return (idx === -1 ? '' : (idx + 1) + '. ') + cat;
  }

  function questionsIn(cat) {
    return ALL.filter(function (q) { return q.cat === cat; })
              .sort(function (a, b) { return a.num - b.num; });
  }

  function accuracy(list) {
    var right = 0, total = 0;
    list.forEach(function (q) {
      var s = statOf(q.id);
      right += s.right;
      total += s.right + s.wrong;
    });
    return { right: right, total: total, pct: total ? Math.round(right / total * 100) : 0 };
  }

  // How much of a section is done, not how accurate you've been on what you've tried:
  // right/wrong are counted once per question (by its most recent answer), as a share
  // of every question in the section — not just the ones you've attempted so far.
  function progress(list) {
    var right = 0, wrong = 0, total = list.length;
    list.forEach(function (q) {
      var last = statOf(q.id).last;
      if (last === 'right') right++;
      else if (last === 'wrong') wrong++;
    });
    return {
      right: right, wrong: wrong, total: total,
      rightPct: total ? Math.round(right / total * 100) : 0,
      wrongPct: total ? Math.round(wrong / total * 100) : 0,
      donePct: total ? Math.round((right + wrong) / total * 100) : 0
    };
  }

  function setRingSplit(el, labelEl, prog) {
    el.style.setProperty('--pct-right', prog.rightPct);
    el.style.setProperty('--pct-wrong', prog.wrongPct);
    if (labelEl) labelEl.textContent = prog.donePct + '%';
  }

  function setRing(el, labelEl, pct) {
    el.style.setProperty('--pct', pct);
    if (labelEl) labelEl.textContent = pct + '%';
  }

  /* ---------------- run state ---------------- */

  var run = null;   // { mode, title, items:[{q, order, picked}], idx, instant }

  function startRun(mode) {
    var pool, title, instant = true, parentSection, size = 0;

    if (mode === 'mock') {
      pool = shuffled(ALL).slice(0, MOCK_SIZE);
      title = 'Mock test';
      instant = false;
    } else if (mode === 'all') {
      pool = shuffled(ALL);
      title = 'All questions';
    } else if (mode === 'wrong') {
      pool = shuffled(wrongIds().map(byId));
      title = 'My mistakes';
    } else if (mode === 'fav') {
      pool = shuffled(store.fav.map(byId).filter(Boolean));
      title = 'Favourites';
    } else {                                    // a category name — "practice all in section"
      pool = shuffled(questionsIn(mode));
      title = catLabel(mode);
      parentSection = mode;
    }

    if (!pool.length) return;
    size = pool.length;

    run = {
      mode: mode,
      title: title,
      instant: instant,
      parentSection: parentSection,
      idx: 0,
      startedAt: Date.now(),
      items: pool.map(function (q) {
        var order = [0, 1, 2, 3].slice(0, q.options.length);
        if (store.shuffle) order = shuffled(order);
        return { q: q, order: order, picked: null };
      })
    };

    $('topbar-title').textContent = title + ' · ' + size + ' questions';
    show('quiz');
    renderQuestion();
  }

  function startSingle(qid, cat) {
    // Picking a question from a section's list drills the whole section in order
    // (not shuffled), starting right at the question you picked — Back and Next both
    // work from there, "Finish" only shows once you reach the section's last question.
    var qs = questionsIn(cat);
    var startIdx = -1;
    for (var i = 0; i < qs.length; i++) if (qs[i].id === qid) { startIdx = i; break; }
    if (startIdx === -1) return;

    run = {
      mode: 'single',
      title: catLabel(cat),
      instant: true,
      parentSection: cat,
      idx: startIdx,
      startedAt: Date.now(),
      items: qs.map(function (q) {
        var order = [0, 1, 2, 3].slice(0, q.options.length);
        if (store.shuffle) order = shuffled(order);
        return { q: q, order: order, picked: null };
      })
    };

    $('topbar-title').textContent = catLabel(cat) + ' · ' + qs.length + ' questions';
    show('quiz');
    renderQuestion();
  }

  /* ---------------- views ---------------- */

  function show(which) {
    ['home', 'section', 'quiz', 'result'].forEach(function (name) {
      $('view-' + name).hidden = (name !== which);
    });
    $('btn-home').hidden = (which === 'home');
    $('btn-home-float').hidden = (which === 'home');
    $('btn-fav').hidden = (which !== 'quiz');
    $('progressbar').hidden = (which !== 'quiz');
    $('hometabs').hidden = (which !== 'home');
    if (which === 'home') $('topbar-title').textContent = tabTitle(store.tab);
    if (which === 'result') $('topbar-title').textContent = 'Results';
    window.scrollTo(0, 0);
  }

  /* ---------------- home ---------------- */

  function renderHome() {
    var acc = accuracy(ALL);
    var seen = ALL.filter(function (q) { return statOf(q.id).last !== null; }).length;
    var wrong = wrongIds().length;

    $('stat-total').textContent = ALL.length;
    setRing($('ring-overall'), $('ring-overall-label'), acc.pct);
    $('stat-attempts').textContent = acc.total ? acc.total + ' answers given' : 'not started';
    $('stat-seen').textContent = seen;
    $('stat-right').textContent = acc.right;
    $('stat-wrong').textContent = wrong;

    $('mock-count').textContent = MOCK_SIZE;
    $('mock-pass').textContent = MOCK_PASS;
    $('card-wrong').querySelector('small').textContent =
      wrong === 1 ? '1 question you have answered incorrectly'
                  : wrong + ' questions you have answered incorrectly';
    $('card-fav').querySelector('small').textContent =
      store.fav.length === 1 ? '1 saved question' : store.fav.length + ' saved questions';
    $('card-wrong').disabled = wrong === 0;
    $('card-fav').disabled = store.fav.length === 0;
    $('opt-shuffle').checked = store.shuffle;

    var list = $('cat-list');
    list.innerHTML = '';
    categories().forEach(function (cat) {
      var qs = questionsIn(cat);
      var prog = progress(qs);
      var btn = document.createElement('button');
      btn.className = 'card';
      btn.setAttribute('data-section', cat);
      btn.innerHTML =
        '<span class="card__icon">' + iconFor(cat) + '</span>' +
        '<span class="card__body"><strong></strong><small class="card__stats"></small></span>' +
        '<span class="ring ring--split card__ring"><span></span></span>';
      btn.querySelector('strong').textContent = catLabel(cat);
      btn.querySelector('small').innerHTML =
        '<span class="card__stat card__stat--q">' + qs.length + '</span>' +
        ((prog.right + prog.wrong) ?
          '<span class="card__stat card__stat--right">&#10003;' + prog.right + '</span>' +
          '<span class="card__stat card__stat--wrong">&#10007;' + prog.wrong + '</span>'
          : '');
      setRingSplit(btn.querySelector('.ring'), btn.querySelector('.ring span'), prog);
      list.appendChild(btn);
    });
  }

  function iconFor(cat) {
    if (/intersection/i.test(cat)) return '&#128678;';       // construction/junction
    if (/alcohol/i.test(cat)) return '&#127866;';            // beer
    if (/fatigue/i.test(cat)) return '&#128564;';            // sleepy
    if (/lane/i.test(cat)) return '&#128663;';                // car in lane
    if (/negligent/i.test(cat)) return '&#9888;';             // warning triangle
    if (/pedestrian/i.test(cat)) return '&#128694;';          // pedestrian
    if (/seat belt/i.test(cat)) return '&#128663;';           // car (belted)
    if (/speed/i.test(cat)) return '&#9201;';                 // stopwatch
    if (/street sign/i.test(cat)) return '&#128737;';         // sign shield
    return '&#128218;';                                      // book (general knowledge)
  }

  /* ---------------- home tabs (DKT / handbook / guide) ---------------- */

  function tabTitle(tab) {
    if (tab === 'handbook') return 'Road User Handbook';
    if (tab === 'guide') return 'Guide to the Driving Test';
    return 'DKT Practice';
  }

  // The handbook viewer's DOM/CSS (hbnav/hbcontent/hb-prev/hb-next) is shared between
  // the 'handbook' and 'guide' tabs - currentBook()/currentSelKey() pick which dataset
  // and which remembered selection key it reads/writes, so only one book tab is ever
  // rendered into that shared DOM at a time.
  function currentBook() {
    return store.tab === 'guide' ? GUIDE : HANDBOOK;
  }

  function currentSelKey() {
    return store.tab === 'guide' ? 'gdSel' : 'hbSel';
  }

  // A chapter's displayed number is its array position by default, but a
  // chapter can override this via an explicit "num" (e.g. a "0 Summary"
  // chapter placed before "1 Introduction" without renumbering the rest).
  function chapNum(chapter, cIdx) {
    return chapter.num != null ? chapter.num : cIdx + 1;
  }

  function showTab(tab) {
    store.tab = (tab === 'handbook' || tab === 'guide') ? tab : 'dkt';
    save();
    var isBook = store.tab !== 'dkt';
    $('home-dkt').hidden = store.tab !== 'dkt';
    $('home-handbook').hidden = !isBook;
    $('app').classList.toggle('app--wide', isBook);
    $('hometabs').classList.toggle('app--wide', isBook);
    Array.prototype.forEach.call(document.querySelectorAll('.hometabs__btn'), function (btn) {
      var active = btn.getAttribute('data-tab') === store.tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('topbar-title').textContent = tabTitle(store.tab);
    if (isBook) {
      renderHandbookNav();
      initHandbookSelection();
      centerActiveHandbookNavLink();
    }
  }

  /* ---------------- handbook / guide (shared book viewer) ---------------- */

  // Chapters are collapsible toggles; only the chapter holding the active topic
  // starts expanded, so the sidebar reads as a scannable list of chapters rather
  // than a long dump of all 77 topics at once.
  function renderHandbookNav() {
    var nav = $('hbnav');
    nav.innerHTML = '';
    currentBook().forEach(function (chapter, cIdx) {
      var group = document.createElement('div');
      group.className = 'hbnav__group';

      // A chapter with only one section has nothing to expand into - render it
      // as a flat clickable leaf instead of a toggle + single-item list.
      if (chapter.sections.length === 1) {
        var leaf = document.createElement('button');
        leaf.className = 'hbnav__chapter hbnav__chapter--leaf';
        leaf.setAttribute('data-hb-chapter', cIdx);
        leaf.setAttribute('data-hb-section', 0);
        var leafIcon = document.createElement('span');
        leafIcon.className = 'hbnav__chapter-icon';
        leafIcon.textContent = chapNum(chapter, cIdx);
        var leafLabel = document.createElement('span');
        leafLabel.className = 'hbnav__chapter-label';
        leafLabel.textContent = chapter.title;
        leaf.appendChild(leafIcon);
        leaf.appendChild(leafLabel);
        group.appendChild(leaf);
        nav.appendChild(group);
        return;
      }

      var heading = document.createElement('button');
      heading.className = 'hbnav__chapter';
      heading.setAttribute('data-hb-toggle', cIdx);
      heading.setAttribute('aria-expanded', 'false');
      var icon = document.createElement('span');
      icon.className = 'hbnav__chapter-icon';
      icon.textContent = chapNum(chapter, cIdx);
      var label = document.createElement('span');
      label.className = 'hbnav__chapter-label';
      label.textContent = chapter.title;
      var chevron = document.createElement('span');
      chevron.className = 'hbnav__chapter-chevron';
      chevron.innerHTML = '&#9662;';
      heading.appendChild(icon);
      heading.appendChild(label);
      heading.appendChild(chevron);
      group.appendChild(heading);

      var list = document.createElement('ul');
      list.className = 'hbnav__list';
      list.hidden = true;
      chapter.sections.forEach(function (section, sIdx) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.className = 'hbnav__link';
        btn.setAttribute('data-hb-chapter', cIdx);
        btn.setAttribute('data-hb-section', sIdx);
        btn.textContent = chapNum(chapter, cIdx) + '.' + (sIdx + 1) + ' ' + section.title;
        li.appendChild(btn);
        list.appendChild(li);
      });
      group.appendChild(list);
      nav.appendChild(group);
    });
  }

  function toggleHandbookChapter(cIdx) {
    var heading = document.querySelector('.hbnav__chapter[data-hb-toggle="' + cIdx + '"]');
    if (!heading) return;
    var list = heading.nextElementSibling;
    var open = heading.getAttribute('aria-expanded') === 'true';
    heading.setAttribute('aria-expanded', open ? 'false' : 'true');
    list.hidden = open;
  }

  function expandHandbookChapter(cIdx) {
    var heading = document.querySelector('.hbnav__chapter[data-hb-toggle="' + cIdx + '"]');
    if (!heading) return;
    heading.setAttribute('aria-expanded', 'true');
    heading.nextElementSibling.hidden = false;
  }

  // Shows one topic's full content in the content pane - the pane holds exactly one
  // topic at a time (not an accordion sharing space with the rest of the chapter).
  function selectHandbookSection(cIdx, sIdx) {
    var chapter = currentBook()[cIdx];
    if (!chapter) return;
    var section = chapter.sections[sIdx];
    if (!section) return;

    store[currentSelKey()] = cIdx + ':' + sIdx;
    save();

    expandHandbookChapter(cIdx);
    Array.prototype.forEach.call(document.querySelectorAll('.hbnav__link, .hbnav__chapter--leaf'), function (btn) {
      var active = Number(btn.getAttribute('data-hb-chapter')) === cIdx && Number(btn.getAttribute('data-hb-section')) === sIdx;
      btn.classList.toggle('is-active', active);
    });

    var pane = $('hbcontent');
    pane.innerHTML = '';

    // A chapter with only one section has nothing to break out into a separate
    // "X.1 Subtitle" line - just show the chapter itself as a single heading.
    var hasSubsections = chapter.sections.length > 1;
    if (hasSubsections) {
      var eyebrow = document.createElement('p');
      eyebrow.className = 'hbcontent__chapter-label';
      eyebrow.textContent = chapNum(chapter, cIdx) + '. ' + chapter.title;
      pane.appendChild(eyebrow);
    }

    var title = document.createElement('h2');
    title.className = 'hero__title';
    title.textContent = hasSubsections
      ? chapNum(chapter, cIdx) + '.' + (sIdx + 1) + ' ' + section.title
      : chapNum(chapter, cIdx) + '. ' + chapter.title;
    pane.appendChild(title);

    var figureList = section.figures || [];
    var figuresGrid = section.figuresGrid || {};
    // 2+ images lay out in a responsive grid (as many columns as fit); a single
    // image stays full-width, since a 1-cell "grid" would just look like a figure.
    var figuresParent = pane;
    var isGrid = figureList.length > 1;
    if (isGrid) {
      figuresParent = document.createElement('div');
      figuresParent.className = 'hbfigures';
      // The column count itself lives in CSS (see .hbfigures[data-cols=N]), which
      // enforces it as a hard count above the mobile breakpoint and falls back to
      // a responsive auto-fit below it -- see styles.css for why.
      if (figuresGrid.cols) figuresParent.dataset.cols = figuresGrid.cols;
      if (figuresGrid.mobileCols) figuresParent.dataset.mobileCols = figuresGrid.mobileCols;
      if (figuresGrid.heightScale) figuresParent.style.setProperty('--hb-img-h', Math.round(220 * figuresGrid.heightScale) + 'px');
      if (figuresGrid.square) figuresParent.classList.add('hbfigures--square');
      pane.appendChild(figuresParent);
    }
    var figureNodes = [];
    figureList.forEach(function (fig, figIdx) {
      var figure = document.createElement('figure');
      figure.className = 'hbfigure';
      // Numbers restart at 1 on every page - it's a within-page reference
      // ("see image 2 above"), not a running count across the whole book.
      var figNum = document.createElement('span');
      figNum.className = 'hbfigure__num';
      figNum.textContent = figIdx + 1;
      figure.appendChild(figNum);
      if (fig.square) figure.classList.add('hbfigure--square');
      if (fig.scale) figure.style.setProperty('--hb-fig-scale', fig.scale);
      if (fig.newRow) figure.style.gridColumnStart = '1';
      // "span" sets an exact column count (e.g. 3 in a 3-col grid), overriding
      // the "wide" span-2 class below via inline style's higher specificity.
      if (fig.span) figure.style.gridColumnEnd = 'span ' + fig.span;
      // "rowSpan" makes a figure taller by spanning multiple grid rows (e.g. a
      // portrait image sitting beside two shorter ones stacked in one column).
      // Its image also grows taller to match, unless an explicit "scale" was set above.
      if (fig.rowSpan) {
        figure.style.gridRowEnd = 'span ' + fig.rowSpan;
        if (!fig.scale) figure.style.setProperty('--hb-fig-scale', fig.rowSpan);
      }
      var img = document.createElement('img');
      img.src = fig.src;
      img.alt = fig.caption || section.title;
      img.loading = 'lazy';
      figure.appendChild(img);
      if (fig.caption) {
        var caption = document.createElement('figcaption');
        caption.innerHTML = linkify(fig.caption);
        figure.appendChild(caption);
      }
      figuresParent.appendChild(figure);
      figureNodes.push({ figure: figure, img: img, fig: fig });
      // max-height alone only ever shrinks an image, never enlarges one past its
      // native resolution -- so a per-figure scale (needed for small source
      // images that would otherwise stay tiny) instead sets an explicit pixel
      // width from the image's own natural size (capped by the existing
      // max-width:100% ceiling, and by max-height for grid figures).
      if (fig.scale || (!isGrid && figuresGrid.heightScale)) {
        var factor = fig.scale || figuresGrid.heightScale;
        var applyNaturalScale = function () {
          if (img.naturalWidth) img.style.width = Math.round(img.naturalWidth * factor) + 'px';
        };
        if (img.complete) applyNaturalScale();
        else img.addEventListener('load', applyNaturalScale);
      }
    });
    // A markedly wide (landscape) image gets 2 grid columns instead of 1, so it
    // isn't squeezed as narrow as a portrait/square sign in the same row. This is
    // decided once for the whole section, after every one of its images has
    // loaded, and the ratio is snapped to the nearest 0.05 -- so images that are
    // basically the same shape always land on the same side of the cutoff,
    // instead of each image racing to classify itself in isolation (which let
    // tiny crop differences push near-identical images to opposite outcomes).
    // A figure can also set an explicit "wide" true/false to override this
    // auto-detection, for cases where several images should share one grid
    // treatment regardless of their individual crop's exact pixel ratio.
    var pendingFigures = figureNodes.length;
    function classifyFigures() {
      figureNodes.forEach(function (fn) {
        if (typeof fn.fig.wide === 'boolean') {
          fn.figure.classList.toggle('hbfigure--wide', fn.fig.wide);
          return;
        }
        var w = fn.img.naturalWidth, h = fn.img.naturalHeight;
        if (!w || !h) return;
        var ratio = Math.round((w / h) * 20) / 20;
        fn.figure.classList.toggle('hbfigure--wide', ratio >= 1.4);
      });
    }
    figureNodes.forEach(function (fn) {
      if (fn.img.complete) {
        pendingFigures--;
      } else {
        fn.img.addEventListener('load', function () {
          pendingFigures--;
          if (pendingFigures === 0) classifyFigures();
        });
      }
    });
    if (pendingFigures === 0) classifyFigures();

    if (section.bullets && section.bullets.length) {
      var ul = document.createElement('ul');
      ul.className = 'hbcontent__bullets';
      section.bullets.forEach(function (bullet) {
        var li = document.createElement('li');
        li.innerHTML = linkify(bullet);
        ul.appendChild(li);
      });
      pane.appendChild(ul);
    }

    // A table reads more clearly than bullets for side-by-side comparisons
    // (e.g. licence restrictions by licence type) - a topic can have several.
    var tables = section.tables || (section.table ? [section.table] : []);
    var inGroup = false;
    tables.forEach(function (t) {
      // A pseudo-"table" that's just { heading: "..." } groups the tables that
      // follow it under one bigger highlighted heading, e.g. several manoeuvres
      // grouped under "Parking" - distinct from a single table's own smaller title.
      // Every table after it is that group's subsection, so gets the muted
      // "hbtable-title--sub" look instead of the usual brand-yellow title.
      if (t.heading) {
        inGroup = true;
        var groupTitle = document.createElement('p');
        groupTitle.className = 'hbgroup-title';
        groupTitle.textContent = t.heading;
        pane.appendChild(groupTitle);
        return;
      }
      if (t.title) {
        var tableTitle = document.createElement('p');
        tableTitle.className = inGroup ? 'hbtable-title hbtable-title--sub' : 'hbtable-title';
        tableTitle.textContent = t.title;
        pane.appendChild(tableTitle);
      }

      var tableWrap = document.createElement('div');
      tableWrap.className = 'hbtable-wrap';
      var table = document.createElement('table');
      table.className = 'hbtable';

      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      t.headers.forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      t.rows.forEach(function (row) {
        var tr = document.createElement('tr');
        row.forEach(function (cell) {
          var td = document.createElement('td');
          td.innerHTML = linkify(cell);   // table data is hand-authored, not user input - allows an occasional <mark> for emphasis
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      tableWrap.appendChild(table);
      pane.appendChild(tableWrap);
    });

    // Abbreviations used on this page, spelled out in one place at the end
    // rather than inline, so the bullets/tables above stay terse.
    if (section.abbr && section.abbr.length) {
      var abbrNote = document.createElement('p');
      abbrNote.className = 'hbabbr';
      abbrNote.innerHTML = section.abbr.map(function (pair) {
        return '<strong>' + pair[0] + '</strong> = ' + linkify(pair[1]);
      }).join(' &nbsp;·&nbsp; ');
      pane.appendChild(abbrNote);
    }

    $('hb-prev').hidden = !getAdjacentHandbookSection(cIdx, sIdx, -1);
    $('hb-next').hidden = !getAdjacentHandbookSection(cIdx, sIdx, 1);

    closeHandbookNav();
    window.scrollTo(0, 0);
  }

  // Walks to the previous/next subsection across chapter boundaries (dir is -1 or 1);
  // returns null past the very first or very last subsection in the whole handbook.
  function getAdjacentHandbookSection(cIdx, sIdx, dir) {
    var book = currentBook();
    var chapter = book[cIdx];
    if (!chapter) return null;
    var newSIdx = sIdx + dir;
    if (newSIdx >= 0 && newSIdx < chapter.sections.length) return { cIdx: cIdx, sIdx: newSIdx };
    var newCIdx = cIdx + dir;
    if (!book[newCIdx]) return null;
    return { cIdx: newCIdx, sIdx: dir > 0 ? 0 : book[newCIdx].sections.length - 1 };
  }

  function goToAdjacentHandbookSection(dir) {
    var sel = (store[currentSelKey()] || '0:0').split(':');
    var target = getAdjacentHandbookSection(Number(sel[0]) || 0, Number(sel[1]) || 0, dir);
    if (target) selectHandbookSection(target.cIdx, target.sIdx);
  }

  function closeHandbookNav() {
    $('hbnav').classList.remove('is-open');
    $('hbnav-toggle').setAttribute('aria-expanded', 'false');
  }

  function toggleHandbookNav() {
    var open = $('hbnav').classList.toggle('is-open');
    $('hbnav-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) centerActiveHandbookNavLink();
  }

  // Keeps the active subsection roughly centered in the sidebar's own
  // scrollbar rather than wherever browsing happened to leave it, whenever
  // the sidebar becomes visible (page load/reload, switching to the
  // Handbook tab, opening the mobile chapters overlay).
  function centerActiveHandbookNavLink() {
    var nav = $('hbnav');
    if (!nav.clientHeight) return;
    var link = nav.querySelector('.hbnav__link.is-active');
    if (!link) return;
    nav.scrollTop = Math.max(0, link.offsetTop - nav.clientHeight / 2 + link.offsetHeight / 2);
  }

  // Resume on the last topic browsed, if any, otherwise the handbook's first topic.
  function initHandbookSelection() {
    var book = currentBook();
    if (!book.length) return;
    var sel = (store[currentSelKey()] || '0:0').split(':');
    var cIdx = Number(sel[0]) || 0;
    var sIdx = Number(sel[1]) || 0;
    if (!book[cIdx] || !book[cIdx].sections[sIdx]) { cIdx = 0; sIdx = 0; }
    selectHandbookSection(cIdx, sIdx);
  }

  /* ---------------- section (per-topic list) ---------------- */

  function statusIcon(status) {
    if (status === 'right') return '&#10003;';   // check
    if (status === 'wrong') return '&#10007;';   // cross
    return '&#8212;';                            // em dash: not attempted yet
  }

  function openSection(cat) {
    var qs = questionsIn(cat);
    if (!qs.length) return;
    var prog = progress(qs);

    $('section-eyebrow').textContent = 'Topic';
    $('section-title').textContent = catLabel(cat);
    $('section-sub').textContent =
      qs.length + ' questions' + ((prog.right + prog.wrong) ? ' · ' + prog.right + ' correct, ' + prog.wrong + ' incorrect' : '');
    setRingSplit($('section-ring'), $('section-ring-label'), prog);
    $('section-practice-all').setAttribute('data-mode', cat);
    $('section-practice-all').querySelector('small').textContent =
      qs.length + ' questions, shuffled order, instant feedback after each answer';

    var list = $('qlist');
    list.innerHTML = '';
    qs.forEach(function (q) {
      var status = statOf(q.id).last;
      var btn = document.createElement('button');
      btn.className = 'qcard';
      btn.setAttribute('data-qid', q.id);
      btn.setAttribute('data-cat', cat);
      btn.innerHTML =
        '<span class="qcard__thumb">' +
          (q.img ? '<img src="' + q.img + '" alt="" loading="lazy">' : '') +
          '<span class="qcard__num">Q' + q.num + '</span>' +
          '<span class="qcard__status qcard__status--' + (status || 'none') + '">' + statusIcon(status) + '</span>' +
        '</span>' +
        '<span class="qcard__title"></span>';
      btn.querySelector('.qcard__title').textContent = q.short || q.q;
      list.appendChild(btn);
    });

    $('topbar-title').textContent = catLabel(cat);
    show('section');
  }

  /* ---------------- quiz ---------------- */

  function current() { return run.items[run.idx]; }

  function renderQuestion() {
    var item = current();
    var q = item.q;

    $('counter').textContent = (run.mode === 'single')
      ? 'Question ' + q.num + ' of ' + run.items.length
      : 'Question ' + (run.idx + 1) + ' of ' + run.items.length;
    $('progressbar-fill').style.width = ((run.idx) / run.items.length * 100) + '%';

    if (q.img) {
      $('qimg').src = q.img;
      $('qimg').alt = 'Diagram for: ' + q.q;
      $('qimage').hidden = false;
    } else {
      $('qimage').hidden = true;
    }

    $('qtext').textContent = q.q;
    $('btn-fav').setAttribute('aria-pressed', isFav(q.id) ? 'true' : 'false');
    $('btn-fav').innerHTML = isFav(q.id) ? '&#9829;' : '&#9825;';

    var box = $('options');
    box.innerHTML = '';
    item.order.forEach(function (optIndex, position) {
      var btn = document.createElement('button');
      btn.className = 'option';
      btn.type = 'button';
      btn.setAttribute('data-opt', optIndex);
      btn.innerHTML = '<span class="option__key">' + LETTERS[position] + '</span><span></span>';
      btn.lastChild.textContent = q.options[optIndex];
      btn.addEventListener('click', function () { pick(optIndex); });
      box.appendChild(btn);
    });

    $('btn-prev').disabled = run.idx === 0;
    // Icon-only button - "Finish" vs "Next" is conveyed via aria-label instead of
    // visible text, since setting textContent here would wipe out the arrow icon span.
    $('btn-next').setAttribute('aria-label', (run.idx === run.items.length - 1) ? 'Finish' : 'Next question');

    if (item.picked === null) {
      $('feedback').hidden = true;
      $('btn-next').disabled = run.instant;      // in practice mode, answer first
    } else {
      paintAnswered(item);
    }
  }

  function paintAnswered(item) {
    var q = item.q;
    var buttons = $('options').querySelectorAll('.option');

    Array.prototype.forEach.call(buttons, function (btn) {
      var idx = Number(btn.getAttribute('data-opt'));
      btn.disabled = run.instant;
      btn.setAttribute('aria-pressed', idx === item.picked ? 'true' : 'false');
      btn.classList.remove('is-correct', 'is-wrong');
      if (!run.instant) return;                  // mock test: no reveal until the end
      if (idx === q.answer) btn.classList.add('is-correct');
      else if (idx === item.picked) btn.classList.add('is-wrong');
    });

    if (run.instant) {
      var right = item.picked === q.answer;
      $('feedback').hidden = false;
      $('feedback').className = 'feedback ' + (right ? 'is-ok' : 'is-bad');
      $('feedback-head').textContent = right ? 'Correct' : 'Not quite';
      $('feedback-head').className = 'feedback__head ' + (right ? 'is-ok' : 'is-bad');
      $('feedback-body').textContent = q.explain;
    }
    $('btn-next').disabled = false;
  }

  function pick(optIndex) {
    var item = current();
    if (run.instant && item.picked !== null) return;    // locked in
    var first = item.picked === null;
    item.picked = optIndex;
    // Practice modes lock the answer in straight away; a mock test lets you change
    // your mind, so its answers are only recorded when the test is submitted.
    if (run.instant && first) record(item.q.id, optIndex === item.q.answer);
    paintAnswered(item);
  }

  function next() {
    if (run.idx < run.items.length - 1) {
      run.idx++;
      renderQuestion();
    } else {
      finish();
    }
  }

  function prev() {
    if (run.idx > 0) { run.idx--; renderQuestion(); }
  }

  /* ---------------- results ---------------- */

  function finish() {
    // Practicing a single question from a section list: skip the results page
    // (the answer was already shown inline) and drop straight back to that list,
    // refreshed with the new correct/incorrect status.
    if (run.mode === 'single' && run.parentSection) {
      openSection(run.parentSection);
      return;
    }

    if (!run.instant) {                      // mock test: bank the answers now
      run.items.forEach(function (i) {
        if (i.picked !== null) record(i.q.id, i.picked === i.q.answer);
      });
    }
    var answered = run.items.filter(function (i) { return i.picked !== null; });
    var right = run.items.filter(function (i) { return i.picked === i.q.answer; }).length;
    var pct = run.items.length ? Math.round(right / run.items.length * 100) : 0;
    var mins = Math.max(1, Math.round((Date.now() - run.startedAt) / 60000));

    var card = $('result-card');
    setRing($('ring-result'), $('result-pct'), pct);

    if (run.mode === 'mock') {
      var passed = right >= MOCK_PASS;
      card.className = 'result ' + (passed ? 'is-pass' : 'is-fail');
      $('result-verdict').textContent = passed ? 'Pass' : 'Not yet';
      $('result-line').textContent =
        right + ' of ' + run.items.length + ' correct — you need ' + MOCK_PASS +
        ' to pass. About ' + mins + ' min.';
    } else {
      card.className = 'result';
      $('result-verdict').textContent = right + ' / ' + run.items.length + ' correct';
      $('result-line').textContent =
        answered.length + ' answered · ' + run.title + ' · about ' + mins + ' min.';
    }

    var missed = run.items.filter(function (i) { return i.picked !== i.q.answer; });
    $('btn-retry-wrong').hidden = missed.length === 0;
    $('btn-retry-wrong').textContent = 'Retry the ' + missed.length + ' I missed';

    var ol = $('review');
    ol.innerHTML = '';
    run.items.forEach(function (item, n) {
      var q = item.q;
      var ok = item.picked === q.answer;
      var li = document.createElement('li');
      li.className = 'review__item' + (ok ? '' : ' is-wrong');

      var head = document.createElement('p');
      head.className = 'review__q';
      head.textContent = (n + 1) + '. ' + q.q;
      li.appendChild(head);

      if (q.img) {
        var img = document.createElement('img');
        img.className = 'review__img';
        img.src = q.img;
        img.alt = '';
        img.loading = 'lazy';
        li.appendChild(img);
      }

      li.appendChild(row('Your answer', item.picked === null ? 'not answered' : q.options[item.picked]));
      if (!ok) li.appendChild(row('Correct answer', q.options[q.answer]));

      var why = document.createElement('p');
      why.className = 'review__why';
      why.textContent = q.explain;
      li.appendChild(why);

      ol.appendChild(li);
    });

    show('result');
  }

  function row(label, value) {
    var p = document.createElement('p');
    p.className = 'review__row';
    var b = document.createElement('b');
    b.textContent = label + ': ';
    p.appendChild(b);
    p.appendChild(document.createTextNode(value));
    return p;
  }

  function retryMissed() {
    var missed = run.items.filter(function (i) { return i.picked !== i.q.answer; })
                          .map(function (i) { return i.q; });
    if (!missed.length) return;
    var parentSection = run.parentSection;      // keep the "back" target, if any
    run = {
      mode: 'retry',
      title: 'Retry',
      instant: true,
      parentSection: parentSection,
      idx: 0,
      startedAt: Date.now(),
      items: shuffled(missed).map(function (q) {
        var order = [0, 1, 2, 3].slice(0, q.options.length);
        if (store.shuffle) order = shuffled(order);
        return { q: q, order: order, picked: null };
      })
    };
    $('topbar-title').textContent = 'Retry · ' + run.items.length + ' questions';
    show('quiz');
    renderQuestion();
  }

  /* ---------------- events ---------------- */

  document.addEventListener('click', function (e) {
    var modeBtn = e.target.closest ? e.target.closest('[data-mode]') : null;
    var sectionBtn = e.target.closest ? e.target.closest('[data-section]') : null;
    var qBtn = e.target.closest ? e.target.closest('[data-qid]') : null;
    var tabBtn = e.target.closest ? e.target.closest('[data-tab]') : null;
    var hbLinkBtn = e.target.closest ? e.target.closest('[data-hb-section]') : null;
    var hbChapterToggle = e.target.closest ? e.target.closest('[data-hb-toggle]') : null;
    var hbNavToggleBtn = e.target.closest ? e.target.closest('#hbnav-toggle') : null;
    var hbPrevBtn = e.target.closest ? e.target.closest('#hb-prev') : null;
    var hbNextBtn = e.target.closest ? e.target.closest('#hb-next') : null;
    if (modeBtn && !modeBtn.disabled) startRun(modeBtn.getAttribute('data-mode'));
    else if (sectionBtn && !sectionBtn.disabled) openSection(sectionBtn.getAttribute('data-section'));
    else if (qBtn) startSingle(Number(qBtn.getAttribute('data-qid')), qBtn.getAttribute('data-cat'));
    else if (tabBtn) showTab(tabBtn.getAttribute('data-tab'));
    else if (hbLinkBtn) selectHandbookSection(Number(hbLinkBtn.getAttribute('data-hb-chapter')), Number(hbLinkBtn.getAttribute('data-hb-section')));
    else if (hbChapterToggle) toggleHandbookChapter(Number(hbChapterToggle.getAttribute('data-hb-toggle')));
    else if (hbNavToggleBtn) toggleHandbookNav();
    else if (hbPrevBtn) goToAdjacentHandbookSection(-1);
    else if (hbNextBtn) goToAdjacentHandbookSection(1);
  });

  $('btn-next').addEventListener('click', next);
  $('btn-prev').addEventListener('click', prev);

  // Swipe left/right on the Handbook/Guide content pane to move to the next/
  // previous page, same as tapping hb-next/hb-prev - touch-only (mouse drags
  // never fire touch events), so this never interferes with desktop use.
  (function () {
    var touchStartX = 0, touchStartY = 0, touchActive = false;
    var SWIPE_MIN_DIST = 60;
    $('hbcontent').addEventListener('touchstart', function (e) {
      // Let a wide table's own horizontal scroll (.hbtable-wrap) win instead
      // of being hijacked into a page change.
      if ((e.target.closest && e.target.closest('.hbtable-wrap')) || e.touches.length !== 1) {
        touchActive = false;
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchActive = true;
    }, { passive: true });
    $('hbcontent').addEventListener('touchend', function (e) {
      if (!touchActive) return;
      touchActive = false;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - touchStartX;
      var dy = touch.clientY - touchStartY;
      if (Math.abs(dx) < SWIPE_MIN_DIST || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      goToAdjacentHandbookSection(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  // The back arrow returns to wherever this run was launched from: a section's
  // question list if it has one, otherwise straight home.
  function goBack() {
    // Already looking at a section's question list? Its "back" always means Home —
    // don't fall through to a stale run's parentSection from an earlier quiz, or the
    // arrow just reopens the same section and looks like it did nothing.
    if (!$('view-section').hidden) { renderHome(); showTab(store.tab); show('home'); return; }
    if (run && run.parentSection) openSection(run.parentSection);
    else { renderHome(); showTab(store.tab); show('home'); }
  }
  $('btn-home').addEventListener('click', goBack);
  $('btn-home-float').addEventListener('click', goBack);
  $('btn-result-home').addEventListener('click', function () {
    renderHome();
    showTab(store.tab);
    show('home');
  });
  $('btn-again').addEventListener('click', function () { startRun(run ? run.mode : 'mock'); });
  $('btn-retry-wrong').addEventListener('click', retryMissed);

  $('btn-fav').addEventListener('click', function () {
    var on = toggleFav(current().q.id);
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.innerHTML = on ? '&#9829;' : '&#9825;';
  });

  $('opt-shuffle').addEventListener('change', function () {
    store.shuffle = this.checked;
    save();
  });

  $('btn-reset').addEventListener('click', function () {
    if (!window.confirm('Clear all your answers, stats and favourites?')) return;
    store = { stats: {}, fav: [], shuffle: store.shuffle, tab: store.tab, hbSel: store.hbSel, gdSel: store.gdSel };
    save();
    renderHome();
  });

  document.addEventListener('keydown', function (e) {
    if ($('view-quiz').hidden) return;
    if (e.key === '1' || e.key.toLowerCase() === 'a') pickByPosition(0);
    else if (e.key === '2' || e.key.toLowerCase() === 'b') pickByPosition(1);
    else if (e.key === '3' || e.key.toLowerCase() === 'c') pickByPosition(2);
    else if (e.key === 'Enter' || e.key === 'ArrowRight') { if (!$('btn-next').disabled) next(); }
    else if (e.key === 'ArrowLeft') prev();
  });

  function pickByPosition(position) {
    var item = current();
    if (position >= item.order.length) return;
    pick(item.order[position]);
  }

  /* ---------------- go ---------------- */

  if (!ALL.length) {
    $('view-home').innerHTML = '<p>Could not load the questions. Make sure <code>data/questions.js</code> sits next to this page.</p>';
  } else {
    renderHome();
    showTab(store.tab);
    show('home');
  }
})();
