
/* ==========================================
   INTERACTIVE POINTER GLOW — SELF-STYLED
========================================== */

const pointerStyle = document.createElement('style');

pointerStyle.textContent = `
  #pointerGlow {
    position: fixed !important;
    z-index: 2147483647 !important;
    left: 0;
    top: 0;
    width: 120px !important;
    height: 120px !important;
    border-radius: 50% !important;
    pointer-events: none !important;
    opacity: 0;
    transform: translate(-50%, -50%) scale(.7);
    background: radial-gradient(
      circle,
      rgba(116, 228, 210, .32),
      rgba(140, 157, 255, .18) 38%,
      transparent 72%
    ) !important;
    transition:
      opacity .18s ease,
      transform .18s ease;
    will-change: left, top, opacity, transform;
  }

  #pointerGlow.pointer-visible {
    opacity: 1 !important;
    transform: translate(-50%, -50%) scale(1);
  }

  #pointerGlow.pointer-tap {
    transform: translate(-50%, -50%) scale(1.3);
  }

  @media (prefers-reduced-motion: reduce) {
    #pointerGlow {
      transition: none;
    }
  }
`;

document.head.appendChild(pointerStyle);

const pointerGlow = document.createElement('div');
pointerGlow.id = 'pointerGlow';
pointerGlow.setAttribute('aria-hidden', 'true');
document.body.appendChild(pointerGlow);

let pointerTapTimer = null;
let pointerHideTimer = null;

function movePointerGlow(x, y) {
  pointerGlow.style.left = `${x}px`;
  pointerGlow.style.top = `${y}px`;
  pointerGlow.classList.add('pointer-visible');
}

document.addEventListener('pointermove', (event) => {
  clearTimeout(pointerHideTimer);

  movePointerGlow(event.clientX, event.clientY);

  if (event.pointerType === 'touch') {
    pointerHideTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-visible');
    }, 700);
  }
}, { passive: true });

document.addEventListener('pointerdown', (event) => {
  clearTimeout(pointerHideTimer);
  clearTimeout(pointerTapTimer);

  movePointerGlow(event.clientX, event.clientY);
  pointerGlow.classList.add('pointer-tap');

  pointerTapTimer = setTimeout(() => {
    pointerGlow.classList.remove('pointer-tap');
  }, 220);

  if (event.pointerType === 'touch') {
    pointerHideTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-visible');
    }, 900);
  }
}, { passive: true });

document.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') {
    clearTimeout(pointerHideTimer);

    pointerHideTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-visible');
    }, 700);
  }
}, { passive: true });

document.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'mouse') {
    pointerGlow.classList.remove(
      'pointer-visible',
      'pointer-tap'
    );
  }
}, { passive: true });

document.addEventListener('pointercancel', () => {
  pointerGlow.classList.remove(
    'pointer-visible',
    'pointer-tap'
  );
}, { passive: true });
