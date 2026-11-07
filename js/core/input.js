// Entrada: teclado (WASD/setas) e ponteiro/touch com joystick virtual arrastável.
(() => {
  const V = (window.V = window.V || {});

  const MOVE_KEYS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  const held = new Set();
  const stick = { active: false, ox: 0, oy: 0, x: 0, y: 0, id: null };
  let toLogical = (cx, cy) => ({ x: cx, y: cy });
  let onKeyCb = null;
  let onPointerCb = null;
  const pressedThisFrame = new Set();

  function keyVector() {
    let x = 0;
    let y = 0;
    if (held.has('left')) x -= 1;
    if (held.has('right')) x += 1;
    if (held.has('up')) y -= 1;
    if (held.has('down')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  const Input = {
    init(canvas, mapFn, keyCb, pointerCb) {
      toLogical = mapFn;
      onKeyCb = keyCb;
      onPointerCb = pointerCb;

      window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        const dir = MOVE_KEYS[e.code];
        if (dir) {
          held.add(dir);
          e.preventDefault();
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (!e.repeat) pressedThisFrame.add(e.code);
        if (onKeyCb) onKeyCb(e.code, true, e);
      });
      window.addEventListener('keyup', (e) => {
        const dir = MOVE_KEYS[e.code];
        if (dir) held.delete(dir);
        if (onKeyCb) onKeyCb(e.code, false, e);
      });
      window.addEventListener('blur', () => {
        held.clear();
        stick.active = false;
        stick.x = 0;
        stick.y = 0;
      });

      const down = (e) => {
        const p = toLogical(e.clientX, e.clientY);
        if (stick.id !== null && e.pointerId !== stick.id) {
          if (onPointerCb) onPointerCb('down', p.x, p.y);
          return;
        }
        stick.active = true;
        stick.id = e.pointerId;
        stick.ox = p.x;
        stick.oy = p.y;
        stick.x = 0;
        stick.y = 0;
        if (onPointerCb) onPointerCb('down', p.x, p.y);
        e.preventDefault();
      };
      const move = (e) => {
        const p = toLogical(e.clientX, e.clientY);
        if (stick.active && e.pointerId === stick.id) {
          const dx = p.x - stick.ox;
          const dy = p.y - stick.oy;
          const len = Math.hypot(dx, dy);
          const full = 46; // distância (lógica) para velocidade máxima
          const k = len > 0 ? Math.min(len, full) / full : 0;
          stick.x = len > 0 ? (dx / len) * k : 0;
          stick.y = len > 0 ? (dy / len) * k : 0;
        }
        if (onPointerCb) onPointerCb('move', p.x, p.y);
      };
      const up = (e) => {
        const p = toLogical(e.clientX, e.clientY);
        if (e.pointerId === stick.id) {
          stick.active = false;
          stick.id = null;
          stick.x = 0;
          stick.y = 0;
        }
        if (onPointerCb) onPointerCb('up', p.x, p.y);
      };

      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.style.touchAction = 'none';
    },

    // Vetor de movimento combinando teclado e joystick, com módulo até 1.
    move() {
      const k = keyVector();
      if (stick.active && (stick.x || stick.y)) {
        return {
          x: clamp1(k.x + stick.x),
          y: clamp1(k.y + stick.y),
        };
      }
      return k;
    },

    stick,

    isHeld(dir) {
      return held.has(dir);
    },

    // Teclas pressionadas desde o último clearFrame(); usado para ações de um toque.
    wasPressed(code) {
      return pressedThisFrame.has(code);
    },

    clearFrame() {
      pressedThisFrame.clear();
    },

    reset() {
      held.clear();
      stick.active = false;
      stick.id = null;
      stick.x = 0;
      stick.y = 0;
    },
  };

  function clamp1(v) {
    return v > 1 ? 1 : v < -1 ? -1 : v;
  }

  V.Input = Input;
})();
