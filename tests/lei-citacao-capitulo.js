/* =====================================================================
 * (19.106.0) O TRECHO CITADO QUE ABRE COM UMA DIVISÃO, E A PENA QUE NÃO É CABEÇALHO — o caso da Lei 14.133/2021
 *
 * O Art. 178 da Lei 14.133 "passa a vigorar acrescido do seguinte Capítulo II-B" no Código Penal, e o texto citado
 * abre com “CAPÍTULO II-B — não com “Art. Como a citação só era reconhecida quando abria com “Art., os Arts. 337-E a
 * 337-P do Código Penal viravam artigos da própria lei, e a revisão da colagem dizia:
 *   · "Art. 179 vem depois do Art. 337-P: a numeração volta" (grave) — falso;
 *   · "Cabeçalho ou rodapé repetido": "Pena - reclusão, de 4 (quatro) anos a 8 (oito) anos, e multa." ×3 (os
 *     Arts. 337-F, 337-H e 337-L têm a mesma pena) — e aceitar APAGAVA as três penas.
 *
 * O QUE PRECISA SER VERDADE:
 *  LC1  o trecho citado pode abrir com “CAPÍTULO, “TÍTULO, “Seção, “LIVRO… — o bloco do artigo que altera tem o trecho
 *       e os artigos citados, e a lei-alvo é o Código Penal;
 *  LC2  os artigos citados não contam como artigos da lei: a numeração não tem problema nenhum;
 *  LC3  as penas repetidas dentro do trecho citado não viram cabeçalho;
 *  LC4  uma linha de pena ("Pena - …") NUNCA é cabeçalho de página, nem fora de citação (o próprio Código Penal colado
 *       tem dezenas de penas iguais, espaçadas como um rodapé) — e o cabeçalho de verdade continua saindo;
 *  LC5  na tela: nem "Cabeçalhos" nem o aviso de numeração; o bloco aparece entre as alterações de outras leis.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api: p } = rodar();

  /* ---- uma lei como a 14.133: artigos próprios longos, e um que acrescenta um capítulo ao Código Penal ---- */
  const L = [];
  const par = (s) => { L.push(s); L.push(""); };
  const frase = " Esta disposição trata de contratações públicas, com regras de planejamento, seleção do fornecedor, gestão do contrato, fiscalização, sanções e controle, aplicáveis à administração direta, autárquica e fundacional de todos os entes da Federação.";
  par("LEI Nº 99.133, DE 1º DE ABRIL DE 2021");
  par("Lei de Licitações e Contratos Administrativos (texto de teste).");
  for (let k = 1; k <= 30; k++) par("Art. " + k + (k < 10 ? "º" : ".") + frase + frase);
  par("Art. 31. O Título XI da Parte Especial do Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal), passa a vigorar acrescido do seguinte Capítulo II-B:");
  par("“CAPÍTULO II-B");
  par("DOS CRIMES EM LICITAÇÕES E CONTRATOS ADMINISTRATIVOS");
  const PENA = "Pena - reclusão, de 4 (quatro) anos a 8 (oito) anos, e multa.";
  const crimes = [
    ["E", "Contratação direta ilegal", "Admitir, possibilitar ou dar causa à contratação direta fora das hipóteses previstas em lei:", "Pena - reclusão, de 4 (quatro) a 8 (oito) anos, e multa."],
    ["F", "Frustração do caráter competitivo de licitação", "Frustrar ou fraudar o caráter competitivo do processo licitatório:", PENA],
    ["G", "Patrocínio de contratação indevida", "Patrocinar, direta ou indiretamente, interesse privado perante a Administração:", "Pena - reclusão, de 6 (seis) meses a 3 (três) anos, e multa."],
    ["H", "Modificação ou pagamento irregular em contrato administrativo", "Admitir, possibilitar ou dar causa a qualquer modificação ou vantagem:", PENA],
    ["I", "Perturbação de processo licitatório", "Impedir, perturbar ou fraudar a realização de qualquer ato:", "Pena - detenção, de 6 (seis) meses a 3 (três) anos, e multa."],
    ["J", "Violação de sigilo em licitação", "Devassar o sigilo de proposta apresentada em processo licitatório:", "Pena - detenção, de 2 (dois) anos a 3 (três) anos, e multa."],
    ["K", "Afastamento de licitante", "Afastar ou tentar afastar licitante por meio de violência:", "Pena - reclusão, de 3 (três) anos a 5 (cinco) anos, e multa."],
    ["L", "Fraude em licitação ou contrato", "Fraudar, em prejuízo da Administração Pública, licitação ou contrato:", PENA],
  ];
  crimes.forEach(([x, tit, caput, pena]) => { par(tit); par("Art. 337-" + x + ". " + caput); par(pena); });
  par("Art. 337-P. A pena de multa cominada aos crimes previstos neste Capítulo seguirá a metodologia de cálculo prevista neste Código.”");
  par("Art. 32. Revogam-se as disposições em contrário." + frase);
  par("Art. 33. Esta Lei entra em vigor na data de sua publicação.");
  const texto = L.join("\n");
  const nLinha = (s) => L.indexOf(s) + 1;

  /* ---- LC1 o bloco do Art. 31, com o trecho que abre em “CAPÍTULO ---- */
  const cit = p.leiLerCitacoes(L);
  const b31 = cit.blocos.find((b) => b.rotulo === "Art. 31");
  const artsCit = b31 ? b31.trechos.reduce((a, tr) => a.concat(tr.artigos.map((x) => x.numCru)), []) : [];
  ok(b31 && b31.trechos.length === 1 && b31.trechos[0].ini === nLinha("“CAPÍTULO II-B"), "LC1 o trecho citado abre na linha do “CAPÍTULO: " + JSON.stringify(b31 && b31.trechos.map((tr) => [tr.ini, tr.fim])));
  ok(artsCit.length === 9 && artsCit[0] === "337-E" && artsCit[8] === "337-P", "LC1b os 9 artigos citados (337-E a 337-P): " + artsCit.join(","));
  ok(b31 && b31.alvo && /Decreto-Lei nº 2\.848\/1940/.test(b31.alvo.curto), "LC1c a lei-alvo é o Código Penal: " + (b31 && b31.alvo && b31.alvo.curto));
  ok(cit.citadas.has(nLinha(PENA)) && cit.citadas.has(nLinha("DOS CRIMES EM LICITAÇÕES E CONTRATOS ADMINISTRATIVOS")), "LC1d as linhas do capítulo citado estão protegidas");
  /* as outras divisões também abrem uma citação */
  ["“TÍTULO IV", "“Seção II", "“LIVRO III", "“SUBSEÇÃO I", "“CAPÍTULO III-A"].forEach((d) => {
    const r = p.leiRegioesCitadas(["Art. 5º A Lei nº 1.234, de 1º de janeiro de 2000, passa a vigorar acrescida do seguinte:", d, "DO TEMA", "Art. 7º-A. Texto novo.”"]);
    ok(r.length === 1 && r[0].ini === 1 && r[0].fim === 3, "LC1e “" + d.slice(1) + " também abre a citação");
  });
  /* e uma divisão SEM aspas continua sendo divisão da própria lei */
  ok(!p.leiRegioesCitadas(["CAPÍTULO II", "DAS DISPOSIÇÕES GERAIS", "Art. 7º Texto.”"]).length, "LC1f sem aspas, CAPÍTULO é da própria lei");

  /* ---- LC2 / LC3 a revisão da colagem ---- */
  const an = p.leiPreAnalisar(texto);
  const cab = an.pre.mudancas.filter((m) => m.grupo === "cabecalho");
  ok(!cab.some((m) => /^Pena\b/.test(m.antes)), "LC3 a pena repetida dentro do trecho citado não vira cabeçalho: " + cab.map((m) => m.antes).join(" | "));
  ok(!an.num.problemas.length && !an.num.graves.length, "LC2 a numeração não tem problema: " + an.num.problemas.map((x) => x.tipo + " " + x.numCru).join(", "));
  const dec = {};
  an.pre.mudancas.forEach((m) => { dec[m.id] = m.grupo === "anexo" ? "separar" : !m.mantido; });
  const res = p.leiAplicarPreprocesso(texto, an.pre.mudancas, dec);
  const arts = p.leiArtigos(res.texto);
  ok(arts.length === 33 && !arts.some((a) => /337/.test(a.numCru)), "LC2b a lei tem os 33 artigos dela, nenhum 337-x: " + arts.length + " · " + arts.filter((a) => /337/.test(a.numCru)).map((a) => a.numCru).join(","));
  ok(res.texto.split("\n").filter((x) => x === PENA).length === 3, "LC3b as três penas continuam no texto");

  /* ---- LC4 a pena nunca é cabeçalho, nem fora de citação; o cabeçalho de verdade continua saindo ---- */
  const CP = [];
  const parCP = (s) => { CP.push(s); CP.push(""); };
  parCP("CÓDIGO PENAL (trecho de teste)");
  const PENA_CP = "Pena - detenção, de 1 (um) a 3 (três) anos, e multa.";
  const TOPO = "Diário Oficial da União - Seção 1 - Edição de teste";
  for (let k = 1; k <= 14; k++) {
    parCP("Crime número " + k);
    parCP("Art. " + (100 + k) + ". Praticar a conduta descrita no tipo penal número " + k + " desta lista de teste:");
    parCP(PENA_CP);
    if (k % 3 === 0) parCP(TOPO);
  }
  const preCP = p.leiPreprocessar(CP.join("\n"));
  const cabCP = preCP.mudancas.filter((m) => m.grupo === "cabecalho");
  ok(!cabCP.some((m) => m.antes === PENA_CP), "LC4 a pena repetida do Código Penal não vira cabeçalho: " + cabCP.map((m) => m.antes).join(" | "));
  ok(cabCP.some((m) => m.antes === TOPO), "LC4b o cabeçalho de verdade continua saindo: " + cabCP.map((m) => m.antes).join(" | "));
  ["Pena – reclusão, de 2 (dois) a 4 (quatro) anos.", "Pena: detenção, de 1 (um) a 2 (dois) anos.", "Penas - reclusão e multa."].forEach((s) => {
    const T = [];
    for (let k = 1; k <= 6; k++) { T.push("Art. " + (200 + k) + ". Conduta " + k + ":", "", s, "", "Texto de ligação " + k, "", "Outro parágrafo " + k, ""); }
    ok(!p.leiPreprocessar(T.join("\n")).mudancas.some((m) => m.grupo === "cabecalho" && m.antes === s), "LC4c “" + s.slice(0, 7) + "…” também é pena");
  });

  /* ---- LC5 a tela ---- */
  p.leiRevisarColagemAbrir({ texto, modo: "criar", pre: an.pre, aoConfirmar: () => {} });
  const chips = p.$("leiPreChips");
  const temChip = (g) => !!(chips && Array.from(chips.children || []).some((b) => b.id === "btnLeiPreChip_" + g));
  ok(!temChip("cabecalho") && !p.$("leiPreGrupo_cabecalho"), "LC5 a tela não pede para tirar a pena");
  const como = p.$("leiPreComo");
  ok(!/numera/i.test((como && como.textContent) || ""), "LC5b o 'como a lei vai ficar' não acusa a numeração: " + (como && como.textContent));
  const alt = p.$("leiPreGrupo_alteracao");
  ok(alt && /Decreto-Lei nº 2\.848\/1940/.test(alt.textContent) && /337-E/.test(alt.textContent), "LC5c o bloco aparece entre as alterações de outras leis");
  try { p.$("dlgLeiPre").close(); } catch (e) {}
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
