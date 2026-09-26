/* =====================================================================
 * DOMÍNIO DO ASSUNTO: o quanto EU confio no que estudei, por disciplina, tópico e ramo
 *
 * O app mede coisas diferentes e não as mistura num número inventado ("dois números que não se misturam"). Aqui os
 * SINAIS ficam lado a lado e só o NÍVEL (a cor) é derivado, por uma regra escrita e com o motivo à vista:
 *
 *   ESTUDO       nunca · estudado · revisado, com a data e se a revisão VENCEU (o plano)
 *   QUESTÕES     % de acerto nas ÚLTIMAS tentativas do tópico (janela recente), com amostra mínima
 *   CARTÕES      retenção recente: das últimas notas dos cartões, quantas foram "lembrei" (Difícil, Bom ou Fácil)
 *   AUTOAVALIAÇÃO inseguro · médio · domino (o que a pessoa declarou, e vence em 45 dias)
 *
 * PRECEDÊNCIA (a primeira que valer):
 *   1. VERMELHO  — qualquer sinal MEDIDO abaixo do corte de risco, ou "inseguro" vigente. Vale mesmo que a pessoa tenha
 *                  estudado hoje: estudar recentemente não desmente um erro.
 *   2. CINZA     — nunca estudado e sem nenhum sinal.
 *   3. AMARELO   — a revisão do plano VENCEU (contra a ilusão de que "estudei, então sei"), motivo "revisão vencida".
 *   4. AZUL      — estudado no prazo, mas SEM amostra suficiente (questões ou cartões): "estudado, não medido".
 *   5. AMARELO   — desempenho mediano (acerto entre os dois cortes, retenção entre os dois cortes).
 *   6. VERDE     — todo sinal medido sólido, dentro do prazo de revisão.
 *   O que a pessoa DECLARA ("domino") nunca anula o que foi MEDIDO: se marcou domino e acerta 40%, é vermelho, e o motivo
 *   diz a divergência. "Domino" só aparece como nota ao lado do azul.
 *
 * RAMO: não tem acerto próprio (as questões são do tópico) — herda o do tópico, marcado como HERDADO.
 * Funções PURAS: recebem as entradas já reunidas (`domEntradas` reúne, e é a única que lê o app).
 * ===================================================================== */
const DOM = {
  janela: 10,            /* últimas tentativas de questões consideradas */
  minQuestoes: 5,        /* amostra mínima dentro da janela */
  acertoRisco: 60, acertoSeguro: 75,
  minRespostas: 10,      /* respostas de cartões (as últimas de cada um) para a retenção valer */
  retencaoRisco: 70, retencaoSeguro: 85,
  fatores: { vermelho: 3, amarelo: 2, cinza: 2, azul: 1.5, verde: 0 },   /* só ORDENAM "o que reforçar primeiro" */
};
/* OS CORTES SÃO AJUSTÁVEIS (guardados no navegador). Só valem os que fazem sentido: 1 a 99 e risco menor que seguro. */
const DOM_CH_LIM = "eac_dom_limites";
function domLimitesLer() {
  const pad = { acertoRisco: DOM.acertoRisco, acertoSeguro: DOM.acertoSeguro, retencaoRisco: DOM.retencaoRisco, retencaoSeguro: DOM.retencaoSeguro };
  let j = {};
  try { j = JSON.parse(localStorage.getItem(DOM_CH_LIM) || "{}") || {}; } catch (e) { j = {}; }
  const ok = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 99 ? n : null; };
  const out = {};
  [["acertoRisco", "acertoSeguro"], ["retencaoRisco", "retencaoSeguro"]].forEach(([r, s]) => {
    const a = ok(j[r]), b = ok(j[s]);
    out[r] = a !== null ? a : pad[r]; out[s] = b !== null ? b : pad[s];
    if (out[r] >= out[s]) { out[r] = pad[r]; out[s] = pad[s]; }      /* corte de risco tem de ser MENOR que o de segurança */
  });
  return out;
}
function domLimitesGravar(l) {
  try { localStorage.setItem(DOM_CH_LIM, JSON.stringify(l)); } catch (e) {}
  return domLimitesLer();
}
const DOM_NIVEIS = ["vermelho", "amarelo", "cinza", "azul", "verde"];   /* do pior ao melhor, para o "pior dos ramos" */

/* Acerto RECENTE de um tópico: as últimas `janela` tentativas (sem data = as mais antigas). */
function domAcerto(tentativas, opc) {
  const o = Object.assign({}, DOM, opc || {});
  const todas = (tentativas || []).filter((t) => t && typeof t.acertou === "boolean");
  const ord = todas.map((t, i) => ({ t, i })).sort((a, b) => (String(a.t.q || "") < String(b.t.q || "") ? -1 : (String(a.t.q || "") > String(b.t.q || "") ? 1 : a.i - b.i))).map((x) => x.t);
  const rec = ord.slice(-o.janela);
  const certas = rec.filter((t) => t.acertou).length;
  const totalCertas = todas.filter((t) => t.acertou).length;
  return {
    n: rec.length, certas, pct: rec.length ? (certas / rec.length) * 100 : null,
    valido: rec.length >= o.minQuestoes,
    historicoN: todas.length, historicoPct: todas.length ? (totalCertas / todas.length) * 100 : null,
  };
}

/* Retenção RECENTE dos cartões: junta as últimas notas (`h`) de cada cartão; nota 1 = não lembrei. */
function domRetencao(regs, opc) {
  const o = Object.assign({}, DOM, opc || {});
  let resp = 0, lembrou = 0, semHist = 0, maduros = 0;
  const lista = (regs || []).filter(Boolean);
  lista.forEach((r) => {
    if ((r.iv || 0) >= 21 && r.s === "review") maduros++;
    if (!r.h || !r.h.length) { semHist++; return; }
    r.h.forEach((n) => { resp++; if (n >= 2) lembrou++; });
  });
  return { cartoes: lista.length, respostas: resp, pct: resp ? (lembrou / resp) * 100 : null, valido: resp >= o.minRespostas, semHistorico: semHist, maduros };
}

/* O NÍVEL de uma folha a partir dos sinais.
 *   s = { estudo: {estado, dias, venceu}, acerto, retencao, auto: {nivel, vencida}, herdadoAcerto }  */
function domNivel(s, opc) {
  const o = Object.assign({}, DOM, opc || {});
  const est = (s && s.estudo) || { estado: "nunca" };
  const ac = s && s.acerto && s.acerto.valido ? s.acerto : null;
  const rt = s && s.retencao && s.retencao.valido ? s.retencao : null;
  const au = s && s.auto && s.auto.nivel && !s.auto.vencida ? s.auto.nivel : null;
  const motivos = [];
  const vermelhos = [], medianos = [], solidos = [];
  if (ac) {
    if (ac.pct < o.acertoRisco) vermelhos.push({ cod: "acerto_baixo", pct: Math.round(ac.pct), n: ac.n });
    else if (ac.pct < o.acertoSeguro) medianos.push({ cod: "acerto_mediano", pct: Math.round(ac.pct), n: ac.n });
    else solidos.push({ cod: "acerto_solido", pct: Math.round(ac.pct), n: ac.n });
  }
  if (rt) {
    if (rt.pct < o.retencaoRisco) vermelhos.push({ cod: "retencao_baixa", pct: Math.round(rt.pct), n: rt.respostas });
    else if (rt.pct < o.retencaoSeguro) medianos.push({ cod: "retencao_mediana", pct: Math.round(rt.pct), n: rt.respostas });
    else solidos.push({ cod: "retencao_solida", pct: Math.round(rt.pct), n: rt.respostas });
  }
  if (au === "alta") vermelhos.push({ cod: "inseguro" });
  if (au === "baixa" && vermelhos.length) motivos.push({ cod: "divergencia_domino" });   /* declarou domino, mas o medido diz o contrário */
  const medido = !!(ac || rt);
  const estudado = est.estado !== "nunca" || medido;
  const nota = au === "baixa" ? [{ cod: "declarou_domino" }] : [];
  /* vermelho vence, mas a revisão vencida continua à vista (o filtro "revisão vencida" e a tooltip a mostram) */
  if (vermelhos.length) return { nivel: "vermelho", motivos: vermelhos.concat(motivos, est.venceu ? [{ cod: "revisao_vencida", dias: est.dias }] : []), semMarcaEstudo: est.estado === "nunca" };
  if (!estudado && !au) return { nivel: "cinza", motivos: [{ cod: "nunca_estudado" }] };
  if (!estudado) return { nivel: "cinza", motivos: [{ cod: "nunca_estudado" }].concat(nota) };
  if (est.venceu) return { nivel: "amarelo", motivos: [{ cod: "revisao_vencida", dias: est.dias }].concat(medianos, solidos) };
  if (!medido) return { nivel: "azul", motivos: [{ cod: "nao_medido" }].concat(nota) };
  if (medianos.length) return { nivel: "amarelo", motivos: medianos.concat(solidos) };
  return { nivel: "verde", motivos: solidos, semMarcaEstudo: est.estado === "nunca" };
}

/* O mapa de domínio: usa a estrutura e o PESO da cobertura (covMapa) e pendura em cada folha os sinais e o nível.
 *   cob:      resultado de covMapa(...) (disciplinas › tópicos › ramos, com pesoPct)
 *   entradas: { estudo: {chave|chave›#ramo → {estado, dias, venceu, quando, pulado, herdado}},
 *               tentativas: {chave → [{q, acertou}]}, cartoes: {chave → {ramoId|"" → [registros]}}, auto: {chave → {nivel, vencida}} } */
function domMapa(cob, entradas, opc) {
  const o = Object.assign({}, DOM, opc || {});
  const E = entradas || {};
  const est = E.estudo || {}, tent = E.tentativas || {}, car = E.cartoes || {}, aut = E.auto || {};
  const distrib = () => ({ vermelho: 0, amarelo: 0, cinza: 0, azul: 0, verde: 0 });
  const geral = distrib();
  const folhas = [];
  const daFolha = (f, chave, ramoId, topicoTemRamos) => {
    const eTop = est[chave] || { estado: "nunca" };
    const eRamo = ramoId ? est[chave + "›#" + ramoId] : null;
    const estudo = eRamo || eTop;
    if (estudo.pulado) return { pulado: true };
    const regs = topicoTemRamos
      ? ((car[chave] || {})[ramoId] || [])
      : Object.keys(car[chave] || {}).reduce((a, k) => a.concat(car[chave][k]), []);
    const acerto = domAcerto(tent[chave], o);
    const retencao = domRetencao(regs, o);
    const autoRamo = ramoId ? aut[chave + "›#" + ramoId] : null;
    const auto = autoRamo || aut[chave] || null;
    const autoHerdada = !!ramoId && !autoRamo && !!aut[chave];
    const r = domNivel({ estudo, acerto, retencao, auto }, o);
    return Object.assign({ sinais: { estudo, acerto, retencao, auto }, herdadoAcerto: !!ramoId, autoHerdada }, r);
  };
  const disciplinas = cob.disciplinas.map((d) => {
    const dist = distrib();
    const topicos = d.topicos.map((t) => {
      const temRamos = t.ramos.length > 0;
      let nivelTopo = null, unica = null;
      const leaves = temRamos ? t.ramos : [t];
      const outRamos = [];
      leaves.forEach((f) => {
        const x = daFolha(f, t.chave, temRamos ? f.ramoId : "", temRamos);
        if (x.pulado) { if (temRamos) outRamos.push(Object.assign({}, f, { pulado: true, nivel: "pulado", motivos: [] })); return; }
        const peso = (f.pesoPct || 0);
        dist[x.nivel] += peso; geral[x.nivel] += peso;
        const folha = Object.assign({}, f, x, { tipo: temRamos ? "ramo" : "topico", disciplina: d.nome, topico: t.nome, chave: t.chave });
        folhas.push(folha);
        if (temRamos) outRamos.push(folha); else unica = folha;
        if (nivelTopo === null || DOM_NIVEIS.indexOf(x.nivel) < DOM_NIVEIS.indexOf(nivelTopo)) nivelTopo = x.nivel;
      });
      const topico = { nome: t.nome, chave: t.chave, pesoPct: t.pesoPct, fase2: t.fase2, cartoes: t.cartoes, nivel: nivelTopo || "pulado", ramos: outRamos };
      if (unica) { topico.sinais = unica.sinais; topico.motivos = unica.motivos; }
      return topico;
    });
    return { nome: d.nome, pesoPct: d.pesoPct, distribuicao: dist, topicos };
  });
  /* "O que reforçar primeiro": urgência = peso × fator do nível (os fatores só ORDENAM; verde não entra) */
  const reforcar = folhas.filter((f) => (o.fatores[f.nivel] || 0) > 0)
    .map((f) => Object.assign({}, f, { urgencia: (f.pesoPct || 0) * o.fatores[f.nivel] }))
    .sort((a, b) => (b.urgencia - a.urgencia) || (b.pesoPct - a.pesoPct));
  const soma = DOM_NIVEIS.reduce((a, k) => a + geral[k], 0) || 1;
  const resumo = { distribuicao: geral, semEstudoPct: geral.cinza, vermelhoPct: geral.vermelho, folhas: folhas.length, total: soma };
  return { disciplinas, folhas, reforcar, resumo, base: cob.base, fase: cob.fase };
}

/* o nome com que a autoavaliação de um RAMO é guardada no módulo de dificuldade */
function domChaveAuto(topico, ramoId) { return String(topico) + "›#" + String(ramoId); }

/* REÚNE as entradas do app para um edital (a única função daqui que lê o resto do sistema). */
function domEntradas(ed, plano, notas, banco, regs) {
  const estudo = {}, tentativas = {}, cartoes = {}, auto = {};
  (plano.itens || []).forEach((i) => {
    const chave = matChaveViva(i.disciplina, i.nome);
    const venceu = (x) => x.feito && !x.revisado && (x.dias === null || x.dias === undefined || x.dias >= REV_DIAS);
    estudo[chave] = { estado: i.revisado ? "revisado" : (i.feito ? "estudado" : "nunca"), quando: i.quando || null, dias: i.dias === undefined ? null : i.dias, venceu: venceu(i) };
    (i.ramos || []).forEach((r) => {
      estudo[chave + "›#" + r.id] = { estado: r.revisado ? "revisado" : (r.feito ? "estudado" : "nunca"), quando: r.quando || null, dias: r.dias === undefined ? null : r.dias, venceu: venceu(r), pulado: !!r.pulado, herdado: !!r.marcaHerdada };
    });
    try { const d = difDe(i.disciplina, i.nome); if (d && d.nivel) auto[chave] = { nivel: d.nivel, vencida: !!d.vencida, dias: d.dias }; } catch (e) {}
    /* autoavaliação por RAMO: guardada como um "tópico" de nome tópico›#ramo, só para o Domínio (não mexe na fila do plano) */
    (i.ramos || []).forEach((r) => {
      try { const d = difDe(i.disciplina, domChaveAuto(i.nome, r.id)); if (d && d.nivel) auto[chave + "›#" + r.id] = { nivel: d.nivel, vencida: !!d.vencida, dias: d.dias }; } catch (e) {}
    });
  });
  (banco || []).forEach((q) => {
    if (!q || !q.disciplina || !q.topico) return;
    const chave = matChaveViva(q.disciplina, q.topico);
    (tentativas[chave] = tentativas[chave] || []).push(...(q.tentativas || []).map((t) => ({ q: t.q, acertou: !!t.acertou })));
  });
  (notas || []).forEach((n) => {
    const ramo = typeof ramIdDoCartao === "function" ? ramIdDoCartao(n.card) : "";
    estcUnidades([{ nota: n, pos: 0 }]).forEach((u) => {
      const r = (regs || {})[u.id];
      if (!r) return;
      const m = (cartoes[n.chave] = cartoes[n.chave] || {});
      (m[ramo] = m[ramo] || []).push(r);
    });
  });
  return { estudo, tentativas, cartoes, auto };
}

/* O mapa de UM edital, com os dados de agora. */
function domDoEdital(ed, opc) {
  const r = lerEdital((ed && ed.texto) || "");
  const notas = cqLerBiblioteca();
  const cob = covMapa(r.disciplinas, covContar(notas), (d, t) => matChaveViva(d, t), Object.assign({}, opc || {}));
  const plano = montarPlano(r, { horas: (r.cfg || {}).horas || 10, prova: (r.cfg || {}).prova, feitos: (ed && ed.progresso) || {} });
  const regs = estcLerJSON(ESTC_CH_REGS, {});
  const banco = typeof qsTodas === "function" ? qsTodas() : [];
  return domMapa(cob, domEntradas(ed, plano, notas, banco, regs), Object.assign(domLimitesLer(), opc || {}));
}
