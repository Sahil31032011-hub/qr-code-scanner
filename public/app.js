
/* ==========================================
   INTERACTIVE POINTER GLOW
========================================== */

(() => {
  // Create the glow only once.
  let pointerGlow = document.getElementById('pointerGlow');

  if (!pointerGlow) {
    pointerGlow = document.createElement('div');
    pointerGlow.id = 'pointerGlow';
    pointerGlow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(pointerGlow);
  }

  let pointerTapTimer = null;

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;

    pointerGlow.style.left = `${event.clientX}px`;
    pointerGlow.style.top = `${event.clientY}px`;
    pointerGlow.classList.add('pointer-visible');
  }, { passive: true });

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;

    pointerGlow.style.left = `${event.clientX}px`;
    pointerGlow.style.top = `${event.clientY}px`;

    pointerGlow.classList.add('pointer-visible', 'pointer-tap');

    clearTimeout(pointerTapTimer);

    pointerTapTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-tap');
    }, 250);
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    pointerGlow.classList.remove('pointer-visible', 'pointer-tap');
  });

  document.addEventListener('pointerenter', () => {
    pointerGlow.classList.add('pointer-visible');
  });
})();


/* ==========================================
   CAMERA ZOOM FIX
========================================== */

(() => {
  const video = document.getElementById('video');
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomRange = document.getElementById('zoomRange');

  if (!video || !zoomIn || !zoomOut || !zoomRange) {
    console.warn('Camera zoom controls were not found.');
    return;
  }

  let zoomTrack = null;
  let zoomMin = 1;
  let zoomMax = 1;
  let currentZoom = 1;
  let zoomStep = 0.25;

  async function findZoomTrack() {
    try {
      const stream = video.srcObject;

      if (!stream || typeof stream.getVideoTracks !== 'function') {
        zoomTrack = null;
        return false;
      }

      zoomTrack = stream.getVideoTracks()[0] || null;

      if (
        !zoomTrack ||
        typeof zoomTrack.getCapabilities !== 'function' ||
        typeof zoomTrack.applyConstraints !== 'function'
      ) {
        disableZoom();
        return false;
      }

      const capabilities = zoomTrack.getCapabilities();
      const zoom = capabilities.zoom;

      if (!zoom || zoom.max <= zoom.min) {
        disableZoom();
        console.info('Native camera zoom is not supported on this device.');
        return false;
      }

      zoomMin = zoom.min;
      zoomMax = zoom.max;
      zoomStep = zoom.step || 0.25;
      currentZoom = Math.max(zoomMin, Math.min(currentZoom, zoomMax));

      zoomRange.min = String(zoomMin);
      zoomRange.max = String(zoomMax);
      zoomRange.step = String(zoomStep);
      zoomRange.value = String(currentZoom);
      zoomRange.disabled = false;

      updateZoomButtons();
      return true;
    } catch (error) {
      console.warn('Unable to read camera zoom capabilities:', error);
      disableZoom();
      return false;
    }
  }

  function disableZoom() {
    zoomTrack = null;
    zoomRange.disabled = true;
    zoomIn.disabled = true;
    zoomOut.disabled = true;
  }

  function updateZoomButtons() {
    zoomIn.disabled = currentZoom >= zoomMax;
    zoomOut.disabled = currentZoom <= zoomMin;
  }

  async function applyZoom(value) {
    if (!zoomTrack || zoomTrack.readyState === 'ended') {
      const found = await findZoomTrack();
      if (!found) return;
    }

    const nextZoom = Math.max(
      zoomMin,
      Math.min(Number(value), zoomMax)
    );

    try {
      await zoomTrack.applyConstraints({
        advanced: [{ zoom: nextZoom }]
      });

      currentZoom = nextZoom;
      zoomRange.value = String(currentZoom);
      updateZoomButtons();
    } catch (error) {
      console.warn('Camera zoom could not be applied:', error);
    }
  }

  zoomIn.addEventListener('click', () => {
    applyZoom(currentZoom + zoomStep);
  });

  zoomOut.addEventListener('click', () => {
    applyZoom(currentZoom - zoomStep);
  });

  zoomRange.addEventListener('input', () => {
    applyZoom(zoomRange.value);
  });

  video.addEventListener('loadedmetadata', findZoomTrack);
  video.addEventListener('playing', findZoomTrack);

  // Check again when the camera stream becomes available.
  const retryTimer = setInterval(() => {
    if (video.srcObject) {
      findZoomTrack();
      clearInterval(retryTimer);
    }
  }, 500);

  // Stop checking after 20 seconds.
  setTimeout(() => clearInterval(retryTimer), 20000);
})();
