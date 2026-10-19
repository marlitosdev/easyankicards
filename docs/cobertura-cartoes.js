/* =====================================================================
 * COBERTURA DE CARTÕES: tenho cartões para TUDO o que o edital cobra, na proporção do PESO?
 *
 * A pergunta que a contagem sozinha não responde: "tenho 80 cartões de contratos e nenhum de concessões" — os
 * dois assuntos podem valer o mesmo na prova. Aqui cada tópico (e cada ramo dele) é comparado com o que o PESO
 * pede: o peso vira uma fatia do total, a fatia vira um alvo de cartões, e a distância entre o que existe e o
 * alvo vira uma faixa (vazio, pouco, ok, excesso).
 *
 * O PESO DA PROVA, em ordem de confiança:
 *   1. Quando TODAS as disciplinas trazem o número de questões no edital ("5q", "20q"), a fatia da disciplina é esse
 *      número sobre o total — é a divisão real da prova (mesma regra da "fatia exata" do plano). Dentro da disciplina, a
 *      fatia se reparte pelo peso dos tópicos.
 *   2. Sem os números: peso da disciplina × peso do tópico (o "bruto" do plano). É uma ESTIMATIVA, e favorece disciplinas
 *      com muitos tópicos — por isso a tela diz qual das duas bases está em uso.
 *   3. 2ª FASE (discursiva): só contam os tópicos marcados para ela, com o peso dela (`pesoF2`).
 * O peso dos ramos é a divisão do peso do tópico pela régua dos ramos (edPesosDosRamos).
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
  const fase = o.fase === 2 ? 2 : 1;
  /* o peso de UM tópico nesta fase (na 2ª, o que não é da discursiva pesa zero e fica de fora) */
  const wDe = (t) => (fase === 2 ? (t.fase2 ? (t.pesoF2 || t.peso) : 0) : t.peso);
  const somaBruto = ds.reduce((a, d) => a + d.topicos.reduce((b, t) => b + d.peso * wDe(t), 0), 0) || 1;
  const comAbs = ds.filter((d) => d.abs > 0);
  const exata = fase === 1 && comAbs.length > 0 && comAbs.length === ds.length;
  const somaAbs = exata ? comAbs.reduce((a, d) => a + d.abs, 0) : 0;
  /* o total de cartões do escopo: só os dos tópicos DESTE plano (e desta fase) */
  let total = 0;
  const chaves = new Set();
  ds.forEach((d) => d.topicos.forEach((t) => {
    if (!wDe(t)) return;
    const ch = chaveDe(d.nome, t.nome);
    if (chaves.has(ch)) return;
    chaves.add(ch); total += ct.get(ch) || 0;
  }));

  const folhas = [];
  const vistos = new Set();
  const disciplinasOut = ds.map((d) => {
    const dOut = { nome: d.nome, peso: d.peso, abs: d.abs || 0, pesoPct: 0, cartoes: 0, cartoesPct: 0, topicos: [] };
    const somaW = d.topicos.reduce((a, t) => a + wDe(t), 0) || 1;
    d.topicos.forEach((t) => {
      if (!wDe(t)) return;
      const chave = chaveDe(d.nome, t.nome);
      const share = exata ? (d.abs / somaAbs) * (wDe(t) / somaW) : (d.peso * wDe(t)) / somaBruto;
      const n = ct.get(chave) || 0;
      const jaContado = vistos.has(chave);     /* o mesmo tópico repetido no plano não soma duas vezes */
      vistos.add(chave);
      const tOut = { nome: t.nome, chave, pesoPct: share * 100, cartoes: n, ramos: [], semRamo: 0, fase2: !!t.fase2 };
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
  /* na 2ª fase, disciplina sem nenhum tópico da discursiva não entra */
  for (let i = disciplinasOut.length - 1; i >= 0; i--) if (!disciplinasOut[i].topicos.length) disciplinasOut.splice(i, 1);
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
  return { total, disciplinas: disciplinasOut, folhas, resumo, faltando, sobrando, fase, somaAbs,
    base: fase === 2 ? "fase2" : (exata ? "questoes" : "estimado") };
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
/* =====================================================================
 * COBERTURA DE UMA LEI POR CARTÕES, ARTIGO A ARTIGO (v18.73.0, K1)
 *
 * A pergunta: "quais artigos do CTN (ou do CTM de Caruaru) ainda não têm
 * nenhum cartão — e quais caem em questão e têm pouco?". A Cobertura do
 * edital mede TÓPICOS; aqui a unidade é o ARTIGO.
 *
 * QUANDO UM CARTÃO COBRE UM ARTIGO (sem contar duas vezes):
 *  · a ETIQUETA que o "virar cartões" do leitor põe ("lei5172-art3",
 *    leiEtiquetaDe), ou
 *  · a CITAÇÃO no texto do cartão (frente, verso, "saiba mais"), resolvida
 *    como no resumo: o vínculo fixado à mão vence; senão o nome da lei
 *    citado ("art. 150, VI, da CF"); sem nome, a lei — se for uma só — do
 *    tópico do cartão. Lista ("arts. 77, 78 e 79") conta em cada um.
 * O PESO DO ARTIGO: 1 + questões que o citam + 2 × "caiu na prova"
 * (leiRanking). FAIXA: vazio (nenhum), pouco (menos da metade do peso),
 * ok. Artigos revogados ficam de fora. Agrupado pelas divisões da lei.
 * ===================================================================== */
function covLeiTextoDoCartao(card) {
  const c = card || {};
  return [c.front, c.back].concat(Array.isArray(c.more) ? c.more : (c.more ? [c.more] : [])).filter(Boolean).join(" \n ");
}
/* os artigos da lei l CITADOS num texto (de um cartão ou de uma questão do tópico "chave"): o vínculo fixado à mão
 * vence; senão o nome da lei citado; sem nome, a lei — se for uma só — do tópico */
function covLeiArtigosDoTexto(txt, chave, l, leis, out) {
  const saida = out || new Set();
  let cits = [];
  try { cits = leiCitacoesNoTexto(txt); } catch (e) { cits = []; }
  try { if (typeof citVinculosAplicar === "function") cits = citVinculosAplicar(txt, cits, chave); } catch (e) {}
  let doTopico = null;
  cits.forEach((c) => {
    if (doTopico === null) { try { doTopico = leisDoTopico(chave) || []; } catch (e) { doTopico = []; } }
    /* a decisão é a dos links (leiResolverCitacao): vínculo fixado, lei nomeada (ou a que a alteradora alterou), a do tópico */
    const alvo = c.leiId ? { id: c.leiId } : leiResolverCitacao(c, leis, doTopico).lei;
    if (!alvo || alvo.id !== l.id) return;
    const nums = (c.artigos && c.artigos.length) ? c.artigos.map((a) => a.num) : [c.num];
    nums.filter(Boolean).forEach((x) => saida.add(leiNumNormal(x)));
  });
  return saida;
}
/* os artigos (números normalizados) da lei l que um cartão cobre: etiqueta do "virar cartões" + citações */
function covLeiArtigosDoCartao(n, l, leis) {
  const out = new Set();
  if (!n || !n.card || !l) return out;
  const base = leiEtiquetaDe(l, { num: "" });
  (n.card.tags || []).forEach((tg) => {
    const s = String(tg || "").toLowerCase();
    if (s.indexOf(base) === 0 && s.length > base.length) out.add(leiNumNormal(s.slice(base.length)));
  });
  return covLeiArtigosDoTexto(covLeiTextoDoCartao(n.card), n.chave, l, leis, out);
}
/* O QUE CAI, DESTA LEI: as questões que citam cada artigo (resolvendo de QUAL lei é a citação — o ranking do leitor
 * contava qualquer "art. 43" para a lei aberta: o art. 43 do CTN ou da EC 132 virava "11 questões" do art. 43 da CF);
 * o "caiu na prova" vem das marcas dentro da própria lei (leiRanking) (doLeitor: esse ranking já pronto, nos testes) */
function covLeiRanking(l, leis, doLeitor) {
  const porNum = {};
  let banco = [];
  try { banco = (typeof qsTodas === "function" ? qsTodas() : []) || []; } catch (e) { banco = []; }
  banco.forEach((q) => {
    const txt = [q.enunciado, q.comentario, q.gabarito].filter(Boolean).join(" \n ");
    covLeiArtigosDoTexto(txt, q.chave, l, leis).forEach((num) => {
      porNum[num] = porNum[num] || { num, questoes: 0, prova: 0 };
      porNum[num].questoes++;
    });
  });
  try {
    (doLeitor || leiRanking(l.id) || []).forEach((r) => {
      if (!r.prova) return;
      porNum[r.num] = porNum[r.num] || { num: r.num, questoes: 0, prova: 0 };
      porNum[r.num].prova = r.prova;
    });
  } catch (e) {}
  return Object.keys(porNum).map((k) => porNum[k]);
}
function covLeiFaixa(n, peso) {
  if (!n) return "vazio";
  if (n < Math.ceil(peso / 2)) return "pouco";
  return "ok";
}
/* o mapa: artigos (vigentes) com cartões, peso e faixa; divisões com os totais; o resumo */
function covLeiMapa(l, notas, opc) {
  if (!l) return null;
  const leis = (opc && opc.leis) || (typeof leisLista === "function" ? leisLista() : []);
  let ef = [];
  try { ef = leiArtigosEfetivos(l); } catch (e) { ef = leiArtigos(l.texto); }
  const rank = {};
  try { ((opc && opc.ranking) || covLeiRanking(l, leis) || []).forEach((r) => { rank[r.num] = r; }); } catch (e) {}
  const cartoes = new Map();
  (notas || []).forEach((n) => covLeiArtigosDoCartao(n, l, leis).forEach((num) => {
    if (!cartoes.has(num)) cartoes.set(num, []);
    cartoes.get(num).push(n);
  }));
  const vigentes = ef.filter((a) => !leiArtigoRevogado(a));
  const arts = vigentes.map((a) => {
    const r = rank[a.num] || {};
    const peso = 1 + (r.questoes || 0) + 2 * (r.prova || 0);
    const ns = cartoes.get(a.num) || [];
    return { num: a.num, rotulo: a.rotulo, ementa: a.ementa || "", divisaoId: a.divisaoId || "", peso,
      questoes: r.questoes || 0, prova: r.prova || 0, cartoes: ns.length, notas: ns, faixa: covLeiFaixa(ns.length, peso) };
  });
  const porNum = new Map(arts.map((a) => [a.num, a]));
  /* as divisões (Título, Capítulo…) da estrutura da lei, com os artigos vigentes de cada uma (e dos filhos) */
  let est = null;
  try { est = leiEstruturaLei(l.texto, leiOpcDaLei(l)); } catch (e) { est = null; }
  const montar = (no) => {
    const proprios = (no.artigos || []).map((i) => est.artigos[i]).filter(Boolean).map((a) => porNum.get(a.num)).filter(Boolean);
    const filhos = (no.filhos || []).map(montar).filter((f) => f.total);
    const todos = proprios.concat(...filhos.map((f) => f.todos));
    return { rotulo: no.rotulo || no.nome || "", nome: no.nome || "", artigos: proprios, filhos, todos,
      total: todos.length, semCartao: todos.filter((a) => !a.cartoes).length, pouco: todos.filter((a) => a.faixa === "pouco").length,
      cartoes: todos.reduce((s, a) => s + a.cartoes, 0) };
  };
  let divisoes = est ? est.raiz.map(montar).filter((d) => d.total) : [];
  /* artigos que só existem na camada de alteração (acrescentados) não estão na estrutura do texto: vão num grupo à parte */
  const naEstrutura = new Set(divisoes.flatMap((d) => d.todos.map((a) => a.num)));
  const fora = arts.filter((a) => !naEstrutura.has(a.num));
  if (fora.length) divisoes.push({ rotulo: "(acrescentados)", nome: "", artigos: fora, filhos: [], todos: fora, total: fora.length,
    semCartao: fora.filter((a) => !a.cartoes).length, pouco: fora.filter((a) => a.faixa === "pouco").length, cartoes: fora.reduce((s, a) => s + a.cartoes, 0) });
  const sem = arts.filter((a) => !a.cartoes);
  const cobrem = new Set();
  arts.forEach((a) => a.notas.forEach((n) => cobrem.add(n)));
  return { lei: l, artigos: arts, divisoes,
    resumo: { artigos: arts.length, semCartao: sem.length, pouco: arts.filter((a) => a.faixa === "pouco").length,
      ok: arts.filter((a) => a.faixa === "ok").length, pctSem: arts.length ? (sem.length / arts.length) * 100 : 0,
      cartoes: cobrem.size, revogados: ef.length - vigentes.length,
      /* os que caem em questão e não têm cartão: a fila de prioridade (número repetido — corpo × ADCT da CF — entra uma vez:
       * a contagem é por número, os dois teriam os mesmos dados) */
      prioridade: arts.filter((a, i) => a.faixa !== "ok" && (a.questoes || a.prova) && arts.findIndex((x) => x.num === a.num) === i)
        .sort((x, y) => (y.peso - x.peso)) } };
}

const COV_CHAVE_MIN = "eac_cov_min";
let covEditalId = "", covDiscAberta = "";

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

/* o edital tem 2ª fase com tópicos marcados para ela? */
function covTemFase2(ed) {
  try {
    const r = lerEdital((ed && ed.texto) || "");
    return !!(r.cfg && r.cfg.fase2 && r.cfg.fase2.prova) && r.disciplinas.some((d) => d.topicos.some((t) => t.fase2));
  } catch (e) { return false; }
}

function covPintar() {
  const cx = $("covCorpo");
  cx.innerHTML = "";
  const ed = (editais || []).find((e) => String(e.id) === String(covEditalId));
  if (!ed) { cx.append(gerEl("p", "nota", t("cov_sem_edital"))); return; }
  const temF2 = covTemFase2(ed);
  $("covFase").hidden = !temF2;
  const fase = temF2 && $("covFase").value === "2" ? 2 : 1;
  const m = covDoEdital(ed, cqLerBiblioteca(), Object.assign(covMinimos(), { fase }));
  const r = m.resumo;
  if (!r.folhas) { cx.append(gerEl("p", "nota", t("cov_sem_topicos"))); return; }
  const man = gerEl("div", "cov-manchete" + (r.pesoSemCartaoPct >= 10 ? " cov-manchete-alerta" : ""));
  man.append(gerEl("b", "", t("cov_manchete", { p: Math.round(r.pesoSemCartaoPct) })),
    document.createTextNode(" " + t("cov_manchete2", { p: Math.round(r.pesoAbaixoPct), n: r.cartoes })));
  cx.append(man);
  cx.append(gerEl("p", "nota cov-base", t("cov_base_" + m.base, { n: m.somaAbs })));
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
    const det = gerEl("div", "cov-det"); det.hidden = d.nome !== covDiscAberta;
    if (!det.hidden) linha.className = "cov-disc cov-aberta";
    d.topicos.forEach((tp) => {
      const tl = gerEl("div", "cov-top cov-f-borda-" + tp.faixa);
      tl.append(gerEl("span", "cov-top-nome", tp.nome));
      if (tp.fase2 && m.fase === 1) tl.append(gerEl("span", "cov-f2", t("cov_f2_tag")));
      tl.append(gerEl("span", "cov-top-n", t("cov_cartoes_de", { n: tp.cartoes, a: tp.alvo })));
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

/* =====================================================================
 * A TELA "POR LEI" (v18.73.0, K2) — mesma linguagem da cobertura do edital:
 * manchete, legenda, uma barra por divisão (Título/Capítulo) e, aberta, a
 * lista dos artigos com "N cartões" e as ações: criar cartões do artigo
 * (o "virar cartões" do leitor, já no artigo) e ver os cartões que o cobrem.
 * Em cima, "o que cai e não tem cartão": os artigos com questões/prova e
 * nenhum (ou pouco) cartão — por onde começar.
 * ===================================================================== */
let covModo = "edital", covLeiId = "", covLeiAberta = "";
function covLeiTopico(l) {
  for (const ch of ((l && l.topicos) || [])) {
    const info = (typeof gerPastaInfo === "function" ? gerPastaInfo(ch) : null) || matResumos[ch];
    if (info && info.disciplina && info.topico) return { chave: ch, disciplina: info.disciplina, topico: info.topico };
  }
  return null;
}
function covLeisOrdenadas(notas) {
  const ls = (typeof leisLista === "function" ? leisLista() : []).slice();
  return ls.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt"));
}
/* criar cartões de UM artigo: abre a lei no artigo (pelo tópico dela) e o "virar cartões" já nele */
function covLeiCriar(idLei, num) {
  const l = leiDe(idLei);
  if (!l) return false;
  const tp = covLeiTopico(l);
  if (!tp) { uiAlert(t("cov_lei_sem_topico", { l: l.nome })); return false; }
  try { $("dlgCobertura").close(); } catch (e) {}
  leiAbrirNoArtigo(tp.disciplina, tp.topico, l.id, num);
  let a = null;
  try { a = leiArtigosEfetivos(leiDe(l.id)).find((x) => x.num === leiNumNormal(num)); } catch (e) { a = null; }
  if (a) leiClozeAbrir(a);
  try { reg("COBERTURA", "lei: criar cartões do artigo", l.nome + " · art. " + num); } catch (e) {}
  return !!a;
}
function covLeiAbrirArtigo(idLei, num) {
  const l = leiDe(idLei);
  if (!l) return false;
  const tp = covLeiTopico(l) || { disciplina: "", topico: "" };
  try { $("dlgCobertura").close(); } catch (e) {}
  return leiAbrirNoArtigo(tp.disciplina, tp.topico, l.id, num);
}
function covLeiLinhaArtigo(pai, m, a) {
  const linha = gerEl("div", "cov-top cov-art cov-f-borda-" + a.faixa);
  linha.id = "covArt_" + a.num;
  linha.append(gerEl("span", "cov-top-nome", a.rotulo + (a.ementa ? " — " + String(a.ementa).slice(0, 110) : "")));
  if (a.questoes || a.prova) linha.append(gerEl("span", "cov-f2", t("cov_lei_cai", { q: a.questoes, p: a.prova })));
  const nb = gerEl("button", "btn-min cov-art-n", t("cov_lei_n", { n: a.cartoes }));
  nb.type = "button";
  nb.disabled = !a.cartoes;
  const ver = gerEl("div", "cov-art-cartoes");
  ver.hidden = true;
  nb.onclick = () => {
    if (ver.hidden && !ver.children.length) a.notas.slice(0, 30).forEach((n) => ver.append(gerEl("div", "cov-art-cartao", String(n.card.front || "").replace(/\s+/g, " ").slice(0, 160))));
    ver.hidden = !ver.hidden;
  };
  const cr = gerEl("button", "btn-min btn-min-ok", t("cov_lei_criar"));
  cr.type = "button";
  cr.id = "btnCovLeiCriar_" + a.num;
  cr.onclick = () => covLeiCriar(m.lei.id, a.num);
  const ab = gerEl("button", "btn-min", t("cov_lei_abrir"));
  ab.type = "button";
  ab.onclick = () => covLeiAbrirArtigo(m.lei.id, a.num);
  const ac = gerEl("span", "cov-acoes");
  /* (v18.90.0) estudar os cartões DESTE artigo, ali mesmo (a Cobertura continua por baixo) — primeiro na fila de botões */
  if (a.cartoes) {
    const es = gerEl("button", "btn-min btn-min-ok cov-art-estudar", t("cov_lei_estudar", { n: a.cartoes }));
    es.type = "button";
    es.id = "btnCovLeiEstudar_" + a.num;
    es.onclick = () => estcAbrirLista(a.notas, { rotulo: m.lei.nome + " · " + a.rotulo });
    ac.append(es);
  }
  ac.append(nb, ab, cr);
  linha.append(ac);
  pai.append(linha, ver);
}
function covPintarLei() {
  const cx = $("covCorpo");
  cx.innerHTML = "";
  const l = leiDe(covLeiId);
  if (!l) { cx.append(gerEl("p", "nota", t("cov_lei_nenhuma"))); return null; }
  const m = covLeiMapa(l, cqLerBiblioteca());
  const r = m.resumo;
  if (!r.artigos) { cx.append(gerEl("p", "nota", t("cov_lei_sem_artigos"))); return m; }
  const man = gerEl("div", "cov-manchete" + (r.pctSem >= 30 ? " cov-manchete-alerta" : ""));
  man.append(gerEl("b", "", t("cov_lei_manchete", { s: r.semCartao, n: r.artigos, p: Math.round(r.pctSem) })),
    document.createTextNode(" " + t("cov_lei_manchete2", { c: r.cartoes, v: r.revogados })));
  cx.append(man);
  if (!covLeiTopico(l)) cx.append(gerEl("p", "nota cov-base", t("cov_lei_sem_topico", { l: l.nome })));
  const leg = gerEl("div", "cov-legenda");
  [["vazio", r.semCartao], ["pouco", r.pouco], ["ok", r.ok]].forEach(([f, n]) => {
    const it = gerEl("span", "cov-leg"); it.append(gerEl("i", "cov-seg cov-f-" + f), document.createTextNode(" " + t("cov_lei_f_" + f) + " (" + n + ")"));
    leg.append(it);
  });
  cx.append(leg);
  /* por onde começar: o que cai em questão/prova e tem pouco ou nenhum cartão */
  if (r.prioridade.length) {
    const s = gerEl("div", "cov-bloco cov-lei-prior");
    s.append(gerEl("h4", "", t("cov_lei_prioridade", { n: r.prioridade.length })));
    r.prioridade.slice(0, 12).forEach((a) => covLeiLinhaArtigo(s, m, a));
    cx.append(s);
  }
  const lista = gerEl("div", "cov-lista");
  const pintarDiv = (d, pai, fundo) => {
    const caixa = gerEl("div", "cov-disc cov-lei-div" + (fundo ? " cov-lei-sub" : ""));
    const cab = gerEl("div", "cov-disc-cab");
    cab.append(gerEl("b", "cov-nome", d.rotulo || "—"),
      gerEl("span", "cov-n" + (d.semCartao ? " cov-n-alerta" : ""), t("cov_lei_div_n", { n: d.total, s: d.semCartao, c: d.cartoes })));
    /* (v18.90.0) estudar os cartões do capítulo inteiro (cada cartão uma vez, mesmo citando dois artigos dele) */
    const notasDiv = Array.from(new Set(d.todos.flatMap((a) => a.notas)));
    if (notasDiv.length) {
      const es = gerEl("button", "btn-min btn-min-ok cov-div-estudar", t("cov_lei_estudar_div", { n: notasDiv.length }));
      es.type = "button";
      es.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); estcAbrirLista(notasDiv, { rotulo: m.lei.nome + " · " + (d.rotulo || "") }); };
      cab.append(es);
    }
    caixa.append(cab);
    covSegmentos(caixa, d.todos.map((a) => ({ faixa: a.faixa, pesoPct: 1, cartoes: a.cartoes, alvo: Math.ceil(a.peso / 2), nome: a.rotulo })), d.todos.length);
    const det = gerEl("div", "cov-det");
    const chaveDiv = (fundo || "") + "|" + (d.rotulo || "");
    det.hidden = covLeiAberta !== chaveDiv;
    if (!det.hidden) caixa.className += " cov-aberta";
    const encher = () => {
      if (det.children.length) return;
      d.artigos.forEach((a) => covLeiLinhaArtigo(det, m, a));
      d.filhos.forEach((f) => pintarDiv(f, det, chaveDiv));
    };
    if (!det.hidden) encher();
    cab.onclick = () => { encher(); det.hidden = !det.hidden; covLeiAberta = det.hidden ? "" : chaveDiv; caixa.classList.toggle("cov-aberta", !det.hidden); };
    caixa.append(det);
    pai.append(caixa);
  };
  m.divisoes.forEach((d) => pintarDiv(d, lista, ""));
  cx.append(lista);
  return m;
}
function covTrocarModo(modo) {
  covModo = modo === "lei" ? "lei" : "edital";
  $("btnCovModoEdital").setAttribute("aria-selected", String(covModo === "edital"));
  $("btnCovModoLei").setAttribute("aria-selected", String(covModo === "lei"));
  ["covEdital", "covMinTop", "covMinRamo"].forEach((id) => { const el = $(id); const lab = el && el.closest ? el.closest("label") : null; (lab || el).hidden = covModo === "lei"; });
  if (covModo === "lei") $("covFase").hidden = true;
  $("covLei").hidden = covModo !== "lei";
  $("covSub").textContent = t(covModo === "lei" ? "cov_lei_sub" : "cov_sub");
  return covModo === "lei" ? covPintarLei() : covPintar();
}
/* abrir já no modo "por lei" (do leitor da lei, por exemplo) */
function covAbrirLei(idLei) {
  covAbrir();
  const ls = covLeisOrdenadas();
  covLeiId = idLei ? String(idLei) : (covLeiId && leiDe(covLeiId) ? covLeiId : (ls[0] ? ls[0].id : ""));
  $("covLei").value = covLeiId;
  return covTrocarModo("lei");
}

function covAbrir(editalId, disciplina) {
  covDiscAberta = disciplina || "";
  const eds = covEditaisOrdenados();
  const sel = $("covEdital");
  sel.innerHTML = "";
  eds.forEach((e) => { const op = gerEl("option", "", e.nome || "—"); op.value = String(e.id); sel.append(op); });
  covEditalId = editalId ? String(editalId) : (eds[0] ? String(eds[0].id) : "");
  sel.value = covEditalId;
  const mn = covMinimos();
  $("covMinTop").value = String(mn.minTopico); $("covMinRamo").value = String(mn.minRamo);
  $("covFase").value = "1";
  /* (v18.73.0) as leis, para o modo "por lei" */
  const sl = $("covLei");
  if (sl) {
    sl.innerHTML = "";
    covLeisOrdenadas().forEach((l) => { const op = gerEl("option", "", l.nome || "—"); op.value = String(l.id); sl.append(op); });
    if (!covLeiId || !leiDe(covLeiId)) covLeiId = sl.children.length ? sl.children[0].value : "";
    sl.value = covLeiId;
  }
  covModo = "edital";
  if ($("btnCovModoEdital")) covTrocarModo("edital"); else covPintar();
  dicasDosBotoes({ covFase: "cov_tip_fase", btnGerCobertura: "cov_tip_abrir", btnCovX: "cov_tip_x", covEdital: "cov_tip_edital", covMinTop: "cov_tip_min", covMinRamo: "cov_tip_min" });
  abrirModal("dlgCobertura");
}

if (typeof document !== "undefined" && $("dlgCobertura")) {
  $("btnGerCobertura").onclick = () => covAbrir();
  $("btnCovX").onclick = () => $("dlgCobertura").close();
  $("covEdital").onchange = () => { covEditalId = $("covEdital").value; $("covFase").value = "1"; covPintar(); };
  $("covFase").onchange = covPintar;
  if ($("btnCovModoEdital")) $("btnCovModoEdital").onclick = () => covTrocarModo("edital");
  if ($("btnCovModoLei")) $("btnCovModoLei").onclick = () => covTrocarModo("lei");
  if ($("covLei")) $("covLei").onchange = () => { covLeiId = $("covLei").value; covLeiAberta = ""; covPintarLei(); };
  const salvarMin = () => {
    try { localStorage.setItem(COV_CHAVE_MIN, JSON.stringify({ t: $("covMinTop").value, r: $("covMinRamo").value })); } catch (e) {}
    covPintar();
  };
  $("covMinTop").onchange = salvarMin; $("covMinRamo").onchange = salvarMin;
}
