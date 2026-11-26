'use strict';

const CharacterSelectView = (() => {
  const screen = document.getElementById('characterSelect');
  const row = document.getElementById('characterCards');
  const slots = [
    { id: 'barel', numeral: 'I', focus: ['45% 0%', '40% 10%'], stats: [5, 2, 2], role: 'SELECT_MELEE' },
    { id: 'viesa', numeral: 'II', focus: ['55% 0%', '50% 8%'], stats: [2, 5, 4], role: 'SELECT_RANGE' },
    { id: 'locked-3', numeral: 'III' },
    { id: 'locked-4', numeral: 'IV' }
  ];
  const portraits = {
    barel: 'godot/phase4/character_select/img/barel.jpg',
    viesa: 'godot/phase4/character_select/img/viesa.jpg'
  };
  const statLabels = ['SELECT_POWER', 'SELECT_AGILITY', 'SELECT_DIFFICULTY'];
  let toastTimer;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function build(slot) {
    const card = element('button', 'card character-card');
    const clip = element('span', 'card-clip');
    card.type = 'button';
    card.dataset.character = slot.id;
    card.id = 'character' + slot.id[0].toUpperCase() + slot.id.slice(1);
    card.append(clip);
    if (!slot.stats) {
      card.classList.add('is-locked');
      const locked = element('span', 'card-locked');
      locked.append(element('span', 'l-mark', '?'), element('span', 'l-hint'));
      clip.append(locked, element('span', 'l-numeral', slot.numeral));
      return card;
    }
    card.style.setProperty('--focus-collapsed', slot.focus[0]);
    card.style.setProperty('--focus-expanded', slot.focus[1]);
    const art = element('img', 'card-art');
    art.src = portraits[slot.id];
    art.alt = '';
    art.draggable = false;
    const collapsed = element('span', 'card-collapsed');
    const meta = element('span', 'c-meta');
    meta.append(element('span', 'c-numeral', slot.numeral), element('span', 'c-class'));
    collapsed.append(element('span', 'v-name'), meta);
    const expanded = element('span', 'card-expanded');
    const title = element('span', 'e-title');
    title.append(element('span', 'e-name'), element('span', 'e-role'));
    const stats = element('span', 'stats');
    slot.stats.forEach((value, index) => {
      const stat = element('span', 'stat');
      const heading = element('span', 'stat-head');
      heading.append(element('span', 'stat-label'), element('span', 'stat-value', value + ' / 5'));
      const track = element('span', 'stat-track');
      const fill = element('span', 'stat-fill' + (index === 2 ? ' is-difficulty' : ''));
      fill.style.setProperty('--pct', (value * 20) + '%');
      fill.style.setProperty('--delay', (220 + index * 90) + 'ms');
      track.append(fill);
      stat.append(heading, track);
      stats.append(stat);
    });
    expanded.append(element('span', 'e-kicker'), title, stats);
    clip.append(art, element('span', 'card-shade'), collapsed, expanded);
    return card;
  }

  const cards = slots.map(build);
  row.append(...cards);

  function translate() {
    const text = TitleMenu.text;
    screen.lang = TitleMenu.locale;
    slots.forEach((slot, index) => {
      const card = cards[index];
      if (!slot.stats) {
        card.querySelector('.l-hint').textContent = text('SELECT_UNREVEALED');
        card.setAttribute('aria-label', text('SELECT_LOCKED') + ' ' + slot.numeral);
        return;
      }
      const name = text('HERO_' + slot.id);
      const job = text('HERO_JOB_' + slot.id);
      card.setAttribute('aria-label', name + ', ' + job);
      card.querySelector('.v-name').textContent = screen.lang === 'ko' ? Array.from(name).join('\n') : name;
      card.querySelector('.c-class').textContent = job;
      card.querySelector('.e-name').textContent = name;
      card.querySelector('.e-kicker').textContent = slot.numeral + ' · ' + job;
      card.querySelector('.e-role').textContent = text(slot.role);
      card.querySelectorAll('.stat-label').forEach((label, i) => { label.textContent = text(statLabels[i]); });
      const difficulty = slot.stats[2];
      card.querySelector('.is-difficulty').closest('.stat').querySelector('.stat-value').textContent =
        text(difficulty < 3 ? 'SELECT_EASY' : difficulty === 3 ? 'SELECT_NORMAL' : 'SELECT_HARD');
    });
    document.getElementById('characterUnlockCount').textContent = text('SELECT_UNLOCKED', slots.filter(s => s.stats).length, slots.length);
  }
  document.addEventListener('bmk-language-change', translate);
  TitleMenu.ready.then(translate);

  function showLockedNotice() {
    const toast = document.getElementById('characterSelectionStatus');
    toast.textContent = TitleMenu.text('SELECT_DENIED');
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(clearNotice, 1600);
  }
  function clearNotice() {
    const toast = document.getElementById('characterSelectionStatus');
    clearTimeout(toastTimer);
    toast.classList.remove('is-visible');
    toast.textContent = '';
  }

  return { cards, showLockedNotice, clearNotice };
})();
