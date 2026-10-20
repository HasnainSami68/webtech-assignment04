(function() {
  'use strict';

  const STORAGE_KEY = 'markslides.deck';
  const SEPARATOR = /^[ \t]*---[ \t]*$/m;
  const SEPARATOR_ALL = /^[ \t]*---[ \t]*$/gm;

  const DEFAULT_DECK = [
    '# Welcome to MarkSlides',
    '## Write Markdown, get slides',
    'Edit text on the left and see the preview update.',
    '',
    '---',
    '',
    '# Shortcuts',
    '1. Left/Right arrows change slides',
    '2. F11 toggles presentation mode',
    '3. Ctrl+S saves your work'
  ].join('\n');

  const el = id => document.getElementById(id);
  const editor = el('editor');
  const saveStatus = el('saveStatus');
  const presentation = el('presentation');

  const views = [
    {
      slide: el('previewSlide'),
      counter: el('previewCounter'),
      prev: el('prevBtn'),
      next: el('nextBtn'),
      fs: el('previewFsBtn'),
      fsLabel: () => '⤢ Full Screen'
    },
    {
      slide: el('presSlide'),
      counter: el('presCounter'),
      prev: el('presPrevBtn'),
      next: el('presNextBtn'),
      fs: el('presFsBtn'),
      fsLabel: () => '✕ Exit Full Screen'
    }
  ];

  let slides = [];
  let current = 0;
  let presenting = false;
  let lastSaved = '';

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }

  function inline(text) {
    let codes = [];
    let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });

    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\/g/g, '<img src="$2" alt="$1">')
             .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>')
             .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
             .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  }

  function markdownToHtml(source) {
    const lines = source.split('\n');
    const html = [];
    let i = 0;

    while (i < lines.length) {
      let line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (line.startsWith('```')) {
        let buf = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          buf.push(lines[i]);
          i++;
        }
        i++;
        html.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
        continue;
      }

      let headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        let level = headingMatch[1].length;
        html.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      let bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
      let orderMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      
      if (bulletMatch || orderMatch) {
        let type = bulletMatch ? 'ul' : 'ol';
        let regex = bulletMatch ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+\.\s+(.*)$/;
        let items = [];
        while (i < lines.length && regex.test(lines[i])) {
          items.push(`<li>${inline(lines[i].match(regex)[1])}</li>`);
          i++;
        }
        html.push(`<${type}>${items.join('')}</${type}>`);
        continue;
      }

      if (line.startsWith('>')) {
        let parts = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          parts.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        html.push(`<blockquote>${inline(parts.join(' '))}</blockquote>`);
        continue;
      }

      let p = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```')) {
        p.push(lines[i].trim());
        i++;
      }
      html.push(`<p>${inline(p.join(' '))}</p>`);
    }

    return html.join('\n');
  }

  function splitSlides(text) {
    return text.split(SEPARATOR).map(p => p.trim());
  }

  function render() {
    current = Math.min(Math.max(current, 0), slides.length - 1);
    let html = markdownToHtml(slides[current]);
    let last = slides.length - 1;

    views.forEach(v => {
      v.slide.innerHTML = html;
      v.counter.textContent = `${current + 1} / ${slides.length}`;
      v.prev.disabled = current === 0;
      v.next.disabled = current === last;
      v.fs.textContent = v.fsLabel();
    });
  }

  function go(step) {
    current += step;
    render();
  }

  function updateStatus() {
    saveStatus.textContent = editor.value === lastSaved ? 'Saved' : 'Unsaved changes';
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, editor.value);
    lastSaved = editor.value;
    updateStatus();
  }

  function load() {
    let saved = localStorage.getItem(STORAGE_KEY);
    editor.value = saved !== null ? saved : DEFAULT_DECK;
    lastSaved = editor.value;
  }

  function onEdit() {
    slides = splitSlides(editor.value);
    let before = editor.value.slice(0, editor.selectionStart);
    let breaks = before.match(SEPARATOR_ALL);
    current = breaks ? breaks.length : 0;
    render();
    updateStatus();
  }

  editor.addEventListener('input', onEdit);
  editor.addEventListener('click', onEdit);
  
  el('saveBtn').addEventListener('click', save);
  el('presentBtn').addEventListener('click', () => {
    presenting = true;
    presentation.hidden = false;
    render();
    document.documentElement.requestFullscreen?.();
  });

  views.forEach(v => {
    v.prev.addEventListener('click', () => go(-1));
    v.next.addEventListener('click', () => go(1));
  });

  views[0].fs.addEventListener('click', () => {
    presenting = true;
    presentation.hidden = false;
    render();
    document.documentElement.requestFullscreen?.();
  });

  views[1].fs.addEventListener('click', () => {
    presenting = false;
    presentation.hidden = true;
    document.exitFullscreen?.();
    render();
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
    if (e.key === 'F11') {
      e.preventDefault();
      presenting ? views[1].fs.click() : views[0].fs.click();
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (e.target === editor && !presenting) return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  load();
  slides = splitSlides(editor.value);
  render();
  updateStatus();
})();