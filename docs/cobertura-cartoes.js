/* =====================================================================
 * COBERTURA DE CARTÕES: tenho cartões para TUDO o que o edital cobra, na proporção do PESO?
 *
 * A pergunta que a contagem sozinha não responde: "tenho 80 cartões de contratos e nenhum de concessões" — os
 * dois assuntos podem valer o mesmo na prova. Aqui cada tópico (e cada ramo dele) é comparado com o que o PESO
 * pede: o peso vira uma fatia do total, a fatia vira um alvo de cartões, e a distância entre o que existe e o
 * alvo vira uma faixa (vazio, pouco, ok, excesso).
 *
 * DUAS RÉGUAS, AS MESMAS DO PLANO: o peso do tópico é peso da disciplina × peso do tópico (o "bruto" do plano) e o
 * dos ramos é a divisão desse peso pela régua dos ramos (edPesosDosRamos). Nada de peso novo é inventado.
 *
 * O ALVO NÃO É SÓ PROPORCIONAL. Com 40 cartões espalhados por 200 tópicos a proporção pede 0,2 cartão por tópico,
 * o que não ensina nada. Por isso há também um MÍNIMO por folha (tópico sem ramos, ou ramo): abaixo dele é "pouco"
 * mesmo que a proporção esteja satisfeita. Excesso é o inverso: mais que o dobro do que o peso pede (e do mínimo).
 *
 * FOLHAS: o tópico sem ramos, ou cada ramo. É nelas que se mede "onde falta", para o mesmo cartão não contar duas vezes.
 * Função pura: recebe o plano lido (lerEdital) e as contagens; não lê a tela nem grava nada.
 * ===================================================================== */
const COV = { minTopico: 5, minRamo: 3, pouco: 0.5, excesso: 2 };

/* faixa de UMA folha: n cartões, alvoProp = quanto a proporção do peso pede, min = o mínimo da folha */
function covFaixa(n, alvoProp, min) {
  if (!n) return "vazio";
  if (n < min) return "pouco";
  if (n < COV.pouco * alvoProp) return "pouco";
  if (n > COV.excesso * Math.max(alvoProp, min)) return "excesso";
  return "ok";
}

/* Conta os cartões da biblioteca (lista de cqLerBiblioteca) por tópico e por ramo. */
function covContar(notas) {
  const top = new Map(), ramo = new Map();
  (notas || []).forEach((n) => {
    top.set(n.chave, (top.get(n.chave) || 0) + 1);
    const id = typeof ramIdDoCartao === "function" ? ramIdDoCartao(n.card) : "";
    if (!id) return;
    if (!ramo.has(n.chave)) ramo.set(n.chave, new Map());
    const m = ramo.get(n.chave); m.set(id, (m.get(id) || 0) + 1);
  });
  return { top, ramo };
}

/* O mapa de cobertura.
 *   disciplinas: as do plano lido (lerEdital(...).disciplinas)
 *   cont:        { top: Map chave→n, ramo: Map chave→Map(idRamo→n) }
 *   chaveDe:     (disciplina, topico) → chave do material (matChaveViva)
 *   opc:         { minTopico, minRamo } para trocar os mínimos */
function covMapa(disciplinas, cont, chaveDe, opc) {
  const o = Object.assign({}, COV, opc || {});
  const ct = (cont && cont.top) || new Map(), cr = (cont && cont.ramo) || new Map();
  const ds = disciplinas || [];
  const somaBruto = ds.reduce((a, d) => a + d.topicos.reduce((b, t) => b + d.peso * t.peso, 0), 0) || 1;
  /* o total de cartões do escopo: só os dos tópicos DESTE plano */
  let total = 0;
  const chaves = new Set();
  ds.forEach((d) => d.topicos.forEach((t) => {
    const ch = chaveDe(d.nome, t.nome);
    if (chaves.has(ch)) return;
    chaves.add(ch); total += ct.get(ch) || 0;
  }));

  const folhas = [];
  const vistos = new Set();
  const disciplinasOut = ds.map((d) => {
    const dOut = { nome: d.nome, peso: d.peso, pesoPct: 0, cartoes: 0, cartoesPct: 0, topicos: [] };
    d.topicos.forEach((t) => {
      const chave = chaveDe(d.nome, t.nome);
      const share = (d.peso * t.peso) / somaBruto;
      const n = ct.get(chave) || 0;
      const jaContado = vistos.has(chave);     /* o mesmo tópico repetido no plano não soma duas vezes */
      vistos.add(chave);
      const tOut = { nome: t.nome, chave, pesoPct: share * 100, cartoes: n, ramos: [], semRamo: 0 };
      const rs = t.ramos || [];
      if (rs.length) {
        const pesos = edPesosDosRamos(rs), soma = pesos.reduce((a, b) => a + b, 0) || 1;
        const mm = cr.get(chave) || new Map();
        let etiquetados = 0;
        rs.forEach((r, k) => {
          const shareR = share * pesos[k] / soma;
          const nr = mm.get(r.id) || 0; etiquetados += nr;
          const alvoProp = total * shareR;
          const faixa = covFaixa(nr, alvoProp, o.minRamo);
          const f = { tipo: "ramo", disciplina: d.nome, topico: t.nome, chave, ramoId: r.id, ramoNome: r.nome,
            pesoPct: shareR * 100, cartoes: nr, alvo: Math.max(o.minRamo, Math.round(alvoProp)), alvoProp, faixa };
          tOut.ramos.push(f);
          if (!jaContado) folhas.push(f);
        });
        tOut.semRamo = Math.max(0, n - etiquetados);
        const alvoPropT = total * share, minT = o.minRamo * rs.length;
        tOut.alvo = Math.max(minT, Math.round(alvoPropT)); tOut.alvoProp = alvoPropT;
        tOut.faixa = covFaixa(n, alvoPropT, minT);
      } else {
        const alvoProp = total * share;
        tOut.alvo = Math.max(o.minTopico, Math.round(alvoProp)); tOut.alvoProp = alvoProp;
        tOut.faixa = covFaixa(n, alvoProp, o.minTopico);
        if (!jaContado) folhas.push({ tipo: "topico", disciplina: d.nome, topico: t.nome, chave, ramoId: "", ramoNome: "",
          pesoPct: tOut.pesoPct, cartoes: n, alvo: tOut.alvo, alvoProp, faixa: tOut.faixa });
      }
      dOut.pesoPct += tOut.pesoPct;
      if (!jaContado) dOut.cartoes += n;
      dOut.topicos.push(tOut);
    });
    return dOut;
  });
  disciplinasOut.forEach((d) => {
    d.cartoesPct = total ? (d.cartoes / total) * 100 : 0;
    d.lacuna = d.cartoesPct - d.pesoPct;             /* negativo = tem menos cartões do que o peso pede */
    const fs = folhas.filter((f) => f.disciplina === d.nome);
    d.folhas = fs.length;
    d.vazias = fs.filter((f) => f.faixa === "vazio").length;
    d.pouco = fs.filter((f) => f.faixa === "pouco").length;
    d.excesso = fs.filter((f) => f.faixa === "excesso").length;
  });
  const soma = (f) => folhas.filter(f).reduce((a, x) => a + x.pesoPct, 0);
  const resumo = {
    cartoes: total, folhas: folhas.length,
    vazias: folhas.filter((f) => f.faixa === "vazio").length,
    pouco: folhas.filter((f) => f.faixa === "pouco").length,
    ok: folhas.filter((f) => f.faixa === "ok").length,
    excesso: folhas.filter((f) => f.faixa === "excesso").length,
    pesoSemCartaoPct: soma((f) => f.faixa === "vazio"),
    pesoAbaixoPct: soma((f) => f.faixa === "vazio" || f.faixa === "pouco"),
    pesoCobertoPct: soma((f) => f.faixa === "ok" || f.faixa === "excesso"),
  };
  /* ONDE FALTA, do mais urgente (peso alto e pouco material) ao menos: urgência = peso × fração que falta do alvo */
  const faltando = folhas.filter((f) => f.faixa === "vazio" || f.faixa === "pouco")
    .map((f) => Object.assign({}, f, { falta: Math.max(0, f.alvo - f.cartoes), urgencia: f.pesoPct * (f.alvo ? Math.max(0, f.alvo - f.cartoes) / f.alvo : 1) }))
    .sort((a, b) => (b.urgencia - a.urgencia) || (b.pesoPct - a.pesoPct));
  /* ONDE SOBRA: quanto passa do que o peso pede (para poder cortar ou mudar de assunto) */
  const sobrando = folhas.filter((f) => f.faixa === "excesso")
    .map((f) => Object.assign({}, f, { sobra: f.cartoes - Math.max(f.alvo, Math.round(f.alvoProp)) }))
    .sort((a, b) => b.sobra - a.sobra);
  return { total, disciplinas: disciplinasOut, folhas, resumo, faltando, sobrando };
}

/* O mapa de UM edital cadastrado, com os cartões da biblioteca de agora. */
function covDoEdital(ed, notas, opc) {
  const plano = lerEdital((ed && ed.texto) || "").disciplinas;
  return covMapa(plano, covContar(notas), (d, t) => matChaveViva(d, t), opc);
}

/* =====================================================================
 * A TELA: "Cobertura" (aberta pela biblioteca de cartões)
 *
 * Uma faixa por disciplina, na ordem do PESO, dividida em segmentos — um por tópico, com a largura do peso dele — e
 * pintada pela faixa de cobertura (vermelho = nenhum cartão, âmbar = pouco, verde = ok, azul = excesso). Assim se vê
 * DENTRO de cada disciplina qual pedaço do peso está sem material. Clicar na disciplina abre os tópicos e os ramos.
 * ===================================================================== */
const COV_CHAVE_MIN = "eac_cov_min";
let covEditalId = "";

function covMinimos() {
  let j = {};
  try { j = JSON.parse(localStorage.getItem(COV_CHAVE_MIN) || "{}") || {}; } catch (e) { j = {}; }
  const num = (v, pad) => { const n = Math.round(Number(v)); return n >= 1 && n <= 50 ? n : pad; };
  return { minTopico: num(j.t, COV.minTopico), minRamo: num(j.r, COV.minRamo) };
}

/* os editais em ordem de prova (a mais próxima primeiro, encerrados por último): o mesmo critério da biblioteca */
function covEditaisOrdenados() {
  const lista = (typeof editais !== "undefined" && Array.isArray(editais)) ? editais.slice() : [];
  const chave = (e) => gerChaveProva(gerSituacaoEdital(e));
  return lista.map((e, i) => ({ e, i })).sort((a, b) => {
    const ka = chave(a.e), kb = chave(b.e);
    return (ka[0] - kb[0]) || (ka[1] - kb[1]) || (a.i - b.i);
  }).map((x) => x.e);
}

function covSegmentos(pai, itens, totalPeso) {
  const tira = gerEl("div", "cov-tira");
  itens.forEach((it) => {
    const seg = gerEl("div", "cov-seg cov-f-" + it.faixa);
    seg.style.width = (totalPeso ? (it.pesoPct / totalPeso) * 100 : 100 / itens.length).toFixed(2) + "%";
    seg.title = (it.ramoNome || it.nome || it.topico || "") + " — " + t("cov_cartoes_de", { n: it.cartoes, a: it.alvo }) + " — " + t("cov_peso", { p: it.pesoPct.toFixed(1) });
    tira.append(seg);
  });
  pai.append(tira);
}

function covLinhaAcoes(pai, disciplina, topico) {
  const ac = gerEl("span", "cov-acoes");
  const ab = gerEl("button", "btn-min", t("cov_abrir")); ab.type = "button";
  ab.onclick = () => { $("dlgCobertura").close(); gerAbrirNoTopico(disciplina, topico); };
  const ge = gerEl("button", "btn-min btn-min-ok", t("cov_gerar")); ge.type = "button";
  ge.onclick = () => bancAlvoDefinir(disciplina, topico);
  ac.append(ab, ge);
  pai.append(ac);
}

function covPintar() {
  const cx = $("covCorpo");
  cx.innerHTML = "";
  const ed = (editais || []).find((e) => String(e.id) === String(covEditalId));
  if (!ed) { cx.append(gerEl("p", "nota", t("cov_sem_edital"))); return; }
  const m = covDoEdital(ed, cqLerBiblioteca(), covMinimos());
  const r = m.resumo;
  if (!r.folhas) { cx.append(gerEl("p", "nota", t("cov_sem_topicos"))); return; }
  const man = gerEl("div", "cov-manchete" + (r.pesoSemCartaoPct >= 10 ? " cov-manchete-alerta" : ""));
  man.append(gerEl("b", "", t("cov_manchete", { p: Math.round(r.pesoSemCartaoPct) })),
    document.createTextNode(" " + t("cov_manchete2", { p: Math.round(r.pesoAbaixoPct), n: r.cartoes })));
  cx.append(man);
  const leg = gerEl("div", "cov-legenda");
  [["vazio", r.vazias], ["pouco", r.pouco], ["ok", r.ok], ["excesso", r.excesso]].forEach(([f, n]) => {
    const it = gerEl("span", "cov-leg"); it.append(gerEl("i", "cov-seg cov-f-" + f), document.createTextNode(" " + t("cov_f_" + f) + " (" + n + ")"));
    leg.append(it);
  });
  cx.append(leg);
  /* as disciplinas, na ordem do peso */
  const ordem = m.disciplinas.slice().sort((a, b) => (b.pesoPct - a.pesoPct) || (a.nome < b.nome ? -1 : 1));
  const lista = gerEl("div", "cov-lista");
  ordem.forEach((d) => {
    const linha = gerEl("div", "cov-disc");
    const cab = gerEl("div", "cov-disc-cab");
    cab.append(gerEl("b", "cov-nome", d.nome), gerEl("span", "cov-peso", t("cov_peso", { p: d.pesoPct.toFixed(1) })),
      gerEl("span", "cov-n" + (d.vazias ? " cov-n-alerta" : ""), t("cov_disc_n", { n: d.cartoes, v: d.vazias, p: d.pouco })));
    linha.append(cab);
    covSegmentos(linha, d.topicos, d.pesoPct);
    const det = gerEl("div", "cov-det"); det.hidden = true;
    d.topicos.forEach((tp) => {
      const tl = gerEl("div", "cov-top cov-f-borda-" + tp.faixa);
      tl.append(gerEl("span", "cov-top-nome", tp.nome), gerEl("span", "cov-top-n", t("cov_cartoes_de", { n: tp.cartoes, a: tp.alvo })));
      covLinhaAcoes(tl, d.nome, tp.nome);
      det.append(tl);
      if (tp.ramos.length) {
        tp.ramos.forEach((rm) => {
          const rl = gerEl("div", "cov-ramo cov-f-borda-" + rm.faixa);
          rl.append(gerEl("span", "cov-top-nome", "↳ " + rm.ramoNome), gerEl("span", "cov-top-n", t("cov_cartoes_de", { n: rm.cartoes, a: rm.alvo })));
          det.append(rl);
        });
        if (tp.semRamo > 0) det.append(gerEl("div", "cov-ramo cov-nota-sem", t("cov_sem_ramo", { n: tp.semRamo })));
      }
    });
    cab.onclick = () => { det.hidden = !det.hidden; linha.className = "cov-disc" + (det.hidden ? "" : " cov-aberta"); };
    linha.append(det);
    lista.append(linha);
  });
  cx.append(lista);
  /* onde falta e onde sobra */
  const bloco = (chave, itens, campo) => {
    const s = gerEl("div", "cov-bloco");
    s.append(gerEl("h4", "", t(chave)));
    itens.slice(0, 15).forEach((f) => {
      const l = gerEl("div", "cov-item");
      l.append(gerEl("span", "cov-item-nome", f.disciplina + " › " + f.topico + (f.ramoNome ? " › " + f.ramoNome : "")),
        gerEl("span", "cov-item-n", campo === "falta" ? t("cov_falta_n", { n: f.cartoes, f: f.falta, p: f.pesoPct.toFixed(1) }) : t("cov_sobra_n", { n: f.cartoes, s: f.sobra })));
      covLinhaAcoes(l, f.disciplina, f.topico);
      s.append(l);
    });
    return s;
  };
  if (m.faltando.length) cx.append(bloco("cov_onde_falta", m.faltando, "falta"));
  if (m.sobrando.length) cx.append(bloco("cov_onde_sobra", m.sobrando, "sobra"));
}

function covAbrir(editalId) {
  const eds = covEditaisOrdenados();
  const sel = $("covEdital");
  sel.innerHTML = "";
  eds.forEach((e) => { const op = gerEl("option", "", e.nome || "—"); op.value = String(e.id); sel.append(op); });
  covEditalId = editalId ? String(editalId) : (eds[0] ? String(eds[0].id) : "");
  sel.value = covEditalId;
  const mn = covMinimos();
  $("covMinTop").value = String(mn.minTopico); $("covMinRamo").value = String(mn.minRamo);
  covPintar();
  dicasDosBotoes({ btnGerCobertura: "cov_tip_abrir", btnCovX: "cov_tip_x", covEdital: "cov_tip_edital", covMinTop: "cov_tip_min", covMinRamo: "cov_tip_min" });
  abrirModal("dlgCobertura");
}

if (typeof document !== "undefined" && $("dlgCobertura")) {
  $("btnGerCobertura").onclick = () => covAbrir();
  $("btnCovX").onclick = () => $("dlgCobertura").close();
  $("covEdital").onchange = () => { covEditalId = $("covEdital").value; covPintar(); };
  const salvarMin = () => {
    try { localStorage.setItem(COV_CHAVE_MIN, JSON.stringify({ t: $("covMinTop").value, r: $("covMinRamo").value })); } catch (e) {}
    covPintar();
  };
  $("covMinTop").onchange = salvarMin; $("covMinRamo").onchange = salvarMin;
}
