'use strict';

const TitleMenu = (() => {
  const title = document.getElementById('title');
  const choices = Array.from(title.querySelectorAll('.title-choice'));
  const marker = document.getElementById('titleSelection');
  const language = document.getElementById('menuLanguage');
  const centers = [394, 460, 521, 582, 642, 703];
  const letteringRows = ['New Game', 'Continue', 'Options', 'Credits', 'Exit'];
  let selected = 0;
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
    // lettering.png holds the five original English captions; other rows use the serif text.
    const atlas = ['New Game', 'Continue', 'Options', 'Credits', 'Exit'].indexOf(button.dataset.menu);
    if (atlas >= 0) button.style.setProperty('--atlas-y', (atlas * 25) + '%');
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

  const text = (key, ...values) => GameLanguage.text(locale, key, ...values);
  const localize = (source, ...values) => GameLanguage.localize(locale, source, ...values);
  function translate() {
    language.value = locale;
    document.documentElement.lang = locale;
    title.lang = locale;
    document.querySelectorAll('[data-menu]').forEach(el => {
      // data-menu-lang pins a label to one language (the bilingual pause rows).
      const lang = el.dataset.menuLang || locale;
      el.textContent = GameLanguage.text(lang, el.dataset.menu);
      el.lang = lang;
      if (el.classList.contains('title-choice')) {
        el.classList.toggle('lettered', locale === 'en' && letteringRows.includes(el.dataset.menu)
          && el.textContent === el.dataset.menu);
      }
    });
    document.querySelectorAll('[data-menu-aria]').forEach(el => {
      el.setAttribute('aria-label', text(el.dataset.menuAria));
    });
    document.title = text('GAME_NAME');
    title.setAttribute('aria-label', document.title);
    document.getElementById('namedTitleImage').alt = document.title;
    document.dispatchEvent(new CustomEvent('bmk-language-change', { detail: { locale } }));
  }
  language.onchange = () => {
    locale = language.value;
    UX.saveMenuLanguage(locale);
    translate();
  };
  const ready = GameLanguage.ready.then(translate);
  return { ready, text, localize, handleKey, reset: () => select(0), get locale() { return locale; } };
})();
