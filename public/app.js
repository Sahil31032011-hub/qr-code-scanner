
/* ==========================================
   INTERACTIVE POINTER GLOW
========================================== */

const pointerGlow = document.createElement('div');
pointerGlow.id = 'pointerGlow';
pointerGlow.setAttribute('aria-hidden', 'true');
document.body.appendChild(pointerGlow);

let pointerTapTimer;

document.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;

  pointerGlow.style.left = event.clientX + 'px';
  pointerGlow.style.top = event.clientY + 'px';
  pointerGlow.classList.add('pointer-visible');
});

document.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') return;

  pointerGlow.style.left = event.clientX + 'px';
  pointerGlow.style.top = event.clientY + 'px';
  pointerGlow.classList.add('pointer-visible', 'pointer-tap');

  clearTimeout(pointerTapTimer);

  pointerTapTimer = setTimeout(() => {
    pointerGlow.classList.remove('pointer-tap');
  }, 250);
});

document.addEventListener('pointerleave', () => {
  pointerGlow.classList.remove('pointer-visible', 'pointer-tap');
});
r-tap');
}, { passive: true });

})();
