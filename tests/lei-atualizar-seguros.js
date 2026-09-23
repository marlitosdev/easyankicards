/* =====================================================================
 * "ACEITAR OS SEM RISCO": reduzir os cliques na comparação de versão nova
 *
 * Colando a versão nova da Constituição via arquivo .htm sobre uma lei que já tinha 45 diferenças, a tela
 * pedia clicar "aceito"/"recusar" uma por uma, sem nenhum atalho — diferente da revisão da colagem, que já
 * tem "aceitar todos"/"recusar todos" por grupo.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada item de comparação (nas duas telas: "lei inteira" via leiCompararVersoes, e "lei que altera" via
 *     leiItensDaAlteradora, incluindo os itens de ANEXO) ganha um `seguro`: false se tiver qualquer alerta de
 *     severidade "alerta" (precisa de atenção de verdade) ou "aviso" (incerto — ex.: artigo AUSENTE, que
 *     "ausência não é prova de revogação"); true quando só há avisos "info" (nota, número que mudou, revogado
 *     pela PRÓPRIA lei) ou nenhum alerta.
 *  2. "Aceitar os sem risco" marca de uma vez só os itens seguros AINDA SEM DECISÃO — nunca os que precisam de
 *     atenção, mesmo chamado várias vezes — e pula a tela para o primeiro que ainda precisa de decisão.
 *  3. A barra só aparece enquanto sobrar item seguro por decidir, com a contagem certa dos dois lados.
 *  4. O item marcado em lote fica registrado como tal no histórico de decisões (via "lote_sem_risco"), diferente
 *     de um aceito individualmente ("item").
 *  5. A tela continua abrindo no item 1 (isso NÃO muda) — só o botão novo pula para o que importa.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const p = iniciar();

  /* ---- fixture A: "lei inteira" (leiCompararVersoes) — 3 seguros, 1 nao ---- */
  const ANOT = "(Redação dada pela LC 227/2026)";
  const antigoA = ["Art. 1º. O prazo é de trinta dias — contados da ciência.", "Art. 2º. Segundo artigo do texto.",
    "Art. 3º. O contribuinte pagará a multa de 10 por cento sobre o valor devido ao Município de Caruaru na forma desta Lei.",
    "Art. 4º. Quarto artigo do texto com redação antiga, que traz uma regra longa o bastante para que o texto novo, se vier cortado, pareça bem menor do que ele.", "Art. 5º. Quinto."].join("\n");
  const novoA = ["Art. 1º. O prazo é de trinta dias - contados da ciência.", "Art. 2º. Segundo artigo do texto. " + ANOT,
    "Art. 3º. O contribuinte pagará a multa de 20 por cento sobre o valor devido ao Município de Caruaru na forma desta Lei.",
    "Art. 4º. [...]", "Art. 5º. Quinto.", "Art. 6º. Sexto artigo, novo de verdade, com bastante texto para nao cair em nenhum alerta de tamanho."].join("\n");

  /* ---- fixture B: "lei que altera" (leiItensDaAlteradora) — 2 seguros, 2 nao ---- */
  const BASE = ["Art. 5º. Tributo é toda prestação pecuniária.", "Art. 91. Requisitos do parcelamento:", "I. a pessoa jurídica de direito público;",
    "Art. 162. Os contribuintes devem se inscrever.", "§ 1º A inscrição é obrigatória.", "§ 2º A baixa é obrigatória.", "§ 3º Os dados são públicos.",
    "Art. 248. São responsáveis:", "I. os tomadores:", "a) construtoras;", "b) bancos;", "II. os intermediários.", "Art. 300. Outro artigo."].join("\n");
  const LC145 = ["LEI COMPLEMENTAR Nº 145, DE 23 DE DEZEMBRO DE 2024", "Altera a Lei Complementar nº 15, de 05 de janeiro de 2009 e dá outras providências.",
    "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:",
    "“ Art. 162 [...]", "§4º O contribuinte que não realizar movimentação terá sua inscrição suspensa. (AC)",
    "§5º O contribuinte inscrito que não realizar atividade terá sua inscrição baixada. (AC)", "[...]",
    "Art. 248 [...]", "I. [...] f) companhias aéreas ou seus representantes; (NR) g) empresas de plano de saúde; (NR) h) empresas de rádio; (NR) i) a empresa de seguro; (AC)",
    "II São solidariamente responsáveis pela retenção: (NR)",
    "Art. 2º Ficam substituídos os Anexos VI, VII e XV da Lei Complementar nº 15/2009.",
    "Art. 3º Fica revogado o Anexo XI da Lei Complementar nº 15/2009.",
    "Art. 4º Fica revogado o art. 5º da Lei Complementar nº 15/2009.",
    "Art. 5º Esta Lei Complementar entra em vigor na data de sua publicação."].join("\n");

  /* ---- 1: o campo `seguro`, nos dois caminhos ---- */
  {
    const cmp = p.leiCompararVersoes(antigoA, novoA, {});
    const por = (num) => cmp.itens.filter((i) => i.num === num)[0];
    ok(por("2").seguro === true && por("3").seguro === true && por("6").seguro === true, "A1 mudou/novo so' com avisos 'info' (ou nenhum): seguro");
    ok(por("4").seguro === false, "A2 mudou com alerta ('[...]' omitido, texto menor): NAO seguro: " + JSON.stringify(por("4").alertas));

    const l = p.leiGuardar ? null : null; /* leiGuardar nao existe em p (so' na api completa); usa iniciar() abaixo para o resto */
    const api = iniciar();
    const lg = api.leiGuardar({ id: "lei_lc15", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE });
    const par = api.leiLerAlteradora(LC145, lg);
    const itens = api.leiItensDaAlteradora(lg, par);
    const porB = (num) => itens.filter((i) => i.num === num)[0];
    ok(porB("5").seguro === true && porB("5").tipo === "revogado", "B1 revogado por ORDEM da lei alteradora (nao por ausencia): seguro");
    ok(porB("162").seguro === true, "B2 mescla limpa, sem alerta: seguro");
    ok(porB("248").seguro === false, "B3 mescla com 'nao_existia' (alinea nova que ainda nao existia): NAO seguro: " + JSON.stringify(porB("248").alertas));
    ok(porB("ANEXO:XI").seguro === false && porB("ANEXO:XI").tipo === "anexo_rev", "B4 anexo a revogar sem base guardada ('anexo_sem_base'): NAO seguro (o campo tambem vale pros itens de ANEXO)");

    /* o caso AUSENTE (artigo que so' nao aparece na versao nova) NUNCA e' seguro — "ausencia nao e' prova de revogacao" */
    const base2 = Array.from({ length: 12 }, (_, i) => "Art. " + (i + 1) + "º Texto " + (i + 1) + ".").join("\n");
    const parcial2 = ["Art. 1º Texto do artigo 1 com redação própria e completa da lei.", "Art. 2º Texto novo do artigo dois inteiro."].join("\n");
    const rev = api.leiCompararVersoes(base2, parcial2, { ausentes: "revogar" });
    ok(rev.itens.filter((i) => i.tipo === "revogado").every((i) => i.seguro === false), "A3 TODO artigo 'possivelmente revogado' por ausencia e' NAO seguro, sempre");

    /* mesmo quando a AUSENCIA e' o UNICO alerta (sem 'ausente_incompleto', que so' soma quando a cobertura geral
     * e' baixa) — o alerta de ausencia sozinho, de severidade so' "aviso" (nunca "alerta"), ja basta para NAO ser
     * seguro. Cobertura alta (9 de 10 = 90%, exatamente no limite que NAO soma o alerta extra) prova isso. */
    const dez = Array.from({ length: 10 }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ", completo e próprio para não cair em alerta de tamanho.").join("\n");
    const semArt5 = dez.split("\n").filter((_, i) => i !== 4).join("\n");
    const rev2 = api.leiCompararVersoes(dez, semArt5, { ausentes: "revogar" });
    const it5 = rev2.itens.filter((i) => i.num === "5")[0];
    ok(it5.alertas.length === 1 && it5.alertas[0].k === "ausente" && it5.alertas[0].sev === "aviso" && it5.seguro === false,
      "A4 alerta de ausencia SOZINHO (so' 'aviso', nunca chega a 'alerta'): ainda assim NAO seguro: " + JSON.stringify(it5.alertas) + " seguro=" + it5.seguro);
  }

  /* ---- 2: leiUpdPrimeiroAtencao ---- */
  {
    const api = iniciar();
    const cmp = api.leiCompararVersoes(antigoA, novoA, {});
    ok(api.leiUpdPrimeiroAtencao(cmp.itens) === cmp.itens.findIndex((i) => i.num === "4"), "P1 acha o indice do primeiro item NAO seguro e ainda sem decisao (o '4')");
    const semNenhum = cmp.itens.filter((i) => i.seguro);
    ok(api.leiUpdPrimeiroAtencao(semNenhum) === 0, "P2 sem nenhum item arriscado, devolve 0");
    ok(api.leiUpdPrimeiroAtencao([]) === 0 && api.leiUpdPrimeiroAtencao(null) === 0 && api.leiUpdPrimeiroAtencao(undefined) === 0, "P3 lista vazia ou ausente: 0, sem quebrar");
    const item4 = cmp.itens.filter((i) => i.num === "4")[0]; item4.aceito = true;
    ok(api.leiUpdPrimeiroAtencao(cmp.itens) === 0, "P4 o item arriscado JA DECIDIDO nao conta mais: sobra so' o 0 padrao");
  }

  /* ---- 3: leiUpdAceitarSeguros() — "lei inteira" ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei X/2020", texto: antigoA });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "atualização de teste";
    api.$("leiUpdTexto").value = novoA;
    api.leiAtualizarComparar();
    ok(api.leiUpdIdxAtual() === 0, "C1 a tela continua abrindo no item 1 (isso nao muda)");
    const antes = api.leiUpdComparoAtual().map((i) => [i.num, i.aceito]);
    ok(antes.every(([, a]) => a === false), "C1a (nada decidido ainda)");
    /* a pessoa RECUSA um dos seguros (o '3') antes de clicar "aceitar os sem risco" — a decisao dela vale, o
     * botao nao pode desfazer uma recusa que ja foi dada */
    const idx3 = api.leiUpdComparoAtual().findIndex((i) => i.num === "3");
    while (api.leiUpdIdxAtual() !== idx3) api.leiUpdMover(api.leiUpdIdxAtual() < idx3 ? 1 : -1);
    api.leiUpdPular();
    ok(api.leiUpdComparoAtual().filter((i) => i.num === "3")[0].recusado === true, "C1b o '3' foi recusado a mao");
    /* volta pro comeco antes de clicar o botao: se o "pulou pro que importa" nao fizer nada de verdade (so'
     * ficar onde o cursor ja estava por acaso, do "recusar" ali em cima), este teste nota */
    while (api.leiUpdIdxAtual() > 0) api.leiUpdMover(-1);
    ok(api.leiUpdIdxAtual() === 0, "C1c (o indice volta ao 0 antes do botao, de proposito)");
    api.leiUpdAceitarSeguros();
    const dep = api.leiUpdComparoAtual();
    const porNum = {}; dep.forEach((i) => { porNum[i.num] = i; });
    ok(porNum["2"].aceito === true && porNum["6"].aceito === true, "C2 os outros 2 seguros foram aceitos de uma vez");
    ok(porNum["3"].recusado === true && porNum["3"].aceito === false, "C2a o '3', recusado a mao, CONTINUA recusado — o botao nao reverte uma decisao da pessoa: " + JSON.stringify(porNum["3"]));
    ok(porNum["4"].aceito === false && porNum["4"].recusado === false, "C3 o NAO seguro continua sem decisao — nao foi tocado");
    ok(api.leiUpdIdxAtual() === dep.findIndex((i) => i.num === "4"), "C4 a tela pulou para o item que precisa de atencao");
    ok(porNum["2"].viaLote === true && porNum["4"].viaLote === undefined, "C5 so' os aceitos em lote ficam marcados 'viaLote'");
    /* chamar de novo nao faz nada (ja foram todos aceitos que podiam) */
    const antesN = api.leiUpdComparoAtual().filter((i) => i.aceito).length;
    api.leiUpdAceitarSeguros();
    ok(api.leiUpdComparoAtual().filter((i) => i.aceito).length === antesN, "C6 chamar de novo e' inofensivo (nada mais para aceitar)");
    /* decidir o 4 na mao e finalizar: o historico distingue lote de individual */
    api.leiUpdAceitar();
    api.leiAtualizarAplicar();
    const drs = api.decLer().filter((x) => x.area === "versao");
    const d2 = drs.filter((x) => x.ref === "art. 2º")[0], d4 = drs.filter((x) => x.ref === "art. 4º")[0];
    ok(d2 && d2.via === "lote_sem_risco", "C7 o historico do item aceito em lote diz 'lote_sem_risco': " + (d2 && d2.via));
    ok(d4 && d4.via === "item", "C7a o item decidido individualmente continua 'item': " + (d4 && d4.via));
  }

  /* ---- 4: leiUpdAceitarSeguros() — "lei que altera" (inclui item de ANEXO) ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ id: "lei_lc15b", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdTexto").value = LC145;
    api.leiAtualizarComparar();
    const itens0 = api.leiUpdComparoAtual();
    ok(itens0.length === 4, "D1 (4 itens: art. 5, 162, 248, ANEXO:XI): " + itens0.map((i) => i.num));
    ok(api.$("leiUpdSegurosTxt").textContent === "2 sem risco identificado · 2 precisam de atenção", "D1a a barra conta os 2 seguros e os 2 que precisam de atencao: " + api.$("leiUpdSegurosTxt").textContent);
    /* decide UM dos dois que precisam de atencao (o '248') SEM usar o botao — a contagem "precisam de atenção"
     * tem que refletir so' o que ainda esta PENDENTE, nao todo item nao-seguro que existe */
    const idx248 = itens0.findIndex((i) => i.num === "248");
    while (api.leiUpdIdxAtual() !== idx248) api.leiUpdMover(api.leiUpdIdxAtual() < idx248 ? 1 : -1);
    api.leiUpdPular();
    ok(api.$("leiUpdSegurosTxt").textContent === "2 sem risco identificado · 1 precisam de atenção", "D1b decidido o '248', a contagem cai para 1 (so' o ANEXO:XI continua pendente): " + api.$("leiUpdSegurosTxt").textContent);
    /* volta pro 0 antes do botao — de proposito, para o pulo so' passar se a funcao de verdade recalcular */
    while (api.leiUpdIdxAtual() > 0) api.leiUpdMover(-1);
    api.leiUpdAceitarSeguros();
    const dep = api.leiUpdComparoAtual();
    const porNum = {}; dep.forEach((i) => { porNum[i.num] = i; });
    ok(porNum["5"].aceito === true && porNum["162"].aceito === true, "D2 os 2 seguros (revogado por ordem + mescla limpa) foram aceitos");
    ok(porNum["248"].recusado === true && porNum["ANEXO:XI"].aceito === false && porNum["ANEXO:XI"].recusado === false, "D3 o '248' segue recusado (decisao da pessoa) e o ANEXO continua sem decisao");
    ok(api.leiUpdIdxAtual() === dep.findIndex((i) => i.num === "ANEXO:XI"), "D4 pulou para o unico que ainda precisa de atencao (o ANEXO:XI)");
  }

  /* ---- 5: a tela ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei X/2020", texto: antigoA });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "teste";
    api.$("leiUpdTexto").value = novoA;
    api.leiAtualizarComparar();
    const barra = api.$("leiUpdSegurosBar");
    ok(!!barra && barra.hidden === false, "T1 a barra aparece (ha 3 itens seguros por decidir)");
    ok(api.$("leiUpdSegurosTxt").textContent === "3 sem risco identificado · 1 precisam de atenção", "T2 o texto da barra conta certo: " + api.$("leiUpdSegurosTxt").textContent);
    ok(api.$("btnLeiUpdAceitarSeguros").textContent === "aceitar os 3 sem risco", "T3 o botao mostra quantos: " + api.$("btnLeiUpdAceitarSeguros").textContent);
    /* o item NAO seguro mostra o aviso no titulo */
    api.leiUpdMover(3); /* indice 3 = item "4", o nao seguro (0:"2",1:"3",2:"4"? confirmar pela ordem real) */
    const idxNaoSeguro = api.leiUpdComparoAtual().findIndex((i) => i.num === "4");
    api.leiUpdMoverPara ? null : null;
    while (api.leiUpdIdxAtual() !== idxNaoSeguro) api.leiUpdMover(api.leiUpdIdxAtual() < idxNaoSeguro ? 1 : -1);
    ok(/precisa de atenção/.test(api.$("leiUpdItem").querySelector(".duv-titulo").textContent), "T4 o titulo do item arriscado mostra 'precisa de atenção': " + api.$("leiUpdItem").querySelector(".duv-titulo").textContent);
    const idxSeguro = api.leiUpdComparoAtual().findIndex((i) => i.num === "2");
    while (api.leiUpdIdxAtual() !== idxSeguro) api.leiUpdMover(api.leiUpdIdxAtual() < idxSeguro ? 1 : -1);
    ok(!/precisa de atenção/.test(api.$("leiUpdItem").querySelector(".duv-titulo").textContent), "T5 o item seguro NAO mostra o aviso");
    /* depois de aceitar todos os seguros, a barra some */
    api.leiUpdAceitarSeguros();
    ok(api.$("leiUpdSegurosBar").hidden === true, "T6 sem nenhum seguro pendente, a barra some");
  }

  /* ---- 6: sem nenhum item seguro: a barra nunca aparece ----
   * (lei pequena — total < 10 — para nao cair na "conferencia de cobertura baixa", que abre outro dialogo) */
  {
    const api = iniciar();
    const a1 = "Art. 1º Texto do artigo um, completo e próprio.";
    const base2 = [a1, "Art. 2º Texto do artigo dois, completo e próprio.", "Art. 3º Texto do artigo três, completo e próprio.",
      "Art. 4º Texto do artigo quatro, completo e próprio.", "Art. 5º Texto do artigo cinco, completo e próprio."].join("\n");
    const l = api.leiGuardar({ nome: "Lei Y/2020", texto: base2 });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "teste";
    api.$("leiUpdTexto").value = a1;   /* só o art. 1 (sem mudança) aparece na versão nova: 2 a 5 ficam ausentes */
    const res = api.leiAtualizarComparar();
    ok(res === true, "E0 a comparacao abriu direto (lei pequena, sem cair na conferencia de cobertura): " + res);
    ok(api.leiUpdComparoAtual().every((i) => i.tipo === "revogado" && i.seguro === false), "E1 todos os itens sao 'possivelmente revogado' por ausencia (nao seguro): a barra nunca aparece");
    ok(api.$("leiUpdSegurosBar").hidden === true, "E1a a barra fica escondida");
    api.leiUpdAceitarSeguros();
    ok(api.leiUpdComparoAtual().every((i) => !i.aceito), "E2 chamar o botao (mesmo sem nada seguro) nao aceita nada");
  }

  /* ---- 7: nao mudou o comportamento de "finalizar" com item sem decisao ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ nome: "Lei X/2020", texto: antigoA });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "teste";
    api.$("leiUpdTexto").value = novoA;
    api.leiAtualizarComparar();
    api.leiUpdAceitarSeguros(); /* aceita 3; o "4" fica sem decisao */
    ok(api.$("btnLeiUpdFinalizar").disabled !== true, "F1 'finalizar' continua sem ficar desabilitado so' por sobrar item sem decisao (comportamento antigo preservado)");
    api.leiAtualizarAplicar();
    const dep = api.leiDe(l.id);
    ok(!("4" in (dep.alteracoes || {})), "F2 o item sem decisao ('4') simplesmente nao entra — nao trava nem e' aplicado por engano");
    ok("2" in dep.alteracoes && "3" in dep.alteracoes && "6" in dep.alteracoes, "F3 os 3 aceitos entraram normalmente");
  }

  /* ---- 8: os textos ---- */
  {
    const chaves = ["lei_upd_seguros_txt", "lei_upd_seguros_btn", "lei_upd_seguros_aceitos", "lei_upd_atencao_badge"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I1 as frases existem em portugues e em ingles, com os mesmos campos: " + chaves.filter((k) => linhas(k).length !== 2 || campos(linhas(k)[0]) !== campos(linhas(k)[1])));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
