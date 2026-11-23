'use strict';

const TitleMenu = (() => {
  const title = document.getElementById('title');
  const choices = Array.from(title.querySelectorAll('.title-choice'));
  const marker = document.getElementById('titleSelection');
  const language = document.getElementById('menuLanguage');
  const centers = [394, 460, 521, 582, 642];
  let selected = 0;
  let strings = new Map();
  let locale = UX.menuLanguage();

  document.getElementById('namedTitleImage').src = 'godot/phase4/title_art/menu.webp';
  title.style.setProperty('--lettering', 'url("godot/phase4/title_art/lettering.png")');
  marker.src = 'godot/phase4/title_art/selection.png';

  function select(index) {
    if (choices[index].disabled) return;
    choices[selected].classList.remove('selected');
    selected = index;
    choices[index].classList.add('selected');
    marker.style.top = choices[index].style.top;
  }
  choices.forEach((button, index) => {
    button.style.setProperty('--atlas-y', (index * 25) + '%');
    button.style.top = centers[index] / 941 * 100 + '%';
    button.addEventListener('pointerenter', () => select(index));
    button.addEventListener('focus', () => select(index));
  });
  select(0);

  function handleKey(event) {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      let index = selected;
      do { index = (index + choices.length + step) % choices.length; } while (choices[index].disabled);
      choices[index].focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) choices[selected].click();
    } else return false;
    event.preventDefault();
    return true;
  }

  // Godot's translation CSV uses one key per row and a header of locale codes.
  function readCatalog(csv) {
    const rows = [], fields = [];
    let value = '', quoted = false;
    for (let i = 0; i < csv.length; i++) {
      const c = csv[i];
      if (c === '"') {
        if (quoted && csv[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && (c === ',' || c === '\n')) {
        fields.push(value); value = '';
        if (c === '\n') rows.push(fields.splice(0));
      } else value += c;
    }
    if (value || fields.length) rows.push([...fields, value]);
    const columns = rows.shift();
    return new Map(rows.map(row => [row[0], Object.fromEntries(columns.map((col, i) => [col, row[i]]))]));
  }
  function text(key) {
    const row = strings.get(key);
    return row?.[locale] || row?.en || '';
  }
  function translate() {
    language.value = locale;
    title.lang = locale;
    document.querySelectorAll('[data-menu]').forEach(el => {
      el.textContent = text(el.dataset.menu);
      el.lang = locale;
      if (el.classList.contains('title-choice')) {
        el.classList.toggle('lettered', el.textContent === el.dataset.menu);
      }
    });
    document.title = text('GAME_NAME');
    title.setAttribute('aria-label', document.title);
    document.getElementById('namedTitleImage').alt = document.title;
  }
  language.onchange = () => {
    locale = language.value;
    UX.saveMenuLanguage(locale);
    translate();
  };
  const ready = fetch('godot/phase4/title_art/menu.csv')
    .then(response => {
      if (!response.ok) throw new Error('Menu CSV: ' + response.status);
      return response.text();
    }).then(csv => {
      strings = readCatalog(csv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'));
      translate();
    });
  return { ready, text, handleKey, reset: () => select(0) };
})();
