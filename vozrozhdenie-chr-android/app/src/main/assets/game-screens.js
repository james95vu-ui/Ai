(() => {
  'use strict';

  const nav = document.querySelector('.game-nav');
  const panels = [...document.querySelectorAll('[data-screen]')];
  const buttons = [...nav.querySelectorAll('[data-go]')];

  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-go]');
    if (!button || button.hasAttribute('aria-current')) return;
    const target = panels.find(panel => panel.id === button.dataset.go);
    if (!target) return;

    for (const panel of panels) panel.hidden = panel !== target;
    for (const tab of buttons) tab.removeAttribute('aria-current');
    button.setAttribute('aria-current', 'page');
    target.scrollTop = 0;
  });
})();
