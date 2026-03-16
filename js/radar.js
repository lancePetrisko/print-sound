function drawRadar(values) {
  const canvas = document.getElementById('radar');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 30;
  const labels = ['Energy', 'Danceable', 'Valence', 'Acoustic', 'Instrumental', 'Loudness'];
  const n = values.length;

  ctx.clearRect(0, 0, W, H);

  // grid rings
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = (ring / 4) * R;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // spokes
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // filled area
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = values[i] * R;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, 'rgba(29,185,84,0.5)');
  grad.addColorStop(1, 'rgba(29,185,84,0.05)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#1db954';
  ctx.lineWidth = 2;
  ctx.stroke();

  // dots
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = values[i] * R;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1db954';
    ctx.fill();
  }

  // labels
  ctx.font = '500 10px DM Sans, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + (R + 18) * Math.cos(angle);
    const y = cy + (R + 18) * Math.sin(angle) + 4;
    ctx.fillText(labels[i], x, y);
  }
}
