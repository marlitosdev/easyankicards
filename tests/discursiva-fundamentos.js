/* =====================================================================
 * DISCURSIVAS — OS FUNDAMENTOS DO ESPELHO E DO MODELO (19.159.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  F1. no leitor do tema, as citações de lei do espelho, da resposta modelo e do treino de esqueleto viram os links do
 *      resumo (com a lei achada pela biblioteca); a de julgado também; tocar abre a prévia do artigo;
 *  F2. "🃏 Cartão" num item do espelho abre o prompt de cartões com o item, os subitens, o trecho da resposta modelo
 *      que fala dele e a disciplina como etiqueta;
 *  F3. nas Leis do edital: os artigos citados nas discursivas entram nos cobrados da lei (quando ela já é medida por
 *      artigos, ou só aparece nas discursivas); a lei que o edital cobra inteira continua inteira; a lei citada que não
 *      está na biblioteca vira lacuna "citada em N discursiva(s)", sem tópico (incluir não liga a tópico falso);
 *  F4. a tela mostra os temas que citam a lei e abre o tema direto; disciplina fora do edital tem seção própria.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const arts = (k) => Array.from({ length: k }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".").join(NL);
  const ESP = [
    "Critérios de Conteúdo (Total 40,0 pontos):",
    "1. Poderes de fiscalização do auditor (20,0 pontos):",
    "* Explicar o art. 197 do CTN e o dever de prestar informações.",
    "2. Acesso a dados bancários (20,0 pontos):",
    "* Citar o art. 6º da LC 105/2001 e o art. 150, VI, da CF.",
    "Critérios de Desconto:",
    "* Erros de Língua Portuguesa: desconto de 0,5 ponto por erro.",
  ].join(NL);
  const MOD = [
    "A fiscalização tributária tem poderes amplos. Nos termos do art. 195 do CTN, não se aplicam disposições que limitem o direito de examinar livros. Os poderes do auditor de fiscalização incluem exigir informações.",
    "",
    "Quanto aos dados bancários, o art. 6º da LC 105/2001 autoriza o acesso pelas autoridades fiscais, como decidiu o STF no RE 601.314.",
  ].join(NL);

  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
  api.ledIniciar();
  const e = api.edCriar("ISS", ["# ISS | prova: " + daqui(15) + " | horas: 10",
    "# discursiva | pontos: 40 | objetiva: 60 | minimo: 50% | linhas: 25-30 | disciplinas: Sistema Tributário",
    "@ Sistema Tributário :: 5", "+ Fiscalização :: 5 :: Arts. 194 a 196 do CTN", "+ Imunidades :: 4 :: CF"].join(NL));
  const chF = api.matChave("Sistema Tributário", "Fiscalização");
  const ctn = api.leiGuardar({ nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: arts(220), topicos: [chF] });
  const cf = api.leiGuardar({ nome: "Constituição Federal", apelido: "CF", texto: arts(160), topicos: [] });
  const lef = api.leiGuardar({ nome: "Lei 6.830/1980 - LEF", texto: arts(8), topicos: [] });
  const p1 = api.dsPropostaAdicionar(e.id, { tema: "Fiscalização", disc: "Sistema Tributário", enunciado: "Disserte sobre a fiscalização.", espelho: ESP, modelo: MOD, fonte: "ia" });
  const p2 = api.dsPropostaAdicionar(e.id, { tema: "Execução fiscal", disc: "Sistema Tributário", enunciado: "Disserte.", espelho: "Abordar o art. 2º da Lei 6.830/80 (10 pts)", fonte: "ia" });
  const p3 = api.dsPropostaAdicionar(e.id, { tema: "Tema de outra matéria", disc: "Direito Financeiro", enunciado: "Disserte.", espelho: "Citar o art. 3º da Lei 6.830/80 (10 pts)", fonte: "ia" });
  api.loja.setItem("eac_ds_edital", e.id); api.loja.setItem("eac_ds_secao", "propostas");
  api.dsPropSel[e.id] = p1.id;
  api.dsRender();

  /* F1 */
  const links = (id, cls) => { const x = api.$(id); return x ? x.querySelectorAll("button").filter((b) => (b.className || "").indexOf(cls) >= 0) : []; };
  const le = links("dsEspTxt_" + p1.id, "qs-lei-link");
  ok(le.some((b) => /art\. 197/.test(b.textContent) && !/qs-lei-link-sem/.test(b.className)) && le.some((b) => /art\. 6º/.test(b.textContent) && /qs-lei-link-sem/.test(b.className)),
    "F1a o espelho: 'art. 197 do CTN' vira link com a lei; 'art. 6º da LC 105' (fora da biblioteca) vira link sem lei: " + le.map((b) => b.textContent + "|" + b.className).join(" ; "));
  const lm = links("dsModeloTxt_" + p1.id, "qs-lei-link");
  ok(lm.some((b) => /art\. 195/.test(b.textContent) && !/qs-lei-link-sem/.test(b.className)), "F1b a resposta modelo: 'art. 195 do CTN' vira link: " + lm.map((b) => b.textContent).join(" ; "));
  ok(links("dsModeloTxt_" + p1.id, "jur-cit-link").some((b) => /601\.314/.test(b.textContent)), "F1c o julgado citado no modelo (RE 601.314) vira link de julgado");
  ok(links("dsEsq_" + p1.id, "qs-lei-link").some((b) => /art\. 197/.test(b.textContent)), "F1d o treino de esqueleto também liga as citações dos subitens");
  le.filter((b) => /art\. 197/.test(b.textContent))[0].onclick({ stopPropagation() {} });
  ok(api.$("dlgLeiCitaPreview").open && /Texto do artigo 197/.test(api.$("leiCitaPreviewTexto").textContent), "F1e tocar abre a prévia do artigo citado: " + api.$("leiCitaPreviewTexto").textContent.slice(0, 200));
  api.$("dlgLeiCitaPreview").close();
  /* o tema que só nomeia o CTN: "o artigo 198" sem lei é do CTN; o balão fala da discursiva, não do resumo */
  const p4 = api.dsPropostaAdicionar(e.id, { tema: "Sigilo fiscal", disc: "Sistema Tributário", enunciado: "Disserte sobre o sigilo no CTN.", modelo: "O sigilo fiscal protege o contribuinte. Segundo o artigo 198, é vedada a divulgação das informações obtidas.", fonte: "ia" });
  api.dsPropSel[e.id] = p4.id;
  api.dsRender();
  const l4 = links("dsModeloTxt_" + p4.id, "qs-lei-link");
  ok(l4.length === 1 && !/qs-lei-link-sem/.test(l4[0].className) && /sem sair da discursiva/.test(l4[0].title) && /Código Tributário/.test(l4[0].title),
    "F1f a citação sem lei vai para a única lei que o tema nomeia (o CTN): " + l4.map((b) => b.className + " | " + b.title).join(" ; "));
  api.dsPropSel[e.id] = p1.id;
  api.dsRender();

  /* F2 */
  const E = api.dsEspelhoItens(ESP);
  ok(/art\. 195 do CTN/.test(api.dsItemTrechoModelo(p1, E.itens[0])) && /LC 105\/2001 autoriza/.test(api.dsItemTrechoModelo(p1, E.itens[1])), "F2a cada item acha o parágrafo do modelo que fala dele");
  /* o modelo num bloco só e comprido: ficam as frases do item, não o texto inteiro */
  const longo = Array.from({ length: 12 }, (_, k) => "Frase de enchimento número " + k + " sobre outro assunto qualquer.").join(" ")
    + " Os poderes do auditor de fiscalização incluem exigir informações, nos termos do art. 197 do CTN. " + Array.from({ length: 6 }, (_, k) => "Mais texto alheio " + k + " aqui.").join(" ");
  const tl = api.dsItemTrechoModelo({ modelo: longo }, E.itens[0]);
  ok(tl.length <= 700 && /Os poderes do auditor de fiscalização/.test(tl) && !/enchimento número 0/.test(tl), "F2d modelo comprido num bloco: só as frases do item (" + tl.length + "): " + tl.slice(0, 160));
  const vc = api.$("btnDsEsqCartao_" + p1.id + "_0");
  ok(!!vc, "F2b cada item do esqueleto tem '🃏 Cartão'");
  vc.onclick({ preventDefault() {} });
  const g = api.$("genTexto").value;
  ok(api.$("dlgGerar").open && /Discursiva — Fiscalização \(Sistema Tributário\)/.test(g) && /Item 1 do espelho \(20 pontos\): Poderes de fiscalização do auditor/.test(g)
    && /- Explicar o art\. 197 do CTN/.test(g) && /art\. 195 do CTN, não se aplicam/.test(g) && !/RE 601\.314/.test(g) && /\[tags sugeridas: sistema_tributário, discursiva\]/.test(g),
    "F2c o prompt de cartões leva o item, o subitem, o trecho do modelo dele (e não o do outro item) e a etiqueta: " + g.slice(-500));
  api.$("dlgGerar").close();

  /* F3 */
  const M = api.ledModelo(e.id);
  ok(M.leis[ctn.id].leit.cobrados.join() === "194,195,196,197", "F3a o CTN: os arts. 194 a 196 do edital + o 195 do modelo e o 197 do espelho: " + M.leis[ctn.id].leit.cobrados.join());
  ok(M.leis[cf.id].leit.modo === "lei", "F3b a CF, cobrada inteira no edital, continua inteira (o art. 150 do espelho não a encolhe)");
  const trib = M.disciplinas.filter((D) => D.nome === "Sistema Tributário")[0];
  const xL = trib && trib.lista.filter((x) => x.id === lef.id)[0];
  ok(xL && xL.ds.length === 1 && xL.ds[0].tema === "Execução fiscal" && xL.leit.modo === "cobrados" && xL.leit.cobrados.join() === "2" && !xL.topicos.length,
    "F3c a LEF, que só aparece numa discursiva da disciplina, entra nela com o artigo citado");
  const G = M.lacunas.filter((x) => x.chave === "lc:105")[0];
  ok(G && !G.topicos.length && G.ds.length === 1 && G.ds[0].tema === "Fiscalização" && G.nums.has("6") && G.disciplinas.join() === "Sistema Tributário",
    "F3d a LC 105 (fora da biblioteca) vira lacuna das discursivas, sem tópico: " + JSON.stringify(G && { t: G.topicos.length, ds: G.ds, d: G.disciplinas }));
  ok(!M.semLigacao.some((x) => x.id === lef.id), "F3e lei só das discursivas não entra em 'citadas sem ligação' (não há tópico para ligar)");
  const solta = M.disciplinas.filter((D) => D.soDs)[0];
  ok(solta && /fora do edital/.test(solta.nome) && solta.lista.some((x) => x.id === lef.id && x.ds[0].tema === "Tema de outra matéria"), "F3f o tema de disciplina fora do edital tem seção própria");

  /* F4 */
  api.ledAbrir(e.id);
  const corpo = api.$("ledCorpo").textContent;
  ok(/em 1 discursiva\(s\)/.test(corpo) && /Fiscalização · art/.test(corpo), "F4a o cartão da lei diz em quantas discursivas é citada e quais artigos");
  ok(/citada em 1 discursiva\(s\): Fiscalização/.test(api.$("ledLac").textContent), "F4b a lacuna diz em que discursiva foi citada");
  const bt = api.$("ledCorpo").querySelectorAll("button").filter((b) => /^btnLedDs_/.test(b.id) && b.id.indexOf(lef.id) >= 0 && b.id.indexOf(api.ledIdSeguro(p2.id)) >= 0)[0];
  ok(!!bt, "F4c cada tema tem 'abrir o tema'");
  if (bt) bt.onclick();
  ok(!api.$("dlgLeiBib").open && api.dsPropSel[e.id] === p2.id && api.loja.getItem("eac_ds_secao") === "propostas", "F4d abrir o tema fecha a tela e abre o leitor dele");
  void p3;

  ["ds_esq_cartao", "ds_esq_cartao_tip", "ds_card_cab", "ds_card_enun", "ds_card_item", "ds_card_trecho", "led_em_ds", "led_ds_ver", "led_ds_abrir", "led_ds_disc", "led_lac_ds"].forEach((k) =>
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "F5 falta " + k + " em " + l); }));
  api.setLanguage("pt");

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
