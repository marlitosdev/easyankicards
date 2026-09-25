/* ===================================================================
 * ELEVAR CARTÕES ANTIGOS AO PADRÃO
 *
 * Medido num baralho real: verso com menos de 100 caracteres em 759 de
 * 843 cartões, só 16% citando artigo, cloze sem dica e "pergunta+resposta"
 * na mesma frase. Os bons baralhos de referência têm resposta com o
 * fundamento, artigo, literalidade em "saiba mais" e lacuna com dica.
 *
 * COMO O CARTÃO É AVALIADO (16.78.0)
 * Antes: uma nota de 0 a 100 somando "descontos". Ninguém entendia "nota 50 → 60"
 * e, pior, alguns descontos eram IMPOSSÍVEIS de tirar: o cartão sem artigo na fonte
 * (uma súmula, uma emenda, um esquema) voltava da IA sem artigo — porque a IA foi mandada
 * não inventar — e ficava "abaixo do padrão" para sempre, voltando a cada rodada.
 * Agora o cartão tem REQUISITOS, cada um cumprido ou não, e um NÍVEL:
 *   Fraco     — falta algo ESSENCIAL (resposta completa, "saiba mais", texto limpo);
 *   Quase lá  — o essencial está; faltam itens DESEJÁVEIS (base legal, dica na lacuna);
 *   Completo  — tudo cumprido.
 * Só o nível "Fraco" entra na fila do elevar: é o que a IA sabe e pode consertar. O
 * que já passou por uma rodada aceita, ou voltou sem melhorar duas vezes, sai da fila.
 *
 * COMO É USADO: um roteiro em 3 passos (copiar o prompt · colar a resposta · conferir e
 * aplicar), com os botões sempre no rodapé, a próxima rodada já preparada e nada que
 * se perca por um clique repetido.
 *
 * Reaproveita: conferirCorrecaoParcial / coberturaConteudo (parser.js),
 * cqLerBiblioteca (cartao-qualidade.js) e pcPadrao (prompts-cartao.js).
 * =================================================================== */
const CE_LIM = {
  versoCurto: 100,     // resposta abaixo disto não ensina: é só o dado solto
  lote: 15,            // cartões por prompt (o prompt precisa caber na IA)
  visiveis: 40,
  fonteMax: 3000,      // do resumo de cada tópico
  fonteTotal: 9000,
  encolheu: 0.9,       // devolvido com menos de 90% do tamanho...
  coberturaOk: 95,     // ...E perdendo palavras (cobertura < 95%) = encolheu de verdade
  tentativas: 2,       // voltou sem melhorar tantas vezes = difícil: sai da fila
  lacunas: 3,          // mais que isto numa frase só = lacunas demais
};

/* Os requisitos. "essencial" decide o nível; o peso só ordena (piores primeiro). */
const CE_REQ = [
  { id: "verso_curto", essencial: true, peso: 40 },
  { id: "sem_mais", essencial: true, peso: 35 },
  { id: "fonte_no_texto", essencial: true, peso: 25 },
  { id: "sem_artigo", essencial: false, peso: 10 },
  { id: "cloze_sem_dica", essencial: false, peso: 5 },
  { id: "lacunas_demais", essencial: false, peso: 5 },
];
/* a ordem em que as faltas são listadas (a mesma de sempre, para os textos e os testes) */
const CE_ORDEM = ["verso_curto", "sem_artigo", "sem_mais", "cloze_sem_dica", "lacunas_demais", "fonte_no_texto"];

/* Base legal = qualquer forma de citar de onde vem: artigo, § ou inciso, súmula, lei/LC/EC/MP nº,
 * emenda constitucional, decreto, CF, CTN. (Antes só valia "art." e "§": a Súmula 160/STJ e a EC nº 03/1993
 * não contavam, e o cartão ficava eternamente sem base legal.) */
const CE_ART_RE = new RegExp([
  String.raw`\bart(?:igo|s)?\.?\s*\d`, String.raw`§\s*\d`, String.raw`\binciso\b`, String.raw`\bcaput\b`,
  String.raw`\bs[úu]mula\b`, String.raw`\b(?:lei|lc|ec|mp|dl)\s*(?:complementar\s*|ordin[áa]ria\s*)?(?:n[ºo°.]?\s*)?\d`,
  String.raw`\bemenda constitucional\b`, String.raw`\bdecreto(?:-lei)?\s*n`, String.raw`\bcf\s*\/?\s*(?:88|1988)\b`,
  String.raw`\bctn\b`, String.raw`\bconstitui[cç][aã]o federal\b`,
].join("|"), "i");

function ceEhCloze(c) { return !!c && (c.kind === "cloze" || /\{\{c\d+::/.test(String(c.front || ""))); }

/* Lacunas do cartão: [{ resposta, dica }] */
function ceLacunas(f) {
  return (String(f || "").match(/\{\{c\d+::[^}]*\}\}/g) || []).map((x) => {
    const p = x.slice(2, -2).replace(/^c\d+::/, "").split("::");
    return { resposta: (p[0] || "").trim(), dica: (p[1] || "").trim() };
  });
}

/* O que este requisito diz do cartão: { aplica, ok } */
function ceChecar(id, c) {
  const f = String((c && c.front) || ""), b = String((c && c.back) || ""), m = String((c && c.more) || "");
  const cloze = ceEhCloze(c);
  const lac = cloze ? ceLacunas(f) : [];
  switch (id) {
    case "verso_curto": return { aplica: !cloze, ok: b.trim().length >= CE_LIM.versoCurto };
    case "sem_mais": return { aplica: true, ok: !!m.trim() };
    case "fonte_no_texto": return { aplica: true, ok: !/\(\s*fonte\s*:/i.test(f + " " + b) };
    case "sem_artigo": return { aplica: true, ok: CE_ART_RE.test(f + " " + b + " " + m) };
    case "cloze_sem_dica": {
      /* dica só faz falta quando a lacuna é uma escolha ("30 ou 60?"); "Sim/Não" não precisa de dica */
      const util = lac.filter((x) => !/^(sim|n[aã]o)$/i.test(x.resposta));
      return { aplica: cloze && util.length > 0, ok: util.some((x) => x.dica) };
    }
    case "lacunas_demais": return { aplica: cloze && lac.length > 0, ok: lac.length <= CE_LIM.lacunas };
    default: return { aplica: false, ok: true };
  }
}

/* A AVALIAÇÃO — o objeto que a tela e o aplicativo leem:
 *   { nivel: "fraco"|"medio"|"bom", nota, falhas: [ids], essenciais: [ids],
 *     requisitos: [{ id, essencial, aplica, ok }], cumpridos, total } */
function ceAvaliar(c) {
  const requisitos = CE_REQ.map((r) => { const x = ceChecar(r.id, c); return { id: r.id, essencial: r.essencial, aplica: x.aplica, ok: x.ok }; });
  const aplicaveis = requisitos.filter((r) => r.aplica);
  const falhasSet = new Set(aplicaveis.filter((r) => !r.ok).map((r) => r.id));
  const falhas = CE_ORDEM.filter((id) => falhasSet.has(id));
  const essenciais = falhas.filter((id) => CE_REQ.find((r) => r.id === id).essencial);
  const nota = Math.max(0, 100 - falhas.reduce((s, id) => s + CE_REQ.find((r) => r.id === id).peso, 0));
  return {
    nivel: essenciais.length ? "fraco" : (falhas.length ? "medio" : "bom"),
    nota, falhas, essenciais, requisitos,
    cumpridos: aplicaveis.filter((r) => r.ok).length, total: aplicaveis.length,
  };
}

/* Compatibilidade: o resto do app (gerenciador, pacote, testes) usa estes três. */
function ceDefeitos(c) { return ceAvaliar(c).falhas; }
function ceNota(c) { return ceAvaliar(c).nota; }
function ceNivel(c) { return ceAvaliar(c).nivel; }
/* "Abaixo do padrão" = nível Fraco: falta algo essencial. */
function ceAbaixo(c) { return ceAvaliar(c).nivel === "fraco"; }
function ceRotuloNivel(c) { return t("ce_nivel_" + ceNivel(c)); }

/* ---- o registro do que já foi trabalhado ---- */
const CE_CHAVE_REV = "eac_ce_revisados";

/* OS OBJETIVOS (o que se quer melhorar). "completar" é o de sempre (níveis e requisitos). Os outros vieram da revisão
 * manual antiga, agora no mesmo fluxo: conferir os fatos (números, datas, artigos), dividir cartões longos e arrumar a
 * forma (curtos, sem resposta, sem pergunta). Cada um tem a sua fila, o seu prompt e a sua memória de "já trabalhado" —
 * um cartão completado ainda pode precisar de conferência de fatos. */
const CE_OBJETIVOS = ["completar", "fatos", "dividir", "forma"];
let ceObjetivo = "completar";
const CE_RISCO_RE = /\b(art\.?|artigo|s[úu]mula|lei|inciso)\b|§|\d{2,}|\d+\s*%|R\$|\b(19|20)\d{2}\b/i;
const CE_ALVO = {
  fatos: (c) => CE_RISCO_RE.test(String(c.front || "") + " " + String(c.back || "") + " " + String(c.more || "")),
  dividir: (c) => (String(c.front || "") + String(c.back || "")).length > 220,
  forma: (c) => (String(c.front || "") + " " + String(c.back || "")).replace(/\{\{c\d+::|\}\}/g, "").trim().length < 25
    || (c.kind !== "cloze" && c.kind !== "mc" && !String(c.back || "").trim())
    || (c.kind === "basic" && !/\?\s*$/.test(String(c.front || "").trim())),
};
function ceServeAoObjetivo(obj, c) { return !!c && (obj === "completar" || !CE_ALVO[obj] ? true : CE_ALVO[obj](c)); }

/* a chave leva frente E verso: cartão editado depois (ou outro com a mesma pergunta) é candidato de novo.
 * Fora do objetivo "completar" a chave leva o objetivo junto (a memória de cada um é separada). */
function ceChaveCartao(c, obj) {
  const o = obj === undefined ? ceObjetivo : obj;
  return cqHash(cqNormal(cqRevelado(c) + " | " + String((c && c.back) || "")) + (o && o !== "completar" ? " |obj:" + o : ""));
}

function ceRevLer() {
  try { const m = JSON.parse(localStorage.getItem(CE_CHAVE_REV) || "{}"); return m && typeof m === "object" ? m : {}; } catch (e) { return {}; }
}
function ceRevGravar(m) {
  try {
    const ks = Object.keys(m);
    if (ks.length > 6000) ks.slice(0, ks.length - 6000).forEach((k) => { delete m[k]; });
    localStorage.setItem(CE_CHAVE_REV, JSON.stringify(m));
  } catch (e) {}
}

/* saiu de uma rodada aceita: não volta para a fila */
function ceMarcarRevisados(cards) {
  const m = ceRevLer();
  (cards || []).forEach((c) => { m[ceChaveCartao(c)] = { ok: 1, q: new Date().toISOString().slice(0, 10) }; });
  ceRevGravar(m);
}
/* voltou (ou não voltou) e não foi aceito: conta uma tentativa */
function ceMarcarTentativa(cards) {
  const m = ceRevLer();
  (cards || []).forEach((c) => { const k = ceChaveCartao(c); const r = m[k] || {}; if (!r.ok) m[k] = { t: (r.t || 0) + 1, q: new Date().toISOString().slice(0, 10) }; });
  ceRevGravar(m);
}
function ceRevisado(c, mapa) {
  const r = (mapa || ceRevLer())[ceChaveCartao(c)];
  return !!r && (!!r.ok || (r.t || 0) >= CE_LIM.tentativas);
}
function ceRevLimpar() { try { localStorage.removeItem(CE_CHAVE_REV); } catch (e) {} }

/* Etiquetas usadas uma vez só na biblioteca: quase sempre ruído do gerador
 * (num baralho real eram 139 etiquetas para 955 cartões). */
function ceTagsUnicas(notas) {
  const cont = new Map();
  (notas || []).forEach((n) => ((n.card && n.card.ownTags) || []).forEach((tg) => {
    const k = String(tg).toLowerCase();
    cont.set(k, (cont.get(k) || 0) + 1);
  }));
  return [...cont.entries()].filter((e) => e[1] === 1).map((e) => e[0]).sort();
}

/* Classifica a biblioteca: cada nota ganha { nivel, nota, defeitos, revisado }. */
function ceClassificar(notas) {
  const rev = ceRevLer();
  return (notas || []).map((n) => {
    const a = ceAvaliar(n.card);
    return Object.assign({ nivel: a.nivel, nota: a.nota, defeitos: a.falhas, revisado: ceRevisado(n.card, rev) }, n);
  });
}

const cePiores = (a, b) => a.nota - b.nota || String(a.topico).localeCompare(String(b.topico));

/* A fila do elevar: nível Fraco, ainda não trabalhado, os piores primeiro.
 * opc.incluirMedios: entra também o "Quase lá"; opc.incluirRevisados: o que já foi trabalhado. */
function ceLerAbaixo(opc) {
  const o = opc || {};
  return ceClassificar(cqLerBiblioteca())
    .filter((n) => (n.nivel === "fraco" || (o.incluirMedios && n.nivel === "medio")) && (o.incluirRevisados || !n.revisado))
    .sort(cePiores);
}

/* O resumo de cada tópico do lote vira FONTE: sem ela a IA só teria o próprio
 * cartão, e "citar o artigo" vira invenção. */
function ceFontes(itens) {
  const vistos = new Set(), partes = [];
  let total = 0;
  (itens || []).forEach((n) => {
    if (vistos.has(n.chave)) return;
    vistos.add(n.chave);
    const r = (typeof matResumos === "object" && matResumos[n.chave]) || {};
    const txt = String(r.texto || "").trim();
    if (!txt || total >= CE_LIM.fonteTotal) return;
    const corte = txt.slice(0, Math.min(CE_LIM.fonteMax, CE_LIM.fonteTotal - total));
    total += corte.length;
    partes.push("### " + [n.disciplina, n.topico].filter(Boolean).join(" · ") + "\n" + corte);
  });
  return partes.join("\n\n");
}

function ceMontarPrompt(itens) {
  const blocos = itens.map((n, i) => ({ id: i + 1, texto: cardToLine(n.card), cartoesOriginais: 1 }));
  const trechos = blocos.map((b) => "@@ " + b.id + "\n" + b.texto).join("\n\n");
  const fontes = ceFontes(itens);
  return {
    blocos,
    texto: t(ceObjetivo === "completar" || CE_OBJETIVOS.indexOf(ceObjetivo) < 0 ? "ce_prompt" : "ce_prompt_" + ceObjetivo,
      { n: itens.length, trechos, fontes: fontes || t("ce_sem_fonte") }),
  };
}

/* Troca o cartão (com o "@" de cima e os "+" de baixo) pelo texto novo. */
function ceSubstituir(bruto, c, novo) {
  const linhas = String(bruto || "").split("\n");
  const raw = String((c && c.raw) || "").trim();
  let k = c && c.line ? c.line - 1 : -1;
  if (k < 0 || String(linhas[k] || "").trim() !== raw) k = linhas.findIndex((l) => l.trim() === raw);
  if (k < 0) return null;
  let de = k, ate = k;
  while (ate + 1 < linhas.length && /^\s*[+*]\s/.test(linhas[ate + 1])) ate++;
  if (de > 0 && /^\s*@\s/.test(linhas[de - 1])) de--;
  linhas.splice(de, ate - de + 1, ...String(novo).replace(/\s+$/, "").split(/\r?\n/));
  return linhas.join("\n");
}

function ceSemFonte(s) { return String(s || "").replace(/\(\s*fonte\s*:[^)]*\)/gi, ""); }

/* A IA tem hábitos: escreve a explicação com "*" em vez de "+", deixa uma linha em branco entre o
 * cartão e a explicação, e repete linhas. Cada rodada acrescentava mais uma explicação órfã (o
 * "+" que vem depois de uma linha em branco não é levado junto na hora de trocar o cartão), e o
 * mesmo "Esquema —" aparecia duas vezes no "antes". Aqui a resposta é arrumada ANTES de conferir:
 * "*" vira "+", a explicação cola no cartão, e linha "+" repetida no mesmo cartão sai. */
function ceNormalizarResposta(txt) {
  const saida = [];
  let ultimoNaoVazio = "";
  let vistas = new Set();
  String(txt || "").split(/\r?\n/).forEach((linha) => {
    let l = linha;
    if (/^\s*@@\s*\d+\s*$/.test(l)) { saida.push(l); ultimoNaoVazio = l; vistas = new Set(); return; }
    if (/^\s*\*\s+\S/.test(l) && ultimoNaoVazio && !/^\s*@@/.test(ultimoNaoVazio) && !/^\s*@\s/.test(ultimoNaoVazio)) l = l.replace(/^\s*\*\s+/, "+ ");
    if (/^\s*\+\s/.test(l)) {
      const k = l.toLowerCase().replace(/\s+/g, " ").trim();
      if (vistas.has(k)) return;
      vistas.add(k);
      /* a explicação cola no cartão: sem linha em branco no meio */
      if (ultimoNaoVazio && !/^\s*@@/.test(ultimoNaoVazio) && !/^\s*@\s/.test(ultimoNaoVazio)) { while (saida.length && !saida[saida.length - 1].trim()) saida.pop(); }
    } else if (l.trim() && !/^\s*@\s/.test(l)) { vistas = new Set(); }
    saida.push(l);
    if (l.trim()) ultimoNaoVazio = l;
  });
  return saida.join("\n");
}

/* Confere a resposta da IA ANTES de tocar em qualquer coisa.
 * Devolve { erros, avisos, itens } — cada item já com o que mudou. */
function ceConferir(resposta, itens, blocos) {
  const r = conferirCorrecaoParcial(ceNormalizarResposta(resposta), blocos);
  const saida = [];
  r.aplicar.forEach((a) => {
    const n = itens[a.id - 1];
    if (!n) return;
    const av = [];
    /* tirar "(Fonte: ...)" do texto é justamente o pedido: não conta como perda */
    const cob = coberturaConteudo(ceSemFonte(a.texto), a.novo);
    /* MENOR só é problema se perdeu palavras: um original com linhas repetidas encolhe ao ser limpo */
    if (String(a.novo).length < String(a.texto).length * CE_LIM.encolheu && cob.pct < CE_LIM.coberturaOk) av.push({ id: "encolheu", n: a.id });
    if (cob.pct < COBERTURA_MIN) av.push({ id: "perdeu", n: a.id, p: cob.pct, termos: cob.faltando.slice(0, 6).join(", ") });
    let novos = [];
    try { novos = parseText(a.novo, []).cards; } catch (e) {}
    const avs = novos.map(ceAvaliar);
    const pior = avs.length ? avs.slice().sort((x, y) => x.nota - y.nota)[0] : null;
    if (ceObjetivo === "completar" && pior && pior.nivel === "fraco") av.push({ id: "continua", n: a.id });
    const antes = ceAvaliar(n.card);
    saida.push({ nota: n, id: a.id, antes: a.texto, depois: a.novo, cartoes: a.cartoes, cobertura: cob.pct,
                 notaDepois: pior ? pior.nota : 0, nivelAntes: antes.nivel, nivelDepois: pior ? pior.nivel : "fraco",
                 reqAntes: antes, reqDepois: pior, novosCards: novos, avisos: av });
  });
  /* o aviso de "perdeu conteúdo" já sai por cartão, com a caixa de aceitar */
  const perdeu = new Set(r.aplicar.filter((a) => a.cobertura < COBERTURA_MIN)
    .map((a) => t("fixpart_perdeu", { n: a.id, p: a.cobertura, termos: a.faltando.slice(0, 6).join(", ") })));
  return { erros: r.erros, avisos: r.avisos.filter((x) => !perdeu.has(x)), itens: saida };
}

/* ---- desfazer a última rodada ---- */
const CE_CHAVE_RECIBO = "eac_ce_recibo";

function ceAplicarLote(aceitos) {
  const antes = {}, tocados = new Set();
  let trocados = 0, naoAchou = 0;
  aceitos.forEach((it) => {
    const ch = it.nota.chave;
    const bruto = cqTexto(ch);
    if (!(ch in antes)) { antes[ch] = bruto; cqVersaoBancada("antes de elevar cartões ao padrão", [ch]); }
    const novo = ceSubstituir(bruto, it.nota.card, it.depois);
    if (novo === null) { naoAchou++; return; }
    cqGravar(ch, novo, { disciplina: it.nota.disciplina, topico: it.nota.topico });
    tocados.add(ch); trocados++;
    /* o que voltou de uma rodada aceita sai da fila, sobre o que sobrar de falta desejável */
    try { ceMarcarRevisados(it.novosCards || parseText(it.depois, []).cards); } catch (e) {}
  });
  const itens = [...tocados].map((ch) => ({ chave: ch, antes: antes[ch], depois: cqTexto(ch),
    disciplina: (matResumos[ch] || {}).disciplina, topico: (matResumos[ch] || {}).topico }));
  if (itens.length) {
    try { localStorage.setItem(CE_CHAVE_RECIBO, JSON.stringify({ quando: new Date().toISOString(), itens })); } catch (e) {}
  }
  try { matReg("cartoes", "cartões elevados ao padrão", trocados + " trocado(s), " + naoAchou + " não achado(s)"); } catch (e) {}
  return { trocados, naoAchou };
}

function ceRecibo() {
  try { return JSON.parse(localStorage.getItem(CE_CHAVE_RECIBO) || "null"); } catch (e) { return null; }
}

/* Só desfaz o tópico que continua exatamente como a rodada o deixou: se a
 * pessoa mexeu depois, desfazer apagaria o trabalho dela. */
function ceDesfazerLote() {
  const rec = ceRecibo();
  if (!rec || !rec.itens) return { desfeitos: 0, pulados: 0 };
  let desfeitos = 0, pulados = 0;
  rec.itens.forEach((it) => {
    if (cqTexto(it.chave) !== it.depois) { pulados++; return; }
    cqVersaoBancada("antes de desfazer a rodada", [it.chave]);
    cqGravar(it.chave, it.antes, { disciplina: it.disciplina, topico: it.topico });
    desfeitos++;
  });
  if (!pulados) { try { localStorage.removeItem(CE_CHAVE_RECIBO); } catch (e) {} }
  try { matReg("cartoes", "rodada de melhoria desfeita", desfeitos + " tópico(s), " + pulados + " pulado(s)"); } catch (e) {}
  return { desfeitos, pulados };
}

/* ---- a tela: um roteiro em 3 passos ----
 *   passo 1  copiar o prompt da rodada        (a rodada já vem escolhida)
 *   passo 2  colar a resposta da IA           (confere sozinha ao colar)
 *   passo 3  conferir o antes/depois e aplicar (e a próxima rodada já fica pronta)
 * Os botões ficam SEMPRE no rodapé (nada de rolar a tela atrás deles), cada clique mostra
 * na hora o que fez, e nada da rodada em andamento se perde por um clique repetido. */
let ceForcadas = null, ceNotas = [], ceSel = new Set(), ceMostrando = CE_LIM.visiveis, ceConf = null, cePedido = null;
let cePasso = 1, ceRodada = 1, ceStats = { total: 0, fracos: 0, medios: 0, bons: 0, escondidos: 0 }, ceIncluirMedios = false;

/* A explicação de cada botão desta janela: id → chave do texto (o teste confere que nenhum fica de fora). */
const CE_DICAS = {
  btnCeMarcar: "ce_tip_marcar", btnCeLimpar: "ce_tip_limpar", btnCeMais: "ce_tip_mais", btnCeMostrarRev: "ce_tip_mostrar_rev",
  btnCePrompt: "ce_tip_prompt", btnCeCopiar: "ce_tip_copiar", btnCeColarClip: "ce_tip_colar", btnCeConferir: "ce_tip_conferir",
  btnCeAplicar: "ce_tip_aplicar", btnCeNova: "ce_tip_nova", btnCeDescartar: "ce_tip_descartar",
  btnCeDesfazer: "ce_tip_desfazer", btnCeFechar: "ce_tip_fechar", ceObjetivo: "ce_tip_obj",
};

/* troca o objetivo: refaz a fila e já marca os piores. Só antes de gerar o prompt (depois, a rodada está em andamento). */
function ceTrocarObjetivo(obj) {
  if (cePasso > 1 || CE_OBJETIVOS.indexOf(obj) < 0) return false;
  ceObjetivo = obj;
  ceForcadas = null;
  ceMostrando = CE_LIM.visiveis; ceSel = new Set(); ceConf = null; cePedido = null;
  ceCalcular();
  ceMarcarPiores();
  ceStatus(ceNotas.length ? t("ce_msg_rodada", { r: ceRodada, n: ceSel.size }) : t("ce_msg_nada_obj"), ceNotas.length ? "" : "ok");
  try { matReg("cartoes", "melhorar cartões: objetivo " + obj, ceNotas.length + " na fila"); } catch (e) {}
  return true;
}

function cePintarObjetivos() {
  const sel = $("ceObjetivo");
  if (!sel) return;
  sel.innerHTML = "";
  CE_OBJETIVOS.forEach((o) => { const op = document.createElement("option"); op.value = o; op.textContent = t("ce_obj_" + o); sel.append(op); });
  sel.value = ceObjetivo;
}

function ceEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

/* o selo do nível: bolinha colorida + palavra (nunca só a cor) */
function ceSelo(nivel) {
  const s = ceEl("span", "ce-nivel ce-nivel-" + nivel, t("ce_nivel_" + nivel));
  s.title = t("ce_nivel_ajuda_" + nivel);
  return s;
}

/* a lista de requisitos de um cartão: ✓ cumpriu · ✗ falta · — não se aplica */
function ceChecklist(av) {
  const ul = ceEl("ul", "ce-checks");
  av.requisitos.forEach((r) => {
    if (!r.aplica) return;
    ul.append(ceEl("li", "ce-check " + (r.ok ? "ce-ok" : (r.essencial ? "ce-falta" : "ce-desej")), (r.ok ? "✓ " : (r.essencial ? "✗ " : "○ ")) + t("ce_req_" + r.id)));
  });
  return ul;
}

function ceCalcular() {
  const todas = ceClassificar(cqLerBiblioteca());
  ceStats = { total: todas.length, fracos: 0, medios: 0, bons: 0, escondidos: 0 };
  todas.forEach((n) => {
    /* "fracos" são os DA FILA; os já trabalhados aparecem à parte, senão a conta nunca chega a zero */
    if (n.nivel === "fraco") { if (n.revisado) ceStats.escondidos++; else ceStats.fracos++; } else if (n.nivel === "medio") ceStats.medios++; else ceStats.bons++;
  });
  if (!ceForcadas && ceObjetivo !== "completar") {
    const alvo = todas.filter((n) => ceServeAoObjetivo(ceObjetivo, n.card));
    ceStats.fila = alvo.filter((n) => !n.revisado).length;
    ceStats.escondidos = alvo.length - ceStats.fila;
    ceNotas = alvo.filter((n) => !n.revisado).sort(cePiores);
    ceSel = new Set([...ceSel].filter((i) => i < ceNotas.length));
    return ceNotas;
  }
  ceNotas = ceForcadas
    ? ceForcadas.map((n) => { const a = ceAvaliar(n.card); return Object.assign({ nivel: a.nivel, nota: a.nota, defeitos: a.falhas }, n); })
    : todas.filter((n) => (n.nivel === "fraco" || (ceIncluirMedios && n.nivel === "medio")) && !n.revisado).sort(cePiores);
  ceSel = new Set([...ceSel].filter((i) => i < ceNotas.length));
  return ceNotas;
}

function ceContarSel() {
  $("ceSel").textContent = t("ce_sel", { n: ceSel.size, max: CE_LIM.lote });
  $("ceEscolhaTit").textContent = t("ce_escolha_tit", { n: ceSel.size, t: ceNotas.length });
}

/* uma frase de estado, no alto, que se lê sem rolar; some sozinha da vista só quando muda */
function ceStatus(texto, tipo) {
  const m = $("ceMsg");
  m.textContent = texto || "";
  m.className = "ce-msg" + (tipo ? " ce-msg-" + tipo : "");
}

/* o botão mostra que foi apertado: "✓ …" por um instante, e a frase de estado fica */
function ceFlash(id, texto) {
  const b = $(id);
  if (!b) return;
  b.dataset.feito = texto;
  b.classList.add("btn-feito");
  const antes = b.dataset.rotulo || b.textContent;
  b.dataset.rotulo = antes;
  b.textContent = texto;               /* o "✓" vem do CSS (.btn-feito::before) */
  setTimeout(() => { b.classList.remove("btn-feito"); b.textContent = b.dataset.rotulo; }, 1600);
}

function cePintarRodape() {
  const p = cePasso, temRec = (() => { const r = ceRecibo(); return !!(r && r.itens && r.itens.length); })();
  const n = ceSel.size;
  const rot = (id, txt) => { const b = $(id); b.textContent = txt; b.dataset.rotulo = txt; };
  rot("btnCePrompt", p === 1 ? t("ce_b_prompt", { n }) : t("ce_b_prompt_de_novo"));
  $("btnCePrompt").hidden = false;
  $("btnCePrompt").disabled = p === 1 ? !n : !cePedido;
  $("btnCePrompt").className = "btn " + (p === 1 ? "btn-verde ce-prim" : "btn-cinza");
  $("btnCeColarClip").hidden = p === 1;
  $("btnCeConferir").hidden = p !== 2;
  $("btnCeAplicar").hidden = !(p === 3 && ceConf && ceConf.itens.length);
  $("btnCeDescartar").hidden = p === 1;
  $("btnCeNova").hidden = p === 1;
  $("btnCeDesfazer").hidden = !temRec;
  [1, 2, 3].forEach((i) => {
    const li = $("cePasso" + i);
    li.className = "ce-passo" + (i === p ? " ce-passo-atual" : (i < p ? " ce-passo-feito" : ""));
  });
  /* enquanto há prompt/resposta em andamento, a escolha dos cartões fica travada: nenhum clique a desfaz */
  const travada = p > 1;
  ["btnCeMarcar", "btnCeLimpar", "ceObjetivo"].forEach((id) => { if ($(id)) $(id).disabled = travada; });
  try { $("ceEscolha").open = p === 1; } catch (e) {}
  $("cePromptCx").hidden = p !== 2 || !cePedido;
  $("ceColarCx").hidden = p !== 2;
  $("ceComparar").hidden = !(p === 3 && ceConf);
}

function cePintar() {
  const r = ceStats;
  $("ceResumo").textContent = r.total && !ceForcadas && ceObjetivo !== "completar"
    ? t("ce_resumo_obj", { n: r.fila, esc: r.escondidos || 0 })
    : r.total
    ? t("ce_resumo", { r: ceRodada, f: r.fracos, m: r.medios, b: r.bons, n: r.total })
      + (r.escondidos ? " · " + t("ce_resumo_esc", { n: r.escondidos }) : "")
    : t("cq_sem_cartoes");
  $("btnCeMostrarRev").hidden = !r.escondidos;
  const cx = $("ceLista");
  cx.innerHTML = "";
  if (r.total && !ceNotas.length) cx.append(ceEl("p", "nota", t(ceForcadas ? "ce_nenhum" : "ce_nada_fila")));
  ceNotas.slice(0, ceMostrando).forEach((n, i) => {
    const lin = ceEl("label", "ce-item");
    const ck = ceEl("input"); ck.type = "checkbox"; ck.checked = ceSel.has(i); ck.disabled = cePasso > 1;
    ck.onchange = () => {
      if (cePasso > 1) { ck.checked = ceSel.has(i); return; }
      if (ck.checked) {
        if (ceSel.size >= CE_LIM.lote) { ck.checked = false; ceStatus(t("ce_lote_cheio", { max: CE_LIM.lote }), "aviso"); return; }
        ceSel.add(i);
      } else ceSel.delete(i);
      ceContarSel(); cePintarRodape();
    };
    const corpo = ceEl("span", "ce-corpo");
    const topo = ceEl("span", "ce-topo");
    topo.append(ceSelo(n.nivel), ceEl("span", "ce-f", " " + cqTrecho(cqRevelado(n.card), 120)));
    corpo.append(topo);
    const falta = n.defeitos.length ? t("ce_falta", { x: n.defeitos.map((d) => t("ce_def_" + d)).join(" · ") }) : "";
    if (falta) corpo.append(ceEl("span", "ce-def", falta));
    corpo.append(ceEl("span", "cq-onde", [n.disciplina, n.topico].filter(Boolean).join(" · ")));
    lin.append(ck, corpo);
    cx.append(lin);
  });
  $("btnCeMais").hidden = ceNotas.length <= ceMostrando;
  ceContarSel();
  cePintarRodape();
}

/* a rodada: os piores da fila, já escolhidos */
function ceMarcarPiores() {
  if (cePasso > 1) return;
  ceSel = new Set();
  for (let i = 0; i < Math.min(CE_LIM.lote, ceNotas.length); i++) ceSel.add(i);
  ceMostrando = Math.max(ceMostrando, CE_LIM.lote);
  cePintar();
}

/* Passo 1. Gera o prompt (uma vez por rodada) e COPIA. Clicar de novo só copia de novo: não refaz
 * a rodada nem apaga a resposta que já foi colada. */
function ceGerarPrompt() {
  if (!cePedido) {
    const itens = [...ceSel].sort((a, b) => a - b).map((i) => ceNotas[i]);
    if (!itens.length) return;
    cePedido = { itens, ...ceMontarPrompt(itens) };
    ceConf = null;
    try { matReg("cartoes", "prompt em lote para elevar ao padrão", itens.length + " cartões"); } catch (e) {}
  }
  $("cePrompt").value = cePedido.texto;
  if (cePasso === 1) cePasso = 2;
  cePintar();
  try { $("ceColar").focus(); } catch (e) {}
  try { $("ceColarCx").scrollIntoView(); } catch (e) {}
  return ceCopiarPrompt();
}

async function ceCopiarPrompt() {
  try {
    await navigator.clipboard.writeText($("cePrompt").value);
    ceStatus(t("ce_msg_copiado"), "ok"); ceFlash("btnCePrompt", t("ce_flash_copiado"));
  } catch (e) {
    let copiou = false;
    try { $("cePrompt").select(); copiou = !!document.execCommand("copy"); } catch (e2) {}
    if (copiou) { ceStatus(t("ce_msg_copiado"), "ok"); ceFlash("btnCePrompt", t("ce_flash_copiado")); }
    else ceStatus(t("ce_copiar_manual"), "aviso");
  }
}

/* Passo 2. Cola da área de transferência (se o navegador deixar) e já confere. */
async function ceColarDaArea() {
  try {
    const txt = await navigator.clipboard.readText();
    if (!String(txt || "").trim()) { ceStatus(t("ce_colar_vazio"), "aviso"); return; }
    $("ceColar").value = txt;
    ceFlash("btnCeColarClip", t("ce_flash_colado"));
    ceConferirColagem();
  } catch (e) {
    try { $("ceColar").focus(); } catch (e2) {}
    ceStatus(t("ce_msg_sem_area"), "aviso");
  }
}

function ceConferirColagem() {
  if (!cePedido) return;
  const resposta = $("ceColar").value;
  if (!resposta.trim()) { ceStatus(t("ce_colar_vazio"), "aviso"); uiAlert(t("ce_colar_vazio")); return; }
  ceConf = ceConferir(resposta, cePedido.itens, cePedido.blocos);
  cePasso = 3;
  cePintarComparacao();
  cePintarRodape();
  const n = ceConf.itens.length;
  ceStatus(ceConf.erros.length && !n ? t("ce_msg_conf_erro") : t("ce_msg_colou", { n }), ceConf.erros.length ? "aviso" : "ok");
  try { $("ceComparar").scrollIntoView(); } catch (e) {}
}

function cePintarComparacao() {
  const cx = $("ceComparar");
  cx.innerHTML = ""; cx.hidden = false;
  const c = ceConf;
  const atualizaBotao = () => { $("btnCeAplicar").textContent = t("ce_aplicar", { n: c.itens.filter((x) => x.aceitar).length }); $("btnCeAplicar").dataset.rotulo = $("btnCeAplicar").textContent; };
  c.erros.forEach((e) => cx.append(ceEl("div", "ce-erro", e)));

  c.itens.forEach((it) => {
    const box = ceEl("div", "ce-cmp");
    const ck = ceEl("input"); ck.type = "checkbox";
    it.aceitar = !it.avisos.some((a) => a.id === "encolheu" || a.id === "perdeu");
    ck.checked = it.aceitar;
    ck.onchange = () => { it.aceitar = ck.checked; atualizaBotao(); };
    const cab = ceEl("label", "cq-grupo-tit ce-cmp-cab");
    cab.append(ck, ceSelo(it.nivelAntes), ceEl("span", "ce-seta", "→"), ceSelo(it.nivelDepois),
      ceEl("span", "", " " + t("ce_cmp_tit", { a: it.antes.length, d: it.depois.length })));
    box.append(cab);
    /* o que mudou, em requisitos: ganhou / perdeu */
    const ganhou = [], perdeu = [];
    if (it.reqDepois) it.reqAntes.requisitos.forEach((r, i) => {
      const d = it.reqDepois.requisitos[i];
      if (!r.aplica || !d.aplica) return;
      if (!r.ok && d.ok) ganhou.push(t("ce_req_" + r.id));
      if (r.ok && !d.ok) perdeu.push(t("ce_req_" + r.id));
    });
    const resumo = ceEl("div", "ce-mudou");
    if (it.reqDepois) resumo.append(ceEl("span", "", t("ce_cmp_req", { a: it.reqAntes.cumpridos, d: it.reqDepois.cumpridos, t: it.reqDepois.total })));
    if (ganhou.length) resumo.append(ceEl("span", "ce-ok", " · " + t("ce_ganhou", { x: ganhou.join(", ") })));
    if (perdeu.length) resumo.append(ceEl("span", "ce-falta", " · " + t("ce_perdeu_req", { x: perdeu.join(", ") })));
    box.append(resumo);
    if (it.reqDepois) { const faltam = it.reqDepois.requisitos.filter((r) => r.aplica && !r.ok); if (faltam.length) box.append(ceChecklist(it.reqDepois)); }
    it.avisos.forEach((a) => box.append(ceEl("div", "ce-aviso", t("ce_av_" + a.id, a))));
    const det = ceEl("details", "ce-det");
    det.append(ceEl("summary", "", t("ce_ver_texto")));
    const par = ceEl("div", "ce-par");
    const a1 = ceEl("div", "ce-lado"); a1.append(ceEl("b", "", t("ce_antes")), ceEl("pre", "", it.antes));
    const a2 = ceEl("div", "ce-lado"); a2.append(ceEl("b", "", t("ce_depois")), ceEl("pre", "", it.depois));
    par.append(a1, a2);
    det.append(par);
    box.append(det);
    cx.append(box);
  });
  /* os avisos de âncora vão DEPOIS dos cartões: o que importa (o antes e depois) aparece primeiro */
  c.avisos.forEach((e) => cx.append(ceEl("div", "ce-aviso", e)));
  atualizaBotao();
}

/* Passo 3. Aplica, guarda o que voltou sem melhorar como tentativa, e JÁ deixa a próxima rodada pronta. */
async function ceAplicar() {
  if (!ceConf) return;
  const aceitos = ceConf.itens.filter((x) => x.aceitar);
  if (!aceitos.length) { ceStatus(t("ce_nenhum_aceito"), "aviso"); uiAlert(t("ce_nenhum_aceito")); return; }
  if (!(await uiConfirm(t("ce_conf_aplicar", { n: aceitos.length })))) return;
  const naoAceitos = ceConf.itens.filter((x) => !x.aceitar).map((x) => x.nota.card)
    .concat(cePedido ? cePedido.itens.filter((n, i) => !ceConf.itens.some((x) => x.id === i + 1)).map((n) => n.card) : []);
  const r = ceAplicarLote(aceitos);
  try { ceMarcarTentativa(naoAceitos); } catch (e) {}
  ceProximaRodada();
  try { matRender(); } catch (e) {}
  ceStatus(t("ce_msg_aplicada", { r: ceRodada - 1, n: r.trocados, m: r.naoAchou }) + " " + (ceNotas.length ? t("ce_msg_rodada", { r: ceRodada, n: ceSel.size }) : t("ce_msg_nada")), "ok");
}

/* limpa a rodada e escolhe a seguinte */
function ceProximaRodada() {
  ceConf = null; cePedido = null; ceSel = new Set(); ceForcadas = null; cePasso = 1; ceRodada++;
  $("ceColar").value = ""; $("cePrompt").value = "";
  ceCalcular(); ceMarcarPiores();
}

/* descartar a rodada: o que voltou e não foi aplicado conta como tentativa */
async function ceDescartar() {
  if (cePasso === 1) return;
  if (!(await uiConfirm(t("ce_conf_descartar")))) return;
  try { if (cePedido) ceMarcarTentativa(cePedido.itens.map((n) => n.card)); } catch (e) {}
  ceConf = null; cePedido = null; cePasso = 1; $("ceColar").value = ""; $("cePrompt").value = "";
  ceCalcular(); ceMarcarPiores();
  ceStatus(t("ce_msg_descartada"), "aviso");
}

/* trocar a seleção: só depois de avisar que descarta o prompt e a resposta */
async function ceTrocarSelecao() {
  if (cePasso === 1) return;
  if (!(await uiConfirm(t("ce_conf_nova")))) return;
  ceConf = null; cePedido = null; cePasso = 1; $("ceColar").value = ""; $("cePrompt").value = "";
  cePintar();
  ceStatus(t("ce_msg_selecao"), "aviso");
  try { $("ceEscolha").open = true; } catch (e) {}
}

async function ceDesfazer() {
  if (!(await uiConfirm(t("ce_conf_desfazer")))) return;
  const r = ceDesfazerLote();
  ceCalcular(); cePintar();
  try { matRender(); } catch (e) {}
  ceStatus(t("ce_desfeito", { n: r.desfeitos, m: r.pulados }), "ok");
}

/* opc.notas: abre com ESTES cartões (vindos do gerenciador), fracos ou não. */
function ceAbrir(opc) {
  ceForcadas = opc && Array.isArray(opc.notas) ? opc.notas : null;
  ceObjetivo = opc && CE_OBJETIVOS.indexOf(opc.objetivo) >= 0 ? opc.objetivo : "completar";
  cePintarObjetivos();
  ceMostrando = CE_LIM.visiveis; ceSel = new Set(); ceConf = null; cePedido = null; cePasso = 1; ceRodada = 1;
  $("ceColar").value = ""; $("cePrompt").value = "";
  ceCalcular();
  ceMarcarPiores();
  ceStatus(ceNotas.length ? t("ce_msg_rodada", { r: ceRodada, n: ceSel.size }) : t("ce_msg_nada"), ceNotas.length ? "" : "ok");
  dicasDosBotoes(CE_DICAS);
  abrirModal("dlgCartElevar");
  try { matReg("cartoes", "elevar ao padrão aberto", ceNotas.length + " na fila"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnCartElevar")) {
  $("btnCartElevar").onclick = () => ceAbrir();
  if ($("btnBancaElevar")) $("btnBancaElevar").onclick = () => ceAbrir();
  if ($("ceObjetivo")) $("ceObjetivo").onchange = () => { if (!ceTrocarObjetivo($("ceObjetivo").value)) $("ceObjetivo").value = ceObjetivo; };
  if ($("btnCeFechar")) $("btnCeFechar").onclick = async () => {
    if (cePasso > 1 && !(await uiConfirm(t("ce_conf_fechar")))) return;
    $("dlgCartElevar").close();
  };
  if ($("btnCeMais")) $("btnCeMais").onclick = () => { ceMostrando += CE_LIM.visiveis; cePintar(); flashBotao($("btnCeMais")); };
  if ($("btnCeMarcar")) $("btnCeMarcar").onclick = () => { ceMarcarPiores(); if (cePasso === 1) flashBotao($("btnCeMarcar")); };
  if ($("btnCeLimpar")) $("btnCeLimpar").onclick = () => { if (cePasso > 1) return; ceSel = new Set(); cePintar(); flashBotao($("btnCeLimpar")); };
  if ($("btnCePrompt")) $("btnCePrompt").onclick = () => (cePasso === 1 ? ceGerarPrompt() : ceCopiarPrompt());
  if ($("btnCeCopiar")) $("btnCeCopiar").onclick = () => { flashBotao($("btnCeCopiar")); return ceCopiarPrompt(); };
  if ($("btnCeColarClip")) $("btnCeColarClip").onclick = ceColarDaArea;
  if ($("btnCeConferir")) $("btnCeConferir").onclick = ceConferirColagem;
  if ($("btnCeAplicar")) $("btnCeAplicar").onclick = ceAplicar;
  if ($("btnCeDescartar")) $("btnCeDescartar").onclick = ceDescartar;
  if ($("btnCeNova")) $("btnCeNova").onclick = ceTrocarSelecao;
  if ($("btnCeDesfazer")) $("btnCeDesfazer").onclick = ceDesfazer;
  if ($("btnCeMostrarRev")) $("btnCeMostrarRev").onclick = async () => {
    if (cePasso > 1) return;
    if (!(await uiConfirm(t("ce_conf_mostrar_rev")))) return;
    ceRevLimpar(); ceCalcular(); ceMarcarPiores();
    ceStatus(t("ce_msg_rev_limpo"), "ok");
  };
  if ($("ceColar")) $("ceColar").onpaste = () => setTimeout(() => { if (cePedido && $("ceColar").value.trim()) ceConferirColagem(); }, 60);
}
