/* =====================================================================
 * (19.172.0) REVISÃO 360° DA RETA FINAL
 *
 * A técnica (e-book "Revisões de alto desempenho"): nos últimos 10 a 15 dias, agrupar os tópicos de cada matéria em
 * blocos (R1, R2…), distribuídos pelo peso da prova, cada um com 10–25% de releitura rápida (os grifos) e 75–90% de
 * questões. Ela supõe o edital estudado inteiro — e quase nunca é assim: no ISS Caruaru, a 11 dias, eram 9 de 133
 * tópicos estudados e todas as disciplinas abaixo do mínimo. Uma 360° só com o que já foi estudado teria 9 tópicos.
 *
 * POR ISSO ELA NÃO É UM PLANEJADOR À PARTE: os blocos saem do MESMO plano da agenda (montarPlano: peso, dificuldade,
 * mínimos, reserva da discursiva) e cada "✓ feito" passa pelo mesmo registro (edMarcar) — o progresso, o diário e as
 * revisões espaçadas continuam certos. O que ela acrescenta:
 *  1. ORÇAMENTO HONESTO: quantos minutos por dia você terá até a prova (a reserva da discursiva sai antes);
 *  2. TRÊS TIPOS DE ITEM: ↻ REVISAR o que você já estudou (grifos + questões, as do caderno primeiro); ★ PRIMEIRO
 *     CONTATO nas lacunas de maior rendimento (questões primeiro, o resumo quando houver), mais curto que o estudo
 *     normal; 📚 lacuna SEM MATERIAL no app (estude pela sua fonte e marque);
 *  3. OS DIFÍCEIS: o tópico que VOCÊ marcou difícil (avaliação declarada, ainda válida) ganha o selo 🔥, vem primeiro
 *     na revisão da disciplina e, se o orçamento deixar, uma segunda passada na segunda metade; a disciplina com
 *     tópico difícil traz a contagem no cabeçalho;
 *  4. PISO NOS MÍNIMOS: por peso puro, 34 de 41 contatos iam para Tributário e Constitucional ficava com zero — com
 *     nota mínima eliminatória. Cada disciplina abaixo do mínimo recebe primeiro RV_PISO contatos; o resto vai pelo
 *     peso;
 *  5. O QUE FICA DE FORA é uma lista nomeada ("deixar de fora nesta prova"), não um silêncio;
 *  6. ESTÁVEL: os blocos ficam gravados (e entram no backup); o bloco não feito aparece como "ficou para trás"; o plano
 *     só se refaz quando você pede ("refazer a partir de hoje");
 *  7. A VÉSPERA É LEVE: só grifos, o bizu do caderno e os artigos que caem — nada novo.
 * ===================================================================== */
const RV_CHAVE = "eac_rv360";
const RV_DIAS = 15;              /* a partir de quantos dias antes da prova ela é oferecida */
const RV_PISO = 2;               /* primeiros contatos garantidos em cada disciplina abaixo do mínimo */
const RV_BLOCO_ALVO = 75;        /* minutos de um bloco (60–90) */
const RV_BLOCO_MAX = 95;
const RV_REV_MIN = 15, RV_REV_MAX = 40;        /* uma revisão: grifos + questões */
const RV_NOVO_MIN = 30, RV_NOVO_MAX = 45;      /* um primeiro contato */

function rvLer() {
  try { const v = JSON.parse(localStorage.getItem(RV_CHAVE) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  catch (e) { return {}; }
}
function rvGravar(m) { try { localStorage.setItem(RV_CHAVE, JSON.stringify(m || {})); return true; } catch (e) { return false; } }
function rvDoEdital(id) { return rvLer()[String(id)] || null; }
function rvApagar(id) { const m = rvLer(); delete m[String(id)]; rvGravar(m); }

function rvHoje() { return typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10); }
function rvSomarDias(iso, n) {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function rvDiasEntre(a, b) { return Math.round((new Date(String(b).slice(0, 10) + "T12:00:00") - new Date(String(a).slice(0, 10) + "T12:00:00")) / 86400000); }

/* o edital pode receber a 360°? { ok, dias, prova } — ativo, com data, a 15 dias ou menos (e não no dia da prova) */
function rvElegivel(e, hoje) {
  if (!e) return { ok: false };
  let s = null;
  try { s = edSituacao(e); } catch (err) { s = null; }
  if (!s || !s.prova || s.grupo === "encerrado") return { ok: false };
  const dias = rvDiasEntre(hoje || rvHoje(), s.prova);
  return { ok: dias >= 1 && dias <= RV_DIAS, dias, prova: s.prova };
}

/* quantos minutos por dia, de partida: a média dos dias em que você estudou nas últimas 2 semanas (mínimo 1 h),
 * arredondada para meia hora. A pessoa troca na tela — é a pergunta mais honesta da reta final. */
function rvMinDiaSugerido(hoje) {
  const h = hoje || rvHoje();
  const ini = rvSomarDias(h, -13);
  const porDia = {};
  ((typeof edDiario !== "undefined" && edDiario) || []).forEach((x) => {
    if (!x || !x.d || x.a === "pendente" || x.d < ini || x.d > h) return;
    porDia[x.d] = (porDia[x.d] || 0) + (Number(x.m) || 0);
  });
  const vs = Object.keys(porDia).map((k) => porDia[k]).filter((m) => m > 0);
  const media = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 120;
  return Math.max(60, Math.round(media / 30) * 30);
}

/* o tópico que VOCÊ marcou difícil (declarado e ainda válido — a marca vencida não pesa, ver dificuldade.js) */
function rvDificil(i) {
  if (!i) return false;
  try {
    if (typeof difDe === "function") { const d = difDe(i.disciplina, i.nome); if (d.nivel === "alta" && !d.vencida && d.origem !== "sessao") return true; }
  } catch (e) {}
  return (i.fator || 1) > 1 && i.fatorOrigem === "declarada";
}

/* o que o tópico tem no app para a revisão: { qs, temResumo, grifos, chaveMat } */
function rvMaterialDe(i, qsPorChave) {
  let chaveMat = i.topicoChave || "";
  try { if (typeof matChaveViva === "function") chaveMat = matChaveViva(i.disciplina, i.nome) || chaveMat; } catch (e) {}
  const r = typeof matObter === "function" ? matObter(chaveMat) : null;
  const txt = r ? String(r.texto || "") : "";
  const grifos = (txt.match(/==[!?§*~@]?(?:[^=\n]|=(?!=))+==/g) || []).length;
  const k = typeof qsChaveNormal === "function" ? qsChaveNormal(i.topicoChave || "") : (i.topicoChave || "");
  const qs = (qsPorChave && (qsPorChave[i.topicoChave] || qsPorChave[k])) || 0;
  return { qs, temResumo: !!txt.trim(), grifos, chaveMat };
}

/* =====================================================================
 * O MOTOR. opc: { minDia, hoje, plano (para teste), qsPorChave, emRisco }
 * Devolve o plano da 360° (sem gravar): { edital, criado, prova, minDia, reservaDia, dias: [{data, blocos}],
 * vespera, fora, resumo }
 * ===================================================================== */
function rvMontar(e, opc) {
  const o = opc || {};
  const hoje = o.hoje || rvHoje();
  const el = rvElegivel(e, hoje);
  if (!el.ok) return null;
  const r = lerEdital(e.texto || "");
  const plano = o.plano || montarPlano(r, { horas: (r.cfg && r.cfg.horas) || 10, prova: el.prova, feitos: e.progresso || {},
    modos: typeof hubModosLer === "function" ? hubModosLer() : null });
  const itens = (plano.itens || []).filter((i) => !i.fase2 || (plano.fase && plano.fase.n === 2) || true);
  const qsPorChave = o.qsPorChave || (typeof qsContarPorChave === "function" ? qsContarPorChave() : {});
  /* a reserva da discursiva sai do dia, às claras */
  let reservaSem = 0;
  try { reservaSem = typeof dagReservaMin === "function" ? dagReservaMin(e) : 0; } catch (err) { reservaSem = 0; }
  const minDia = Math.max(30, Math.round(Number(o.minDia) || rvMinDiaSugerido(hoje)));
  const reservaDia = Math.round(reservaSem / 7);
  const util = Math.max(30, minDia - reservaDia);
  /* os dias de bloco: de hoje até a antevéspera; a véspera é leve */
  const vespera = rvSomarDias(el.prova, -1);
  const datas = [];
  for (let d = hoje; d < vespera; d = rvSomarDias(d, 1)) datas.push(d);
  const orcamento = util * datas.length;
  /* disciplinas abaixo do mínimo (cobertura ou acerto) — o piso */
  let emRisco = o.emRisco;
  if (!emRisco) { try { emRisco = typeof edDiscEmRisco === "function" ? edDiscEmRisco(plano.blocos) : []; } catch (err) { emRisco = []; } }
  const risco = {};
  (emRisco || []).forEach((x) => { risco[x.disciplina] = x; });
  const fatia = plano.fatia || {};

  const tarefa = (i, tipo, passada) => {
    const mat = rvMaterialDe(i, qsPorChave);
    const min = tipo === "rev"
      ? Math.max(RV_REV_MIN, Math.min(RV_REV_MAX, Math.round((i.minutos || 45) / 3)))
      : Math.max(RV_NOVO_MIN, Math.min(RV_NOVO_MAX, Math.round((i.minutos || 45) / 2)));
    const semMaterial = tipo === "novo" && !mat.qs && !mat.temResumo;
    return { chave: i.chave, topicoChave: i.topicoChave, disciplina: i.disciplina, topico: i.nome, tipo: semMaterial ? "fonte" : tipo,
      passada: passada || 1, minutos: min, dificil: rvDificil(i), qs: mat.qs, grifos: mat.grifos, temResumo: mat.temResumo,
      bruto: i.bruto || 0, edital: e.id };
  };
  /* 1. as revisões: tudo o que já foi estudado, o difícil primeiro dentro da disciplina, depois o mais pesado */
  const estudados = itens.filter((i) => i.feito)
    .sort((a, b) => (rvDificil(b) - rvDificil(a)) || ((b.brutoOrdem || 0) - (a.brutoOrdem || 0)));
  const revs = estudados.map((i) => tarefa(i, "rev", 1));
  let usado = revs.reduce((a, x) => a + x.minutos, 0);
  /* 2. os primeiros contatos: o piso das disciplinas em risco, depois o peso (com a dificuldade dentro dele) */
  const lacunas = itens.filter((i) => !i.feito).sort((a, b) => (b.brutoOrdem || 0) - (a.brutoOrdem || 0));
  const novos = [];
  const pegou = new Set();
  const cabe = (x) => usado + x.minutos <= orcamento;
  /* em RODADAS: um contato para cada disciplina em risco, depois o segundo — com pouco tempo, a disciplina pesada não
   * leva os dois antes de a leve ganhar o primeiro */
  const emRiscoOrd = Object.keys(risco).sort((a, b) => (fatia[b] || 0) - (fatia[a] || 0));
  for (let rodada = 0; rodada < RV_PISO; rodada++) {
    emRiscoOrd.forEach((d) => {
      const i = lacunas.filter((y) => y.disciplina === d)[rodada];
      if (!i || pegou.has(i.chave)) return;
      const x = tarefa(i, "novo");
      if (!cabe(x)) return;
      x.piso = true;
      novos.push(x); pegou.add(i.chave); usado += x.minutos;
    });
  }
  lacunas.forEach((i) => {
    if (pegou.has(i.chave)) return;
    const x = tarefa(i, "novo");
    if (!cabe(x)) return;
    novos.push(x); pegou.add(i.chave); usado += x.minutos;
  });
  /* 3. a segunda passada dos difíceis, se sobrar orçamento (vai para a segunda metade) */
  const segundas = [];
  estudados.filter(rvDificil).forEach((i) => {
    const x = tarefa(i, "rev", 2);
    if (usado + x.minutos > orcamento) return;
    segundas.push(x); usado += x.minutos;
  });
  const fora = lacunas.filter((i) => !pegou.has(i.chave)).map((i) => ({ chave: i.chave, disciplina: i.disciplina, topico: i.nome, bruto: i.bruto || 0 }));

  /* 4. os blocos: cada bloco é UMA disciplina (o "bloco lógico" da técnica), revisões antes dos contatos; a próxima
   * disciplina é a mais atrasada em relação ao que lhe cabe (o mesmo rodízio por peso da agenda) */
  const fila = {};
  revs.concat(novos).forEach((x) => { (fila[x.disciplina] = fila[x.disciplina] || []).push(x); });
  const total = {};
  Object.keys(fila).forEach((d) => { total[d] = fila[d].reduce((a, x) => a + x.minutos, 0); });
  const feito = {};
  const blocosSeq = [];
  const proxDisc = () => {
    let melhor = null, mv = -Infinity;
    Object.keys(fila).forEach((d) => {
      if (!fila[d].length) return;
      const v = total[d] ? 1 - (feito[d] || 0) / total[d] : 0;
      const pv = v * 1000 + (fatia[d] || 0);
      if (pv > mv) { mv = pv; melhor = d; }
    });
    return melhor;
  };
  let d0;
  while ((d0 = proxDisc())) {
    const b = { disciplina: d0, itens: [], minutos: 0 };
    while (fila[d0].length && (b.minutos < RV_BLOCO_ALVO - 10 || !b.itens.length) && b.minutos + fila[d0][0].minutos <= RV_BLOCO_MAX) {
      const x = fila[d0].shift(); b.itens.push(x); b.minutos += x.minutos; feito[d0] = (feito[d0] || 0) + x.minutos;
    }
    if (!b.itens.length) { const x = fila[d0].shift(); b.itens.push(x); b.minutos += x.minutos; feito[d0] = (feito[d0] || 0) + x.minutos; }
    blocosSeq.push(b);
  }
  /* as segundas passadas, em blocos próprios, no fim */
  const fila2 = {};
  segundas.forEach((x) => { (fila2[x.disciplina] = fila2[x.disciplina] || []).push(x); });
  Object.keys(fila2).forEach((d) => {
    let b = null;
    fila2[d].forEach((x) => {
      if (!b || b.minutos + x.minutos > RV_BLOCO_MAX) { b = { disciplina: d, itens: [], minutos: 0, segunda: true }; blocosSeq.push(b); }
      b.itens.push(x); b.minutos += x.minutos;
    });
  });
  /* 5. os dias: enche cada dia até o útil (um bloco passa um pouco, nunca mais de meio bloco) */
  const dias = datas.map((data) => ({ data, blocos: [], minutos: 0 }));
  let k = 0;
  blocosSeq.forEach((b, n) => {
    b.id = "R" + (n + 1);
    while (k < dias.length - 1 && dias[k].minutos && dias[k].minutos + b.minutos > util + RV_BLOCO_ALVO / 2) k++;
    b.dia = dias[k].data;
    dias[k].blocos.push(b); dias[k].minutos += b.minutos;
  });
  const pesoTot = (plano.peso && plano.peso.total) || itens.reduce((a, i) => a + (i.bruto || 0), 0) || 1;
  const pesoFeito = (plano.peso && plano.peso.feito) || 0;
  const pesoNovos = novos.reduce((a, x) => a + x.bruto, 0);
  const discs = {};
  itens.forEach((i) => {
    const D = discs[i.disciplina] = discs[i.disciplina] || { dificeis: 0, emRisco: !!risco[i.disciplina], fatia: fatia[i.disciplina] || 0 };
    if (rvDificil(i)) D.dificeis++;
  });
  return {
    edital: e.id, nome: e.nome || "", criado: hoje, prova: el.prova, minDia, reservaDia, util, vespera,
    dias: dias.filter((d) => d.blocos.length), fora, discs,
    resumo: {
      revisoes: revs.length, segundas: segundas.length, novos: novos.length, piso: novos.filter((x) => x.piso).length,
      fonte: novos.filter((x) => x.tipo === "fonte").length, dificeis: revs.filter((x) => x.dificil).length, fora: fora.length,
      pctAntes: Math.round((pesoFeito / pesoTot) * 100), pctDepois: Math.round(((pesoFeito + pesoNovos) / pesoTot) * 100),
      orcamento, usado, blocos: blocosSeq.length,
    },
  };
}

/* montar e gravar (substitui o anterior do mesmo edital) */
function rvCriar(e, opc) {
  const p = rvMontar(e, opc);
  if (!p) return null;
  const m = rvLer();
  m[String(e.id)] = p;
  rvGravar(m);
  try { reg("EDITAL-PROGRESSO", "revisão 360° montada: " + (e.nome || ""), p.resumo.blocos + " blocos · " + p.resumo.revisoes + " revisões · " + p.resumo.novos + " contatos · " + p.resumo.fora + " de fora"); } catch (err) {}
  return p;
}

/* um item está feito? há registro no diário do tópico (estudo ou revisão) a partir da criação do plano; a segunda
 * passada pede dois registros */
function rvItemFeito(p, x, diario) {
  const regs = (diario || (typeof edDiario !== "undefined" && edDiario) || [])
    .filter((y) => y && y.c === x.chave && y.a && y.a !== "pendente" && String(y.d || "") >= p.criado);
  return regs.length >= (x.passada || 1);
}
function rvBlocoFeito(p, b, diario) { return b.itens.every((x) => rvItemFeito(p, x, diario)); }
/* o estado do plano hoje: { hoje: [blocos], atrasados: [blocos], feitos, total, vespera (bool) } */
function rvEstado(p, hoje, diario) {
  const h = hoje || rvHoje();
  const todos = [];
  (p.dias || []).forEach((d) => d.blocos.forEach((b) => todos.push(b)));
  const feitos = todos.filter((b) => rvBlocoFeito(p, b, diario));
  return {
    hoje: todos.filter((b) => b.dia === h),
    atrasados: todos.filter((b) => b.dia < h && feitos.indexOf(b) < 0),
    feitos: feitos.length, total: todos.length, vespera: h === p.vespera, provaPassou: h >= p.prova,
  };
}

/* "✓ feito" de um item: o mesmo registro da agenda (edMarcar), no edital dono; revisão → "revisado", contato → "feito" */
function rvMarcarFeito(p, x) {
  const e = (typeof editais !== "undefined" ? editais : []).filter((y) => String(y.id) === String(p.edital))[0];
  if (!e) return false;
  const r = lerEdital(e.texto || "");
  let item = null;
  try {
    const pl = montarPlano(r, { horas: (r.cfg && r.cfg.horas) || 10, prova: p.prova, feitos: e.progresso || {} });
    item = (pl.itens || []).filter((i) => i.chave === x.chave)[0] || null;
  } catch (err) { item = null; }
  if (!item) return false;
  item.edital = e.id;
  const estado = x.tipo === "rev" ? "revisado" : "feito";
  edMarcar(item, estado, { minutos: x.minutos, origem: "rv360" }, true);
  return true;
}

/* =====================================================================
 * A TELA: o aviso na agenda e a janela dos blocos
 * ===================================================================== */
function rvEditalDaVez() {
  const lista = (typeof editais !== "undefined" ? editais : []).map((e) => ({ e, el: rvElegivel(e) })).filter((x) => x.el.ok);
  lista.sort((a, b) => a.el.dias - b.el.dias);
  return lista[0] || null;
}
/* o aviso no alto da agenda (o elemento, ou null) */
function rvAvisoEl() {
  const v = rvEditalDaVez();
  if (!v) return null;
  const p = rvDoEdital(v.e.id);
  const av = document.createElement("div");
  av.className = "rv-aviso"; av.id = "rvAviso";
  const tx = document.createElement("span");
  tx.className = "rv-aviso-txt";
  const bt = document.createElement("button");
  bt.type = "button"; bt.className = "btn-min btn-min-ok"; bt.id = "btnRvAbrir";
  if (p && p.prova === v.el.prova) {
    const st = rvEstado(p);
    tx.textContent = t("rv_aviso_em_curso", { e: v.e.nome || "", d: v.el.dias, f: st.feitos, n: st.total, h: st.hoje.length })
      + (st.atrasados.length ? " · " + t("rv_aviso_atrasados", { n: st.atrasados.length }) : "");
    bt.textContent = t("rv_abrir");
  } else {
    tx.textContent = t("rv_aviso_novo", { e: v.e.nome || "", d: v.el.dias });
    bt.textContent = t("rv_montar");
  }
  bt.title = t("rv_tip");
  bt.onclick = () => rvAbrir(v.e.id);
  av.append(tx, bt);
  return av;
}

let rvAbertoId = null;
let rvPrevia = null;            /* o plano montado e ainda não gravado (a prévia antes de confirmar) */
function rvAbrir(id) {
  rvAbertoId = String(id);
  rvPrevia = null;
  rvPintar();
  const fe = typeof document !== "undefined" ? document.getElementById("btnRvFechar") : null;
  if (fe) fe.onclick = () => { const d = document.getElementById("dlgRv360"); if (d && d.close) d.close(); rvPrevia = null; };
  if (typeof abrirModal === "function") abrirModal("dlgRv360");
  return true;
}
function rvEdital() { return (typeof editais !== "undefined" ? editais : []).filter((e) => String(e.id) === rvAbertoId)[0] || null; }
const rvTipoIco = { rev: "↻", novo: "★", fonte: "📚" };

function rvItemEl(p, x, diario) {
  const li = document.createElement("div");
  const feito = rvItemFeito(p, x, diario);
  li.className = "rv-item rv-" + x.tipo + (feito ? " rv-feito" : "");
  const nm = document.createElement("span");
  nm.className = "rv-item-nome";
  nm.textContent = (feito ? "✓ " : rvTipoIco[x.tipo] + " ") + x.topico + (x.passada > 1 ? " " + t("rv_segunda") : "");
  li.append(nm);
  const sel = document.createElement("span");
  sel.className = "rv-selos";
  const selo = (txt, cls, tip) => { const s = document.createElement("span"); s.className = "rv-selo " + cls; s.textContent = txt; if (tip) s.title = tip; sel.append(s); };
  if (x.dificil) selo(t("rv_selo_dificil"), "rv-selo-dif", t("rv_selo_dificil_tip"));
  if (x.piso) selo(t("rv_selo_piso"), "rv-selo-piso", t("rv_selo_piso_tip"));
  selo(t("rv_min", { m: x.minutos }), "rv-selo-min");
  li.append(sel);
  const ac = document.createElement("span");
  ac.className = "rv-acoes";
  const b = (id, txt, tip, fn) => { const bt = document.createElement("button"); bt.type = "button"; bt.className = "btn-min"; bt.id = id; bt.textContent = txt; if (tip) bt.title = tip; bt.onclick = fn; ac.append(bt); return bt; };
  const sufixo = String(x.chave).replace(/[^a-z0-9]+/gi, "_").slice(0, 60) + "_" + (x.passada || 1);
  if (x.tipo !== "fonte" && x.temResumo) {
    b("btnRvGrifos_" + sufixo, x.grifos ? t("rv_bt_grifos", { n: x.grifos }) : t("rv_bt_resumo"), t("rv_bt_grifos_tip"), () => rvIrResumo(x));
  }
  if (x.tipo !== "fonte" && x.qs) b("btnRvQs_" + sufixo, t("rv_bt_questoes", { n: x.qs }), t("rv_bt_questoes_tip"), () => rvIrQuestoes(x));
  /* na prévia (ainda não montada) não há o que marcar: o plano nem existe */
  if (!feito && !rvPrevia) {
    const bf = b("btnRvFeito_" + sufixo, t(x.tipo === "rev" ? "rv_bt_revisei" : "rv_bt_estudei"), t(x.tipo === "rev" ? "rv_bt_revisei_tip" : "rv_bt_estudei_tip"), () => {
      if (rvMarcarFeito(p, x)) { try { toastMsg(t("rv_marcado", { t: x.topico }), 2500); } catch (e) {} }
      rvPintar();
      try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
    });
    bf.className = "btn-min btn-min-ok";
  }
  li.append(ac);
  return li;
}
function rvIrResumo(x) {
  const dlg = typeof document !== "undefined" ? document.getElementById("dlgRv360") : null;
  if (dlg && dlg.open && dlg.close) dlg.close();
  try { if (typeof matAbrirEditor === "function") matAbrirEditor({ disciplina: x.disciplina, nome: x.topico }, "ler"); } catch (e) {}
  try { if (x.grifos && typeof matSoGrifosAlternar === "function") matSoGrifosAlternar(true); } catch (e) {}
}
function rvIrQuestoes(x) {
  const dlg = typeof document !== "undefined" ? document.getElementById("dlgRv360") : null;
  if (dlg && dlg.open && dlg.close) dlg.close();
  try { if (typeof qsUiResponderDireto === "function") qsUiResponderDireto(x.disciplina, x.topico); } catch (e) {}
}
function rvBlocoEl(p, b, diario, aberto) {
  const det = document.createElement("details");
  const feito = rvBlocoFeito(p, b, diario);
  det.className = "rv-bloco" + (feito ? " rv-bloco-feito" : "");
  det.id = "rvBloco_" + b.id;
  if (aberto && !feito) det.open = true;
  const sm = document.createElement("summary");
  const D = (p.discs || {})[b.disciplina] || {};
  sm.textContent = (feito ? "✓ " : "") + b.id + " · " + b.disciplina + " · " + t("rv_min", { m: b.minutos })
    + (b.segunda ? " · " + t("rv_segunda") : "")
    + (D.dificeis ? " · " + t("rv_disc_dificeis", { n: D.dificeis }) : "")
    + (D.emRisco ? " · " + t("rv_disc_risco") : "");
  det.append(sm);
  const nota = document.createElement("p");
  nota.className = "nota rv-como";
  nota.textContent = t("rv_como");
  det.append(nota);
  b.itens.forEach((x) => det.append(rvItemEl(p, x, diario)));
  return det;
}
function rvPintar() {
  const box = typeof document !== "undefined" ? document.getElementById("rvCorpo") : null;
  if (!box) return;
  box.innerHTML = "";
  const e = rvEdital();
  if (!e) return;
  const el = rvElegivel(e);
  const gravado = rvDoEdital(e.id);
  const p = rvPrevia || gravado;
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const tit = typeof document !== "undefined" ? document.getElementById("rvTitulo") : null;
  if (tit) tit.textContent = t("rv_titulo", { e: e.nome || "", d: el.dias != null ? el.dias : "?" });
  /* o orçamento: minutos por dia */
  const cfg = document.createElement("div");
  cfg.className = "rv-cfg";
  const lb = document.createElement("label");
  lb.textContent = t("rv_min_dia");
  const sel = document.createElement("select");
  sel.id = "rvMinDia";
  const atual = (p && p.minDia) || rvMinDiaSugerido();
  for (let m = 60; m <= 600; m += 30) {
    const op = document.createElement("option"); op.value = String(m); op.textContent = (m / 60).toString().replace(".5", "h30").replace(/^(\d+)$/, "$1h"); if (m === atual) op.selected = true; sel.append(op);
  }
  sel.value = String(atual);
  sel.onchange = () => { rvPrevia = rvMontar(e, { minDia: Number(sel.value) }); rvPintar(); };
  lb.append(sel);
  cfg.append(lb);
  if (!p) {
    rvPrevia = rvMontar(e, { minDia: atual });
    rvPintar();
    return;
  }
  const R = p.resumo;
  const res = document.createElement("p");
  res.className = "rv-resumo"; res.id = "rvResumo";
  res.textContent = t("rv_resumo", { b: R.blocos, r: R.revisoes, n: R.novos, f: R.fora, a: R.pctAntes, d: R.pctDepois, h: Math.round(R.usado / 60) })
    + (R.dificeis ? " " + t("rv_resumo_dif", { n: R.dificeis, s: R.segundas }) : "")
    + (R.piso ? " " + t("rv_resumo_piso", { n: R.piso }) : "")
    + (p.reservaDia ? " " + t("rv_resumo_disc", { m: p.reservaDia }) : "");
  cfg.append(res);
  box.append(cfg);
  if (rvPrevia) {
    const bt = document.createElement("button");
    bt.type = "button"; bt.className = "btn btn-verde"; bt.id = "btnRvConfirmar";
    bt.textContent = t(gravado ? "rv_refazer_ok" : "rv_confirmar");
    bt.onclick = () => { rvCriar(e, { minDia: p.minDia }); rvPrevia = null; rvPintar(); try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (x) {} };
    box.append(bt);
  } else {
    const st = rvEstado(p, null, diario);
    const est = document.createElement("p");
    est.className = "rv-estado"; est.id = "rvEstado";
    est.textContent = t("rv_estado", { f: st.feitos, n: st.total }) + (st.atrasados.length ? " · " + t("rv_aviso_atrasados", { n: st.atrasados.length }) : "");
    box.append(est);
    const bRef = document.createElement("button");
    bRef.type = "button"; bRef.className = "btn-min"; bRef.id = "btnRvRefazer";
    bRef.textContent = t("rv_refazer"); bRef.title = t("rv_refazer_tip");
    bRef.onclick = () => { rvPrevia = rvMontar(e, { minDia: Number(sel.value) || p.minDia }); rvPintar(); };
    box.append(bRef);
  }
  const h = rvHoje();
  const st = rvEstado(p, h, diario);
  if (!rvPrevia && st.atrasados.length) {
    const sec = document.createElement("div"); sec.className = "rv-dia rv-atrasados"; sec.id = "rvAtrasados";
    const hd = document.createElement("div"); hd.className = "rv-dia-tit"; hd.textContent = t("rv_atrasados_tit");
    sec.append(hd);
    st.atrasados.forEach((b) => sec.append(rvBlocoEl(p, b, diario, true)));
    box.append(sec);
  }
  (p.dias || []).forEach((d) => {
    const sec = document.createElement("div"); sec.className = "rv-dia" + (d.data === h ? " rv-hoje" : "");
    const hd = document.createElement("div"); hd.className = "rv-dia-tit";
    hd.textContent = (d.data === h ? t("rv_hoje") + " · " : "") + d.data.split("-").reverse().join("/") + " · " + t("rv_min", { m: d.minutos });
    sec.append(hd);
    d.blocos.forEach((b) => sec.append(rvBlocoEl(p, b, diario, d.data === h)));
    box.append(sec);
  });
  /* a véspera */
  const vs = document.createElement("div"); vs.className = "rv-dia rv-vespera"; vs.id = "rvVespera";
  const vh = document.createElement("div"); vh.className = "rv-dia-tit"; vh.textContent = t("rv_vespera_tit", { d: p.vespera.split("-").reverse().join("/") });
  const vp = document.createElement("p"); vp.className = "nota"; vp.textContent = t("rv_vespera");
  vs.append(vh, vp);
  const bBizu = document.createElement("button"); bBizu.type = "button"; bBizu.className = "btn-min"; bBizu.id = "btnRvBizu"; bBizu.textContent = t("rv_vespera_bizu");
  bBizu.onclick = () => {
    const dlg = document.getElementById("dlgRv360"); if (dlg && dlg.open && dlg.close) dlg.close();
    try { if (typeof qsUiCadernoAbrir === "function") { if (!(typeof qsUiFiltro !== "undefined" && qsUiFiltro.caderno)) qsUiCadernoAbrir(); if (typeof qsUiBizuAberto !== "undefined" && !qsUiBizuAberto) qsUiBizuAlternar(); } } catch (x) {}
  };
  vs.append(bBizu);
  box.append(vs);
  /* o que fica de fora */
  if (p.fora && p.fora.length) {
    const df = document.createElement("details"); df.className = "rv-fora"; df.id = "rvFora";
    const sf = document.createElement("summary"); sf.textContent = t("rv_fora_tit", { n: p.fora.length });
    df.append(sf);
    const nf = document.createElement("p"); nf.className = "nota"; nf.textContent = t("rv_fora_txt"); df.append(nf);
    const porD = {};
    p.fora.forEach((x) => { (porD[x.disciplina] = porD[x.disciplina] || []).push(x.topico); });
    Object.keys(porD).forEach((d) => { const li = document.createElement("div"); li.className = "rv-fora-lin"; li.textContent = d + " (" + porD[d].length + "): " + porD[d].join("; "); df.append(li); });
    box.append(df);
  }
  /* os outros editais na agenda até a prova */
  const outros = (typeof editais !== "undefined" ? editais : []).filter((x) => String(x.id) !== String(e.id) && typeof edSituacao === "function" && edSituacao(x).grupo !== "encerrado");
  if (outros.length && typeof hubEdOcultosLer === "function") {
    const ocultos = hubEdOcultosLer();
    const todosFora = outros.every((x) => ocultos.indexOf(String(x.id)) >= 0);
    const bo = document.createElement("button"); bo.type = "button"; bo.className = "btn-min"; bo.id = "btnRvSoEste";
    bo.textContent = t(todosFora ? "rv_outros_voltar" : "rv_outros_pausar", { e: e.nome || "" });
    bo.title = t("rv_outros_tip");
    bo.onclick = () => {
      const lst = hubEdOcultosLer();
      outros.forEach((x) => { const k = lst.indexOf(String(x.id)); if (todosFora && k >= 0) lst.splice(k, 1); if (!todosFora && k < 0) lst.push(String(x.id)); });
      try { hubEdOcultos = lst; hubEdOcultosGravar(); } catch (err) {}
      rvPintar();
      try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (err) {}
    };
    box.append(bo);
  }
}
