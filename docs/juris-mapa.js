/* =====================================================================
 * O MAPA DOS SEUS JULGADOS (19.146.0) — a vista "🗺 Mapa" da biblioteca de julgados
 *
 * Ideia tomada do Atlas do iajus (temas com o volume de cada um; uma linha do tempo que filtra o período; "de onde vêm
 * os números" dito na tela), no tamanho de um acervo pessoal — os julgados que VOCÊ guardou, não o do tribunal:
 *  · LINHA DO TEMPO: uma barra por ano do julgamento. Tocar num ano filtra por ele; arrastar sobre as barras (ou tocar
 *    num segundo ano) escolhe um período. O filtro vira chip, como os outros.
 *  · TEMAS: as disciplinas do edital, cada uma com os tópicos em blocos do tamanho do número de julgados; a faixa de
 *    cores de cada bloco é a qualidade (oficial · conferido · a conferir · problema). Tocar num tópico (ou na
 *    disciplina) filtra a biblioteca por ele e volta para a lista.
 * Os números seguem os OUTROS filtros (tribunal, qualidade, busca…): o mapa responde "destes, onde estão e de quando".
 * ===================================================================== */

const JMP_VISTA_CH = "eac_jbb_vista";
const JMP_Q = ["oficial", "conferido", "aconferir", "vencido", "problema"];
let jmpArrasto = null;   /* { de, ate } enquanto o dedo/mouse percorre as barras */

function jmpVista() { try { return localStorage.getItem(JMP_VISTA_CH) === "mapa" ? "mapa" : "lista"; } catch (e) { return "lista"; } }
function jmpVistaTrocar(v) {
  try { localStorage.setItem(JMP_VISTA_CH, v === "mapa" ? "mapa" : "lista"); } catch (e) {}
  try { reg("JURIS", "biblioteca: vista " + (v === "mapa" ? "mapa" : "lista")); } catch (e) {}
  jurBibPintar();
}

/* os julgados filtrados SEM um dos filtros (o mapa conta "ignorando o assunto"; a linha do tempo, "ignorando o ano") */
function jmpFiltradosSem(campos) {
  const guard = {};
  campos.forEach((k) => { guard[k] = jurBib[k]; jurBib[k] = ""; });
  let L = [];
  try { L = jurBibFiltrados(); } finally { campos.forEach((k) => { jurBib[k] = guard[k]; }); }
  return L;
}

/* a qualidade de cada um, contada */
function jmpContaQ(L, todos) {
  const q = {};
  L.forEach((j) => { let nv = "aconferir"; try { nv = jurQualidade(j, { lista: todos }).nivel; } catch (e) {} q[nv] = (q[nv] || 0) + 1; });
  return q;
}

/* os anos: [{ ano, n, q }] em ordem, mais os sem ano */
function jmpAnos(L) {
  const todos = jurLista();
  const por = new Map();
  let sem = 0;
  L.forEach((j) => { const a = jurBibAno(j); if (!a) { sem++; return; } if (!por.has(a)) por.set(a, []); por.get(a).push(j); });
  const anos = [...por.keys()].sort();
  /* os anos do meio que não têm julgado também aparecem (a linha do tempo não pula) */
  const out = [];
  if (anos.length) {
    for (let y = +anos[0]; y <= +anos[anos.length - 1]; y++) {
      const g = por.get(String(y)) || [];
      out.push({ ano: String(y), n: g.length, q: jmpContaQ(g, todos) });
    }
  }
  return { anos: out, sem };
}

/* os temas: as disciplinas (pelo número de julgados) e, dentro, os tópicos */
function jmpTemas(L) {
  const todos = jurLista();
  const discs = new Map();
  L.forEach((j) => {
    const tps = jurBibTopicosDe(j);
    if (!tps.length) {
      const dk = "—";
      if (!discs.has(dk)) discs.set(dk, { dk, nome: t("jmp_sem_topico"), ids: new Set(), tops: new Map(), sem: true });
      discs.get(dk).ids.add(j.id);
      return;
    }
    tps.forEach((x) => {
      const dk = jurChaveComparavel(x.disciplina || "—");
      if (!discs.has(dk)) discs.set(dk, { dk, nome: x.disciplina || "—", ids: new Set(), tops: new Map() });
      const D = discs.get(dk);
      D.ids.add(j.id);
      if (!D.tops.has(x.k)) D.tops.set(x.k, { k: x.k, nome: x.topico, ids: new Set() });
      D.tops.get(x.k).ids.add(j.id);
    });
  });
  const porId = new Map(L.map((j) => [j.id, j]));
  const q = (ids) => jmpContaQ([...ids].map((id) => porId.get(id)).filter(Boolean), todos);
  return [...discs.values()].map((D) => ({ dk: D.dk, nome: D.nome, sem: !!D.sem, n: D.ids.size, q: q(D.ids),
    tops: [...D.tops.values()].map((T) => ({ k: T.k, nome: T.nome, n: T.ids.size, q: q(T.ids) })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome)) }))
    .sort((a, b) => (a.sem ? 1 : 0) - (b.sem ? 1 : 0) || b.n - a.n || a.nome.localeCompare(b.nome));
}

/* o período escolhido: "2018-2021" (ou "2019-2019") */
function jmpPeriodo() {
  const m = String(jurBib.anos || "").match(/^(\d{4})-(\d{4})$/);
  return m ? { de: m[1], ate: m[2] } : null;
}
function jmpPeriodoDefinir(de, ate) {
  if (!de) { jurBib.anos = ""; jurBibPintar(); return; }
  const a = [String(de), String(ate || de)].sort();
  jurBib.anos = a[0] + "-" + a[1];
  jurBib.ano = "";
  try { reg("JURIS", "biblioteca: período pela linha do tempo", jurBib.anos); } catch (e) {}
  jurBibPintar();
}
function jmpTocarAno(ano) {
  const p = jmpPeriodo();
  if (p && p.de === ano && p.ate === ano) return jmpPeriodoDefinir("");        /* o mesmo ano de novo: tira */
  if (p && p.de === p.ate) return jmpPeriodoDefinir(p.de, ano);               /* um ano já escolhido: vira período */
  return jmpPeriodoDefinir(ano, ano);
}

/* a faixa de cores da qualidade (a soma é o total) */
function jmpFaixaQ(q, n) {
  const f = document.createElement("span");
  f.className = "jmp-faixa";
  f.setAttribute("aria-hidden", "true");
  JMP_Q.forEach((k) => {
    if (!q[k]) return;
    const s = document.createElement("span");
    s.className = "jmp-q jmp-q-" + k;
    s.style.width = Math.round((q[k] / Math.max(1, n)) * 100) + "%";
    f.append(s);
  });
  return f;
}

function jmpEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

function jmpPintar() {
  const cx = $("jurBibMapa");
  if (!cx) return;
  cx.innerHTML = "";
  /* ---- a linha do tempo ---- */
  const Lt = jmpFiltradosSem(["ano", "anos"]);
  const { anos, sem } = jmpAnos(Lt);
  const per = jmpPeriodo();
  const sec1 = jmpEl("section", "jmp-sec");
  sec1.append(jmpEl("div", "jmp-tit", t("jmp_tempo_tit")));
  sec1.append(jmpEl("p", "nota", t("jmp_tempo_expl")));
  if (!anos.length) sec1.append(jmpEl("p", "nota", t("jmp_tempo_vazio")));
  else {
    const max = Math.max(1, ...anos.map((a) => a.n));
    const barras = jmpEl("div", "jmp-barras");
    barras.id = "jmpBarras";
    barras.setAttribute("role", "group");
    barras.setAttribute("aria-label", t("jmp_tempo_tit"));
    const dentro = (a) => per && a >= per.de && a <= per.ate;
    const arrastoDentro = (a) => jmpArrasto && a >= [jmpArrasto.de, jmpArrasto.ate].sort()[0] && a <= [jmpArrasto.de, jmpArrasto.ate].sort()[1];
    anos.forEach((a, i) => {
      const b = jmpEl("button", "jmp-barra" + (dentro(a.ano) ? " sel" : "") + (a.n ? "" : " vazia"));
      b.type = "button";
      b.id = "jmpAno_" + a.ano;
      b.dataset.ano = a.ano;
      b.title = t("jmp_ano_aj", { a: a.ano, n: a.n });
      b.setAttribute("aria-label", b.title);
      const col = jmpEl("span", "jmp-col");
      col.style.height = Math.max(a.n ? 6 : 2, Math.round((a.n / max) * 100)) + "%";
      if (a.n) col.append(jmpFaixaQ(a.q, a.n));
      b.append(col);
      /* o primeiro, o último e os múltiplos de 5 — sem um rótulo colado no primeiro ou no último (sobrepunham) */
      const mostrarRot = i === 0 || i === anos.length - 1 || (+a.ano % 5 === 0 && i >= 3 && i <= anos.length - 4);
      b.append(jmpEl("span", "jmp-rot", mostrarRot ? a.ano : ""));
      b.onclick = () => { if (!jmpArrasto) jmpTocarAno(a.ano); };
      /* arrastar: de onde o dedo desceu até onde subiu */
      b.onpointerdown = (ev) => { jmpArrasto = { de: a.ano, ate: a.ano, moveu: false }; if (ev && ev.target && ev.target.releasePointerCapture && ev.pointerId != null) { try { ev.target.releasePointerCapture(ev.pointerId); } catch (x) {} } };
      b.onpointerenter = () => { if (jmpArrasto && jmpArrasto.ate !== a.ano) { jmpArrasto.ate = a.ano; jmpArrasto.moveu = true; Array.from(barras.children).forEach((x) => { if (x.classList) x.classList.toggle("arrasto", arrastoDentro(x.dataset.ano)); }); } };
      barras.append(b);
    });
    const soltar = () => { if (!jmpArrasto) return; const ar = jmpArrasto; jmpArrasto = null; if (ar.moveu) jmpPeriodoDefinir(ar.de, ar.ate); };
    barras.onpointerup = soltar;
    barras.onpointerleave = soltar;
    sec1.append(barras);
    const rodape = [];
    if (per) rodape.push(t("jmp_periodo", { a: per.de === per.ate ? per.de : per.de + "–" + per.ate }));
    if (sem) rodape.push(t("jmp_sem_ano", { n: sem }));
    if (rodape.length) sec1.append(jmpEl("p", "nota jmp-rodape", rodape.join(" · ")));
  }
  cx.append(sec1);
  /* ---- os temas ---- */
  const Lm = jmpFiltradosSem(["assunto"]);
  const temas = jmpTemas(Lm);
  const sec2 = jmpEl("section", "jmp-sec");
  sec2.append(jmpEl("div", "jmp-tit", t("jmp_temas_tit")));
  sec2.append(jmpEl("p", "nota", t("jmp_temas_expl")));
  const leg = jmpEl("div", "jmp-legenda");
  ["oficial", "conferido", "aconferir", "problema"].forEach((k) => { const s = jmpEl("span", "jmp-leg"); s.append(jmpEl("span", "jmp-q jmp-q-" + k), document.createTextNode(" " + t("jur_q_" + k))); leg.append(s); });
  sec2.append(leg);
  if (!temas.length) sec2.append(jmpEl("p", "nota", t("jmp_temas_vazio")));
  const maxD = Math.max(1, ...temas.map((D) => D.n));
  temas.forEach((D, i) => {
    const bloco = jmpEl("div", "jmp-disc");
    const cab = jmpEl("button", "jmp-disc-cab" + (jurBib.assunto === "d:" + D.dk ? " sel" : ""));
    cab.type = "button";
    cab.id = "jmpDisc_" + i;
    cab.disabled = !!D.sem;
    cab.title = t("jmp_disc_aj", { d: D.nome, n: D.n });
    const nm = jmpEl("span", "jmp-disc-nome", D.nome);
    const ct = jmpEl("span", "jmp-disc-n", String(D.n));
    const volume = jmpEl("span", "jmp-volume");
    const vb = jmpEl("span", "jmp-volume-b");
    vb.style.width = Math.round((D.n / maxD) * 100) + "%";
    volume.append(vb);
    cab.append(nm, ct, volume);
    cab.onclick = () => { if (D.sem) return; jurBib.assunto = "d:" + D.dk; if (typeof jmpVistaTrocar === "function") jmpVistaTrocar("lista"); };
    bloco.append(cab);
    if (D.tops.length) {
      const tiles = jmpEl("div", "jmp-tiles");
      D.tops.forEach((T, k) => {
        const b = jmpEl("button", "jmp-tile" + (jurBib.assunto === "t:" + T.k ? " sel" : ""));
        b.type = "button";
        b.id = "jmpTop_" + i + "_" + k;
        b.style.flexGrow = String(T.n);
        b.title = t("jmp_top_aj", { t: T.nome, n: T.n });
        b.append(jmpEl("span", "jmp-tile-nome", T.nome), jmpEl("span", "jmp-tile-n", String(T.n)), jmpFaixaQ(T.q, T.n));
        b.onclick = () => { jurBib.assunto = "t:" + T.k; jmpVistaTrocar("lista"); };
        tiles.append(b);
      });
      bloco.append(tiles);
    }
    sec2.append(bloco);
  });
  sec2.append(jmpEl("p", "nota jmp-fonte", t("jmp_fonte", { n: Lm.length, t: jurLista().length })));
  cx.append(sec2);
}
