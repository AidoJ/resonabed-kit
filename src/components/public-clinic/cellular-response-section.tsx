"use client";

// RESONABED CELLULAR V3: single mechanical cell + fading potential-benefit words.

import { useEffect, useRef, useState } from "react";

// Self-contained: React + Canvas 2D. Geometry is rotated and projected in 3D.
// All educational copy remains hardcoded, as in the supplied component.
const STEPS = [
  {
    "title": "Cells sense mechanical movement",
    "label": "Mechanical movement",
    "text": "Cells can sense changes in their physical surroundings.",
    "tag": "Shared mechanical input",
    "color": "#7956ae"
  },
  {
    "title": "Calcium carries a signal",
    "label": "Membrane sensors",
    "text": "Some mechanically sensitive channels allow calcium signals into the cell.",
    "tag": "Membrane pathway · Ca²⁺",
    "color": "#208677"
  },
  {
    "title": "Attachment points respond",
    "label": "Attachment signalling",
    "text": "Cell attachment points can activate internal signalling.",
    "tag": "Adhesion pathway · FAK",
    "color": "#208677"
  },
  {
    "title": "The inner structure responds",
    "label": "Internal framework",
    "text": "The cell’s internal framework helps transmit mechanical forces.",
    "tag": "Structural pathway · Cytoskeleton",
    "color": "#7956ae"
  },
  {
    "title": "A connection to the nucleus",
    "label": "Nuclear connections",
    "text": "Mechanical connections can carry forces toward the nucleus.",
    "tag": "Structural pathway · LINC complex",
    "color": "#7956ae"
  },
  {
    "title": "Cellular activity may change",
    "label": "Gene activity",
    "text": "Under studied conditions, mechanical signals can influence gene activity.",
    "tag": "Context-dependent response",
    "color": "#ac7929"
  }
];

type Vec = [number, number, number];
type SceneState = { step: number; playing: boolean; reduced: boolean; visible: boolean; yaw: number; pitch: number; labels: boolean };

function mountCell(canvas: HTMLCanvasElement, state: { current: SceneState }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  let width = 1, height = 1, frame = 0, last = 0, time = 0, zoom = 1;
  const dots: Vec[] = Array.from({ length: 190 }, (_, i) => {
    const y = 1 - (i / 189) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width; height = entry.contentRect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  resize.observe(canvas);
  const sphere = (x: number, y: number, radius: number, color: string, alpha = 1) => {
    if (radius <= 0) return;
    ctx.globalAlpha = alpha;
    const gradient = ctx.createRadialGradient(x - radius * .35, y - radius * .4, radius * .03, x, y, radius);
    gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.2, color); gradient.addColorStop(1, "#3d285e");
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  };
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    const s = state.current;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
    if (!s.visible || document.hidden) return;
    if (s.playing && !s.reduced) { time += dt; s.yaw += dt * .022; }
    ctx.clearRect(0, 0, width, height);
    zoom += ((s.step === 1 ? 1.08 : 1) - zoom) * (s.reduced ? 1 : .05);
    const scale = Math.min(width * .315, height * .32) * zoom, cx = width * .51, cy = height * .49;
    const angle = s.yaw, pitch = s.pitch;
    const breathe = 1 + Math.sin(time * 1.5) * (s.step === 0 ? .027 : .006);
    const project = (v: Vec) => {
      const x = v[0] * Math.cos(angle) + v[2] * Math.sin(angle);
      const z = -v[0] * Math.sin(angle) + v[2] * Math.cos(angle);
      const y = v[1] * Math.cos(pitch) - z * Math.sin(pitch);
      const depth = v[1] * Math.sin(pitch) + z * Math.cos(pitch);
      const perspective = 3.8 / (3.8 - depth);
      return { x: cx + x * scale * perspective * breathe, y: cy + y * scale * perspective / breathe, z: depth, k: perspective };
    };
    const line = (a: Vec, b: Vec, color: string, thickness = 1) => {
      const p = project(a), q = project(b);
      ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    };

    // Soft ground shadow gives the cell a visible floating plane.
    ctx.save(); ctx.translate(cx, cy + scale * 1.32); ctx.scale(1, .16);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * .92);
    shadow.addColorStop(0, "rgba(80,55,116,.15)"); shadow.addColorStop(1, "rgba(80,55,116,0)");
    ctx.fillStyle = shadow; ctx.fillRect(-scale, -scale, scale * 2, scale * 2); ctx.restore();
    // Traveling wavefronts sit behind the membrane.
    for (let j = 0; j < 4; j++) {
      const progress = (time * .3 + j / 4) % 1;
      ctx.strokeStyle = `rgba(137,109,176,${(s.step === 0 ? .24 : .055) * Math.sin(progress * Math.PI)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(cx, cy, scale * (1.06 + progress * .55), scale * (1.06 + progress * .55), -.25, Math.PI * .57, Math.PI * 1.44); ctx.stroke();
    }

    // Extracellular fibres and attachment plaques ground the cell in tissue.
    for (let j = 0; j < 5; j++) {
      const y = cy + scale * (1.03 + j * .07);
      ctx.strokeStyle = j % 2 ? "rgba(91,157,142,.20)" : "rgba(160,130,185,.20)";
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - scale * 1.38, y);
      ctx.bezierCurveTo(cx - scale * .7, y - 22, cx + scale * .6, y + 16, cx + scale * 1.38, y - 13); ctx.stroke();
    }
    const label = (text: string, x: number, y: number, color = "#786389") => {
      if (!s.labels) return;
      ctx.font = "11px system-ui";
      const w = ctx.measureText(text).width;
      const left = Math.max(8, Math.min(width - w - 24, x));
      ctx.fillStyle = "rgba(255,253,250,.94)"; ctx.fillRect(left - 6, y - 14, w + 12, 21);
      ctx.fillStyle = color; ctx.fillText(text, left, y);
    };
    const radius = scale * 1.038;
    const body = ctx.createRadialGradient(cx - scale * .4, cy - scale * .48, 0, cx, cy, radius);
    body.addColorStop(0, "rgba(255,255,255,.94)"); body.addColorStop(.45, "rgba(228,218,244,.22)");
    body.addColorStop(.84, "rgba(199,176,227,.30)"); body.addColorStop(.96, "rgba(161,134,196,.28)"); body.addColorStop(1, "rgba(242,235,251,.6)");
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, cy, radius * breathe, radius / breathe, 0, 0, Math.PI * 2); ctx.fill();
    const grid = (front: boolean) => {
      for (let latitude = -3; latitude <= 3; latitude++) {
        const phi = latitude * Math.PI / 8;
        for (let j = 0; j < 100; j++) {
          const a = j / 100 * Math.PI * 2, b = (j + 1) / 100 * Math.PI * 2;
          const p: Vec = [Math.cos(phi) * Math.cos(a), Math.sin(phi), Math.cos(phi) * Math.sin(a)];
          if ((project(p).z > 0) !== front) continue;
          line(p, [Math.cos(phi) * Math.cos(b), Math.sin(phi), Math.cos(phi) * Math.sin(b)], front ? "rgba(145,107,181,.13)" : "rgba(145,107,181,.055)", .7);
        }
      }
      dots.map(v => ({ ...project(v), v })).filter(p => (p.z > 0) === front).sort((a,b) => a.z - b.z).forEach(p => {
        sphere(p.x, p.y, (front ? 2.25 : 1.5) * p.k, "#cbb6e1", front ? .66 : .18);
      });
    };
    grid(false);
    // Cytoskeletal fibers link the nucleus to the membrane in real 3D space.
    for (let j = 0; j < 16; j++) {
      const p = dots[j * 11];
      const tense = s.step === 3 || s.step === 4;
      const inner: Vec = [p[0] * .29, p[1] * .29, p[2] * .29];
      line(inner, [p[0] * .94, p[1] * .94, p[2] * .94], tense ? "rgba(133,91,177,.59)" : "rgba(151,117,184,.17)", tense ? 1.5 : .8);
      if (tense) {
        const f = (time * .6 + j / 16) % 1;
        const q = project([p[0] * (.9 - f * .6), p[1] * (.9 - f * .6), p[2] * (.9 - f * .6)]);
        sphere(q.x, q.y, 2.3, "#bc9fdf", .85);
      }
    }
    // LINC bridges connect the cytoskeleton across the nuclear envelope.
    if (s.step === 4) for (let j = 0; j < 10; j++) {
      const a = j * Math.PI / 5;
      line([Math.cos(a)*.29,Math.sin(a)*.29,.13], [Math.cos(a)*.43,Math.sin(a)*.43,.13], "#a779cd", 3);
      const q = project([Math.cos(a)*.43,Math.sin(a)*.43,.13]); sphere(q.x,q.y,3,"#d1b4e7");
    }
    // Small organelles float at different depths.
    for (let j = 0; j < 11; j++) {
      const a = j * 2.4, r = .52 + (j % 3) * .085;
      const p = project([Math.cos(a) * r, Math.sin(a) * r, Math.sin(j * 7) * .35]);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a + time * .05); ctx.scale(1.6, .78);
      sphere(0, 0, scale * .038 * p.k, j % 3 ? "#c5aedb" : "#8bc8b7", .65); ctx.restore();
    }
    const tug = s.step === 4 ? Math.sin(time * 3) * .025 : 0;
    const nucleus = project([tug, 0, 0]);
    sphere(nucleus.x, nucleus.y, scale * .315, "#b49bd4", .98);
    ctx.strokeStyle = "rgba(255,255,255,.64)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, scale * .325, 0, Math.PI * 2); ctx.stroke();
    // A rotating double helix inside the nucleus.
    for (let j = 0; j < 28; j++) {
      const y = (j / 27 - .5) * .43, a = j * .42 + time * .45;
      const p: Vec = [Math.sin(a) * .105 + tug, y, Math.cos(a) * .105 + .23];
      const q: Vec = [-Math.sin(a) * .105 + tug, y, -Math.cos(a) * .105 + .23];
      if (j % 2 === 0) line(p, q, "rgba(244,229,255,.6)", 1);
      [p, q].forEach(v => { const n = project(v); sphere(n.x, n.y, 1.7 * n.k, "#e9d5fc", .88); });
    }
    grid(true);
    ctx.strokeStyle = "rgba(153,121,185,.36)"; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * breathe, radius / breathe, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.88)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx - scale * .01, cy, radius * .973 * breathe, radius * .973 / breathe, 0, Math.PI * 1.08, Math.PI * 1.66); ctx.stroke();
    // Membrane channels visibly open during stages 2 and 3.
    for (let j = 0; j < 3; j++) {
      const a = Math.PI + (j - 1) * .31, open = s.step === 1;
      const x = cx + Math.cos(a) * radius * breathe, y = cy + Math.sin(a) * radius / breathe;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = open ? "#538f89" : "#ae92ca"; ctx.lineWidth = 4; ctx.lineCap = "round";
      [-1, 1].forEach(sign => { ctx.beginPath(); ctx.moveTo(-7, sign * (open ? 8 : 3)); ctx.lineTo(7, sign * (open ? 10 : 3)); ctx.stroke(); }); ctx.restore();
    }

    // Calcium belongs to the membrane branch, not a nutrient/energy animation.
    if (s.step === 1) for (let j = 0; j < 15; j++) {
      const f = (time * .22 + j / 15) % 1;
      const x = cx - radius * (1.30 - f * .88), y = cy + Math.sin(j * 8) * scale * .22;
      sphere(x, y, scale * .019, "#67c7b4", .2 + Math.sin(f * Math.PI) * .8);
    }
    // Adhesions are at the tissue interface; FAK is highlighted locally.
    for (let j = 0; j < 3; j++) {
      const x = cx + (j - 1) * scale * .53, y = cy + scale * Math.sqrt(1 - ((j - 1) * .53) ** 2);
      ctx.strokeStyle = s.step === 2 ? "#318e7e" : "#b7a5c7"; ctx.lineWidth = s.step === 2 ? 5 : 3;
      ctx.beginPath(); ctx.moveTo(x - 10,y); ctx.lineTo(x + 10,y); ctx.stroke();
      ctx.strokeStyle = "#9bb9ac"; ctx.lineWidth = 1.2;ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,cy+scale*1.15);ctx.stroke();
      if(s.step===2){const f=(time*.32+j/3)%1;sphere(x, y - 8 - f * scale*.28, 3.5, "#6ec7b1",1-f*.8);}
    }
    // A small active region illustrates altered transcription, not guaranteed repair.
    if (s.step === 5) {
      const glow = ctx.createRadialGradient(nucleus.x+scale*.08,nucleus.y-scale*.05,1,nucleus.x+scale*.08,nucleus.y-scale*.05,scale*.2);
      glow.addColorStop(0,"rgba(251,209,111,.6)");glow.addColorStop(1,"rgba(251,209,111,0)");
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(nucleus.x+scale*.08,nucleus.y-scale*.05,scale*.2,0,Math.PI*2);ctx.fill();
      for(let j=0;j<5;j++){const f=(time*.12+j/5)%1;const q=project([.1+f*.36,-.08+Math.sin(j)*.11,.2]);sphere(q.x,q.y,2.7,"#e9c580",Math.sin(f*Math.PI));}
    }
    label("Cell membrane",cx+scale*.73,cy-scale*.69);
    if(s.step===0)label("Surrounding tissue",cx-scale*.48,cy+scale*1.49);
    if(s.step===1){label("Mechanosensitive channel",cx-scale*1.4,cy-scale*.39,"#287e70");label("Ca²⁺",cx-scale*.76,cy+scale*.36,"#287e70");}
    if(s.step===2)label("FAK · attachment signalling",cx-scale*.65,cy+scale*1.46,"#287e70");
    if(s.step===3)label("Cytoskeleton",cx+scale*.28,cy+scale*.56);
    if(s.step===4)label("LINC complex",cx+scale*.37,cy+scale*.38);
    if(s.step===5)label("Gene activity",cx+scale*.34,cy-scale*.16,"#9b7028");

  };
  frame = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(frame); resize.disconnect(); };
}

const PATHWAYS = "<span class=\"cr-path-input\">Mechanical input</span><div class=\"cr-path-split\"><span class=\"cr-path-membrane\">Membrane sensors</span><span class=\"cr-path-structural\">Attachments &amp; structure</span></div><small>Related pathways · not a fixed chain</small>";
const RESEARCH = "<details class=\"cr-research\"><summary>Research &amp; context <span>Studies &amp; limitations ↗</span></summary><div class=\"cr-research-grid\"><article><p class=\"cr-tag\">Relaxation &amp; stress</p><h3>Promising questions, mixed findings</h3><p>A pilot study of 54 students found improvements in subjective stress and relaxation in both groups, without a between-group advantage. Some heart-rate variability measures changed.</p><a href=\"https://pmc.ncbi.nlm.nih.gov/articles/PMC9606670/\" target=\"_blank\" rel=\"noopener noreferrer\">Read the pilot study ↗</a></article><article><p class=\"cr-tag\">Muscle tension &amp; physical ease</p><h3>A common aim of sessions</h3><p>Physical release is commonly promoted by VAT providers. This does not establish a clinical effect on muscle tension, and should not be interpreted as evidence of tissue repair.</p><a href=\"https://www.vibrac.fi/vibroacoustic-therapy/\" target=\"_blank\" rel=\"noopener noreferrer\">VIBRAC: therapeutic context ↗</a></article><article><p class=\"cr-tag\">Pain &amp; comfort</p><h3>Early clinical exploration</h3><p>A small uncontrolled study in 19 women with fibromyalgia reported symptom changes. Without a control group, the effect of the intervention cannot be isolated. A scoping review found the pain evidence too sparse to establish effectiveness.</p><a href=\"https://pmc.ncbi.nlm.nih.gov/articles/PMC4325896/\" target=\"_blank\" rel=\"noopener noreferrer\">Fibromyalgia study ↗</a><br><a href=\"https://doi.org/10.1136/bmjopen-2020-046591\" target=\"_blank\" rel=\"noopener noreferrer\">Pain research review ↗</a></article><article><p class=\"cr-tag\">Rest &amp; sleep</p><h3>Combined interventions</h3><p>A small sleep study combined clinic stimulation with home audio. Its design cannot establish that vibration alone, or a Resonabed session, improves sleep.</p><a href=\"https://pmc.ncbi.nlm.nih.gov/articles/PMC7024098/\" target=\"_blank\" rel=\"noopener noreferrer\">Read the sleep study ↗</a></article></div><p class=\"cr-evidence-note\">Potential benefits are research topics and reported aims, not guaranteed outcomes. These studies do not establish Resonabed-specific benefits. The separate cell model illustrates general biological mechanisms, not a demonstrated pathway from a session to a health outcome.</p><div class=\"cr-research-grid\"><article><p class=\"cr-tag\">Cell-culture research</p><h3>Sound and cellular responses</h3><p>A 2025 Kyoto study found changes in FAK signalling and gene expression in cultured cells. Experiments included 440 Hz stimulation at 100 Pa. This was not a clinical trial of Resonabed.</p><a href=\"https://www.nature.com/articles/s42003-025-07969-1\" target=\"_blank\" rel=\"noopener noreferrer\">Read the original study ↗</a></article><article><p class=\"cr-tag\">General mechanobiology</p><h3>How cells sense force</h3><p>Studies support mechanically activated PIEZO1 channels and force transmission through the cytoskeleton and LINC complex. These findings come from different experimental systems; they do not establish one universal sequence.</p><a href=\"https://www.nature.com/articles/ncomms10366\" target=\"_blank\" rel=\"noopener noreferrer\">PIEZO1 research ↗</a><br><a href=\"https://pubmed.ncbi.nlm.nih.gov/27548707/\" target=\"_blank\" rel=\"noopener noreferrer\">Nuclear force transmission ↗</a></article></div><p class=\"cr-evidence-note\">This model explains cellular mechanisms. It does not demonstrate that a Resonabed session produces these responses or establishes repair, anti-inflammatory, fat-loss or brain-clearance outcomes.</p></details>";

const BENEFITS = "<aside class=\"cr-benefits\" aria-label=\"Potential benefits\"><p>Potential benefits</p><div class=\"cr-benefit-words\"><span>Relaxation &amp; calm</span><span>Physical ease</span><span>Pain Relief and Comfort</span><span>Rest &amp; sleep</span></div></aside>";

const CSS = `
.cr-benefits{padding:4px 0 22px;margin-bottom:22px;border-bottom:1px solid var(--line)}
.cr-benefits>p{font-size:10px;text-transform:uppercase;letter-spacing:.17em;color:#82718f;margin:0 0 14px}
.cr-benefit-words{position:relative;height:68px;color:#73528e;font-size:clamp(23px,2.3vw,30px);font-weight:450;letter-spacing:-.035em;line-height:1.18}
.cr-benefit-words span{position:absolute;inset:0;opacity:0;animation:cr-benefit 28s linear infinite}
.cr-benefit-words span:nth-child(2){animation-delay:-21s}.cr-benefit-words span:nth-child(3){animation-delay:-14s}.cr-benefit-words span:nth-child(4){animation-delay:-7s}
[data-motion="paused"] .cr-benefit-words span{animation-play-state:paused}
@keyframes cr-benefit{0%,21%{opacity:1;transform:translateY(0)}24%,97%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.cr-benefit-words{height:auto;display:grid;gap:8px;font-size:21px}.cr-benefit-words span{position:static;opacity:1;transform:none}}

.cr-section [hidden]{display:none!important}

.cr-section{--ink:#302b39;--muted:#797480;--line:#e6e0e9;background:#faf9f6;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:88px 28px 52px;border-bottom:1px solid var(--line);-webkit-font-smoothing:antialiased}
.cr-section *{box-sizing:border-box}.cr-wrap{max-width:1180px;margin:0 auto}.cr-eyebrow{display:flex;align-items:center;gap:9px;color:#726184;text-transform:uppercase;font-size:10px;letter-spacing:.19em;font-weight:650;margin:0 0 22px}.cr-dot{width:6px;height:6px;border-radius:50%;background:#9f87b9;box-shadow:0 0 0 4px #eee8f2}.cr-header{display:flex;align-items:end;justify-content:space-between;gap:36px;margin-bottom:40px}.cr-header h2{font-size:clamp(36px,4.4vw,58px);font-weight:420;letter-spacing:-.055em;line-height:1.09;margin:0}.cr-header h2 span{color:#9482a6}.cr-intro{max-width:290px;font-size:14px;line-height:1.85;color:var(--muted);margin:0 0 5px}.cr-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);border:1px solid var(--line);border-radius:22px;overflow:hidden;background:#fffefa;box-shadow:0 15px 60px #47305305}.cr-stage{position:relative;min-width:0;min-height:560px;background:radial-gradient(ellipse at 50% 45%,#f0eaf6 0%,#f7f4f8 46%,#fbfaf8 76%);overflow:hidden}.cr-stage-top{position:absolute;top:25px;left:26px;right:26px;display:flex;align-items:center;justify-content:space-between;z-index:1}.cr-pill{display:flex;align-items:center;gap:7px;border:1px solid #e3dce9;background:#ffffff90;border-radius:30px;padding:8px 11px;font-size:10px;color:#756580;letter-spacing:.03em}.cr-pill i{width:5px;height:5px;background:#66a28e;border-radius:50%}.cr-micro{font-size:9px;letter-spacing:.15em;color:#938b9c;text-transform:uppercase}.cr-canvas{display:block;width:100%;height:560px;touch-action:pan-y;cursor:grab}.cr-canvas:active{cursor:grabbing}.cr-label{position:absolute;font-size:10px;color:#8e809c;pointer-events:none;display:flex;align-items:center;gap:8px}.cr-label:before{content:"";width:27px;height:1px;background:#c2b4cf}.cr-label.membrane{top:29%;right:7%}.cr-label.nucleus{top:53%;right:12%}.cr-stage-bottom{position:absolute;bottom:23px;left:26px;right:26px;display:flex;align-items:center;justify-content:space-between;gap:12px}.cr-hint{font-size:10px;color:#9b91a4}.cr-controls{display:flex;gap:7px}.cr-section button{font:inherit;cursor:pointer}.cr-icon{width:34px;height:34px;border:1px solid #ded5e6;border-radius:50%;background:#ffffffa6;color:#786687;display:grid;place-items:center;font-size:13px!important}.cr-icon[hidden]{display:none}.cr-icon:hover{background:#eee6f4}.cr-section button:focus-visible,.cr-canvas:focus-visible{outline:2px solid #8256b3;outline-offset:4px}.cr-info{padding:32px;border-left:1px solid var(--line);display:flex;flex-direction:column}.cr-info-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:23px}.cr-index{font-size:11px;color:#928798;font-variant-numeric:tabular-nums}.cr-index strong{color:#6e508e;font-weight:550}.cr-steps{display:flex;flex-direction:column;gap:5px}.cr-step{width:100%;display:flex;align-items:center;gap:13px;padding:11px 12px;border:1px solid transparent;border-radius:10px;background:transparent;text-align:left;color:#89818e;transition:background .25s,border-color .25s,color .25s}.cr-step:hover{background:#f7f3fa}.cr-step[aria-current="step"]{background:#f1ebf6;border-color:#e6dced;color:#58416f}.cr-step-number{font-size:10px;border:1px solid #e4dfe8;border-radius:50%;height:24px;width:24px;display:grid;place-items:center;flex-shrink:0;font-variant-numeric:tabular-nums}.cr-step[aria-current="step"] .cr-step-number{background:#806197;border-color:#806197;color:white}.cr-step-name{font-size:12px;font-weight:500}.cr-step-arrow{margin-left:auto;opacity:0;color:#967bad}.cr-step[aria-current="step"] .cr-step-arrow{opacity:1}.cr-caption{border-top:1px solid var(--line);margin-top:23px;padding-top:24px;min-height:157px}.cr-tag{font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);margin:0 0 10px}.cr-caption h3{font-size:20px;letter-spacing:-.035em;font-weight:500;line-height:1.25;margin:0 0 10px}.cr-caption p:last-child{font-size:12px;line-height:1.85;color:var(--muted);margin:0}.cr-footer{display:flex;justify-content:space-between;gap:20px;padding:22px 3px 0;color:#978e9c;font-size:10px;line-height:1.7}.cr-footer b{font-weight:500;color:#75657f}.cr-fade{animation:cr-appear .4s ease both}@keyframes cr-appear{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.cr-label-toggle{position:absolute;left:26px;bottom:70px;display:flex;gap:7px;align-items:center;font-size:11px;color:#746280}.cr-label-toggle input{accent-color:#7956ae}.cr-info{padding:26px}.cr-info-top{margin-bottom:16px}.cr-step{padding:8px 10px}.cr-caption{margin-top:16px;padding-top:19px;min-height:133px}.cr-stage,.cr-canvas{min-height:590px;height:590px}.cr-pathways{padding:12px 8px 17px;text-align:center;font-size:10px;color:#81718c}.cr-path-input{display:inline-block;border:1px solid #e1d7ea;border-radius:20px;padding:6px 13px;background:#faf7fc}.cr-path-split{display:flex;gap:12px;justify-content:center;margin-top:16px;position:relative}.cr-path-split:before{content:"";position:absolute;top:-10px;left:24%;right:24%;height:9px;border:1px solid #cbbdd7;border-bottom:0}.cr-path-split span{padding:6px 8px;border-radius:6px;background:#f5f1f7;flex:1}.cr-pathways small{display:block;margin-top:9px;font-size:9px;color:#8a7c92}.cr-pathways[data-branch="membrane"] .cr-path-membrane{background:#e1f0e9;color:#287466}.cr-pathways[data-branch="structural"] .cr-path-structural{background:#eae0f3;color:#70478f}.cr-research{margin-top:25px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.cr-research summary{cursor:pointer;font-size:14px;padding:22px 0;color:#54445e}.cr-research summary span{float:right;font-size:11px;color:#897597}.cr-research-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;padding:6px 0 20px}.cr-research h3{font-size:19px;font-weight:500;margin:0 0 10px}.cr-research article p:not(.cr-tag),.cr-evidence-note{font-size:12px;line-height:1.85;color:#786c80}.cr-research a{font-size:12px;color:#73528e;text-underline-offset:3px}.cr-evidence-note{padding:15px 20px;background:#f0eaf5;border-radius:9px;margin:0 0 23px}.cr-footer{font-size:11px}.cr-footer span:first-child{max-width:740px}@media(max-width:800px){.cr-stage,.cr-canvas{min-height:430px;height:430px}.cr-research-grid{grid-template-columns:1fr;gap:24px}.cr-header h2{font-size:clamp(31px,6vw,48px)}.cr-label-toggle{bottom:64px}.cr-info{padding:22px}.cr-research summary span{float:none;display:block;margin:8px 0 0}.cr-footer span{max-width:100%}}
@media(min-width:1450px){.cr-section{padding-top:100px}}@media(max-width:800px){.cr-section{padding:48px 20px 30px}.cr-header{align-items:start;flex-direction:column;gap:20px;margin-bottom:28px}.cr-intro{max-width:410px}.cr-grid{grid-template-columns:1fr}.cr-info{border-left:0;border-top:1px solid var(--line);padding:25px}.cr-stage{min-height:440px}.cr-canvas{height:440px}.cr-steps{display:grid;grid-template-columns:1fr 1fr}.cr-step{padding:10px 8px;gap:8px}.cr-caption{min-height:130px}.cr-footer{flex-direction:column;gap:5px}}@media(max-width:400px){.cr-stage{min-height:365px}.cr-canvas{height:365px}.cr-label{display:none}.cr-stage-top,.cr-stage-bottom{left:18px;right:18px}.cr-step-name{font-size:11px}.cr-info{padding:20px}}@media(min-width:801px){.cr-stage{height:auto}.cr-canvas{height:100%;min-height:590px}}@media(prefers-reduced-motion:reduce){.cr-section *{animation:none!important;transition:none!important}}
`;

export function CellularResponseSection() {
  const [step, setStep] = useState(0);
  const [labels, setLabels] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SceneState>({ step: 0, playing: true, reduced: false, visible: false, yaw: .35, pitch: -.18, labels: false });
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    update(); media.addEventListener("change", update);
    let intersecting = false;
    const visibility = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; visibility(); }, { threshold: .15 });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", update); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => { Object.assign(scene.current, { step, playing, reduced, visible, labels }); }, [step, playing, reduced, visible, labels]);
  useEffect(() => { if (canvas.current) return mountCell(canvas.current, scene); }, []);
  useEffect(() => {
    if (!playing || reduced || !visible) return;
    const timer = window.setTimeout(() => setStep(n => (n + 1) % 6), 8000);
    return () => window.clearTimeout(timer);
  }, [step, playing, reduced, visible]);
  const select = (index: number) => { setStep(index); setPlaying(false); };
  const current = STEPS[step];
  return (
    <section id="cellular-response" data-animation-version="resonabed-cellular-v3" className="cr-section" ref={root} aria-label="The cellular response">
      <style>{CSS}</style>
      <div className="cr-wrap">
        <p className="cr-eyebrow"><span className="cr-dot" /> Sound, sensation & science</p>
        <header className="cr-header">
          <h2>Feel the sound.<br /><span>Explore the possibilities.</span></h2>
          <p className="cr-intro">A closer look at how cells sense mechanical movement, alongside the potential benefits of VibroAcoustic Therapy (VAT).</p>
        </header>
        <div className="cr-grid">
          <div className="cr-stage">
            <div className="cr-stage-top"><span className="cr-pill"><i /> Inside the cell</span><span className="cr-micro">Interactive 3D model</span></div>
            <canvas ref={canvas} className="cr-canvas" tabIndex={0} role="img" aria-label="Rotatable 3D cell. Drag or use arrow keys to rotate."
              onPointerDown={e => { if (e.pointerType === "mouse" || e.pointerType === "pen") e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }}
              onPointerMove={e => { if (!drag.current) return; scene.current.yaw += (e.clientX - drag.current.x) * .008; scene.current.pitch = Math.max(-.7, Math.min(.7, scene.current.pitch + (e.clientY - drag.current.y) * .004)); drag.current = { x: e.clientX, y: e.clientY }; }}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
              onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); scene.current.yaw += e.key === "ArrowLeft" ? -.15 : e.key === "ArrowRight" ? .15 : 0; scene.current.pitch = Math.max(-.7, Math.min(.7, scene.current.pitch + (e.key === "ArrowUp" ? -.1 : e.key === "ArrowDown" ? .1 : 0))); }}
            />
            <label className="cr-label-toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} /> Scientific labels</label>
            <div className="cr-stage-bottom"><span className="cr-hint">↔ &nbsp; Drag to explore</span><div className="cr-controls"><button type="button" className="cr-icon" aria-label="Reset cell rotation" title="Reset view" onClick={() => { scene.current.yaw = .35; scene.current.pitch = -.18; }}>↺</button>{!reduced && <button type="button" className="cr-icon" aria-label={playing ? "Pause animation" : "Play animation"} title={playing ? "Pause" : "Play"} onClick={() => setPlaying(p => !p)}>{playing ? "Ⅱ" : "▶"}</button>}</div></div>
          </div>
          <div className="cr-info">
            <div data-motion={playing && visible && !reduced ? "running" : "paused"} dangerouslySetInnerHTML={{ __html: BENEFITS }} />
            <div className="cr-info-top"><span className="cr-micro">Explore related mechanisms</span><span className="cr-index"><strong>{String(step + 1).padStart(2, "0")}</strong> / 06</span></div>
            <div className="cr-pathways" data-branch={step === 1 ? "membrane" : step >= 2 && step <= 4 ? "structural" : "shared"} dangerouslySetInnerHTML={{ __html: PATHWAYS }} />
            <nav className="cr-steps" aria-label="Cell response stages">{STEPS.map((item, i) => <button type="button" className="cr-step" key={item.title} aria-current={step === i ? "step" : undefined} onClick={() => select(i)}><span className="cr-step-number">{String(i + 1).padStart(2, "0")}</span><span className="cr-step-name">{item.label}</span><span className="cr-step-arrow" aria-hidden="true">↗</span></button>)}</nav>
            <div className="cr-caption" aria-live={playing ? "off" : "polite"} aria-atomic="true"><div key={step} className="cr-fade"><p className="cr-tag" style={{ color: current.color }}>{current.tag}</p><h3>{current.title}</h3><p>{current.text}</p></div></div>
          </div>
        </div>
        <footer className="cr-footer"><span>Potential benefits are not guaranteed. Cellular mechanisms and human outcomes are separate areas of research.</span><span>Conceptual visuals · Continuous loop</span></footer>
        <div dangerouslySetInnerHTML={{ __html: RESEARCH }} />
      </div>
    </section>
  );
}

export default CellularResponseSection;

