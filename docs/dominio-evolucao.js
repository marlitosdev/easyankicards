/* =====================================================================
 * EVOLUÇÃO DO DOMÍNIO NO TEMPO
 *
 * O Domínio é uma FOTO de agora. Para ver a curva subindo (ou parada), o app guarda um RETRATO por dia e por edital:
 * quanto do peso da prova estava em cada nível (verde · amarelo · azul · vermelho · cinza), no total e por disciplina.
 * O retrato do dia é regravado (vale o último estado do dia) e é tirado sozinho, uma vez por dia, ao abrir o app — não
 * depende de você abrir a tela. A tela mostra uma coluna por SEMANA (o último retrato de cada semana).
 *
 * O retrato é pequeno de propósito (só percentuais): 16 disciplinas × 5 números por dia e por edital.
 * Funções PURAS (domSnapDe, domSnapsGravar, domSerie, domDelta) recebem tudo pronto; quem lê e grava o navegador é
 * domSnapsLer/domSnapsSalvar.
 * ===================================================================== */
const DOM_SNAP_CHAVE = "eac_dominio_snaps";
const DOM_SNAP_MAX = 800;          /* retratos guardados no total (todos os editais) */
const DOM_SEMANAS = 20;            /* colunas do gráfico */
const DOM_NIVEIS_ORDEM = ["verde", "azul", "amarelo", "vermelho", "cinza"];   /* de baixo para cima na coluna */

const domPct = (x) => Math.round(x * 10) / 10;

/* o RETRATO de um mapa de domínio (resultado de domMapa) */
function domSnapDe(m, edId, fase, hoje) {
  const tot = (m && m.resumo && m.resumo.total) || 0;
  if (!tot) return null;
  const dist = {};
  DOM_NIVEIS_ORDEM.forEach((k) => { dist[k] = domPct((m.resumo.distribuicao[k] / tot) * 100); });
  return {
    d: hoje, ed: String(edId), f: fase === 2 ? 2 : 1,
    dist,
    discs: m.disciplinas.map((d) => {
      const dd = d.distribuicao, ds = DOM_NIVEIS_ORDEM.reduce((x, k) => x + dd[k], 0) || 1;
      const o = { n: d.nome, p: domPct(d.pesoPct) };
      DOM_NIVEIS_ORDEM.forEach((k) => { o[k] = domPct((dd[k] / ds) * 100); });
      return o;
    }),
  };
}

/* Junta o retrato à lista: no máximo UM por dia, edital e fase (o do dia é substituído); mantém os mais recentes. */
function domSnapsGravar(lista, snap, max) {
  if (!snap) return (lista || []).slice();
  const out = (lista || []).filter((x) => !(x.d === snap.d && String(x.ed) === String(snap.ed) && (x.f || 1) === (snap.f || 1)));
  out.push(snap);
  out.sort((a, b) => (a.d < b.d ? -1 : (a.d > b.d ? 1 : 0)));
  while (out.length > (max || DOM_SNAP_MAX)) out.shift();
  return out;
}

/* a segunda-feira da semana de uma data ISO (a chave da semana) */
function domSegunda(iso) {
  const d = new Date(iso + "T00:00:00");
  const dia = (d.getDay() + 6) % 7;      /* segunda = 0 */
  d.setDate(d.getDate() - dia);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/* A SÉRIE SEMANAL de um edital e fase: o último retrato de cada semana, do mais antigo ao mais novo (até `semanas`). */
function domSerie(snaps, edId, fase, semanas) {
  const doEd = (snaps || []).filter((x) => String(x.ed) === String(edId) && (x.f || 1) === (fase === 2 ? 2 : 1));
  const porSemana = new Map();
  doEd.forEach((x) => { porSemana.set(domSegunda(x.d), x); });     /* já em ordem de data: o último de cada semana fica */
  return [...porSemana.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([sem, x]) => Object.assign({ sem }, x)).slice(-(semanas || DOM_SEMANAS));
}

/* O retrato de REFERÊNCIA para comparar: o mais recente que tenha pelo menos `dias` dias; se a história for mais curta,
 * o mais antigo, desde que tenha pelo menos 6 dias de diferença; senão nenhum. */
function domReferencia(snaps, edId, fase, hojeISO, dias) {
  const doEd = (snaps || []).filter((x) => String(x.ed) === String(edId) && (x.f || 1) === (fase === 2 ? 2 : 1) && x.d < hojeISO);
  if (!doEd.length) return null;
  const idade = (x) => Math.round((new Date(hojeISO + "T00:00:00") - new Date(x.d + "T00:00:00")) / 86400000);
  const velhos = doEd.filter((x) => idade(x) >= dias);
  if (velhos.length) return velhos[velhos.length - 1];
  const maisAntigo = doEd[0];
  return idade(maisAntigo) >= 6 ? maisAntigo : null;
}

/* A diferença, em PONTOS percentuais, entre o retrato de agora e o de referência (total e por disciplina). */
function domDelta(atual, antes) {
  if (!atual || !antes) return null;
  const dif = (a, b) => { const o = {}; DOM_NIVEIS_ORDEM.forEach((k) => { o[k] = domPct((a[k] || 0) - (b[k] || 0)); }); return o; };
  const porDisc = {};
  const antesMap = {}; (antes.discs || []).forEach((d) => { antesMap[d.n] = d; });
  (atual.discs || []).forEach((d) => { if (antesMap[d.n]) porDisc[d.n] = dif(d, antesMap[d.n]); });
  return { total: dif(atual.dist, antes.dist), disciplinas: porDisc, desde: antes.d };
}

/* ---- guardar no navegador ---- */
function domSnapsLer() {
  try { const j = JSON.parse(localStorage.getItem(DOM_SNAP_CHAVE) || "[]"); return Array.isArray(j) ? j : []; } catch (e) { return []; }
}
function domSnapsSalvar(lista) {
  const txt = JSON.stringify(lista);
  if (typeof guardar === "function") guardar(DOM_SNAP_CHAVE, txt);
  else { try { localStorage.setItem(DOM_SNAP_CHAVE, txt); } catch (e) {} }
}
function domHojeISO() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
/* tira e guarda o retrato de hoje de um mapa já calculado */
function domSnapGravarHoje(m, edId, fase) {
  const s = domSnapDe(m, edId, fase, domHojeISO());
  if (!s) return null;
  domSnapsSalvar(domSnapsGravar(domSnapsLer(), s));
  return s;
}
/* UMA VEZ POR DIA, sem abrir a tela: quem ainda não tem o retrato de hoje (1ª fase) ganha um. Editais encerrados ficam de fora. */
function domSnapGarantirTodos() {
  if (typeof editais === "undefined" || !Array.isArray(editais)) return 0;
  const hoje = domHojeISO();
  let n = 0;
  editais.forEach((ed) => {
    try {
      if (gerSituacaoEdital(ed).grupo === "encerrado") return;
      const tem = domSnapsLer().some((x) => x.d === hoje && String(x.ed) === String(ed.id) && (x.f || 1) === 1);
      if (tem) return;
      if (domSnapGravarHoje(domDoEdital(ed, { fase: 1 }), ed.id, 1)) n++;
    } catch (e) {}
  });
  return n;
}

/* =====================================================================
 * O GRÁFICO: uma coluna por semana, empilhada pelos níveis (verde embaixo, cinza em cima), mais o resumo da mudança
 * ===================================================================== */
function domEvolucaoPintar(cx, m, edId, fase) {
  const sec = gerEl("div", "dom-evo");
  sec.append(gerEl("h4", "", t("dom_evo_tit")));
  const snapAgora = domSnapDe(m, edId, fase, domHojeISO());
  domSnapGravarHoje(m, edId, fase);
  const snaps = domSnapsLer();
  const serie = domSerie(snaps, edId, fase, DOM_SEMANAS);
  if (serie.length < 2) {
    sec.append(gerEl("p", "nota", t("dom_evo_pouca")));
    cx.append(sec);
    return null;
  }
  const ref = domReferencia(snaps, edId, fase, domHojeISO(), 28);
  const dl = ref ? domDelta(snapAgora, ref) : null;
  if (dl) {
    const pts = (k) => (dl.total[k] > 0 ? "+" : "") + String(dl.total[k]).replace(".", ",") + " pt";
    sec.append(gerEl("p", "dom-evo-resumo", t("dom_evo_desde", { d: dl.desde.split("-").reverse().join("/") }) + " " +
      ["verde", "vermelho", "cinza"].map((k) => t("dom_n_" + k) + " " + pts(k)).join(" · ")));
  }
  const graf = gerEl("div", "dom-evo-graf");
  serie.forEach((x) => {
    const col = gerEl("div", "dom-evo-col");
    const pilha = gerEl("div", "dom-evo-pilha");
    DOM_NIVEIS_ORDEM.forEach((k) => {
      const seg = gerEl("div", "dom-evo-seg dom-n-" + k);
      seg.style.height = (x.dist[k] || 0) + "%";
      pilha.append(seg);
    });
    pilha.title = x.d.split("-").reverse().join("/") + " — " + DOM_NIVEIS_ORDEM.map((k) => t("dom_n_" + k) + " " + String(x.dist[k]).replace(".", ",") + "%").join(" · ");
    col.append(pilha, gerEl("div", "dom-evo-dia", x.d.slice(8) + "/" + x.d.slice(5, 7)));
    graf.append(col);
  });
  sec.append(graf);
  cx.append(sec);
  return dl;
}

if (typeof document !== "undefined" && typeof setTimeout === "function") {
  /* depois que o app terminou de subir (o cálculo lê os cartões e o plano) */
  setTimeout(() => { try { domSnapGarantirTodos(); } catch (e) {} }, 4000);
}
