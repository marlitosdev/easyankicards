/* =====================================================================
 * ATUALIZAR COM A LEI QUE ALTERA — "só alterações", artigo a artigo
 *
 * O CASO REAL. A LC 95/2022, a 112/2023 e a 145/2024 alteram o Código
 * Tributário de Caruaru (LC 15/2009) SEM trazer o Código inteiro: trazem os
 * dispositivos alterados entre aspas, com "(NR)" nova redação, "(AC)"
 * acréscimo, "REVOGADO" e "[...]" no lugar do que não mudou. Muitas vezes a
 * alteração é só de um inciso ou de uma alínea, sem tocar no caput.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Os artigos PRÓPRIOS da lei alteradora (1º, 2º, 3º…) não são artigos do
 *     Código; só os artigos-ALVO contam.
 *  2. A alteração vem por ENDEREÇO: o inciso II do Art. 91, o §5º do Art. 117,
 *     a alínea f do inciso I do Art. 248 — e é MESCLADA no artigo vigente, no
 *     lugar certo, sem apagar o resto.
 *  3. Artigo inteiro (sem "[...]") substitui; artigo em partes mescla.
 *  4. O que a lei alteradora NÃO cita nunca é tocado: nada vira "revogado" por
 *     ausência. Revogação só quando a lei MANDA ("Fica revogado o art. 5º",
 *     "§ 2º REVOGADO") — e ordem de revogar OUTRA lei é ignorada.
 *  5. Onde a mescla não acha o dispositivo, diz qual — e a pessoa edita o texto
 *     proposto antes de aceitar.
 *  6. Cada artigo guarda o HISTÓRICO das leis que mexeram nele; aplicar uma lei
 *     mais antiga por cima de uma mais nova é avisado.
 *  7. Anexos: a ordem é lida e o tratamento fica em lei-anexos.js; sem o texto do anexo novo, é só aviso.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

const BASE = [
  "Art. 5º. Tributo é toda prestação pecuniária.",
  "Art. 91. Requisitos do parcelamento:",
  "I. a pessoa jurídica de direito público;",
  "II. à Secretaria Municipal da Fazenda, quando o crédito estiver em cobrança administrativa.",
  "Art. 96. Correção do parcelamento:",
  "I - pagamento em parcelas;",
  "II - a atualização monetária será calculada pela taxa Selic;",
  "III - juros de mora de 1%.",
  "Art. 100. Os pagamentos:",
  "I - dinheiro;",
  "II - cheque;",
  "III - depósito.",
  "Art. 106. A multa de mora será reduzida em até 10%.",
  "Art. 117. Compensação:",
  "§ 1º A compensação depende de requerimento.",
  "§ 2º Prazo de dois anos.",
  "Art. 162. Os contribuintes devem se inscrever.",
  "§ 1º A inscrição é obrigatória.",
  "§ 2º A baixa é obrigatória.",
  "§ 3º Os dados são públicos.",
  "Art. 173. Cessa a competência da Secretaria.",
  "Parágrafo único. Cabe à Secretaria a cobrança.",
  "Art. 248. São responsáveis:",
  "I. os tomadores:",
  "a) construtoras;",
  "b) bancos;",
  "c) seguradoras;",
  "d) escolas;",
  "e) hospitais;",
  "f) companhias antigas;",
  "g) empresas de saúde;",
  "II. os intermediários.",
  "Art. 296. Isenções:",
  "§ 1º Pedidos.",
  "§ 2º Prazo de dois anos.",
  "Art. 300. Outro artigo.",
].join("\n");

const CAB145 = ["LEI COMPLEMENTAR Nº 145, DE 23 DE DEZEMBRO DE 2024",
  "Altera a Lei Complementar nº 15, de 05 de janeiro de 2009 e dá outras providências.",
  "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:"];
const LC145 = CAB145.concat([
  "“ Art. 162 [...]",
  "§4º O contribuinte que não realizar movimentação terá sua inscrição suspensa. (AC)",
  "§5º O contribuinte inscrito que não realizar atividade terá sua inscrição baixada. (AC)",
  "[...]",
  "Art. 248 [...]",
  "I. [...] f) companhias aéreas ou seus representantes; (NR) g) empresas de plano de saúde; (NR) h) empresas de rádio; (NR) i) a empresa de seguro; (AC)",
  "II São solidariamente responsáveis pela retenção: (NR)",
  "Art. 2º Ficam substituídos os Anexos VI, VII e XV da Lei Complementar nº 15/2009.",
  "Art. 3º Fica revogado o Anexo XI da Lei Complementar nº 15/2009.",
  "Art. 4º Fica revogado o art. 5º da Lei Complementar nº 15/2009.",
  "Art. 5º Esta Lei Complementar entra em vigor na data de sua publicação.",
]).join("\n");

const LC95 = ["LEI COMPLEMENTAR Nº 95, DE 28 DE SETEMBRO DE 2022.", "Altera Lei Complementar nº 015, 05 de janeiro de 2009, e dá outras providências.",
  "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:",
  "\"Art. 96. [ ... ]",
  "II a atualização monetária sobre o saldo devedor será calculada com base na variação do IPCA; (NR)",
  "Art. 100. [ ... ]",
  "IV cartão magnético. (AC)",
  "Art. 106. A multa de mora será reduzida em até 25% (vinte e cinco por cento) se o sujeito passivo recolher, em pagamento único, a totalidade. (NR)",
  "Art. 296. [ ... ]",
  "§ 2º REVOGADO",
  "Art. 2º Fica revogado o § 1º do art. 117 da Lei Complementar nº 015, de 05 de janeiro de 2009.",
  "Art. 3º Revoga-se o art. 9º da Lei nº 123, de 2000.",
  "Art. 4º Esta Lei entra em vigor na data de sua publicação."].join("\n");

const LC112 = ["LEI COMPLEMENTAR Nº 112, DE 09 DE JUNHO DE 2023", "Altera dispositivos da Lei Complementar nº 015, de 05 de janeiro de 2009.",
  "Art. 1º A Lei Complementar nº 015, de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:",
  "“Art. 91 [...]", "II. à Procuradoria-Geral do Município, quando o crédito tributário se encontrar inscrito em Dívida Ativa.”", "(NR)",
  "“Art. 117 [...]", "§5º. Em se tratando de crédito inscrito em Dívida Ativa, a Procuradoria será ouvida antes da decisão.”", "(NR)",
  "“Art. 173 Cessa a competência da Secretaria Municipal da Fazenda para cobrança de débitos com a inscrição em Dívida Ativa.",
  "Parágrafo único. Cabe à Procuradoria-Geral do Município executar, coordenar e fiscalizar a cobrança.”", "(NR)",
  "Art. 2º Esta Lei Complementar entra em vigor na data de sua publicação."].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const { api: p } = rodar();
  const lei = (extra) => Object.assign({ id: "lei_lc15", nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE, alteracoes: {} }, extra || {});
  const linhasDe = (t, num) => p.leiArtigo(t, num).texto.split("\n");

  /* ==============================================================
   * A: LER A LEI ALTERADORA
   * ============================================================== */
  {
    const par = p.leiLerAlteradora(LC145, lei());
    ok(par.curto === "LC 145/2024" && par.dataLei === "2024-12-23", "A1 identificacao e data da lei alteradora: " + par.curto + " " + par.dataLei);
    ok(par.proprios === 5, "A1a os artigos PROPRIOS (1º a 5º) devem ser separados dos artigos-alvo: " + par.proprios);
    ok(par.blocos.map((b) => b.num).join(",") === "162,248", "A1b os artigos-alvo: " + par.blocos.map((b) => b.num));
    ok(par.blocos.every((b) => b.bloco.parcial), "A1c '[...]' deixa o artigo PARCIAL");
    ok(par.revogacoes.map((r) => r.num).join(",") === "5", "A1d 'Fica revogado o art. 5º' (desta lei): " + JSON.stringify(par.revogacoes));
    ok(par.ordensAnexo.length === 2 && par.ordensAnexo[0].acao === "substituir" && par.ordensAnexo[0].alvos.join() === "VI,VII,XV" && par.ordensAnexo[1].acao === "revogar" && par.ordensAnexo[1].alvos.join() === "XI",
       "A1e as ordens sobre Anexos sao LIDAS (o tratamento esta em lei-anexos.js): " + JSON.stringify(par.ordensAnexo));
    const u248 = par.blocos[1].bloco.unidades.map((u) => u.chave + "/" + u.acao).join(",");
    ok(u248 === "I/omitido,I>f/nr,I>g/nr,I>h/nr,I>i/ac,II/nr", "A2 o endereco e a marca de cada pedaco do art. 248: " + u248);
    ok(par.blocos[0].bloco.unidades.map((u) => u.chave + "/" + u.acao).join(",") === "P4/ac,P5/ac", "A2a art. 162: " + par.blocos[0].bloco.unidades.map((u) => u.chave));
  }
  {
    const par = p.leiLerAlteradora(LC95, lei());
    ok(par.dataLei === "2022-09-28" && par.curto === "LC 95/2022", "A3 LC 95: " + par.curto + " " + par.dataLei);
    ok(par.blocos.map((b) => b.num).join(",") === "96,100,106,296", "A3a artigos-alvo da LC 95 (as aspas simples e o [ ... ] com espacos): " + par.blocos.map((b) => b.num));
    ok(par.blocos[2].bloco.parcial === false && par.blocos[2].bloco.caputAcao === "nr", "A3b Art. 106 vem INTEIRO (sem [...])");
    ok(par.blocos[3].bloco.unidades[0].chave === "P2" && par.blocos[3].bloco.unidades[0].acao === "rev", "A3c '§ 2º REVOGADO': " + JSON.stringify(par.blocos[3].bloco.unidades));
    ok(par.revogacoes.length === 1 && par.revogacoes[0].num === "117" && par.revogacoes[0].unidade.paragrafos[0] === "1º",
       "A3d 'Fica revogado o § 1º do art. 117' vale; 'Revoga-se o art. 9º da Lei nº 123' (OUTRA lei) nao: " + JSON.stringify(par.revogacoes));
  }
  {
    const par = p.leiLerAlteradora(LC112, lei());
    ok(par.blocos.map((b) => b.num).join(",") === "91,117,173" && par.proprios === 2, "A4 LC 112 (aspas curvas, '(NR)' em linha propria): " + par.blocos.map((b) => b.num) + " proprios " + par.proprios);
    ok(par.blocos[2].bloco.parcial === false && par.blocos[2].bloco.unidades.map((u) => u.chave).join(",") === "PU", "A4a Art. 173 vem inteiro, com Parágrafo único: " + JSON.stringify(par.blocos[2].bloco));
  }
  ok(p.leiAlteradoraCitaLei(LC145, lei()) === true && p.leiAlteradoraCitaLei("LEI Nº 9\nArt. 1º Texto qualquer da Lei Complementar nº 77.", lei()) === false, "A5 a lei alteradora cita a lei-alvo pelo numero?");
  ok(p.leiDataDaLei("LEI Nº 8, DE 5 DE MARÇO DE 2001") === "2001-03-05", "A5a data com 'março'");

  /* ==============================================================
   * M: MESCLAR NO ARTIGO VIGENTE
   * ============================================================== */
  {
    const par = p.leiLerAlteradora(LC145, lei());
    const it = p.leiItensDaAlteradora(lei(), par);
    const i162 = it.filter((x) => x.num === "162")[0], i248 = it.filter((x) => x.num === "248")[0], i5 = it.filter((x) => x.num === "5")[0];
    ok(i162 && i162.tipo === "mudou" && i162.parcial, "M1 Art. 162");
    ok(linhasDe(i162.novo, "162").map((l) => l.slice(0, 4)).join("|") === "Art.|§ 1º|§ 2º|§ 3º|§4º |§5º ", "M1a os §4º e §5º entram DEPOIS do §3º e o resto fica: " + linhasDe(i162.novo, "162").map((l) => l.slice(0, 6)).join("|"));
    ok(/\(Incluído por LC 145\/2024\)/.test(i162.novo), "M1b o acrescimo leva 'Incluído por LC 145/2024'");
    const l248 = linhasDe(i248.novo, "248").map((l) => l.slice(0, 3));
    ok(l248.join("|") === "Art|I. |a) |b) |c) |d) |e) |f) |g) |h) |i) |II.", "M2 alineas f, g, h (NR) e i (AC) do inciso I, sem tocar a a e: " + l248.join("|"));
    ok(/f\) companhias aéreas/.test(i248.novo) && !/companhias antigas/.test(i248.novo) && /Redação dada por LC 145\/2024/.test(i248.novo), "M2a a alinea f foi SUBSTITUIDA (nova redacao)");
    ok(/II\. São solidariamente responsáveis pela retenção:/.test(i248.novo) && !/os intermediários/.test(i248.novo), "M2b inciso II com nova redacao");
    ok(/Art\. 248\. São responsáveis:/.test(i248.novo) && /I\. os tomadores:/.test(i248.novo), "M2c o caput e o inciso I nao foram tocados (so ha '[...]' neles)");
    ok(i248.problemas.length === 1 && i248.problemas[0].unidade === "alínea h do inciso I", "M2d so a alinea h (NR) nao existia na lei gravada, e o app diz: " + JSON.stringify(i248.problemas));
    ok(!i248.alertas.some((a) => /^numeros/.test(a.k)) && !i162.alertas.some((a) => /^numeros/.test(a.k)), "M2e o ano da nota (Redação dada por LC 145/2024) virou 'numero que mudou': " + JSON.stringify(i248.alertas));
    ok(i5 && i5.tipo === "revogado" && i5.novo === "" && i5.alertas.some((a) => a.k === "revogado_pela_lei"), "M3 'Fica revogado o art. 5º': " + JSON.stringify(i5));
    ok(!it.some((x) => x.num === "300" || x.num === "173"), "M4 o que a lei NAO cita nunca vira item (nada e' 'revogado' por ausencia)");
  }
  {
    const par = p.leiLerAlteradora(LC95, lei());
    const it = p.leiItensDaAlteradora(lei(), par);
    const por = {}; it.forEach((x) => { por[x.num] = x; });
    ok(/II - a atualização monetária sobre o saldo devedor será calculada com base na variação do IPCA/.test(por["96"].novo) && /I - pagamento em parcelas;/.test(por["96"].novo) && /III - juros de mora de 1%/.test(por["96"].novo),
       "M5 inciso II do art. 96 trocado; I e III intactos: " + por["96"].novo);
    ok(linhasDe(por["100"].novo, "100").length === 5 && /^IV cartão magnético/.test(linhasDe(por["100"].novo, "100")[4]), "M6 inciso IV acrescentado depois do III: " + por["100"].novo);
    ok(por["106"].parcial === false && /reduzida em até 25%/.test(por["106"].novo) && /Redação dada por LC 95\/2022/.test(por["106"].novo), "M7 artigo INTEIRO substitui: " + por["106"].novo);
    ok(/§ 2º \(Revogado por LC 95\/2022\)/.test(por["296"].novo) && /§ 1º Pedidos\./.test(por["296"].novo), "M8 '§ 2º REVOGADO' marca o paragrafo, nao o artigo: " + por["296"].novo);
    ok(por["117"] && /§ 1º \(Revogado por LC 95\/2022\)/.test(por["117"].novo) && /§ 2º Prazo de dois anos\./.test(por["117"].novo), "M9 'Fica revogado o § 1º do art. 117': " + (por["117"] && por["117"].novo));
    ok(por["9"] === undefined, "M9a a ordem de revogar artigo de OUTRA lei foi ignorada");
  }
  {
    /* alteração num dispositivo que a lei gravada não tem: diz qual, e propõe */
    const par = p.leiLerAlteradora(LC145, lei({ texto: BASE.replace("f) companhias antigas;\ng) empresas de saúde;\n", "") }));
    const i248 = p.leiItensDaAlteradora(lei({ texto: BASE.replace("f) companhias antigas;\ng) empresas de saúde;\n", "") }), par).filter((x) => x.num === "248")[0];
    ok(i248.problemas.filter((x) => x.k === "nao_existia").length === 3 && i248.alertas.some((a) => a.k === "nao_existia"), "M10 (NR) num dispositivo que nao existe avisa: " + JSON.stringify(i248.problemas));
    /* artigo que a lei gravada nao tem, so em partes */
    const semArt = p.leiItensDaAlteradora(lei({ texto: BASE.replace(/Art\. 162[\s\S]*?Art\. 173/, "Art. 173") }), p.leiLerAlteradora(LC145, lei())).filter((x) => x.num === "162")[0];
    ok(semArt && semArt.tipo === "novo" && semArt.alertas.some((a) => a.k === "artigo_sem_base"), "M11 artigo ausente e alterado so em partes: " + JSON.stringify(semArt && semArt.alertas));
  }
  {
    /* a mesma lei, duas vezes, em ordem: a segunda mescla no RESULTADO da primeira */
    const l1 = lei();
    const it95 = p.leiItensDaAlteradora(l1, p.leiLerAlteradora(LC95, l1));
    const alt = {};
    it95.forEach((x) => { alt[x.num] = { texto: x.novo, fonteAlteracao: "LC 95/2022", data: "2026-01-01", historico: [{ fonte: "LC 95/2022", dataLei: "2022-09-28" }], dataLei: "2022-09-28" }; });
    const l2 = lei({ alteracoes: alt });
    const it112 = p.leiItensDaAlteradora(l2, p.leiLerAlteradora(LC112, l2));
    const i91 = it112.filter((x) => x.num === "91")[0], i117 = it112.filter((x) => x.num === "117")[0];
    ok(/II\. à Procuradoria-Geral/.test(i91.novo) && /I\. a pessoa jurídica/.test(i91.novo), "M12 art. 91 (so inciso II)");
    ok(/§ 1º \(Revogado por LC 95\/2022\)/.test(i117.novo) && /§5º\. Em se tratando/.test(i117.novo), "M12a a LC 112 mescla sobre o que a LC 95 ja tinha feito (o §1º continua revogado e entra o §5º): " + i117.novo);
    ok(!i91.alertas.some((a) => a.k === "fora_ordem"), "M12b a ordem 95 -> 112 esta certa");
    /* ao contrario: aplicar a mais ANTIGA (LC 95) por cima da LC 112 ja aplicada */
    const alt2 = { "117": { texto: "Art. 117. x", fonteAlteracao: "LC 112/2023", historico: [{ fonte: "LC 112/2023", dataLei: "2023-06-09" }], dataLei: "2023-06-09" } };
    const l3 = lei({ alteracoes: alt2 });
    const itX = p.leiItensDaAlteradora(l3, p.leiLerAlteradora(LC95, l3)).filter((x) => x.num === "117")[0];
    ok(itX.alertas.some((a) => a.k === "fora_ordem" && a.d1 === "2022-09-28" && a.d2 === "2023-06-09"), "M13 lei mais antiga por cima de uma mais nova: " + JSON.stringify(itX.alertas));
  }

  /* ==============================================================
   * U: A TELA
   * ============================================================== */
  const montar = () => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_lc15", nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE });
    api.leiAbrir("Direito Tributário", "CTM", l.id);
    api.leiAtualizarAbrir();
    return { api, l };
  };
  {
    const { api } = montar();
    ok(api.$("leiUpdModoCompleta").checked === true && api.$("leiUpdGuardarAltCx").hidden === true, "U1 o padrao e' 'lei inteira', sem a opcao de guardar a alteradora");
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdModoAlt").onchange();
    ok(api.$("leiUpdGuardarAltCx").hidden === false, "U1a escolher 'só alterações' mostra 'guardar a lei que altera'");
    api.$("leiUpdTexto").value = LC145;
    const r = api.leiAtualizarComparar();
    ok(r === true && api.$("leiUpdPasso2").hidden === false, "U2 a comparacao 'so alteracoes' devia abrir direto (a fonte vem do titulo): " + r + " " + api.$("dlgLeiPre").open);
    ok(api.$("leiUpdFonte").value === "LC 145/2024", "U2a a norma foi preenchida pelo titulo da lei: " + api.$("leiUpdFonte").value);
    const it = api.leiUpdComparoAtual();
    ok(it.map((x) => x.num).join(",") === "5,162,248,ANEXO:XI" && !it.some((x) => x.num === "300"), "U2b os itens sao so os artigos citados (e o Anexo que a lei manda revogar): " + it.map((x) => x.num + ":" + x.tipo));
    ok(it.filter((x) => x.tipo === "revogado").length === 1 && it.filter((x) => x.tipo === "revogado")[0].num === "5", "U2c so o art. 5 (mandado revogar) e' 'revogado'");
    ok(api.leiUpdModoAusentesAtual() === "presentes", "U2d nunca revoga por ausencia");
    /* o texto proposto é editável e vale ao aceitar */
    api.leiUpdMover(1);
    ok(api.leiUpdIdxAtual() === 1, "U3 (indice)");
    const ta = api.$("leiUpdProposto") || achar(api.$("leiUpdItem"), (c) => c.id === "leiUpdProposto")[0];
    ok(!!ta && /§4º/.test(ta.value) && /Art\. 162/.test(ta.value), "U3a o texto proposto da mescla aparece numa caixa editavel: " + (ta && ta.value.slice(0, 80)));
    ta.value = ta.value + "\n§6º Parágrafo que eu mesmo acrescentei.";
    ta.oninput();
    ok(/§6º Parágrafo que eu mesmo/.test(api.leiUpdComparoAtual()[1].novo), "U3b a edicao do texto proposto vale");
    ok(achar(api.$("leiUpdItem"), (c) => /lei-upd-al/.test(c.className || "")).some((c) => /trechos do artigo/.test(c.textContent)), "U3c o alerta 'alteracao so de trechos' aparece");
    ok(/Anexo/.test(api.$("leiUpdItem").textContent || ""), "U3d o aviso dos Anexos aparece na tela: " + (api.$("leiUpdItem").textContent || "").slice(-200));
    api.leiUpdAceitar();
    api.leiUpdMover(1);
    api.leiUpdPular();                         /* recusa o 248 */
    api.leiUpdMover(-2);                       /* volta ao 5 (revogado) e nao decide */
    api.leiAtualizarAplicar();
    const dep = api.leiDe("lei_lc15");
    ok(Object.keys(dep.alteracoes).join(",") === "162", "U4 so o item ACEITO entra (nao o recusado nem o sem decisao): " + Object.keys(dep.alteracoes));
    const a162 = dep.alteracoes["162"];
    ok(/§6º Parágrafo que eu mesmo/.test(a162.texto) && a162.fonteAlteracao === "LC 145/2024" && a162.historico.length === 1 && a162.historico[0].dataLei === "2024-12-23",
       "U4a alteracao com historico e data da lei: " + JSON.stringify(a162).slice(0, 300));
    ok(dep.texto === BASE, "U4b o texto-base nunca e' reescrito");
    ok(api.leisLista().filter((x) => /145/.test(x.nome)).length === 1, "U4c a lei que ALTERA foi guardada como lei propria: " + api.leisLista().map((x) => x.nome));
    const alt145 = api.leisLista().filter((x) => /145/.test(x.nome))[0];
    ok(alt145 && (alt145.topicos || []).length === 0 && alt145.numero === "145" && alt145.ano === "2024" && /Art\. 4º Fica revogado/.test(alt145.texto), "U4d a alteradora nao ganha vinculo com topico: " + JSON.stringify(alt145 && alt145.topicos));
    ok(api.leiArtigosEfetivos(dep).filter((x) => x.num === "162")[0].alterado === true && /§6º Parágrafo que eu mesmo/.test(api.leiArtigosEfetivos(dep).filter((x) => x.num === "162")[0].texto), "U4e a leitura mostra o texto vigente");
  }
  {
    /* nao guardar a alteradora quando a caixa esta desmarcada */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true; api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdGuardarAlt").checked = false;
    api.$("leiUpdTexto").value = LC145;
    api.leiAtualizarComparar();
    api.leiUpdAceitar();
    api.leiAtualizarAplicar();
    ok(api.leisLista().length === 1, "U5 'guardar a lei que altera' desmarcado nao pode criar lei: " + api.leisLista().map((x) => x.nome));
  }
  {
    /* colou a lei que altera no modo "lei inteira": o app oferece o modo certo */
    const { api } = montar();
    api.$("leiUpdFonte").value = "LC 145/2024";
    api.$("leiUpdTexto").value = LC145.replace("“ Art. 162", "Art. 162");
    api.leiAtualizarComparar();
    ok(api.$("dlgLeiCob").open === true, "U6 a lei que altera colada como 'inteira' devia abrir a conferencia: pre=" + api.$("dlgLeiPre").open);
    const ops = achar(api.$("leiCobOpcoes"), (c) => c.type === "radio").map((c) => c.value);
    ok(ops[0] === "alteracoes" && ops.indexOf("revogar") < 0, "U6a a primeira opcao e' ler como lei que altera: " + ops);
    achar(api.$("leiCobOpcoes"), (c) => c.value === "alteracoes")[0].onchange();
    api.$("btnLeiCobConfirmar").onclick();
    ok(api.$("leiUpdModoAlt").checked === true && api.$("leiUpdPasso2").hidden === false && api.leiUpdComparoAtual().some((x) => x.num === "248" && x.parcial),
       "U6b escolhida a opcao, a comparacao abre no modo 'so alteracoes'");
  }
  {
    /* texto que nao cita esta lei */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdFonte").value = "outra";
    api.$("leiUpdTexto").value = ["LEI COMPLEMENTAR Nº 77, DE 01 DE JANEIRO DE 2020", "Art. 1º A Lei Complementar nº 33, de 2001, passa a vigorar com as seguintes alterações:", "“Art. 162 [...]", "§4º Novo parágrafo. (AC)", "Art. 2º Vigência."].join("\n");
    api.leiAtualizarComparar();
    ok(api.$("dlgLeiCob").open === true && /não cita/.test(achar(api.$("leiCobAvisos"), () => true).map((c) => c.textContent).join(" ")), "U7 texto que nao cita esta lei avisa antes de comparar");
    api.$("btnLeiCobVoltar").onclick();
    ok(api.$("leiUpdPasso2").hidden === true, "U7a voltar nao compara");
  }
  {
    /* nada reconhecível */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdFonte").value = "x";
    api.$("leiUpdTexto").value = "Um texto qualquer sem artigos alterados.\nOutra linha.";
    ok(api.leiAtualizarComparar() === false && api.$("leiUpdPasso2").hidden === true && /Não reconheci nenhuma alteração/.test(api.$("uiModalMsg").textContent || ""), "U8 sem alteracao reconhecivel diz isso");
  }
  {
    /* a mesma lei, pelo caminho da lei inteira, nao muda: aceitar duas vezes acumula o histórico */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdTexto").value = LC95;
    api.leiAtualizarComparar();
    api.leiUpdComparoAtual().forEach((x) => { x.aceito = true; });
    api.leiAtualizarAplicar();
    api.leiAtualizarAbrir();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdTexto").value = LC112;
    api.leiAtualizarComparar();
    api.leiUpdComparoAtual().forEach((x) => { x.aceito = true; });
    api.leiAtualizarAplicar();
    const a = api.leiDe("lei_lc15").alteracoes;
    ok(a["117"].historico.length === 2 && a["117"].fonteAlteracao === "LC 95/2022; LC 112/2023", "U9 o artigo 117 foi alterado pelas duas leis, em ordem: " + JSON.stringify(a["117"].historico) + " / " + a["117"].fonteAlteracao);
    ok(/§ 1º \(Revogado por LC 95\/2022\)/.test(a["117"].texto) && /§5º\. Em se tratando/.test(a["117"].texto), "U9a a segunda mescla sobre a primeira");
    ok(a["91"].historico.length === 1 && a["91"].fonteAlteracao === "LC 112/2023", "U9b art. 91 so pela 112");
  }

  /* ==============================================================
   * O: O PONTILHADO DAS EMENDAS CONSTITUCIONAIS (bug real, EC 132/2023)
   *
   * A Câmara/Senado (emenda constitucional) marca o trecho omitido com uma FILEIRA NUA de pontos —
   * "Art. 43. ......................... § 4º Sempre que possível..." — sem colchete nem parêntese, diferente
   * do "[...]" que a Lei Complementar municipal usa (ver LC145/LC95/LC112 acima). Colando a EC 132/2023 de
   * verdade (copiada do Planalto) para atualizar a Constituição, o caput de CADA artigo citado virava a
   * própria fileira de pontos na mescla — sem nenhum alerta — porque só "[...]"/"(...)" contavam como omissão.
   * ============================================================== */
  const PONTOS = ".".repeat(60);
  const EC_PONTILHADO = [
    "EMENDA CONSTITUCIONAL Nº 999, DE 1º DE JANEIRO DE 2026",
    "Altera a Lei Complementar nº 15, de 05 de janeiro de 2009.",
    "Art. 1º A Lei Complementar nº 015, de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:",
    "\"Art. 106. " + PONTOS,
    "Parágrafo único. A multa de mora fica reduzida em até 30% (trinta por cento) se o pagamento for à vista.\" (AC)",
    "\"Art. 173. " + PONTOS,
    "Parágrafo único. Cabe à Secretaria a cobrança, ressalvada a competência da Procuradoria-Geral.\" (NR)",
    "Art. 2º Esta Emenda entra em vigor na data de sua publicação.",
  ].join("\n");
  {
    const alt = p.leiPareceAlteradora(EC_PONTILHADO);
    ok(alt.sim === true && alt.sinais.includes("omitidos"), "O1 a fileira nua de pontos (sem colchete) conta como sinal de omissao, como o '[...]': " + JSON.stringify(alt));

    /* NEM TODO PONTO E' OMISSAO: uma reticencia comum de frase ("etc...", "a saber...") tem 3 pontos, e o
     * limiar de 5+ existe por isso (o mesmo de leiSemPontilhado) — baixar o limiar faria prosa comum virar
     * "artigo parcial" por engano */
    const b295 = p.leiLerBlocoAlterado("Art. 295. O disposto neste artigo não se aplica a hipóteses de isenção, remissão, etc... nem a outras exceções previstas em lei.\"");
    ok(b295.temOmissao === false && b295.parcial === false, "O1a tres pontos de reticencia comum NAO contam como omissao do dispositivo: " + JSON.stringify(b295));

    const par = p.leiLerAlteradora(EC_PONTILHADO, lei());
    const b106 = par.blocos.filter((b) => b.num === "106")[0], b173 = par.blocos.filter((b) => b.num === "173")[0];
    ok(b106 && b106.bloco.temOmissao === true && b106.bloco.parcial === true && b106.bloco.caputAcao === "omitido" && b106.bloco.caputTexto === "",
      "O2 o caput do 106 (so' pontos) e' reconhecido como OMITIDO, nao como o texto novo: " + JSON.stringify(b106 && b106.bloco));
    ok(b173 && b173.bloco.temOmissao === true && b173.bloco.caputAcao === "omitido", "O2a o mesmo vale pro 173: " + JSON.stringify(b173 && b173.bloco));

    const itens = p.leiItensDaAlteradora(lei(), par);
    const i106 = itens.filter((x) => x.num === "106")[0], i173 = itens.filter((x) => x.num === "173")[0];
    ok(/^Art\. 106\. A multa de mora será reduzida em até 10%\.$/m.test(i106.novo), "O3 o caput do 106 continua o ORIGINAL da base (nao vira pontos): " + JSON.stringify(i106.novo));
    ok(/Parágrafo único\. A multa de mora fica reduzida em até 30%.*\(Incluído por/.test(i106.novo), "O3a o paragrafo novo (AC) entra certo: " + i106.novo);
    ok(!/\.{5,}/.test(i106.novo), "O3b nenhuma fileira de pontos sobra no texto proposto: " + JSON.stringify(i106.novo));
    ok(/^Art\. 173\. Cessa a competência da Secretaria\.$/m.test(i173.novo), "O4 o caput do 173 tambem continua o ORIGINAL (o NR era so' do paragrafo): " + JSON.stringify(i173.novo));
    ok(/Parágrafo único\. Cabe à Secretaria a cobrança, ressalvada a competência da Procuradoria-Geral.*\(Redação dada por/.test(i173.novo), "O4a o paragrafo (NR) troca certo: " + i173.novo);
    ok(!/\.{5,}/.test(i173.novo), "O4b idem, sem pontos sobrando: " + JSON.stringify(i173.novo));

    /* o mesmo alerta que "[...]" ja dava (ver U10i em lei-colagem.js), agora tambem para o pontilhado nu —
     * caminho da "lei INTEIRA" (leiCompararVersoes), nao o da lei que altera */
    const cmpAntes = "Art. 9º Texto antigo do artigo nove, por inteiro e com bastante conteudo proprio.";
    const cmpDepois = "Art. 9º " + PONTOS + " Texto novo, so' o final. " + PONTOS;
    const cmp = p.leiCompararVersoes(cmpAntes, cmpDepois, {});
    const it9 = cmp.itens.filter((x) => x.num === "9")[0];
    ok(it9 && it9.alertas.some((a) => a.k === "omitido" && a.sev === "alerta"), "O5 na comparacao de 'lei inteira', o pontilhado nu tambem dispara o alerta de trecho omitido: " + JSON.stringify(it9 && it9.alertas));
  }

  /* O caso REAL: trecho copiado literalmente do site do Planalto (EC 132/2023, art. 43 da Constituição) —
   * a mesma emenda que expôs o defeito. Prova que o conserto vale para o texto de verdade, nao so' pro fixture. */
  {
    const ART43_EC132 = [
      "\"Art. 43. .............................................................................................................",
      ".....................................................................................................................................",
      "§ 4º Sempre que possível, a concessão dos incentivos regionais a que se refere o § 2º, III, considerará critérios de sustentabilidade ambiental e redução das emissões de carbono.\" (NR)",
    ].join("\n");
    const texto = [
      "EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023",
      "Altera o Sistema Tributário Nacional.",
      "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:",
      ART43_EC132,
      "Art. 2º Esta Emenda Constitucional entra em vigor na data de sua publicação.",
    ].join("\n");
    const cfFake = lei({ id: "cf88", nome: "Constituição Federal de 1988", especie: "Constituição", numero: "", ano: "1988",
      texto: "Art. 43. Para efeitos administrativos, a União poderá articular sua ação em um mesmo complexo geoeconômico e social." });
    const par = p.leiLerAlteradora(texto, cfFake);
    const itens = p.leiItensDaAlteradora(cfFake, par);
    const i43 = itens.filter((x) => x.num === "43")[0];
    ok(/^Art\. 43\. Para efeitos administrativos, a União poderá articular sua ação em um mesmo complexo geoeconômico e social\.$/m.test(i43.novo),
      "R1 (caso real, EC 132/2023) o caput do art. 43 da Constituição continua o ORIGINAL, nao os pontos copiados do Planalto: " + JSON.stringify(i43.novo));
    ok(/§ 4º Sempre que possível.*\(Incluído por/.test(i43.novo), "R1a o § 4º novo entra certo");
    ok(!/\.{5,}/.test(i43.novo), "R1b nenhum ponto sobra no texto proposto de verdade");
  }

  /* ==============================================================
   * P: "PEDIR APOIO DA IA" — o rótulo estava em branco (nunca recebia texto em
   * lugar nenhum do código) e o placeholder ficava preso em português, direto
   * no HTML. Quem via só o campo (fora do fluxo do botão) não tinha como saber
   * pra que servia. Agora os dois vêm do i18n, e o rótulo diz o efeito real:
   * é opcional, fica só no histórico da decisão, e não muda o texto da lei.
   * ============================================================== */
  {
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdTexto").value = LC145;
    api.leiAtualizarComparar();
    ok(api.$("leiUpdPrompt").hidden === true && api.$("leiUpdPromptBarra").hidden === true
      && api.$("leiUpdExplicaRot").hidden === true && api.$("leiUpdExplica").hidden === true,
      "P1 antes de pedir apoio da IA, a caixa do prompt e a da explicação ficam escondidas");

    api.leiUpdIA();
    ok(api.$("leiUpdPrompt").hidden === false && api.$("leiUpdPromptBarra").hidden === false
      && api.$("leiUpdExplicaRot").hidden === false && api.$("leiUpdExplica").hidden === false,
      "P2 'pedir apoio da IA' mostra as duas caixas");
    const item0 = api.leiUpdComparoAtual()[0];
    ok(api.$("leiUpdPrompt").value.includes(item0.rotulo || "Art. " + item0.numCru)
      && api.$("leiUpdPrompt").value.includes(item0.novo || ""),
      "P2a o prompt monta com o artigo e o texto novo do item atual: " + api.$("leiUpdPrompt").value.slice(0, 80));
    ok(api.$("leiUpdExplicaRot").textContent.length > 10, "P3 o rotulo NAO fica em branco (o bug real): " + JSON.stringify(api.$("leiUpdExplicaRot").textContent));
    ok(/opcional/i.test(api.$("leiUpdExplicaRot").textContent) && /não muda/i.test(api.$("leiUpdExplicaRot").textContent),
      "P3a o rotulo deixa claro pra pessoa o que vai acontecer: e' opcional e nao muda a lei: " + api.$("leiUpdExplicaRot").textContent);
    ok(api.$("leiUpdExplica").placeholder && api.$("leiUpdExplica").placeholder.length > 5,
      "P4 o placeholder tambem nao fica em branco: " + JSON.stringify(api.$("leiUpdExplica").placeholder));

    /* o que a pessoa cola ali acompanha a decisao, sem entrar no texto do artigo */
    api.$("leiUpdExplica").value = "A IA explicou que isso so' acrescenta um paragrafo novo.";
    api.leiUpdAceitar();
    ok(api.leiUpdComparoAtual()[0].explicacao === "A IA explicou que isso so' acrescenta um paragrafo novo.", "P5 a explicacao colada fica presa a decisao do item");
    ok(!/A IA explicou/.test(api.leiUpdComparoAtual()[0].novo), "P5a a explicacao NAO entra no texto proposto do artigo (nao muda a lei)");
    api.leiAtualizarAplicar();
    const dr = api.decLer().filter((x) => x.area === "versao")[0];
    ok(dr && dr.via === "com_explicacao", "P6 o historico da decisao registra que veio COM explicacao: " + (dr && dr.via));
  }

  /* os textos: pt e en, os dois preenchidos, e o rotulo diferente do placeholder (nao e' o mesmo texto duplicado) */
  {
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": \"([^\"]*)\",\\r?\\n", "g")) || []);
    ok(linhas("lei_upd_explica_rot").length === 2 && linhas("lei_upd_explica_ph").length === 2,
      "P7 as duas chaves existem em portugues e em ingles");
    const valor = (l) => (l.match(/: "([^"]*)"/) || [, ""])[1];
    ok(linhas("lei_upd_explica_rot").every((l) => valor(l).length > 10) && linhas("lei_upd_explica_ph").every((l) => valor(l).length > 5),
      "P7a nenhuma das quatro frases fica vazia");
    ok(valor(linhas("lei_upd_explica_rot")[0]) !== valor(linhas("lei_upd_explica_ph")[0]), "P7b o rotulo e o placeholder nao sao o mesmo texto repetido");
  }

  /* ==============================================================
   * Q: A LEI ALTERADORA "SE CITANDO" — bug real (o usuario reproduziu)
   *
   * "Guardar também o texto da lei que altera na biblioteca" salva a emenda como lei propria — com o
   * MESMO numero que o titulo dela ("EMENDA CONSTITUCIONAL Nº 132"). Reabrir esse registro e colar a
   * MESMA emenda de novo em "atualizar versão" fazia leiAlteradoraCitaLei() achar que "132" no titulo
   * da EC contava como citação da lei nº 132 aberta — e o aviso "esse texto não fala desta lei" (que
   * já existia, para a lei ERRADA) nunca disparava. O alvo de verdade da emenda (a Constituição) nunca
   * aparecia citado por numero nenhuma, so' pelo nome "Constituição Federal".
   * ============================================================== */
  const EC132_MINI = [
    "EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023",
    "Altera o Sistema Tributário Nacional.",
    "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:",
    "\"Art. 43. .............................................................................................................",
    "§ 4º Sempre que possível, a concessão dos incentivos regionais considerará critérios ambientais.\" (NR)",
    "Art. 2º Esta Emenda Constitucional entra em vigor na data de sua publicação.",
  ].join("\n");
  {
    /* unidade: leiAlteradoraCitaLei sozinha */
    const lEmendaPropria = { numero: "132", especie: "Emenda Constitucional" };
    const lCF = { numero: "", especie: "Constituição" };
    ok(p.leiAlteradoraCitaLei(EC132_MINI, lEmendaPropria) === false,
      "Q1 o titulo da propria emenda ('EMENDA CONSTITUCIONAL Nº 132') NAO conta como citacao da lei nº 132 aberta");
    ok(p.leiAlteradoraCitaLei(EC132_MINI, lCF) === true, "Q1a lei sem numero (a Constituicao) nunca precisa de citacao numerica: sempre passa");
    /* a citacao de verdade, dentro do corpo (Art. 1º), continua funcionando (nao regride LC145/95/112) */
    ok(p.leiAlteradoraCitaLei(LC145, { numero: "15", especie: "Lei Complementar" }) === true, "Q1b a citacao real, no corpo do Art. 1º, continua sendo achada");
    ok(p.leiAlteradoraCitaLei(LC145, { numero: "999", especie: "Lei Complementar" }) === false, "Q1c uma lei que de fato nao e' citada continua sem aviso falso-positivo");
  }
  {
    /* tela: reabrir a emenda salva como lei propria e colar ela mesma de novo — o aviso agora aparece */
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const lEmenda = api.leiGuardar({ id: "lei_emenda-constitucional-132-2023", nome: "Emenda Constitucional 132/2023",
      especie: "Emenda Constitucional", numero: "132", ano: "2023", texto: "Art. 1º A Constituição Federal passa a vigorar...\nArt. 2º Esta Emenda entra em vigor..." });
    api.leiAbrir("Direito Constitucional", "Emendas", lEmenda.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdTexto").value = EC132_MINI;
    const res = api.leiAtualizarComparar();
    ok(res === false && api.$("dlgLeiCob").open === true && api.$("leiUpdPasso2").hidden === true,
      "Q2 colar a MESMA emenda sobre o registro dela mesma agora PARA na conferencia, em vez de despejar a lista de itens direto: " + res);
    const av = achar(api.$("leiCobAvisos"), () => true).map((c) => c.textContent).join(" | ");
    ok(/não cita.*Emenda Constitucional 132\/2023/.test(av), "Q2a o aviso nomeia a lei aberta, avisando que o texto nao fala dela: " + av);
    const ops = achar(api.$("leiCobOpcoes"), (c) => c.type === "radio").map((c) => c.value);
    ok(ops.join(",") === "continuar", "Q2b so' a opcao de seguir mesmo assim (nao ha 'baixa cobertura' nem 'e alteradora' aqui)");
    /* escolhendo seguir mesmo assim, a comparacao abre (a pessoa foi avisada e decidiu prosseguir) */
    api.leiCobCtxAtual().escolha = "continuar";
    api.leiCobConfirmar();
    ok(api.$("dlgLeiCob").open === false && api.$("leiUpdPasso2").hidden === false, "Q3 escolhido 'continuar', a comparacao abre normalmente");
  }
  {
    /* controle: o caso LEGITIMO (LC145 sobre a LC 15/2009 de verdade) NAO aciona esse aviso */
    const { api } = montar();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdTexto").value = LC145;
    const res = api.leiAtualizarComparar();
    ok(res === true && api.$("dlgLeiCob").open !== true && api.$("leiUpdPasso2").hidden === false,
      "Q4 controle: a atualizacao legitima (LC145 sobre a LC15/2009) continua indo direto pra comparacao, sem aviso falso: " + res);
  }

  /* ==============================================================
   * S: "COMPARAR NÃO PROSSEGUE" — bug real relatado pelo usuário
   *
   * Clicar "comparar" sem preencher a norma (o campo só tinha o PLACEHOLDER "EC 132/2023", nunca digitado
   * de verdade) parava a tela sem abrir nada — só um <p class="nota"> discreto, do mesmo tom cinza de
   * qualquer outra dica da tela, aparecia colado acima dos botões. Ninguém notava; parecia que o botão
   * simplesmente não fazia nada. O mesmo valia pro aviso de "nenhum artigo reconhecido" no texto colado.
   * Agora os dois ganham o MESMO destaque vermelho da conferência de versão (".lei-upd-al.alerta") e jogam
   * o foco de volta pro campo que precisa de atenção — e Passo 1 ganha um botão de relatório, igual ao que
   * já existe no Passo 2, para poder relatar um problema mesmo antes de conseguir comparar.
   * ============================================================== */
  {
    const { api } = montar();
    let focouFonte = 0;
    api.$("leiUpdFonte").focus = () => { focouFonte++; };
    ok(api.$("leiUpdAviso1").className === "nota", "S1 sem nenhum erro ainda, o aviso e' so' uma nota comum");
    /* texto simples de "lei inteira" (sem "[...]"/NR/AC — nao aciona nenhum dialogo de limpeza no meio do
     * caminho), so' falta a norma */
    const novoBaseSimples = BASE.replace("Tributo é toda prestação pecuniária.", "Tributo é toda prestação pecuniária, em moeda corrente nacional.");
    api.$("leiUpdTexto").value = novoBaseSimples;
    const res = api.leiAtualizarComparar();
    ok(res === false, "S2 sem norma, comparar realmente para (devolve false)");
    ok(api.$("leiUpdAviso1").textContent.length > 10, "S2a o aviso tem texto de verdade: " + JSON.stringify(api.$("leiUpdAviso1").textContent));
    ok(api.$("leiUpdAviso1").className === "nota lei-upd-al alerta", "S2b o aviso agora ganha o MESMO destaque vermelho da conferencia de versao (nao e' mais uma nota discreta que passa despercebida): " + api.$("leiUpdAviso1").className);
    ok(focouFonte > 0, "S2c o foco volta pro campo da norma — a pessoa nao precisa procurar o que falta");
    /* corrigido e clicado de novo: o alerta vermelho sai (nao fica um erro velho vermelho pra sempre na tela) */
    api.$("leiUpdFonte").value = "LC 145/2024";
    const res2 = api.leiAtualizarComparar();
    ok(res2 === true, "S3 corrigido, agora prossegue: " + res2);
    ok(api.$("leiUpdAviso1").className === "nota", "S3a o destaque vermelho do erro anterior sai assim que o proximo clique nao falha mais");
  }
  {
    const { api } = montar();
    let focouTexto = 0;
    api.$("leiUpdTexto").focus = () => { focouTexto++; };
    api.$("leiUpdFonte").value = "norma qualquer";
    api.$("leiUpdTexto").value = "isto nao tem nenhum 'Art. N' reconhecivel, so' um paragrafo solto de prosa comum.";
    const res = api.leiAtualizarComparar();
    ok(res === false && /nenhum artigo/i.test(api.$("leiUpdAviso1").textContent), "S4 texto sem nenhum artigo reconhecivel tambem para, com aviso: " + api.$("leiUpdAviso1").textContent);
    ok(api.$("leiUpdAviso1").className === "nota lei-upd-al alerta", "S4a mesmo destaque vermelho");
    ok(focouTexto > 0, "S4b o foco vai pra caixa do texto colado, dessa vez (e' ela que precisa de atencao)");
  }
  {
    /* o botao de relatorio no Passo 1 — igual ao que ja existe no Passo 2 (btnLeiRelUpd), so' que aqui
     * dando pra relatar um problema MESMO SEM conseguir comparar ainda */
    const { api } = montar();
    ok(typeof api.$("btnLeiRelUpd1").onclick === "function", "S5 o botao de relatorio existe e esta ligado no Passo 1");
    api.$("leiUpdFonte").value = "EC 132/2023";
    api.$("leiUpdTexto").value = "Art. 43. texto qualquer, so' pra aparecer no relatorio.";
    const txt = api.leiRelatorioCopiar("atualizar a lei");
    ok(/Norma informada: EC 132\/2023/.test(txt) && /Texto colado: \d+ caracteres/.test(txt),
      "S5a o relatorio do Passo 1 mostra a norma e o texto colado, mesmo sem ter comparado ainda: " + txt.slice(0, 300));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
