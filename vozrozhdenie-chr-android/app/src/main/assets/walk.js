(() => {
  'use strict';

  const dialog = document.getElementById('walk-view');
  const canvas = document.getElementById('walk-canvas');
  const ctx = canvas.getContext('2d');
  const buttons = [...dialog.querySelectorAll('[data-move]')];
  const keys = {
    w: 'forward', a: 'left', s: 'back', d: 'right',
    arrowup: 'forward', arrowleft: 'left', arrowdown: 'back', arrowright: 'right'
  };
  const held = new Map();
  const near = .18;
  let player, surfaces, obstacles, drag, frame, lastTime, cityLevel;

  function addFace(points, color, ground = false) {
    surfaces.push({points, color, ground});
  }

  function ground(x, z, width, depth, color, y = 0) {
    addFace([[x, y, z], [x + width, y, z], [x + width, y, z + depth], [x, y, z + depth]], color, true);
  }

  function block(x, z, width, depth, height, colors, bottom = 0) {
    const right = x + width, far = z + depth, top = bottom + height;
    const a = [x, bottom, z], b = [right, bottom, z], c = [right, bottom, far], d = [x, bottom, far];
    const e = [x, top, z], f = [right, top, z], g = [right, top, far], h = [x, top, far];
    addFace([a, e, f, b], colors[0]);
    addFace([b, f, g, c], colors[1]);
    addFace([c, g, h, d], colors[1]);
    addFace([d, h, e, a], colors[0]);
    addFace([e, h, g, f], colors[2]);
  }

  function tree(x, z, size) {
    block(x - .13, z - .13, .26, .26, size, ['#594736', '#765842', '#80634b']);
    block(x - size / 2, z - size / 2, size, size, size,
      ['#377854', '#256344', '#75a86b'], size * .55);
  }

  function stoneTower(x, z) {
    block(x, z, 1.25, 1.25, 4.8, ['#bda37d', '#8c785f', '#dbc49c']);
    for (let step = 0; step < 3; step++) {
      const inset = .15 + step * .16;
      const width = 1.25 - inset * 2;
      block(x + inset, z + inset, width, width, .28,
        ['#766754', '#655447', '#a08a70'], 4.8 + step * .28);
    }
    obstacles.push({left: x, right: x + 1.25, front: z, back: z + 1.25});
  }

  function makeCity(city, level, built) {
    cityLevel = level;
    surfaces = [];
    obstacles = [];
    const hue = [...city].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 65 + 12;
    ground(-70, -70, 140, 140, '#779369');
    ground(-23, -23, 46, 46, level >= 8 ? '#43565c' : level >= 3 ? '#748183' : '#a39476', .01);
    for (let i = -2; i < 3; i++) {
      const lane = i * 12 + 6;
      if (Math.abs(lane) > 22) continue;
      for (let offset = -21; offset < 22; offset += 4) {
        if (level < 4) break;
        ground(lane - .08, offset, .16, 1.6, '#e7dcb0', .025);
        ground(offset, lane - .08, 1.6, .16, '#e7dcb0', .025);
      }
    }
    if (level >= 7) {
      for (const x of [-18, -6, 6, 18]) {
        for (const z of [-18, -6, 6, 18]) {
          block(x - 1.45, z - 1.45, .12, .12, 2.9, ['#5c6b67', '#42544e', '#c2ddd0']);
          block(x - 1.57, z - 1.57, .36, .36, .14, ['#f5da96', '#ffe8a8', '#fffade'], 2.85);
        }
      }
    }
    for (let i = 0; i < 9; i++) {
      const x = (i % 3 - 1) * 12;
      const z = (Math.floor(i / 3) - 1) * 12;
      ground(x - 4.65, z - 4.65, 9.3, 9.3, built[i] ? '#d5c3a0' : '#87966a', .04);
      if (!built[i]) {
        if (level <= 2) {
          block(x - 1.7, z + 1.3, 2.6, .42, .55, ['#a89981', '#817662', '#b5a58c']);
          block(x + .9, z - .35, .65, .66, .33, ['#a89981', '#817662', '#b5a58c']);
        }
        tree(x + 2, z + 2, 1.1);
        continue;
      }
      if (i === 0) {
        ground(x - 4.3, z - 4.3, 8.6, 8.6, '#83a866', .06);
        for (const dx of [-2.6, 2.6]) {
          for (const dz of [-2.6, 2.6]) tree(x + dx, z + dz, 1.7);
        }
        ground(x - .55, z - 4.3, 1.1, 8.6, '#e7d6ad', .07);
        if (level >= 5) stoneTower(x + 1.05, z - 1.7);
        if (level >= 8) {
          ground(x - 3.8, z - 1.3, 2, 2.6, '#e8d2a4', .08);
          ground(x - 3.55, z - 1.05, 1.5, 2.1, '#5da9ab', .09);
        }
        continue;
      }
      const modern = level >= 8 && [3, 4, 7, 8].includes(i);
      const width = i % 2 ? 6.2 : 5.4, depth = 5.2;
      const height = [0, 3.4, 3.1, 5.4, 4.7, 4.1, 2.8, 3.6, 5.1][i] +
        (modern ? (level - 7) * (i === 8 ? 1.7 : .95) : 0);
      const left = x - width / 2, front = z - depth / 2;
      const roof = modern ? '#718f93' : 'hsl(' + (hue + i * 4) + ',34%,42%)';
      block(left, front, width, depth, height, modern ? ['#69979c', '#497582', roof] : ['#e4cba3', '#c1ab8d', roof], .04);
      block(left - .15, front - .15, width + .3, depth + .3, .28, [roof, roof, roof], height);
      if (modern) {
        block(left + .55, front + .55, width - 1.1, depth - 1.1, .95,
          ['#527f88', '#3e6975', '#83a5a6'], height + .28);
        if (level === 10) {
          block(left + width * .49, front + depth * .49, .18, .18, 1.35,
            ['#abddcf', '#649997', '#d1fcda'], height + 1.23);
        }
      }
      obstacles.push({left, right: left + width, front, back: front + depth});
      for (let col = 1; col <= 3; col++) {
        for (let floor = 0; floor < Math.floor(height / 1.5); floor++) {
          const winX = left + width * col / 4 - .35;
          const y = .9 + floor * 1.45;
          addFace([[winX, y, front - .02], [winX, y + .66, front - .02],
            [winX + .7, y + .66, front - .02], [winX + .7, y, front - .02]], modern ? (floor % 2 ? '#b0dfd2' : '#84b6b8') : '#416569');
          const back = front + depth + .02;
          addFace([[winX + .7, y, back], [winX + .7, y + .66, back],
            [winX, y + .66, back], [winX, y, back]], modern ? (floor % 2 ? '#b0dfd2' : '#84b6b8') : '#416569');
        }
      }
      if (level >= 6) tree(x + 3.5, z + 3.5, 1.45);
    }
  }

  function clip(points) {
    const visible = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if (a[2] >= near) visible.push(a);
      if ((a[2] >= near) === (b[2] >= near)) continue;
      const t = (near - a[2]) / (b[2] - a[2]);
      visible.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
    }
    return visible;
  }

  function paint() {
    const width = Math.min(1200, canvas.clientWidth), height = Math.min(1000, canvas.clientHeight);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const horizon = height * (.43 + player.pitch);
    const focal = Math.max(width * .66, height * .47);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, cityLevel >= 9 ? '#426783' : '#6da2aa');
    sky.addColorStop(1, cityLevel >= 9 ? '#e6b98f' : '#edddaa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? '#739389' : '#92ada3';
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let i = 0; i <= 16; i++) {
        const peak = Math.sin(i * 2.1 + player.yaw * 3 + layer) * .5 + .5;
        ctx.lineTo(i * width / 16, horizon - height * (.02 + peak * (.14 - layer * .05)));
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fill();
    }

    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    const polygons = [];
    for (const face of surfaces) {
      const points = clip(face.points.map(([x, y, z]) => {
        const dx = x - player.x, dz = z - player.z;
        return [dx * cos - dz * sin, y - 1.65, dx * sin + dz * cos];
      }));
      if (points.length < 3) continue;
      const pixels = points.map(([x, y, z]) => [width / 2 + x * focal / z, horizon - y * focal / z]);
      const area = pixels.reduce((sum, [x, y], i) => {
        const [nx, ny] = pixels[(i + 1) % pixels.length];
        return sum + x * ny - y * nx;
      }, 0);
      if (!face.ground && area <= 0) continue;
      polygons.push({pixels, color: face.color, ground: face.ground,
        depth: points.reduce((sum, point) => sum + point[2], 0) / points.length});
    }
    const ordered = polygons.filter(face => !face.ground).sort((a, b) => b.depth - a.depth);
    for (const {pixels, color} of [...polygons.filter(face => face.ground), ...ordered]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(...pixels[0]);
      for (const point of pixels.slice(1)) ctx.lineTo(...point);
      ctx.closePath();
      ctx.fill();
    }
  }

  function canMove(x, z) {
    return Math.abs(x) < 22 && Math.abs(z) < 22 &&
      !obstacles.some(b => x > b.left - .35 && x < b.right + .35 && z > b.front - .35 && z < b.back + .35);
  }

  function tick(now) {
    const dt = Math.min(.05, (now - lastTime) / 1000);
    lastTime = now;
    const moves = new Set(held.values());
    if (moves.size) {
      const forward = Number(moves.has('forward')) - Number(moves.has('back'));
      const right = Number(moves.has('right')) - Number(moves.has('left'));
      const step = 6 * dt / Math.max(1, Math.hypot(forward, right));
      const x = player.x + (forward * Math.sin(player.yaw) + right * Math.cos(player.yaw)) * step;
      const z = player.z + (forward * Math.cos(player.yaw) - right * Math.sin(player.yaw)) * step;
      if (canMove(x, player.z)) player.x = x;
      if (canMove(player.x, z)) player.z = z;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }

  dialog.addEventListener('walkstart', ({detail}) => {
    if (!ctx || dialog.open) return;
    makeCity(detail.city, detail.level, detail.built);
    player = {x: -6, z: -19, yaw: .19, pitch: 0};
    document.getElementById('walk-title').textContent = detail.city;
    document.getElementById('walk-level').textContent = 'Уровень ' + detail.level + ' из 10';
    dialog.showModal();
    paint();
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  });
  document.getElementById('walk-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    cancelAnimationFrame(frame);
    held.clear();
    drag = null;
  });
  window.addEventListener('resize', () => { if (dialog.open) paint(); });

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      held.set(event.pointerId, button.dataset.move);
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => held.delete(event.pointerId));
    }
  }
  canvas.addEventListener('pointerdown', event => {
    if (drag) return;
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    player.yaw -= (event.clientX - drag.x) * .007;
    player.pitch = Math.max(-.28, Math.min(.28, player.pitch + (event.clientY - drag.y) * .002));
    drag.x = event.clientX;
    drag.y = event.clientY;
    paint();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => { if (drag?.id === event.pointerId) drag = null; });
  }
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!dialog.open || !keys[key]) return;
    event.preventDefault();
    held.set(key, keys[key]);
  });
  window.addEventListener('keyup', event => held.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => { held.clear(); drag = null; });
})();
