/* =====================================================================
 * TINTA — o lápis por cima da questão (v19.7.0)
 *
 * O PEDIDO: um lápis como o do caderno da Literalidade — lápis, marca-texto,
 * borracha, mão, cores, espessura, desfazer, apagar — para sublinhar,
 * circular e marcar DIRETO em cima do enunciado e das alternativas.
 *
 * O QUE NÃO PODIA VOLTAR. O app já teve um canvas por cima do enunciado e
 * o tirou (ver grifo.js): girar o aparelho, aumentar a letra ou mudar a
 * largura da caixa faz o texto refluir, e os riscos ficavam onde estavam,
 * apontando para palavras que já não estavam ali. Aqui o traço NÃO é
 * guardado em pixels da tela: é guardado PRESO A UMA LETRA do texto.
 *
 *  · ao soltar, o app acha a letra mais próxima do começo do traço (no
 *    enunciado ou numa alternativa) e guarda os pontos RELATIVOS a ela, em
 *    "em" (tamanho da letra) — {anc: {b: "en", i: 214}, pts: [[0.1, 1.2], …]};
 *  · a cada pintura, a letra é procurada de novo e o traço é redesenhado a
 *    partir dela: refluiu, girou, aumentou a letra — o traço anda junto com
 *    a palavra em que foi feito;
 *  · traço feito longe de qualquer texto (na margem) fica preso ao topo da
 *    questão.
 * (Um sublinhado que atravessa duas linhas ainda pode ficar torto depois de
 * um refluxo grande: virar marca de texto de verdade é a fase seguinte.)
 *
 * QUANTO DURA: por questão, enquanto a sessão dura (ir e voltar entre questões
 * mantém os traços). DESDE A v19.8.0, alguns ficam guardados — ver "GUARDAR NA
 * QUESTÃO", abaixo.
 *
 * CANETA DE TABLET: quando o app vê uma caneta (pointerType "pen"), a mão
 * apoiada na tela deixa de riscar e o dedo volta a rolar a página.
 *
 * A GEOMETRIA mora em tnGeo, trocável: os testes não têm motor de layout e
 * injetam caixas de letra conhecidas; o navegador usa Range e caret.
 * ===================================================================== */

const TN_CORES = [
  { id: "grafite", cor: "#3f4451" },
  { id: "vermelho", cor: "#d1495b" },
  { id: "azul", cor: "#5b7cfa" },
  { id: "verde", cor: "#4f9d6e" },
  { id: "laranja", cor: "#e8a33d" },
  { id: "roxo", cor: "#9b5de5" },
];
const TN_FERRAMENTAS = ["lapis", "marca", "borracha", "mao"];
/* espessura em px para letra de 16px, por ferramenta (a borracha é o raio) */
const TN_LARG_PADRAO = { lapis: 3, marca: 16, borracha: 14 };
const TN_LARG_LIMITE = { lapis: [1, 12], marca: [6, 32], borracha: [6, 40] };
const TN_PREF = "eac_tinta_pref";
const TN_HIST_MAX = 60;

let tnAberta = false;
let tnFerr = "lapis";
let tnCor = "laranja";
let tnLarg = Object.assign({}, TN_LARG_PADRAO);
let tnPorQuestao = {};
let tnHist = {};
let tnQid = null;
let tnCorpo = null;
let tnSvg = null;
let tnAtual = null;
let tnApagando = false;
let tnCanetaVista = false;
let tnObs = null;
let tnPintarPedido = false;
/* o traço em andamento: UM elemento, atualizado a cada movimento (ver tnMover) */
let tnPathVivo = null;

/* ---------- preferências (só conveniência deste aparelho) ---------- */
function tnPrefLer() {
  try {
    const p = JSON.parse(localStorage.getItem(TN_PREF) || "{}") || {};
    if (TN_FERRAMENTAS.indexOf(p.f) >= 0 && p.f !== "borracha") tnFerr = p.f;
    if (TN_CORES.some((c) => c.id === p.c)) tnCor = p.c;
    Object.keys(TN_LARG_LIMITE).forEach((k) => {
      const v = Number(p.l && p.l[k]);
      if (v >= TN_LARG_LIMITE[k][0] && v <= TN_LARG_LIMITE[k][1]) tnLarg[k] = v;
    });
  } catch (e) {}
}
function tnPrefGravar() {
  try { localStorage.setItem(TN_PREF, JSON.stringify({ f: tnFerr, c: tnCor, l: tnLarg })); } catch (e) {}
}

/* ---------- matemática pura (testável sem layout) ---------- */
function tnArred(v) { return Math.round(v * 100) / 100; }
function tnRelativos(pts, org, em) {
  const e = em > 0 ? em : 16;
  return (pts || []).map((p) => [tnArred((p[0] - org.x) / e), tnArred((p[1] - org.y) / e)]);
}
function tnAbsolutos(rel, org, em) {
  const e = em > 0 ? em : 16;
  return (rel || []).map((p) => [org.x + p[0] * e, org.y + p[1] * e]);
}
/* menos pontos, o mesmo desenho (Ramer–Douglas–Peucker): um traço de 2 s tem centenas de eventos */
function tnSimplificar(pts, tol) {
  const P = pts || [];
  if (P.length < 3) return P.slice();
  const t2 = (tol || 0.8) * (tol || 0.8);
  const dist2 = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy;
    let u = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
    u = Math.max(0, Math.min(1, u));
    const x = a[0] + u * dx - p[0], y = a[1] + u * dy - p[1];
    return x * x + y * y;
  };
  const manter = new Array(P.length).fill(false);
  manter[0] = manter[P.length - 1] = true;
  const pilha = [[0, P.length - 1]];
  while (pilha.length) {
    const [i, j] = pilha.pop();
    let maior = -1, k = -1;
    for (let m = i + 1; m < j; m++) { const d = dist2(P[m], P[i], P[j]); if (d > maior) { maior = d; k = m; } }
    if (maior > t2 && k > 0) { manter[k] = true; pilha.push([i, k], [k, j]); }
  }
  return P.filter((_, i) => manter[i]);
}
/* a borracha: os pontos dentro do raio saem e o que sobra de cada lado vira traço próprio (como no rascunho) */
function tnPartir(pts, x, y, raio) {
  const r2 = raio * raio;
  const partes = [];
  let atual = [];
  (pts || []).forEach((p) => {
    const dx = p[0] - x, dy = p[1] - y;
    if (dx * dx + dy * dy <= r2) { if (atual.length) partes.push(atual); atual = []; }
    else atual.push(p);
  });
  if (atual.length) partes.push(atual);
  return partes.filter((p) => p.length >= 2);
}
/* pontos a cada "passo" ao longo do traço: o simplificado guarda só as pontas de uma reta, e a borracha que passa no
 * meio dela precisa de pontos ali para ter o que apagar */
function tnDensificar(pts, passo) {
  const P = pts || [], out = [];
  const d = passo > 0 ? passo : 4;
  P.forEach((p, i) => {
    if (i) {
      const a = P[i - 1], n = Math.floor(Math.hypot(p[0] - a[0], p[1] - a[1]) / d);
      for (let k = 1; k < n; k++) out.push([a[0] + (p[0] - a[0]) * k / n, a[1] + (p[1] - a[1]) * k / n]);
    }
    out.push(p);
  });
  return out;
}
/* o caminho SVG, suavizado pelos pontos médios */
function tnCaminho(pts) {
  const P = pts || [];
  if (!P.length) return "";
  const f = (v) => Math.round(v * 10) / 10;
  if (P.length === 1) return "M" + f(P[0][0]) + " " + f(P[0][1]) + "l0.1 0.1";
  let d = "M" + f(P[0][0]) + " " + f(P[0][1]);
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    d += "Q" + f(P[i][0]) + " " + f(P[i][1]) + " " + f(mx) + " " + f(my);
  }
  const u = P[P.length - 1];
  return d + "L" + f(u[0]) + " " + f(u[1]);
}
/* palma da mão: depois de ver uma caneta, o toque do dedo não risca (rola) */
function tnAceitaPonteiro(ev) {
  if (!ev) return false;
  if (ev.pointerType === "pen") { if (!tnCanetaVista) { tnCanetaVista = true; tnPintarClasse(); } return true; }
  if (ev.pointerType === "touch" && tnCanetaVista) return false;
  if (ev.button !== undefined && ev.button !== 0 && ev.button !== -1) return false;
  return true;
}

/* ---------- geometria (o navegador; os testes trocam) ---------- */
function tnTextos(el) {
  const out = [];
  if (!el || typeof document === "undefined" || !document.createTreeWalker) return out;
  const w = document.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  let n;
  while ((n = w.nextNode())) out.push(n);
  return out;
}
const TN_GEO_NAVEGADOR = {
  /* o canto da área de conteúdo do corpo, na tela (o que rola junto) */
  base(corpo) {
    const r = corpo.getBoundingClientRect();
    return { x: r.left - (corpo.scrollLeft || 0), y: r.top - (corpo.scrollTop || 0) };
  },
  blocos(corpo) {
    const out = [];
    const en = corpo.querySelector(".qs-enunciado");
    if (en) out.push({ id: "en", el: en });
    Array.from(corpo.querySelectorAll(".qs-op")).forEach((b, i) => {
      const l = b.querySelector(".qs-op-l");
      out.push({ id: "op:" + ((l && l.textContent.trim()) || i), el: b });
    });
    return out;
  },
  texto(el) { return el.textContent || ""; },
  caixa(el) { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; },
  em(el) {
    try { const v = parseFloat(getComputedStyle(el).fontSize); return v > 0 ? v : 16; } catch (e) { return 16; }
  },
  /* a letra sob o ponto (posição no texto do bloco), ou -1 */
  letraEm(el, x, y) {
    let no = null, off = 0;
    /* a própria camada do lápis está POR CIMA do texto: o caret acharia o SVG, não a letra — sai do caminho um instante */
    const cam = document.getElementById("tnCamada");
    const antes = cam && cam.style ? cam.style.pointerEvents : "";
    if (cam && cam.style) cam.style.pointerEvents = "none";
    try {
      if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); if (c) { no = c.offsetNode; off = c.offset; } }
      else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { no = r.startContainer; off = r.startOffset; } }
    } catch (e) { no = null; }
    if (cam && cam.style) cam.style.pointerEvents = antes;
    if (!no || !el.contains(no)) return -1;
    let soma = 0;
    for (const t of tnTextos(el)) {
      if (t === no) return soma + off;
      soma += t.length;
    }
    return -1;
  },
  /* o canto de cima, à esquerda, da letra i do bloco (na tela) */
  letraCaixa(el, i) {
    const ts = tnTextos(el);
    let resto = Math.max(0, i);
    for (let k = 0; k < ts.length; k++) {
      const t = ts[k];
      if (resto < t.length || k === ts.length - 1) {
        const o = Math.min(resto, Math.max(0, t.length - 1));
        try {
          const r = document.createRange();
          r.setStart(t, o); r.setEnd(t, Math.min(t.length, o + 1));
          const q = (r.getClientRects && r.getClientRects()[0]) || r.getBoundingClientRect();
          if (q && (q.width || q.height)) return { x: q.left, y: q.top };
        } catch (e) {}
        return null;
      }
      resto -= t.length;
    }
    return null;
  },
};
/* (o nó de texto e a posição dentro dele da letra i do bloco) */
function tnPosNo(el, i) {
  const ts = tnTextos(el);
  let resto = Math.max(0, i);
  for (let k = 0; k < ts.length; k++) {
    if (resto < ts[k].length || k === ts.length - 1) return { no: ts[k], o: Math.min(resto, ts[k].length) };
    resto -= ts[k].length;
  }
  return null;
}
/* as linhas (uma caixa por linha de texto) das letras i..j do bloco: é por elas que o sublinhado se redesenha */
TN_GEO_NAVEGADOR.linhas = function (el, i, j) {
  const a = tnPosNo(el, i), b = tnPosNo(el, j + 1);
  if (!a || !b) return [];
  const out = [];
  try {
    const r = document.createRange();
    r.setStart(a.no, a.o); r.setEnd(b.no, b.o);
    Array.from(r.getClientRects()).forEach((q) => {
      if (!q.width || !q.height) return;
      const mesma = out.filter((x) => Math.abs(x.t - q.top) < q.height / 2)[0];
      if (mesma) { mesma.l = Math.min(mesma.l, q.left); mesma.r = Math.max(mesma.r, q.right); mesma.b = Math.max(mesma.b, q.bottom); }
      else out.push({ l: q.left, t: q.top, r: q.right, b: q.bottom });
    });
  } catch (e) { return []; }
  return out.sort((x, y) => x.t - y.t || x.l - y.l);
};
let tnGeo = TN_GEO_NAVEGADOR;
function tnGeoDefinir(g) { tnGeo = g || TN_GEO_NAVEGADOR; }

/* ---------- âncora ---------- */
/* o ponto (na tela) → {b, i} e a origem (na tela) + em. Longe de texto (mais de 2 letras), preso ao corpo. */
function tnAncorar(x, y) {
  const corpo = tnCorpo;
  if (!corpo) return null;
  const bs = tnGeo.blocos(corpo);
  let melhor = null;
  bs.forEach((b) => {
    const c = tnGeo.caixa(b.el);
    const dx = x < c.l ? c.l - x : x > c.r ? x - c.r : 0;
    const dy = y < c.t ? c.t - y : y > c.b ? y - c.b : 0;
    const d = Math.hypot(dx, dy);
    if (!melhor || d < melhor.d) melhor = { b, d, c };
  });
  if (melhor) {
    const em = tnGeo.em(melhor.b.el);
    if (melhor.d <= em * 2) {
      const cx = Math.min(Math.max(x, melhor.c.l + 1), melhor.c.r - 1), cy = Math.min(Math.max(y, melhor.c.t + 1), melhor.c.b - 1);
      /* um pouco ACIMA do começo do traço: o sublinhado mora abaixo das letras que marca, e a letra mais próxima dele
       * seria a da linha de baixo (depois de refluir, ele iria parar sob outras palavras). No marca-texto e no círculo,
       * 0,35 letra acima ainda é a mesma linha. */
      const cyq = Math.max(melhor.c.t + 1, cy - em * 0.35);
      let i = tnGeo.letraEm(melhor.b.el, cx, cyq);
      if (i < 0) i = 0;
      const org = tnGeo.letraCaixa(melhor.b.el, i);
      if (org) return { anc: { b: melhor.b.id, i }, org, em };
    }
  }
  const base = tnGeo.base(corpo);
  return { anc: { b: "corpo", i: 0 }, org: { x: base.x, y: base.y }, em: 16 };
}
/* a origem atual (na tela) de uma âncora guardada; null se o bloco sumiu (a alternativa não existe mais) */
function tnOrigem(anc) {
  const corpo = tnCorpo;
  if (!corpo || !anc) return null;
  if (anc.b === "corpo") { const b = tnGeo.base(corpo); return { org: { x: b.x, y: b.y }, em: 16 }; }
  const bl = tnGeo.blocos(corpo).filter((b) => b.id === anc.b)[0];
  if (!bl) return null;
  const org = tnGeo.letraCaixa(bl.el, anc.i);
  return org ? { org, em: tnGeo.em(bl.el) } : null;
}

/* ---------- modelo por questão ---------- */
function tnTracos(qid) { return tnPorQuestao[qid || tnQid] || []; }
function tnGuardarTracos(qid, lista, opc) {
  if (!qid) return;
  tnPorQuestao[qid] = lista || [];
  if (!(opc && opc.semSinc)) tnSincronizar(qid, tnQuestaoDe(qid));
}
function tnContar(qid) { return tnTracos(qid).length; }
function tnMarcarDesfazer() {
  if (!tnQid) return;
  const h = tnHist[tnQid] || (tnHist[tnQid] = []);
  /* junto com os traços, se a questão estava GUARDADA: apagar tudo e desfazer tem de devolver as duas coisas */
  const rec = typeof tnSalvos !== "undefined" ? tnSalvos[tnQid] : null;
  h.push(JSON.stringify({ t: tnTracos(), r: rec || null }));
  if (h.length > TN_HIST_MAX) h.shift();
}
function tnDesfazer() {
  const h = tnHist[tnQid] || [];
  if (!h.length) return false;
  const o = JSON.parse(h.pop());
  /* estava guardada e deixou de estar (apagar tudo): volta a ser — GRAVANDO de novo, não só na memória */
  const volta = o && o.r && !tnSalvos[tnQid] ? o.r.motivo : "";
  tnGuardarTracos(tnQid, (o && o.t) || [], { semSinc: !!volta });
  if (volta) { delete tnRecusadas[tnQid]; tnGravarRec(tnQid, volta); }
  tnPintar();
  tnPintarBarra();
  return true;
}
function tnLimpar() {
  if (!tnContar()) return false;
  tnMarcarDesfazer();
  tnGuardarTracos(tnQid, []);
  tnPintar();
  tnPintarBarra();
  try { reg("QUESTOES", "lápis: traços apagados", String(tnQid)); } catch (e) {}
  try { toastMsg(t("tn_limpou"), 3500); } catch (e) {}
  return true;
}
function tnEsquecerTudo() { tnPorQuestao = {}; tnHist = {}; }

/* ---------- desenhar ---------- */
function tnPonto(ev) { return [Number(ev.clientX) || 0, Number(ev.clientY) || 0]; }
function tnComecar(ev) {
  if (!tnAberta || !tnQid || tnFerr === "mao") return false;
  if (!tnAceitaPonteiro(ev)) return false;
  /* (v19.12.2) O PONTEIRO FICA PRESO NA CAMADA, NUNCA NO TRAÇO. O relato: "só o primeiro risco é mantido completo; os
   * próximos só funcionam no início" — com caneta, dedo e mouse. O segundo traço começava EM CIMA do primeiro: o alvo
   * do toque era o desenho dele (<path>), e era nele que o ponteiro ficava preso; a pintura seguinte apagava e
   * recriava os desenhos, o elemento preso sumia, a captura se perdia — e fora da camada (que só cobre o conteúdo da
   * questão) o resto do gesto ia para outro lugar (no toque, virava rolagem). Agora: preso sempre na camada (tnSvg), os
   * traços não recebem toque (CSS .tn-traco) e o traço em andamento é atualizado no lugar. */
  try {
    const alvo = tnSvg || ev.currentTarget || ev.target;
    if (alvo && alvo.setPointerCapture && ev.pointerId !== undefined) alvo.setPointerCapture(ev.pointerId);
  } catch (e) {}
  if (ev.preventDefault) ev.preventDefault();
  const p = tnPonto(ev);
  if (tnFerr === "borracha") {
    tnMarcarDesfazer();
    tnApagando = true;
    tnApagarEm(p[0], p[1]);
    return true;
  }
  tnAtual = { f: tnFerr, cor: tnCor, larg: tnLarg[tnFerr], pts: [p], id: ev.pointerId };
  tnPintar();
  return true;
}
function tnMover(ev) {
  if (tnApagando) { const p = tnPonto(ev); tnApagarEm(p[0], p[1]); return true; }
  if (!tnAtual) return false;
  if (ev.pointerId !== undefined && tnAtual.id !== undefined && ev.pointerId !== tnAtual.id) return false;
  /* os eventos agrupados pelo navegador (traço mais liso); lista vazia (evento sintético) = o próprio evento */
  const co = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
  const evs = co && co.length ? co : [ev];
  evs.forEach((e) => {
    const p = tnPonto(e);
    const u = tnAtual.pts[tnAtual.pts.length - 1];
    if (!u || Math.abs(u[0] - p[0]) >= 1 || Math.abs(u[1] - p[1]) >= 1) tnAtual.pts.push(p);
  });
  if (ev.preventDefault) ev.preventDefault();
  /* o traço em andamento muda NO LUGAR (o mesmo elemento): redesenhar tudo a cada movimento destruía o que estava sob
   * o ponteiro e custava mais a cada traço já feito */
  if (tnPathVivo && tnSvg && tnPathVivo.parentNode === tnSvg) {
    const base = tnGeo.base(tnCorpo);
    tnPathVivo.setAttribute("d", tnCaminho(tnAtual.pts.map((q) => [q[0] - base.x, q[1] - base.y])));
  } else tnPintarLogo();
  return true;
}
function tnSoltar() {
  if (tnApagando) { tnApagando = false; tnPintarBarra(); return true; }
  const a = tnAtual;
  tnAtual = null;
  if (!a) return false;
  let pts = tnSimplificar(a.pts, 0.8);
  if (pts.length === 1) pts = [pts[0], [pts[0][0] + 0.6, pts[0][1] + 0.6]];
  const an = tnAncorar(pts[0][0], pts[0][1]);
  if (!an) { tnPintar(); return false; }
  tnMarcarDesfazer();
  const lista = tnTracos().slice();
  const novo = { f: a.f, cor: a.cor, larg: tnArred((a.larg / 16)), anc: an.anc, pts: tnRelativos(pts, an.org, an.em) };
  const lin = tnComoLinha(a.f, pts, an) || tnComoContorno(a.f, pts, an);
  if (lin) Object.assign(novo, lin);
  lista.push(novo);
  tnGuardarTracos(tnQid, lista);
  tnPintar();
  tnPintarBarra();
  return true;
}
/* =====================================================================
 * O SUBLINHADO E O MARCA-TEXTO VIRAM "DA LETRA i ATÉ A LETRA j"
 *
 * Preso só ao começo, um sublinhado longo guardava o COMPRIMENTO em que foi feito: a frase refluía para duas linhas e
 * ele saía pela borda, sob palavras que não eram as dele. O traço quase horizontal (altura até 0,9 letra, largura de
 * mais de uma letra) guarda as duas pontas no texto e a altura em relação à linha (dy, em "em"); a pintura o refaz
 * sob as MESMAS letras, uma reta por linha de texto. Traço torto, círculo, seta: continuam como desenhados.
 * ===================================================================== */
function tnComoLinha(f, pts, an) {
  if ((f !== "lapis" && f !== "marca") || !an || an.anc.b === "corpo" || !pts || pts.length < 2) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const em = an.em || 16;
  const w = Math.max.apply(null, xs) - Math.min.apply(null, xs), h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
  if (h > em * 0.9 || w < em * 1.2) return null;
  const esq = pts[xs.indexOf(Math.min.apply(null, xs))], dir = pts[xs.indexOf(Math.max.apply(null, xs))];
  const a = tnAncorar(esq[0], esq[1]), b = tnAncorar(dir[0], dir[1]);
  if (!a || !b || a.anc.b !== an.anc.b || b.anc.b !== an.anc.b) return null;
  const i = Math.min(a.anc.i, b.anc.i), j = Math.max(a.anc.i, b.anc.i);
  if (j <= i) return null;
  const yMed = ys.reduce((s, v) => s + v, 0) / ys.length;
  return { anc: { b: an.anc.b, i }, fim: j, dy: tnArred((yMed - a.org.y) / em), pts: [] };
}
/* =====================================================================
 * O CÍRCULO VIRA "CONTORNO DAS LETRAS i A j" (v19.9.0)
 *
 * Preso só à letra do começo, o círculo guardava a FORMA em que foi feito: a frase circulada passava a quebrar de
 * linha e ele ficava torto, cercando metade das palavras e o vazio. O traço FECHADO (as pontas se encontram) que cerca
 * texto guarda as letras de dentro; a pintura desenha uma elipse em volta de cada linha dessas letras — refluiu, as
 * elipses acompanham. Seta, número, rabisco: continuam como desenhados.
 * ===================================================================== */
function tnComoContorno(f, pts, an) {
  if (f !== "lapis" || !an || an.anc.b === "corpo" || !pts || pts.length < 4) return null;
  const em = an.em || 16;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  const w = x1 - x0, h = y1 - y0;
  if (w < em * 1.5 || h < em * 0.9) return null;
  const a = pts[0], z = pts[pts.length - 1];
  /* fechado: as pontas se encontram (perto, em relação ao tamanho do desenho) */
  if (Math.hypot(a[0] - z[0], a[1] - z[1]) > Math.max(em * 1.5, 0.35 * Math.max(w, h))) return null;
  /* AS LETRAS DE DENTRO: pontos de uma grade que caem DENTRO do traço — encolhido em volta do centro (o alto e o
   * baixo de um círculo passam no vão entre as linhas, e o canto da caixa em volta fica fora dele, na linha vizinha) */
  const bl = tnGeo.blocos(tnCorpo).filter((b) => b.id === an.anc.b)[0];
  if (!bl) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const enc = pts.map((p) => [cx + (p[0] - cx) * 0.85, cy + (p[1] - cy) * 0.6]);
  const passo = Math.max(2, em * 0.5);
  let i = Infinity, j = -1;
  for (let y = y0; y <= y1; y += passo) {
    for (let x = x0; x <= x1; x += passo) {
      if (!tnDentro([x, y], enc)) continue;
      const k = tnGeo.letraEm(bl.el, x, y);
      if (k >= 0) { if (k < i) i = k; if (k > j) j = k; }
    }
  }
  if (!(j > i)) return null;
  /* PALAVRAS INTEIRAS: circula-se palavra, não meia palavra — o encolhimento corta as pontas ("sprudência … Feder") */
  const tx = tnGeo.texto ? String(tnGeo.texto(bl.el) || "") : "";
  if (tx) {
    while (i < j && /\s/.test(tx[i] || "")) i++;
    while (j > i && /\s/.test(tx[j] || "")) j--;
    while (i > 0 && /\S/.test(tx[i - 1] || "")) i--;
    while (j < tx.length - 1 && /\S/.test(tx[j + 1] || "")) j++;
  }
  return { forma: "contorno", anc: { b: an.anc.b, i }, fim: j, pts: [] };
}
/* o ponto está dentro do polígono? (raio que cruza as arestas) */
function tnDentro(p, poli) {
  let dentro = false;
  for (let a = 0, b = poli.length - 1; a < poli.length; b = a++) {
    const [xa, ya] = poli[a], [xb, yb] = poli[b];
    if ((ya > p[1]) !== (yb > p[1]) && p[0] < ((xb - xa) * (p[1] - ya)) / (yb - ya) + xa) dentro = !dentro;
  }
  return dentro;
}
/* uma elipse (em pontos) em volta de uma caixa de linha */
function tnElipse(r, em) {
  const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
  const rx = (r.r - r.l) / 2 + em * 0.45, ry = (r.b - r.t) / 2 + em * 0.3;
  const out = [];
  for (let k = 0; k <= 32; k++) { const a = Math.PI + (k / 32) * Math.PI * 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return out;
}
/* as retas (na tela) de um traço: o desenhado, ou uma por linha de texto do "da letra i até j" */
function tnSegmentos(tr) {
  const o = tnOrigem(tr.anc);
  if (!o) return null;
  if (tr.fim === undefined) return { em: o.em, polis: [tnAbsolutos(tr.pts, o.org, o.em)] };
  const bl = tnGeo.blocos(tnCorpo).filter((b) => b.id === tr.anc.b)[0];
  const ls = bl && tnGeo.linhas ? tnGeo.linhas(bl.el, tr.anc.i, tr.fim) : [];
  if (!ls.length) return null;
  if (tr.forma === "contorno") return { em: o.em, polis: ls.map((r) => tnElipse(r, o.em)) };
  const y = (r) => r.t + (tr.dy || 0) * o.em;
  return { em: o.em, polis: ls.map((r) => [[r.l, y(r)], [r.r, y(r)]]) };
}
function tnApagarEm(x, y) {
  const raio = tnLarg.borracha;
  let mudou = false;
  const nova = [];
  tnTracos().forEach((tr) => {
    const o = tnOrigem(tr.anc);
    if (!o) { nova.push(tr); return; }
    /* a reta "da letra i até j" sai inteira quando a borracha encosta nela (partir mudaria as letras que ela marca) */
    if (tr.fim !== undefined) {
      const sg = tnSegmentos(tr);
      const alcance = raio + (tr.larg * o.em) / 2;
      const toca = !!sg && sg.polis.some((p) => tnDensificar(p, Math.max(2, raio / 2)).some((q) => Math.hypot(q[0] - x, q[1] - y) <= alcance));
      if (toca) mudou = true; else nova.push(tr);
      return;
    }
    const abs = tnDensificar(tnAbsolutos(tr.pts, o.org, o.em), Math.max(2, raio / 2));
    const partes = tnPartir(abs, x, y, raio + (tr.larg * o.em) / 2);
    if (partes.length === 1 && partes[0].length === abs.length) { nova.push(tr); return; }
    mudou = true;
    partes.forEach((p) => nova.push(Object.assign({}, tr, { pts: tnRelativos(tnSimplificar(p, 0.8), o.org, o.em) })));
  });
  if (mudou) { tnGuardarTracos(tnQid, nova); tnPintar(); }
  return mudou;
}

/* ---------- pintar ---------- */
const TN_NS = "http://www.w3.org/2000/svg";
function tnPintarLogo() {
  if (tnPintarPedido) return;
  tnPintarPedido = true;
  const f = () => { tnPintarPedido = false; tnPintar(); };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(f); else f();
}
function tnCorDe(id) { return (TN_CORES.filter((c) => c.id === id)[0] || TN_CORES[0]).cor; }
function tnPath(pts, tr, em, base) {
  const p = document.createElementNS(TN_NS, "path");
  const rel = pts.map((q) => [q[0] - base.x, q[1] - base.y]);
  p.setAttribute("d", tnCaminho(rel));
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", tnCorDe(tr.cor));
  p.setAttribute("stroke-width", String(Math.max(0.8, (tr.larg || 0.2) * em)));
  p.setAttribute("stroke-linecap", tr.f === "marca" ? "butt" : "round");
  p.setAttribute("stroke-linejoin", "round");
  p.setAttribute("class", "tn-traco tn-" + (tr.f || "lapis"));
  return p;
}
function tnPintar() {
  const svg = tnSvg, corpo = tnCorpo;
  if (!svg || !corpo) return 0;
  svg.innerHTML = "";
  const base = tnGeo.base(corpo);
  /* MEDIR SEM A CAMADA: com ela dentro, scrollWidth/Height contavam o próprio SVG — e ele nunca encolhia depois que a
   * tela estreitava (o texto do celular saía cortado à direita). Zera, mede, aplica; a largura é a visível. */
  if (svg.style) { svg.style.width = "0px"; svg.style.height = "0px"; }
  const w = corpo.clientWidth || corpo.scrollWidth || 0, h = Math.max(corpo.scrollHeight || 0, corpo.clientHeight || 0);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  if (svg.style) { svg.style.width = w + "px"; svg.style.height = h + "px"; }
  let n = 0;
  tnTracos().forEach((tr) => {
    const sg = tnSegmentos(tr);
    if (!sg) return;
    sg.polis.forEach((p) => svg.appendChild(tnPath(p, tr, sg.em, base)));
    n++;
  });
  tnPathVivo = null;
  if (tnAtual) { tnPathVivo = tnPath(tnAtual.pts, { f: tnAtual.f, cor: tnAtual.cor, larg: tnAtual.larg / 16 }, 16, base); svg.appendChild(tnPathVivo); }
  return n;
}
function tnPintarClasse() {
  if (!tnSvg || !tnSvg.setAttribute) return;
  const ativa = tnAberta && tnFerr !== "mao";
  /* no SVG, a classe vai pelo atributo (className é um objeto, não texto) */
  tnSvg.setAttribute("class", ["tn-camada", ativa ? "tn-ativa" : "", tnCanetaVista ? "tn-caneta" : "", ativa && tnFerr === "borracha" ? "tn-apagar" : ""].filter(Boolean).join(" "));
}

/* ---------- a camada na questão (a cada repintura do corpo) ---------- */
function tnMontar(corpo, qid) {
  tnCorpo = corpo || null;
  tnQid = qid || null;
  tnAtual = null;
  tnApagando = false;
  if (!corpo) { tnSvg = null; return null; }
  if (qid) { tnTrazerGuardados(qid); tnSincronizar(qid, tnQuestaoDe(qid)); }
  if (corpo.classList) corpo.classList.add("tn-com");
  const svg = document.createElementNS(TN_NS, "svg");
  svg.setAttribute("class", "tn-camada");
  svg.setAttribute("aria-hidden", "true");
  svg.id = "tnCamada";
  if (svg.addEventListener) {
    svg.addEventListener("pointerdown", (ev) => { tnComecar(ev); });
    svg.addEventListener("pointermove", (ev) => { tnMover(ev); });
    svg.addEventListener("pointerup", () => { tnSoltar(); });
    svg.addEventListener("pointercancel", () => { tnSoltar(); });
    /* a captura se perdeu por outro motivo (a janela trocou, o sistema tomou o gesto): termina o traço, não o deixa pendurado */
    svg.addEventListener("lostpointercapture", () => { if (tnAtual || tnApagando) tnSoltar(); });
  }
  corpo.appendChild(svg);
  tnSvg = svg;
  tnPintarClasse();
  /* o texto refluiu (girou, mudou a letra, a caixa): redesenha a partir das letras */
  try {
    if (tnObs) tnObs.disconnect();
    if (typeof ResizeObserver === "function") { tnObs = new ResizeObserver(() => tnPintarLogo()); tnObs.observe(corpo); }
  } catch (e) {}
  tnPintar();
  /* A JANELA PODE AINDA NÃO ESTAR ABERTA (nem medida) nesta hora: com traços guardados que voltam ao abrir a questão, a
   * pintura de agora não acha as linhas do texto e não desenha nada. Pinta de novo no próximo quadro e depois da
   * animação de abrir. */
  if (tnContar()) { tnPintarLogo(); try { setTimeout(() => { if (tnSvg === svg) tnPintar(); }, 300); } catch (e) {} }
  tnPintarBarra();
  return svg;
}

/* =====================================================================
 * GUARDAR NA QUESTÃO (v19.8.0)
 *
 * A DÚVIDA: guardar traços ocupa espaço? Medido: sublinhado/marca-texto ≈ 0,1 KB, círculo à mão ≈ 0,4 KB; uma questão
 * bem marcada ≈ 0,7 KB; as 438 questões marcadas ≈ 300 KB. O problema não é o tamanho, é o LUGAR: o localStorage tem
 * teto de ~5 MB e já passa de 3,5 MB. Por isso:
 *  · mora no IndexedDB (eac_idb_tinta), como leis, decisões e julgados — nunca no localStorage;
 *  · guarda SOZINHO só a questão que você ERROU ou CHUTOU (a que vai rever), e as que você pedir (📌);
 *  · LIMPA SOZINHO: a errada/chutada some quando você a acerta numa revisão; qualquer uma some depois de 90 dias sem
 *    abrir; tirar o 📌 deixa de guardar (e o automático não volta a guardar aquela questão nesta sessão);
 *  · fica FORA do backup por padrão (opção para incluir, no ⋮ da questão).
 * A decisão (tnDecidir) é pura; o IndexedDB é gravado em segundo plano, numa fila.
 * ===================================================================== */
const TN_IDB_NOME = "eac_idb_tinta";
const TN_IDB_LOJA = "q";
const TN_VENCE_DIAS = 90;
const TN_PREF_BACKUP = "eac_tinta_backup";
let tnSalvos = {};
let tnRecusadas = {};
let _tnIdb = null;
let _tnGravando = null;

function tnIdbSuportado() { try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; } }
function tnIdbAbrir() {
  if (_tnIdb) return Promise.resolve(_tnIdb);
  if (!tnIdbSuportado()) return Promise.reject(new Error("sem indexedDB"));
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(TN_IDB_NOME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(TN_IDB_LOJA)) db.createObjectStore(TN_IDB_LOJA); };
    req.onsuccess = () => { _tnIdb = req.result; resolve(_tnIdb); };
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB do lápis"));
    req.onblocked = () => reject(new Error("indexedDB do lápis bloqueado"));
  });
}
function tnIdbTx(fn) {
  return tnIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([TN_IDB_LOJA], "readwrite");
    fn(tx.objectStore(TN_IDB_LOJA));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}
function tnIdbLerTudo() {
  return tnIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const out = {};
    const req = db.transaction([TN_IDB_LOJA], "readonly").objectStore(TN_IDB_LOJA).openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { out[c.key] = c.value; c.continue(); } else resolve(out); };
    req.onerror = () => reject(req.error);
  }));
}
/* uma gravação de cada vez, na ordem: guardar e apagar a mesma questão em seguida não podem se cruzar */
function tnFila(fn) {
  if (!tnIdbSuportado()) return Promise.resolve(false);
  _tnGravando = (_tnGravando || Promise.resolve()).then(fn).catch((e) => {
    try { reg("ERRO", "lápis: gravação no indexedDB falhou", String((e && e.message) || e)); } catch (x) {}
  });
  return _tnGravando;
}

/* o que a ÚLTIMA tentativa diz da questão: "errou" | "chute" | "acertou" | "" (ainda não respondida) */
function tnMotivoAuto(q) {
  const ts = (q && q.tentativas) || [];
  const u = ts[ts.length - 1];
  if (!u) return "";
  if (u.chute) return "chute";
  return u.acertou ? "acertou" : "errou";
}
/* a regra, pura: "guardar" | "apagar" | "nada" */
function tnDecidir(rec, motivoAuto, temTracos, recusada) {
  if (rec && rec.motivo !== "pedido" && motivoAuto === "acertou") return "apagar";
  if (!temTracos) return rec ? "apagar" : "nada";
  if (rec) return "guardar";
  if (!recusada && (motivoAuto === "errou" || motivoAuto === "chute")) return "guardar";
  return "nada";
}
/* as guardadas há mais de "dias" sem abrir */
function tnVencidos(salvos, agoraMs, dias) {
  const lim = (agoraMs || Date.now()) - (dias || TN_VENCE_DIAS) * 86400000;
  return Object.keys(salvos || {}).filter((k) => {
    const d = Date.parse((salvos[k] && (salvos[k].aberto || salvos[k].salvo)) || "");
    return !isNaN(d) && d < lim;
  });
}
function tnQuestaoDe(qid) {
  try {
    const a = typeof qsAtual === "function" ? qsAtual() : null;
    if (a && a.id === qid) return a;
    return (typeof qsTodas === "function" ? qsTodas() : []).filter((x) => x.id === qid)[0] || null;
  } catch (e) { return null; }
}
function tnGravarRec(qid, motivo) {
  const tr = JSON.stringify(tnTracos(qid));
  const ant = tnSalvos[qid];
  if (ant && ant.motivo === motivo && JSON.stringify(ant.tracos) === tr) return false;
  const agora = new Date().toISOString();
  const rec = { tracos: JSON.parse(tr), motivo, salvo: agora, aberto: (ant && ant.aberto) || agora };
  tnSalvos[qid] = rec;
  tnFila(() => tnIdbTx((l) => l.put(rec, qid)));
  if (!ant) { try { reg("QUESTOES", "lápis: marcas guardadas na questão", qid + " · " + motivo); } catch (e) {} }
  return true;
}
function tnApagarRec(qid) {
  if (!tnSalvos[qid]) return false;
  delete tnSalvos[qid];
  tnFila(() => tnIdbTx((l) => l.delete(qid)));
  try { reg("QUESTOES", "lápis: marcas guardadas apagadas", String(qid)); } catch (e) {}
  return true;
}
function tnSincronizar(qid, q) {
  if (!qid) return "nada";
  const rec = tnSalvos[qid];
  const d = tnDecidir(rec, tnMotivoAuto(q), tnContar(qid) > 0, !!tnRecusadas[qid]);
  if (d === "guardar") tnGravarRec(qid, rec ? rec.motivo : tnMotivoAuto(q));
  else if (d === "apagar") tnApagarRec(qid);
  return d;
}
/* o 📌: guardar a pedido, ou deixar de guardar */
function tnGuardarAlternar() {
  const qid = tnQid;
  if (!qid) return false;
  if (tnSalvos[qid]) {
    tnApagarRec(qid);
    tnRecusadas[qid] = true;
    try { toastMsg(t("tn_desguardou"), 4500); } catch (e) {}
  } else if (tnContar(qid)) {
    delete tnRecusadas[qid];
    tnGravarRec(qid, "pedido");
    try { toastMsg(t("tn_guardou"), 3500); } catch (e) {}
  } else {
    try { toastMsg(t("tn_guardar_vazio"), 3500); } catch (e) {}
    return false;
  }
  tnPintarBarra();
  return true;
}
/* a questão aberta tem traços guardados e ainda nenhum nesta sessão: eles voltam (e "aberto" vira hoje) */
function tnTrazerGuardados(qid) {
  const rec = qid && tnSalvos[qid];
  if (!rec || tnPorQuestao[qid] !== undefined) return false;
  tnPorQuestao[qid] = JSON.parse(JSON.stringify(rec.tracos || []));
  rec.aberto = new Date().toISOString();
  tnFila(() => tnIdbTx((l) => l.put(rec, qid)));
  return true;
}
function tnCarregarSalvos() {
  if (!tnIdbSuportado()) return Promise.resolve(0);
  return tnIdbLerTudo().then((o) => {
    tnSalvos = Object.assign({}, o || {}, tnSalvos);
    const venc = tnVencidos(tnSalvos, Date.now(), TN_VENCE_DIAS);
    venc.forEach((k) => tnApagarRec(k));
    if (venc.length) { try { reg("QUESTOES", "lápis: marcas vencidas apagadas (90 dias sem abrir)", String(venc.length)); } catch (e) {} }
    if (tnTrazerGuardados(tnQid)) { tnPintar(); tnPintarBarra(); }
    return Object.keys(tnSalvos).length;
  }).catch(() => 0);
}
function tnEspaco() {
  const ks = Object.keys(tnSalvos);
  return { n: ks.length, kb: Math.max(ks.length ? 1 : 0, Math.round(JSON.stringify(tnSalvos).length / 1024)) };
}
function tnBackupLigado() { try { return localStorage.getItem(TN_PREF_BACKUP) === "1"; } catch (e) { return false; } }
function tnBackupDefinir(sim) { try { if (sim) localStorage.setItem(TN_PREF_BACKUP, "1"); else localStorage.removeItem(TN_PREF_BACKUP); } catch (e) {} return tnBackupLigado(); }
/* o que vai para o backup: só com a opção ligada (null = fica de fora) */
function tnParaBackup() { return tnBackupLigado() ? JSON.stringify(tnSalvos) : null; }
function tnRestaurarTudo(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return 0;
  tnSalvos = JSON.parse(JSON.stringify(o));
  tnFila(() => tnIdbTx((l) => { l.clear(); Object.keys(tnSalvos).forEach((k) => l.put(tnSalvos[k], k)); }));
  return Object.keys(tnSalvos).length;
}
function tnApagarTodasGuardadas() {
  const n = Object.keys(tnSalvos).length;
  tnSalvos = {};
  tnFila(() => tnIdbTx((l) => l.clear()));
  try { reg("QUESTOES", "lápis: todas as marcas guardadas apagadas", String(n)); } catch (e) {}
  tnPintarBarra();
  return n;
}
/* o ⋮ da questão: quanto ocupa, apagar todas, backup sim/não */
function tnGuardadasBotao() {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-min";
  b.id = "btnTnGuardadas";
  const e = tnEspaco();
  b.textContent = t("tn_ger_btn", { n: e.n, kb: e.kb });
  b.title = t("tn_ger_aj");
  b.onclick = () => { try { if (typeof qsFerFechar === "function") qsFerFechar(); } catch (x) {} tnGuardadasAbrir(); };
  return b;
}
async function tnGuardadasAbrir() {
  const e = tnEspaco();
  const bk = tnBackupLigado();
  const r = await uiEscolha(t("tn_ger_txt", { n: e.n, kb: e.kb, bk: t(bk ? "tn_ger_bk_sim" : "tn_ger_bk_nao") }), [
    { rot: t(bk ? "tn_ger_bk_off" : "tn_ger_bk_on"), valor: "backup", classe: "btn-cinza" },
    { rot: t("tn_ger_fechar"), valor: false, classe: "btn-cinza" },
    e.n ? { rot: t("tn_ger_apagar"), valor: "apagar", classe: "btn-perigo" } : null,
  ].filter(Boolean));
  if (r === "backup") {
    tnBackupDefinir(!bk);
    try { reg("QUESTOES", "lápis: marcas " + (bk ? "fora do" : "incluídas no") + " backup", ""); } catch (x) {}
    try { toastMsg(t(bk ? "tn_ger_bk_tirou" : "tn_ger_bk_pos"), 4500); } catch (x) {}
    return "backup";
  }
  if (r === "apagar") {
    if (!(await uiConfirm(t("tn_ger_apagar_conf", { n: e.n }), { perigo: true, ok: t("tn_ger_apagar") }))) return "";
    tnApagarTodasGuardadas();
    try { toastMsg(t("tn_ger_apagado"), 3500); } catch (x) {}
    return "apagar";
  }
  return "";
}

/* ---------- a barra ---------- */
function tnBarraMontar() {
  if (typeof document === "undefined") return null;
  let b = $("tnBarra");
  if (b) return b;
  const dlg = $("dlgQsResponder");
  if (!dlg) return null;
  b = document.createElement("div");
  b.id = "tnBarra";
  b.className = "tn-barra";
  b.hidden = true;
  b.setAttribute("role", "toolbar");
  b.setAttribute("aria-label", t("tn_barra"));
  const bt = (id, txt, tit, fn, cls) => {
    const x = document.createElement("button");
    x.type = "button"; x.id = id; x.className = "tn-bt" + (cls ? " " + cls : "");
    x.textContent = txt; x.title = tit; x.setAttribute("aria-label", tit);
    x.onclick = fn;
    b.append(x);
    return x;
  };
  const sep = () => { const s = document.createElement("span"); s.className = "tn-sep"; b.append(s); };
  bt("btnTnLapis", "✏️", t("tn_lapis"), () => tnFerramenta("lapis"));
  bt("btnTnMarca", "🖍️", t("tn_marca"), () => tnFerramenta("marca"));
  bt("btnTnBorracha", "🧽", t("tn_borracha"), () => tnFerramenta("borracha"));
  bt("btnTnMao", "✋", t("tn_mao"), () => tnFerramenta("mao"));
  sep();
  TN_CORES.forEach((c) => {
    const x = bt("btnTnCor_" + c.id, "", t("tn_cor_" + c.id), () => tnCorEscolher(c.id), "tn-cor");
    if (x.style) x.style.background = c.cor;
  });
  sep();
  const r = document.createElement("input");
  r.type = "range"; r.id = "tnEspessura"; r.className = "tn-esp";
  r.title = t("tn_espessura"); r.setAttribute("aria-label", t("tn_espessura"));
  r.oninput = () => tnEspessura(Number(r.value));
  b.append(r);
  sep();
  bt("btnTnDesfazer", "↶", t("tn_desfazer"), () => tnDesfazer());
  bt("btnTnLimpar", "🗑", t("tn_limpar"), () => tnLimpar(), "tn-perigo");
  bt("btnTnGuardar", "📌", t("tn_guardar_off"), () => tnGuardarAlternar());
  sep();
  bt("btnTnFechar", "✕", t("tn_fechar"), () => tnFechar());
  dlg.append(b);
  return b;
}
function tnPintarBarra() {
  /* o ✏️ da questão primeiro: ele existe mesmo sem a barra ter sido aberta nesta sessão */
  const g = $("btnQsTinta");
  if (g && g.classList) {
    g.classList.toggle("btn-min-ok", tnAberta); g.setAttribute("aria-pressed", tnAberta ? "true" : "false");
    /* a questão tem marcas (desta sessão ou guardadas): um ponto no ✏️, para lembrar que há algo ali */
    g.classList.toggle("tn-tem", tnContar() > 0);
  }
  const b = $("tnBarra");
  if (!b) return;
  b.hidden = !tnAberta;
  TN_FERRAMENTAS.forEach((f) => {
    const x = $("btnTn" + f.charAt(0).toUpperCase() + f.slice(1));
    if (x && x.classList) { x.classList.toggle("on", tnFerr === f); x.setAttribute("aria-pressed", tnFerr === f ? "true" : "false"); }
  });
  TN_CORES.forEach((c) => {
    const x = $("btnTnCor_" + c.id);
    if (x && x.classList) { x.classList.toggle("on", tnCor === c.id); x.setAttribute("aria-pressed", tnCor === c.id ? "true" : "false"); }
  });
  const r = $("tnEspessura");
  if (r) {
    const k = tnFerr === "mao" ? "lapis" : tnFerr;
    r.min = String(TN_LARG_LIMITE[k][0]); r.max = String(TN_LARG_LIMITE[k][1]);
    r.value = String(tnLarg[k]);
    r.disabled = tnFerr === "mao";
  }
  if ($("btnTnDesfazer")) $("btnTnDesfazer").disabled = !(tnHist[tnQid] || []).length;
  if ($("btnTnLimpar")) $("btnTnLimpar").disabled = !tnContar();
  const gd = $("btnTnGuardar");
  if (gd) {
    const rec = tnSalvos[tnQid];
    if (gd.classList) gd.classList.toggle("on", !!rec);
    gd.setAttribute("aria-pressed", rec ? "true" : "false");
    gd.title = rec ? t("tn_guardar_on_" + (rec.motivo === "pedido" ? "pedido" : rec.motivo === "chute" ? "chute" : "errou")) : t("tn_guardar_off");
    gd.setAttribute("aria-label", gd.title);
  }
}
function tnFerramenta(f) {
  if (TN_FERRAMENTAS.indexOf(f) < 0) return false;
  tnFerr = f;
  tnPrefGravar();
  tnPintarClasse();
  tnPintarBarra();
  return true;
}
function tnCorEscolher(id) {
  if (!TN_CORES.some((c) => c.id === id)) return false;
  tnCor = id;
  if (tnFerr === "borracha" || tnFerr === "mao") tnFerr = "lapis";
  tnPrefGravar();
  tnPintarClasse();
  tnPintarBarra();
  return true;
}
function tnEspessura(v) {
  const k = tnFerr === "mao" ? "lapis" : tnFerr;
  const [a, z] = TN_LARG_LIMITE[k];
  tnLarg[k] = Math.max(a, Math.min(z, Number(v) || TN_LARG_PADRAO[k]));
  tnPrefGravar();
  return tnLarg[k];
}
function tnAbrir() {
  if (!tnQid) return false;
  tnBarraMontar();
  tnAberta = true;
  if (tnFerr === "borracha") tnFerr = "lapis";
  tnPintarClasse();
  tnPintarBarra();
  try { reg("QUESTOES", "lápis aberto", String(tnQid)); } catch (e) {}
  return true;
}
function tnFechar() {
  if (!tnAberta) return false;
  tnAberta = false;
  tnAtual = null;
  tnApagando = false;
  tnPintarClasse();
  tnPintarBarra();
  tnPintar();
  return true;
}
function tnAlternar() { return tnAberta ? !tnFechar() : tnAbrir(); }
function tnAbertaAgora() { return tnAberta; }

/* o botão da linha de cima da questão (ao lado do ⋮) */
function tnBotaoQuestao() {
  const b = document.createElement("button");
  b.type = "button";
  b.id = "btnQsTinta";
  b.className = "btn-min qs-fer-tinta" + (tnAberta ? " btn-min-ok" : "");
  b.textContent = "✏️";
  b.title = t("tn_abrir_aj");
  b.setAttribute("aria-label", t("tn_abrir_aj"));
  b.setAttribute("aria-pressed", tnAberta ? "true" : "false");
  b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); tnAlternar(); };
  return b;
}

/* o teclado com a barra aberta: P lápis · M marca-texto · R borracha · H mão · Ctrl+Z desfazer (Esc fecha a barra,
 * pelo "cancel" da janela — ver tnIniciar). As letras das alternativas (A–E) e os números continuam respondendo:
 * por isso a borracha é R, não B nem E. */
function tnTecla(ev) {
  if (!tnAberta || !ev) return false;
  const alvo = ev.target;
  const tag = String((alvo && alvo.tagName) || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (alvo && alvo.isContentEditable)) return false;
  const k = String(ev.key || "");
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && k.toLowerCase() === "z") { tnDesfazer(); return true; }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  const mapa = { p: "lapis", m: "marca", r: "borracha", h: "mao" };
  if (mapa[k.toLowerCase()]) return tnFerramenta(mapa[k.toLowerCase()]);
  return false;
}

function tnIniciar() {
  tnPrefLer();
  try { tnCarregarSalvos(); } catch (e) {}
  const dlg = typeof document !== "undefined" ? $("dlgQsResponder") : null;
  if (dlg && dlg.addEventListener) {
    dlg.addEventListener("close", () => { tnFechar(); });
    /* Esc com a barra aberta fecha a barra, não a sessão */
    dlg.addEventListener("cancel", (ev) => { if (tnAberta) { if (ev.preventDefault) ev.preventDefault(); tnFechar(); } });
  }
}
if (typeof document !== "undefined") { try { tnIniciar(); } catch (e) {} }
