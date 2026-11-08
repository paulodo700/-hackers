// Entrada: teclado, mouse, toque (joystick virtual e botões) e arraste de câmera.
export function createInput(canvas) {
  const input = {
    // Movimento em espaço de tela: x → direita, y → cima (-1..1)
    moveX: 0, moveY: 0,
    yawDelta: 0,        // arraste horizontal de câmera neste frame
    zoomDelta: 0,
    onInteract: null,
    onMenu: null,
    onAdvance: null,
    onKey: null,
    touchEnabled: false,
  };

  const keys = new Set();
  const touchMoveHolder = { x: 0, y: 0 };

  function recomputeKeys() {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    input.keyMove = { x, y };
  }

  window.addEventListener('keydown', (e) => {
    if (input.onKey && input.onKey(e.code, 'down', e) === true) return;
    // Com um botão focado, Espaço e Enter ativam o botão (navegação por teclado), sem virar ação do mundo
    const focused = document.activeElement;
    const onControl = !!focused && (focused.tagName === 'BUTTON' || focused.tagName === 'INPUT' || focused.tagName === 'SELECT' || (focused.tagName === 'CANVAS' && focused.hasAttribute('tabindex')));
    if (onControl && (e.code === 'Space' || e.code === 'Enter')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    recomputeKeys();
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
      if (!e.repeat && input.onInteract) input.onInteract();
    }
    if (e.code === 'KeyM' || e.code === 'Escape') {
      if (!e.repeat && input.onMenu) input.onMenu();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    recomputeKeys();
  });
  window.addEventListener('blur', () => { keys.clear(); recomputeKeys(); });

  // Mouse: arrastar com botão direito ou meio gira a câmera. Roda do mouse dá zoom.
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && (e.button === 2 || e.button === 1)) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (dragging) {
      input.yawDelta += (e.clientX - lastX) * 0.008;
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    input.zoomDelta += Math.sign(e.deltaY) * 0.8;
  }, { passive: true });

  // Toque: joystick na metade esquerda; arrastar na direita gira a câmera.
  const joyZone = document.getElementById('joy-zone');
  const joyBase = document.getElementById('joy-base');
  const joyKnob = document.getElementById('joy-knob');
  const touchRoot = document.getElementById('touch');
  let joyId = null, joyCx = 0, joyCy = 0;
  let camId = null, camX = 0;
  const JOY_R = 60;

  function setKnob(dx, dy) {
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  joyZone.addEventListener('pointerdown', (e) => {
    if (joyId !== null) return;
    joyId = e.pointerId;
    joyCx = e.clientX; joyCy = e.clientY;
    joyBase.style.display = 'block';
    joyBase.style.left = `${joyCx}px`;
    joyBase.style.top = `${joyCy}px`;
    joyZone.setPointerCapture(e.pointerId);
    touchMoveHolder.x = 0; touchMoveHolder.y = 0;
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - joyCx, dy = e.clientY - joyCy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
    setKnob(dx, dy);
    touchMoveHolder.x = dx / JOY_R;
    touchMoveHolder.y = -dy / JOY_R;
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    joyBase.style.display = 'none';
    setKnob(0, 0);
    touchMoveHolder.x = 0; touchMoveHolder.y = 0;
  };
  joyZone.addEventListener('pointerup', endJoy);
  joyZone.addEventListener('pointercancel', endJoy);

  // Arrastar na metade direita gira a câmera (fora dos botões)
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && e.clientX > window.innerWidth / 2 && camId === null) {
      camId = e.pointerId; camX = e.clientX;
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && e.pointerId === camId) {
      input.yawDelta += (e.clientX - camX) * 0.008;
      camX = e.clientX;
    }
  });
  window.addEventListener('pointerup', (e) => { if (e.pointerId === camId) camId = null; });
  window.addEventListener('pointercancel', (e) => { if (e.pointerId === camId) camId = null; });

  document.getElementById('tb-act').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (input.onInteract) input.onInteract();
  });
  document.getElementById('tb-menu').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (input.onMenu) input.onMenu();
  });

  // Detecta toque para mostrar os controles
  const enableTouch = () => {
    if (input.touchEnabled) return;
    input.touchEnabled = true;
    touchRoot.classList.add('enabled');
  };
  window.addEventListener('touchstart', enableTouch, { once: true, passive: true });
  if (window.matchMedia('(pointer: coarse)').matches) enableTouch();

  input.update = () => {
    const k = input.keyMove || { x: 0, y: 0 };
    let x = k.x, y = k.y;
    if (joyId !== null || touchMoveHolder.x || touchMoveHolder.y) {
      x = touchMoveHolder.x; y = touchMoveHolder.y;
    }
    input.moveX = x;
    input.moveY = y;
  };
  input.consume = () => {
    const out = { yawDelta: input.yawDelta, zoomDelta: input.zoomDelta };
    input.yawDelta = 0;
    input.zoomDelta = 0;
    return out;
  };
  input.keyMove = { x: 0, y: 0 };
  return input;
}
