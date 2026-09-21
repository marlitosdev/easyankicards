/* =====================================================================
 * A EMENDA NÃO TEM "PARÁGRAFOS REPETIDOS" — o caso da EC 132/2023
 *
 * A pessoa vinculou a EC 132/2023 (uma lei que ALTERA a Constituição) e a tela "artigos repetidos" apontou
 * 22 grupos: "Art. 1º — §4º ×2", "Art. 2º — §1º ×7"… Nenhum era repetição. O "Art. 1º" da emenda traz, entre
 * aspas, a nova redação de vários artigos da Constituição (Art. 43, 145, 146, 149-C…), cada um com o seu
 * §1º, §2º, §3º. Como os artigos citados não são artigos DA emenda, todos os parágrafos caem no mesmo
 * artigo — e o mesmo endereço se repete, de verdade, mas em artigos diferentes da lei alterada.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Numa lei que altera outra, os parágrafos repetidos dentro do artigo NÃO são apontados.
 *  2. Numa lei consolidada, o §5º velho e o §5º novo do mesmo artigo CONTINUAM apontados (é o que o
 *     detector existe para pegar).
 *  3. Numa lei que altera outra, o artigo INTEIRO repetido (mesmo número, lado a lado) continua apontado:
 *     só se calou a repetição de parágrafo.
 *  4. A tela: a lei guardada não mostra o aviso de repetidos nem abre a conferência.
 *  5. A NUMERAÇÃO também não se confere numa lei que altera outra: os artigos que ela cita (o 156-A e o
 *     156-B entre o 1º e o 2º) vêm soltos no meio dela, e saíam "faltam 154 artigos depois do 1º" e "a
 *     numeração recomeça". A linha de estado do mapa diz que a numeração não conta como aviso — não afirma
 *     que "segue uma sequência". Numa lei consolidada o salto continua apontado.
 *  6. Mas a pessoa pode querer ver: o que a conferência normal apontaria aparece como INFORMAÇÃO, num bloco
 *     RECOLHIDO, à parte da conferência — fora da linha de estado, da contagem de avisos e do grupo de
 *     ajustes. Guarda se estava aberto ao repintar, vai para o relatório, e só existe quando há o que mostrar.
 * ===================================================================== */
const fs = require("fs");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api: p } = rodar();

  /* trechos do texto oficial da EC 132/2023 (planalto.gov.br), com as reticências de "sem alteração" */
  const PTS = ".".repeat(60);
  const EC = [
    "EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023",
    "Altera o Sistema Tributário Nacional.",
    "As Mesas da Câmara dos Deputados e do Senado Federal, nos termos do § 3º do art. 60 da Constituição Federal, promulgam a seguinte Emenda ao texto constitucional:",
    "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:",
    "\"Art. 43. " + PTS, PTS,
    "§ 4º Sempre que possível, a concessão dos incentivos regionais a que se refere o § 2º, III, considerará critérios de sustentabilidade ambiental e redução das emissões de carbono.\" (NR)",
    "\"Art. 145. " + PTS, PTS,
    "§ 3º O Sistema Tributário Nacional deve observar os princípios da simplicidade, da transparência, da justiça tributária, da cooperação e da defesa do meio ambiente.",
    "§ 4º As alterações na legislação tributária buscarão atenuar efeitos regressivos.\" (NR)",
    "\"Art. 146. " + PTS, PTS, "III - " + PTS, PTS,
    "c) adequado tratamento tributário ao ato cooperativo praticado pelas sociedades cooperativas, inclusive em relação aos tributos previstos nos arts. 156-A e 195, V;",
    "§ 1º " + PTS,
    "§ 2º É facultado ao optante pelo regime único de que trata o § 1º apurar e recolher os tributos previstos nos arts. 156-A e 195, V.",
    "§ 3º Na hipótese de o recolhimento dos tributos previstos nos arts. 156-A e 195, V, ser realizado por meio do regime único de que trata o § 1º, enquanto perdurar a opção:",
    "I - não será permitida a apropriação de créditos dos tributos previstos nos arts. 156-A e 195, V, pelo contribuinte optante pelo regime único; e",
    "II - será permitida a apropriação de créditos pelo adquirente não optante pelo regime único de que trata o § 1º.",
    "\"Art. 149-C. O produto da arrecadação do imposto previsto no art. 156-A e da contribuição prevista no art. 195, V, incidentes sobre operações contratadas pela administração pública direta.",
    "§ 1º As operações de que trata o caput poderão ter alíquotas reduzidas de modo uniforme, nos termos de lei complementar.",
    "§ 2º Lei complementar poderá prever hipóteses em que não se aplicará o disposto no caput e no § 1º.",
    "§ 3º Nas importações efetuadas pela administração pública direta, o disposto no art. 150, VI, \"a\", será implementado na forma do disposto no caput e no § 1º.\"",
    "Art. 2º O Ato das Disposições Constitucionais Transitórias passa a vigorar com as seguintes alterações:",
    "\"Art. 92-B. " + PTS,
    "§ 1º Para assegurar o disposto no caput, serão utilizados, isolada ou cumulativamente, instrumentos fiscais, econômicos ou financeiros.",
    "§ 2º Lei complementar instituirá Fundo de Sustentabilidade e Diversificação Econômica do Estado do Amazonas.",
    "\"Art. 124. Lei complementar disporá sobre a compensação.",
    "§ 1º O montante recolhido na forma do caput será compensado com o valor devido das contribuições.",
    "§ 2º Caso o contribuinte não possua débitos suficientes para efetuar a compensação de que trata o § 1º, o valor recolhido poderá ser compensado com qualquer outro tributo.\"",
    "Art. 3º Esta Emenda Constitucional entra em vigor na data de sua publicação.",
  ].join("\n");

  /* ---- 1: a emenda ---- */
  {
    ok(p.leiPareceAlteradora(EC).sim === true, "E1 (o texto e' reconhecido como lei que altera outra)");
    ok(p.leiArtigos(EC).map((a) => a.rotulo).join("|") === "Art. 1º|Art. 2º|Art. 3º", "E1a os artigos da emenda sao 1º, 2º e 3º (os citados nao sao artigos dela)");
    ok(p.leiRepetidosNoArtigo(EC).length === 0, "E2 nenhum paragrafo repetido dentro do artigo: " + p.leiRepetidosNoArtigo(EC).map((g) => g.rotulo));
    ok(p.leiDuplicados(EC).length === 0, "E3 a conferencia de repetidos da emenda fica vazia: " + p.leiDuplicados(EC).map((g) => g.rotulo));
    /* mais avisos de "alteradora": so' as marcas (NR), sem 'passa a vigorar' */
    const soNR = ["Art. 1º A Lei nº 1 passa a vigorar com as seguintes alterações:", "§ 1º Um. (NR)", "§ 1º Dois. (NR)", "§ 1º Tres. (NR)", "Art. 2º Vigencia."].join("\n");
    ok(p.leiEhAlteradora(soNR) && p.leiParcelaCitada(soNR) === 0 && p.leiRepetidosNoArtigo(soNR).length === 0, "E4 sem as aspas (perdidas na colagem), mas com a maioria dos artigos de alteracao e as marcas (NR): tambem");
  }

  /* ---- 2: o que continua apontado ---- */
  {
    const consolidada = ["Art. 9º O tributo e' devido.", "§ 5º A Lei determinará medidas para os consumidores.",
      "§ 5º A Lei determinará medidas para os consumidores dos tributos municipais. (Redação dada pela Lei Complementar nº 018, de 2009)",
      "Art. 10. Outro artigo."].join("\n");
    ok(p.leiPareceAlteradora(consolidada).sim === false, "F0 (a lei consolidada nao parece alteradora)");
    const g = p.leiDuplicados(consolidada);
    ok(g.length === 1 && g[0].num === "9#P5" && g[0].intra === true, "F1 numa lei consolidada o §5º velho e o novo do mesmo artigo CONTINUAM apontados: " + JSON.stringify(g.map((x) => x.num)));
    /* artigo inteiro repetido numa lei que altera outra: continua */
    const dupArt = EC.replace("Art. 3º Esta Emenda", "Art. 3º Texto um do artigo.\nArt. 3º Texto dois do artigo.\nArt. 4º Esta Emenda");
    const g2 = p.leiDuplicados(dupArt);
    ok(g2.length === 1 && g2[0].num === "3" && !g2[0].intra, "F2 o artigo INTEIRO repetido, lado a lado, continua apontado mesmo numa emenda: " + JSON.stringify(g2.map((x) => x.num)));
  }

  /* ---- 3: a tela ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_ec132", nome: "Emenda Constitucional 132/2023", texto: EC });
    ok(api.leiRepetidosDaLei(l).length === 0, "T1 a lei guardada nao tem repetidos a mostrar");
    api.leiAbrir("Direito", "Reforma tributária", l.id);
    ok(api.leiRevisarRepetidos() === false && !api.$("dlgLeiDup").open, "T2 'revisar repetidos' nao abre a conferencia: nao ha o que revisar");
    /* a mesma lei, marcada como consolidada por engano de texto, ainda abre (controle da tela) */
    const cons = ["Art. 9º O tributo e' devido.", "§ 5º Um.", "§ 5º Dois. (Redação dada pela Lei Complementar nº 018, de 2009)", "Art. 10. Outro."].join("\n");
    const l2 = api.leiGuardar({ id: "lei_cons", nome: "Lei Consolidada", texto: cons });
    api.leiAbrir("Direito", "Consolidada", l2.id);
    ok(api.leiRepetidosDaLei(l2).length === 1 && api.leiRevisarRepetidos() === true && api.$("dlgLeiDup").open, "T3 controle: numa lei consolidada a conferencia abre");
  }

  /* ---- 4: a numeracao ---- */
  const PT2 = ".".repeat(40);
  const EC2 = [
    "EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023",
    "Altera o Sistema Tributário Nacional.",
    "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:",
    "\"Art. 43. " + PT2,
    "§ 4º Sempre que possível, a concessão dos incentivos regionais considerará critérios ambientais.\" (NR)",
    "\"Art. 146. " + PT2,
    "§ 4º As alterações na legislação tributária buscarão atenuar efeitos regressivos.\" (NR)",
    "\"Art. 156. " + PT2,
    "Art. 156-A. Lei complementar instituirá imposto sobre bens e serviços, com as regras gerais de incidência, base de cálculo e alíquotas.",
    "§ 1º O imposto será informado pelo princípio da neutralidade e pela não cumulatividade plena.",
    "§ 2º Lei complementar disporá sobre as hipóteses de regimes específicos e de imunidades.",
    "Art. 156-B. Compete ao Comitê Gestor do Imposto sobre Bens e Serviços, entidade pública sob regime especial.",
    "§ 1º O Comitê terá independência técnica, administrativa, orçamentária e financeira.\" (NR)",
    "Art. 2º O Ato das Disposições Constitucionais Transitórias passa a vigorar com as seguintes alterações:",
    "\"Art. 124. Lei complementar disporá sobre a compensação.\" (AC)",
    "Art. 3º Esta Emenda entra em vigor na data de sua publicação.",
    "Art. 4º Ficam revogados dispositivos.",
    "Art. 5º Cumpra-se.",
    "Art. 6º Publique-se.",
    "Art. 7º Registre-se.",
  ].join("\n");
  /* a MESMA estrutura, sem nenhuma marca de lei que altera outra */
  const CONSOL = EC2.replace("EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023", "LEI Nº 132, DE 20 DE DEZEMBRO DE 2023").replace("Altera o Sistema Tributário Nacional.", "Dispõe sobre o Sistema Tributário Nacional.")
    .replace("passa a vigorar com as seguintes alterações", "vigora").replace("passa a vigorar com as seguintes alterações", "vigora")
    .replace(/ \(NR\)| \(AC\)/g, "");
  {
    const dg = p.leiDiagnosticarLei(EC2);
    ok(p.leiArtigos(EC2).map((a) => a.numCru).join(",") === "1º,156-A,156-B,2º,3º,4º,5º,6º,7º", "N0 (a emenda tem o 156-A e o 156-B soltos entre o 1º e o 2º)");
    ok(dg.alteradora === true && dg.itens.length === 0 && dg.resumo.graves === 0 && dg.numeracao.problemas.length === 0,
      "N1 a conferencia da emenda nao aponta salto nem recomeco: " + JSON.stringify(dg.itens.map((i) => i.tipo)));
    ok(p.leiPareceAlteradora(CONSOL).sim === false, "N2 (a copia sem as marcas nao parece alteradora)");
    const dc = p.leiDiagnosticarLei(CONSOL);
    ok(dc.alteradora === false && dc.itens.map((i) => i.tipo).sort().join(",") === "recomeco,salto", "N3 numa lei consolidada os MESMOS dois avisos continuam: " + JSON.stringify(dc.itens.map((i) => i.tipo)));
  }
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_ec2", nome: "EC 132", texto: EC2 });
    ok(api.leiNumeracaoDaLei(l).problemas.length === 0 && api.leiNumeracaoDaLei(l).graves.length === 0, "N4 o aviso de numeracao da lei guardada fica vazio");
    ok(api.leiPreAnalisar(EC2).num.problemas.length === 0 && api.leiPreAnalisar(CONSOL).num.problemas.length === 2, "N5 a analise da colagem: nada na emenda, os dois na consolidada");
    api.leiAbrir("Direito", "Reforma", l.id);
    api.leiMapaAbrir();
    const cf = api.$("leiMapaConferir");
    ok(cf.children.length === 1 && /lei-mapa-estado-ok/.test(cf.children[0].className) && /^✓ Nada suspeito: não achei título solto dentro de artigo\. Esta lei altera outra, então a numeração não conta como aviso/.test(cf.children[0].textContent),
      "N6 a linha de estado diz que a numeracao nao conta como aviso (e nao que 'segue uma sequencia'): " + cf.textContent.slice(0, 120));
    ok(!/segue uma sequência/.test(cf.textContent), "N6a nao afirma o que nao conferiu");
    const l2 = api.leiGuardar({ id: "lei_cons2", nome: "Lei consolidada", texto: CONSOL });
    api.leiAbrir("Direito", "Consolidada", l2.id);
    api.leiMapaAbrir();
    ok(/^⚠|^✓ Nada grave/.test(api.$("leiMapaConferir").children[0].textContent) && /2 avisos/.test(api.$("leiMapaConferir").children[0].textContent), "N7 controle: a consolidada mostra os 2 avisos: " + api.$("leiMapaConferir").children[0].textContent);
  }
  {
    /* a consolidada LIMPA (sem nada a apontar): a linha de estado afirma a numeracao, porque conferiu */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const limpa = []; for (let i = 1; i <= 9; i++) limpa.push("Art. " + i + "º Texto " + i + ".");
    const l = api.leiGuardar({ id: "lei_limpa", nome: "Lei limpa", texto: limpa.join("\n") });
    api.leiAbrir("Direito", "Limpa", l.id);
    api.leiMapaAbrir();
    ok(/^✓ Nada suspeito: a numeração segue uma sequência/.test(api.$("leiMapaConferir").children[0].textContent), "N9 numa lei consolidada limpa a linha de estado afirma a sequencia (conferiu): " + api.$("leiMapaConferir").children[0].textContent.slice(0, 80));
  }
  {
    /* a revisao da colagem: o painel da numeracao aparece na consolidada e NAO na emenda */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const abre = (texto) => {
      api.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api.leiPreprocessar(texto), aoConfirmar() {} });
      return api.$("leiPreNumeracao").hidden;
    };
    ok(abre(EC2) === true, "N10 a revisao da colagem de uma emenda nao mostra o painel de numeracao");
    api.$("dlgLeiPre").close();
    ok(abre(CONSOL) === false, "N11 controle: numa lei consolidada com salto o painel de numeracao aparece");
  }
  /* ---- 5: a numeracao como INFORMACAO recolhivel ---- */
  const EC3 = ["EMENDA X", "Altera dispositivos.", "Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:",
    "\"Art. 43. Texto do artigo 43.\" (NR)", "\"Art. 50. Texto do artigo 50.\" (NR)", "\"Art. 105. Texto do artigo 105.\" (NR)", "\"Art. 145. Texto do artigo 145.\" (NR)",
    "\"Art. 146. " + PT2,
    "Art. 2º Dois, com uma redação nova que ocupa bastante espaço no texto da emenda.", "Art. 3º Tres, com uma redação nova que ocupa bastante espaço no texto da emenda.",
    "Art. 4º Quatro, com uma redação nova que ocupa bastante espaço no texto da emenda.", "Art. 5º Cinco, com uma redação nova que ocupa bastante espaço no texto da emenda.",
    "Art. 6º Seis, com uma redação nova que ocupa bastante espaço no texto da emenda.", "Art. 7º Sete, com uma redação nova que ocupa bastante espaço no texto da emenda.",
    "Art. 8º Oito, com uma redação nova que ocupa bastante espaço no texto da emenda.\" (NR)",
    "Art. 9º Esta Emenda entra em vigor na data de sua publicação."].join("\n");
  {
    const dg = p.leiDiagnosticarLei(EC2);
    ok(dg.numeracaoInfo.map((i) => i.tipo).sort().join(",") === "recomeco,salto" && dg.numeracaoInfo.every((i) => i.gravidade === "leve" && i.indice >= 0 && i.linha > 0),
      "I1 o que a conferencia normal apontaria vai em numeracaoInfo, sempre 'leve': " + JSON.stringify(dg.numeracaoInfo.map((i) => i.tipo + "/" + i.gravidade)));
    ok(p.leiDiagnosticarLei(CONSOL).numeracaoInfo.length === 0, "I2 numa lei consolidada nao ha 'informacao': os mesmos pontos sao AVISOS");
    ok(p.leiEhAlteradora(EC3) && p.leiDiagnosticarLei(EC3).numeracaoInfo.length === 0, "I3 emenda com a numeracao em ordem: nada a informar");
    /* a limpeza da colagem (grafia) tira as aspas dos artigos citados: sem elas a emenda continua sendo emenda (as marcas) */
    const semAspas = EC3.replace(/["“”]/g, "");
    ok(p.leiParcelaCitada(semAspas) === 0 && p.leiEhAlteradora(semAspas) === true && p.leiDiagnosticarLei(semAspas).alteradora === true && p.leiDiagnosticarLei(semAspas).itens.length === 0,
      "I3c a emenda SEM as aspas (depois da limpeza) continua sendo emenda: marcas por artigo " + ((semAspas.match(/\(NR\)|\(AC\)/g) || []).length / p.leiArtigos(semAspas).length).toFixed(2));
    /* um numero isolado seria GRAVE numa lei consolidada: na emenda e' informacao 'leve', e nao vira grave no resumo */
    const EC4 = EC3.replace("Art. 6º Seis, com", "Art. 40º Isolado, com uma redação nova que ocupa bastante espaço.\nArt. 6º Seis, com");
    const grave = p.leiDiagnosticarLei(CONSOL.replace("Art. 4º Ficam revogados dispositivos.", "Art. 40º Isolado.\nArt. 4º Ficam revogados dispositivos."));
    const d4 = p.leiDiagnosticarLei(EC4);
    ok(grave.itens.some((i) => i.gravidade === "grave"), "I3a (controle: na consolidada o numero isolado e' GRAVE)");
    ok(p.leiPareceAlteradora(EC4).sim && d4.numeracaoInfo.some((i) => i.tipo === "isolado") && d4.numeracaoInfo.every((i) => i.gravidade === "leve") && d4.resumo.graves === 0 && d4.itens.length === 0,
      "I3b na emenda o mesmo numero isolado e' informacao 'leve': nao conta como grave nem como aviso: " + JSON.stringify(d4.numeracaoInfo.map((i) => i.tipo + "/" + i.gravidade)));
  }
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ach = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); ach(c, pred, acc); }); return acc; };
    const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
    const l = api.leiGuardar({ id: "lei_ec2b", nome: "EC 132", texto: EC2 });
    api.leiAbrir("Direito", "Reforma", l.id);
    api.leiMapaAbrir();
    const info = api.$("leiMapaInfo");
    const g = ach(info, (c) => cls(c, "lei-info-grupo"))[0];
    ok(info.children.length === 1 && g && g.open !== true, "I4 um bloco de informacao RECOLHIDO");
    const sm = ach(g, (c) => String(c.tag || c.tagName).toLowerCase() === "summary")[0];
    ok(/^Numeração \(só informação\) · 2 ponto\(s\)$/.test(sm.textContent), "I5 o titulo diz o que e' e quantos: " + sm.textContent);
    ok(/altera outra.*não é tratada como aviso/.test(g.textContent), "I5a e explica por que nao e' aviso");
    const linhas = ach(g, (c) => cls(c, "lei-mapa-item"));
    ok(linhas.length === 2 && linhas.every((x) => cls(x, "lei-mapa-g-leve")) && /156-A/.test(linhas[0].textContent) && /recomeça/.test(linhas[1].textContent),
      "I6 cada ponto em uma linha, cinza ('leve'), com 'ir ao artigo' e 'ver no texto': " + linhas.map((x) => x.textContent.slice(0, 60)));
    ok(ach(g, (c) => cls(c, "btn-min")).length >= 2, "I6a (com o botao 'ir ao artigo')");
    const cf = api.$("leiMapaConferir");
    ok(cf.children.length === 1 && !ach(cf, (c) => cls(c, "lei-info-grupo")).length && !/ponto\(s\)/.test(cf.textContent) && api.$("leiMapaAjustes").children.length <= 1 && !ach(api.$("leiMapaAjustes"), (c) => cls(c, "lei-info-grupo")).length,
      "I7 a informacao fica FORA da conferencia, da linha de estado e do grupo de ajustes");
    /* o que estava aberto continua aberto ao repintar */
    g.open = true; g.ontoggle();
    api.leiMapaAbrir(true);
    ok(ach(api.$("leiMapaInfo"), (c) => cls(c, "lei-info-grupo"))[0].open === true, "I8 aberto continua aberto depois de repintar");
    const rel = api.leiRelatorioFluxo("mapa e conferência");
    ok(/numeração \(só informação; lei que altera outra\): 2 — salto art\. 156-A .*recomeco art\. 2º/.test(rel) && /a conferir: 0/.test(rel), "I9 o relatorio traz a informacao (e continua dizendo 0 a conferir): " + rel.split("\n").filter((x) => /só informação/.test(x)).join("|"));
    /* controles: a consolidada mostra AVISOS e nenhuma informacao; a emenda em ordem, nada */
    const l2 = api.leiGuardar({ id: "lei_cons3", nome: "Consolidada", texto: CONSOL });
    api.leiAbrir("Direito", "C", l2.id);
    api.leiMapaAbrir();
    ok(api.$("leiMapaInfo").children.length === 0, "I10 controle: a lei consolidada nao tem bloco de informacao (os pontos sao avisos)");
    const l3 = api.leiGuardar({ id: "lei_ec3", nome: "EC ok", texto: EC3 });
    api.leiAbrir("Direito", "E", l3.id);
    api.leiMapaAbrir();
    ok(api.$("leiMapaInfo").children.length === 0, "I11 emenda com a numeracao em ordem: sem bloco (nada a informar)");
  }
  /* ---- 6: a lei que so' TRAZ alteracoes de outras (a LC 214/2025) nao e' "alteradora" ---- */
  {
    const misto = [];
    misto.push("LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025", "Institui o Imposto sobre Bens e Serviços.");
    for (let i = 1; i <= 30; i++) {
      misto.push("Art. " + i + "º Texto próprio do artigo " + i + ", que institui regras do imposto e trata da sua incidência.");
      misto.push("§ 1º O contribuinte observará o disposto neste artigo " + i + ".");
      misto.push("§ 2º Lei complementar disporá sobre o tema deste artigo.");
    }
    /* dois artigos da propria lei que alteram outras leis, no fim, com aspas e marcas (NR) */
    misto.push("Art. 31. A Lei nº 5.172, de 25 de outubro de 1966 - Código Tributário Nacional, passa a vigorar com as seguintes alterações:");
    misto.push("\"Art. 9º " + ".".repeat(40), "IV - cobrar impostos sobre entidades religiosas;", ".".repeat(40) + " \" (NR)");
    misto.push("Art. 32. O Decreto-Lei nº 37, de 18 de novembro de 1966, passa a vigorar com a seguinte redação:");
    misto.push("\"Art. 44." + ".".repeat(40), "Parágrafo único. As informações prestadas constituem confissão de dívida.\" (NR)");
    misto.push("Art. 33. A Lei nº 10.931 passa a vigorar com as seguintes alterações: \"Art. 3º Texto. \" (NR)");
    misto.push("Art. 34. Esta Lei Complementar entra em vigor na data de sua publicação.");
    const MISTO = misto.join("\n");
    ok(p.leiPareceAlteradora(MISTO).sim === true, "M0 (o texto misto 'parece alteradora': tem (NR) e 'passa a vigorar')");
    ok(p.leiParcelaCitada(MISTO) < 0.15 && p.leiParcelaCitada(EC) > 0.5, "M1 so' uma parcela pequena do texto e' artigo citado (a EC tem mais da metade): " + p.leiParcelaCitada(MISTO).toFixed(2) + " / " + p.leiParcelaCitada(EC).toFixed(2));
    ok(p.leiEhAlteradora(MISTO) === false && p.leiEhAlteradora(EC) === true, "M2 a lei que so' TRAZ alteracoes NAO e' 'alteradora'; a emenda e'");
    const dg = p.leiDiagnosticarLei(MISTO);
    ok(dg.alteradora === false && dg.numeracaoInfo.length === 0, "M3 o mapa da lei mista nao a trata como alteradora: " + dg.alteradora);
    /* a numeracao dela CONTINUA conferida: um numero isolado e' apontado */
    const salto = MISTO.replace("Art. 20º Texto", "Art. 20º Texto").replace("Art. 21º Texto próprio do artigo 21", "Art. 210º Texto próprio do artigo 21");
    const ds = p.leiDiagnosticarLei(salto);
    ok(ds.itens.some((i) => i.tipo === "isolado" || i.tipo === "salto") && ds.numeracao.problemas.length > 0, "M4 a numeracao da lei mista CONTINUA conferida (um numero fora do lugar e' apontado): " + JSON.stringify(ds.itens.map((i) => i.tipo)));
    /* e o paragrafo repetido no mesmo artigo tambem */
    const rep = MISTO.replace("Art. 10º Texto próprio do artigo 10, que institui regras do imposto e trata da sua incidência.\n§ 1º O contribuinte observará o disposto neste artigo 10.",
      "Art. 10º Texto próprio do artigo 10, que institui regras do imposto e trata da sua incidência.\n§ 1º O contribuinte observará o disposto neste artigo 10.\n§ 1º Redação nova do mesmo parágrafo. (Redação dada pela Lei Complementar nº 999)");
    ok(p.leiRepetidosNoArtigo(rep).length === 1, "M5 o paragrafo repetido no mesmo artigo da lei mista CONTINUA apontado: " + p.leiRepetidosNoArtigo(rep).length);
    /* a analise da colagem e o aviso da lei guardada seguem o mesmo criterio */
    ok(p.leiPreAnalisar ? true : true, "M6 (analise)");
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    ok(api.leiPreAnalisar(salto).num.problemas.length > 0 && api.leiPreAnalisar(EC2).num.problemas.length === 0, "M7 a analise da colagem: confere a mista, nao a emenda");
    const l = api.leiGuardar({ id: "lei_mista", nome: "LC 214", texto: salto });
    ok(api.leiNumeracaoDaLei(l).problemas.length > 0, "M8 o aviso da lei guardada confere a numeracao da mista");
    api.leiAbrir("Direito", "IBS", l.id);
    api.leiMapaAbrir();
    ok(api.$("leiMapaInfo").children.length === 0 && !/altera outra/.test(api.$("leiMapaConferir").textContent), "M9 o mapa da mista nao mostra o bloco de informacao nem diz 'altera outra': " + api.$("leiMapaConferir").textContent.slice(0, 80));
  }
  /* ---- 7: os sinais de quem estuda: a especie (emenda constitucional) e a maioria dos artigos ---- */
  {
    const seq = (ini, fim) => { const a = []; for (let i = ini; i <= fim; i++) a.push("Art. " + i + "º Texto próprio do artigo " + i + " desta norma, com redação bastante longa para contar."); return a; };
    /* emenda constitucional SEM marcas nenhuma e sem 'passa a vigorar': e' emenda pela especie */
    const ecSemMarcas = ["EMENDA CONSTITUCIONAL Nº 45, DE 30 DE DEZEMBRO DE 2004", "Dispõe sobre matérias do Poder Judiciário."].concat(seq(1, 10)).join("\n");
    ok(p.leiPareceAlteradora(ecSemMarcas).sim === false && p.leiEhAlteradora(ecSemMarcas) === true, "S1 uma EMENDA CONSTITUCIONAL e' alteradora pela especie, mesmo sem marcas (NR) nem 'passa a vigorar'");
    ok(p.leiDiagnosticarLei(ecSemMarcas).alteradora === true && p.leiRepetidosNoArtigo(ecSemMarcas).length === 0, "S1a e o mapa a trata como tal");
    const lcSemMarcas = ecSemMarcas.replace("EMENDA CONSTITUCIONAL Nº 45, DE 30 DE DEZEMBRO DE 2004", "LEI COMPLEMENTAR Nº 45, DE 30 DE DEZEMBRO DE 2004");
    ok(p.leiEhAlteradora(lcSemMarcas) === false, "S2 a mesma coisa como lei complementar comum: nao e'");
    /* a maioria dos artigos e' de alteracao */
    const alt = (i) => "Art. " + i + "º A Lei nº " + (100 + i) + ", de 2020, passa a vigorar com as seguintes alterações:\n\"Art. 1º Texto novo.\" (NR)";
    const maioria = ["LEI COMPLEMENTAR Nº 95, DE 2022", "Altera leis tributárias."].concat([alt(1), alt(2), alt(3), alt(4), alt(5)], seq(6, 9)).join("\n");
    ok(p.leiEhAlteradora(maioria) === true, "S3 uma lei em que a MAIORIA dos artigos e' de alteracao de outra e' alteradora");
    const minoria = ["LEI COMPLEMENTAR Nº 95, DE 2022", "Altera leis tributárias."].concat([alt(1), alt(2)], seq(3, 12)).join("\n");
    ok(p.leiEhAlteradora(minoria) === false, "S4 com so' uma minoria de artigos de alteracao (2 de 12), nao e'");
  }
  /* ---- 8: so' a parte citada decide; e a revisao avalia o texto ORIGINAL (a grafia tira as aspas) ---- */
  {
    const grande = "Texto do artigo citado, com uma redação nova longa que ocupa bastante espaço no texto desta lei. ".repeat(6);
    const corpo = [];
    for (let i = 2; i <= 9; i++) corpo.push("Art. " + i + "º Dispositivo próprio " + i + ".");
    const soAspas = ["LEI Nº 9, DE 2025", "Trata de tributos.", "Art. 1º A Lei nº 1 passa a vigorar com as seguintes alterações:", "\"Art. 5º " + grande, grande + "\" (NR)"].concat(corpo).join("\n");
    ok(p.leiParcelaCitada(soAspas) >= 0.3 && p.leiEhAlteradora(soAspas) === true, "Q1 so' pela parte citada (mais de 30% do texto, uma unica introducao e nenhuma outra marca) ja e' alteradora: " + p.leiParcelaCitada(soAspas).toFixed(2));
    const semCitacao = soAspas.replace(/["“”]/g, "");
    ok(p.leiEhAlteradora(semCitacao) === false, "Q2 e sem as aspas (e sem marcas suficientes) nao");
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    ok(api.leiPreprocessar(soAspas).mudancas.some((m) => m.grupo === "grafia"), "Q3 (a limpeza sugere tirar as aspas do artigo citado)");
    api.leiRevisarColagemAbrir({ modo: "criar", texto: soAspas, pre: api.leiPreprocessar(soAspas), aoConfirmar() {} });
    ok(api.$("leiPreNumeracao").hidden === true, "Q4 a revisao avalia o texto ORIGINAL (com as aspas): o painel de numeracao fica escondido, mesmo com a grafia aceita");
  }
  /* ---- 9: as marcas so' contam quando sao DENSAS: por artigo E por KB ---- */
  {
    /* artigos longos (3 KB cada) com uma marca (NR) em cada 2,5 artigos: 0,4 por artigo, mas so' 0,13 por KB */
    const longo = "Disposição própria do artigo, com uma redação extensa que trata da incidência, da base de cálculo e das obrigações acessórias. ".repeat(25);
    const arts = [];
    for (let i = 1; i <= 30; i++) arts.push("Art. " + i + "º " + longo + (i % 5 === 0 || i % 5 === 3 ? "\n\"Art. 9º Texto citado.\" (NR)" : ""));
    arts.push("Art. 31. A Lei nº 1 passa a vigorar com as seguintes alterações:");
    const raro = ["LEI COMPLEMENTAR Nº 9, DE 2025", "Institui tributos."].concat(arts).join("\n");
    const marcas = (raro.match(/\(NR\)/g) || []).length;
    const porArt = marcas / p.leiArtigos(raro).length, porKB = marcas / (raro.length / 1000);
    ok(porArt >= 0.3 && porKB < 0.2 && p.leiPareceAlteradora(raro).sim === true && p.leiEhAlteradora(raro) === false,
      "D1 artigos longos com marcas ESPARSAS (" + porArt.toFixed(2) + " por artigo, " + porKB.toFixed(2) + " por KB) nao sao alteradora: e' a densidade por KB que segura");
  }
  const chaves2 = ["lei_mapa_ok_alt", "lei_info_num_titulo", "lei_info_num_expl", "lei_info_num_mais"];
  {
    const i18n = fs.readFileSync(require("path").join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const conta = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": ", "g")) || []).length;
    ok(chaves2.every((k) => conta(k) === 2), "N8 as frases novas existem em portugues E em ingles");
    ok(/<div id="leiMapaAjustes"><\/div>\s*<!--[^>]*-->\s*<div id="leiMapaInfo"><\/div>/.test(fs.readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8")), "N9a o espaco da informacao existe, depois dos ajustes");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
