/* =====================================================================
 * CATÁLOGO OFICIAL, SELO DE QUALIDADE E AUDITORIA (v18.95.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o catálogo acha a súmula/tema pelo número e o TEMA pelo processo que o fixou (RE 593.849 → Tema 201);
 *  2. comparar a tese: igual (acento/pontuação), "forma" (nº, art., ano, DL, CF, preposições) e diferente (Poder Executivo
 *     × Município) — a forma não vira troca de texto;
 *  3. a citação "RE 593.849" acha o "Tema 201" guardado (e o contrário), e os dois guardados são REPETIDOS;
 *  4. o selo: nunca conferido = a conferir; ✓ conferi = conferido; > 180 dias = vencido; oficial preso ao texto
 *     (editar a tese tira); fora de vigor, diferente do oficial ou repetido = problema;
 *  5. a auditoria sugere, não decide: iguais → selo; diferentes → a pessoa escolhe; situação só piora (nunca rebaixa
 *     "cancelada"); tribunal trocado só com o texto batendo; composto e acórdão isolado ficam de fora;
 *  6. aplicar grava só o decidido, com recibo guardado; desfazer volta TUDO como era;
 *  7. a tela: passos e barra de progresso, grupos, escolha um a um, confirmação antes de gravar, desfazer;
 *  8. a prévia de uma citação não guardada mostra o texto oficial e guarda com o selo; a biblioteca conta e filtra
 *     pelo selo; a gaveta mostra o selo de quem foi conferido e abre o painel pelo ⋯.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const CAT = {
  geradoEm: "2026-10-21",
  itens: {
    "STJ|sumula|160": { tribunal: "STJ", classe: "Súmula", numero: "160", tese: "É defeso, ao município, atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária.", situacao: "vigente", orgao: "Primeira Seção", data: "1996-06-12", fonte: "DJ 19/06/1996, p. 21940", url: "https://scon.stj.jus.br/SCON/sumstj/toc.jsp?livre=%40num%3D'160'" },
    "STJ|sumula|212": { tribunal: "STJ", classe: "Súmula", numero: "212", tese: "A compensação de créditos tributários não pode ser deferida em ação cautelar ou por medida liminar cautelar ou antecipatória.", situacao: "cancelada", orgao: "Primeira Seção", data: "2005-05-11" },
    "STJ|sumula|436": { tribunal: "STJ", classe: "Súmula", numero: "436", tese: "A entrega de declaração pelo contribuinte reconhecendo débito fiscal constitui o crédito tributário, dispensada qualquer outra providência por parte do fisco.", situacao: "vigente", orgao: "Primeira Seção", data: "2010-04-14", fonte: "DJe 13/05/2010" },
    "STF|sumula vinculante|8": { tribunal: "STF", classe: "Súmula Vinculante", numero: "8", tese: "São inconstitucionais o parágrafo único do artigo 5º do Decreto-Lei 1.569/1977 e os artigos 45 e 46 da Lei 8.212/1991, que tratam da prescrição e decadência do crédito tributário.", situacao: "vigente", url: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26&sumula=1212", stfId: "1212" },
    "STF|sumula|160": { tribunal: "STF", classe: "Súmula", numero: "160", tese: "É nula a decisão do Tribunal que acolhe, contra o réu, nulidade não arguida no recurso da acusação, ressalvados os casos de recurso de ofício.", situacao: "vigente" },
    "STF|tema|201": { tribunal: "STF", classe: "Tema", numero: "201", tese: "É devida a restituição da diferença do Imposto sobre Circulação de Mercadorias e Serviços (ICMS) pago a mais no regime de substituição tributária para a frente se a base de cálculo efetiva da operação for inferior à presumida.", situacao: "vigente", data: "2016-10-19", paradigmas: ["RE 593849"] },
    "STF|tema|432": { tribunal: "STF", classe: "Tema", numero: "432", tese: "A imunidade tributária prevista no art. 195, § 7º, da Constituição Federal abrange a contribuição para o PIS.", situacao: "vigente", paradigmas: ["RE 636941"] },
    "STJ|tema|962": { tribunal: "STJ", classe: "Tema", numero: "962", tese: "O redirecionamento da execução fiscal, quando fundado na dissolução irregular da pessoa jurídica executada ou na presunção de sua ocorrência, não pode ser autorizado contra o sócio ou o terceiro não sócio que, embora exercesse poderes de gerência ao tempo do fato gerador, sem incorrer em prática de atos com excesso de poderes ou infração à lei, ao contrato social ou aos estatutos, dela regularmente se retirou e não deu causa à sua posterior dissolução irregular, conforme art. 135, III, do CTN.", situacao: "vigente", relator: "Assusete Magalhães", paradigmas: ["REsp 1377019/SP", "REsp 1776138/RJ"] },
    "STJ|tema|201": { tribunal: "STJ", classe: "Tema", numero: "201", tese: "Outro tema 201, do STJ.", situacao: "vigente" },
  },
};

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, sim) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 20 && !pronto; i++) { await new Promise((r) => setImmediate(r)); try { api._uiFechar(sim !== false); } catch (e) {} }
    return promessa;
  };
  const NL = String.fromCharCode(10);

  /* ---- 1 e 2 ---- */
  {
    const { api: a } = rodar();
    ok(!a.jurCatPronto(), "C0 sem catálogo carregado, nada responde");
    a.jurCatDefinir(CAT);
    const e = (o) => a.jurCatEntradasDe(o).map((x) => x.chave + ":" + x.via).join(",");
    ok(e({ cc: "sumula", numero: "160", tribunal: "STJ" }) === "STJ|sumula|160:eh", "C1 súmula pelo número e tribunal");
    ok(e({ cc: "sumula", numero: "160" }) === "STF|sumula|160:eh,STJ|sumula|160:eh", "C1a sem tribunal: as duas (quem chama decide)");
    ok(e({ cc: "re", numero: "593849", tribunal: "STF" }) === "STF|tema|201:paradigma", "C1b o RE acha o tema que ele fixou");
    ok(e({ cc: "resp", numero: "1776138" }) === "STJ|tema|962:paradigma", "C1c qualquer dos REsp afetados acha o tema");
    ok(e({ cc: "re", numero: "593849", tribunal: "STJ" }) === "", "C1d tribunal errado: nada");
    const eq = a.jurCatEquivalentes({ cc: "tema", numero: "962", tribunal: "STJ" }).map((x) => x.cc + " " + x.numero).join(",");
    ok(eq === "resp 1377019,resp 1776138", "C1e as identidades equivalentes de um tema: " + eq);
    /* comparar */
    ok(a.jurCatComparar("É DEFESO, ao Município — atualizar o IPTU mediante decreto em percentual superior ao índice oficial de correção monetária", CAT.itens["STJ|sumula|160"].tese) === "igual", "C2 caixa, acento e pontuação: igual");
    ok(a.jurCatComparar("São inconstitucionais o parágrafo único do artigo 5º do Decreto-Lei nº 1.569/1977 e os artigos 45 e 46 da Lei nº 8.212/91, que tratam de prescrição e decadência de crédito tributário.", CAT.itens["STF|sumula vinculante|8"].tese) === "forma",
      "C2a SV 8 com 'nº', ano com dois dígitos e 'de'/'da': só a forma");
    ok(a.jurCatComparar("A imunidade tributária prevista no art. 195, § 7º, da CF abrange a contribuição para o PIS.", CAT.itens["STF|tema|432"].tese) === "forma", "C2b 'CF' × 'Constituição Federal': forma");
    ok(a.jurCatComparar("É defeso ao Poder Executivo atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária.", CAT.itens["STJ|sumula|160"].tese) === "diferente", "C2c 'Poder Executivo' × 'município': diferente");
    ok(a.jurCatComparar("A imunidade tributária prevista no art. 195, § 7º, da CF NÃO abrange a contribuição para o PIS.", CAT.itens["STF|tema|432"].tese) === "diferente", "C2d um 'não' a mais é diferente (nunca é só forma)");
    ok(a.jurCatComparar("", "x") === "diferente", "C2e vazio não é igual");
    const df = a.jurDiffPalavras("ao Poder Executivo atualizar", "ao município atualizar");
    ok(JSON.stringify(df) === JSON.stringify([{ t: "=", s: "ao" }, { t: "-", s: "Poder Executivo" }, { t: "+", s: "município" }, { t: "=", s: "atualizar" }]), "C2f diferença palavra a palavra: " + JSON.stringify(df));
  }

  /* ---- 3 e 4 ---- */
  {
    const { api: a } = rodar();
    a.jurCatDefinir(CAT);
    const t201 = a.jurGravar({ tribunal: "STF", classe: "Tema", numero: "201", tese: CAT.itens["STF|tema|201"].tese });
    const cit = (s) => a.jurAcharCitado(a.jurCitacoesNoTexto(s)[0]);
    const r = cit("RE 593.849");
    ok(r.julgado && r.julgado.id === t201.id && r.via === "catalogo", "C3 'RE 593.849' acha o Tema 201 guardado (pelo catálogo): " + JSON.stringify({ via: r.via }));
    ok(!cit("REsp 593.849").julgado, "C3a outra classe com o mesmo número não");
    const re = a.jurGravar({ tribunal: "STF", classe: "RE", numero: "593849", tese: "outra redação" });
    const r2 = cit("Tema 201 da Repercussão Geral");
    ok(r2.julgado && r2.julgado.id === t201.id && r2.via === "eh", "C3b com os dois guardados, 'Tema 201' acha o que É o tema");
    const r3 = cit("RE 593.849");
    ok(r3.julgado && r3.julgado.id === re.id && r3.via === "eh", "C3c e 'RE 593.849' acha o que É o RE");
    ok(a.jurRepetidosDe(t201).map((x) => x.id).join() === re.id && a.jurRepetidosDe(re).map((x) => x.id).join() === t201.id, "C4 Tema 201 e RE 593.849 guardados separados são REPETIDOS");
    ok(a.jurQualidade(t201).nivel === "problema" && a.jurQualidade(t201).motivos.some((m) => m.k === "repetido"), "C4a e o selo diz 'problema: repetido'");
    const stj201 = a.jurGravar({ tribunal: "STJ", classe: "Tema", numero: "201", tese: "Outro tema 201, do STJ." });
    ok(!a.jurRepetidosDe(stj201).length, "C4b o Tema 201 do STJ não é repetido do Tema 201 do STF");
  }

  /* ---- 4: o selo ---- */
  {
    const { api: a } = rodar();
    a.jurCatDefinir(CAT);
    const n = (j, h) => a.jurQualidade(a.jurDe(j.id), { hoje: h || "2026-10-21" }).nivel;
    const acord = a.jurGravar({ tribunal: "STF", classe: "ADI", numero: "1945", tese: "É constitucional a incidência do ISS no licenciamento de software." });
    ok(n(acord) === "aconferir" && a.jurQualidade(acord).motivos[0].k === "nunca", "C5 nunca conferido: a conferir");
    a.jurGravar({ id: acord.id, deMemoria: true });
    ok(a.jurQualidade(a.jurDe(acord.id)).motivos.some((m) => m.k === "memoria"), "C5a de memória entra no porquê");
    a.jurGravar({ id: acord.id, deMemoria: false, conferidoEm: "2026-09-01" });
    ok(n(acord) === "conferido", "C5b verificado há pouco (JM4): conferido");
    ok(n(acord, "2027-06-01") === "vencido", "C5c há mais de 180 dias: vencido");
    a.jurSeloConceder(acord.id, "pessoa", "fonte", "2026-10-20");
    ok(a.jurSeloValido(a.jurDe(acord.id)) && n(acord) === "conferido" && a.jurQualidade(a.jurDe(acord.id)).motivos[0].k === "selo", "C5d ✓ conferi: selo da pessoa");
    a.jurGravar({ id: acord.id, tese: "É constitucional a incidência do ISS no licenciamento de software (texto editado)." });
    const qe = a.jurQualidade(a.jurDe(acord.id), { hoje: "2026-10-21" });
    ok(!a.jurSeloValido(a.jurDe(acord.id)) && qe.nivel !== "oficial" && qe.motivos.some((m) => m.k === "editada"), "C5e editar a tese tira o selo (e diz por quê): " + qe.nivel);
    a.jurGravar({ id: acord.id, tese: "É constitucional a incidência do ISS no licenciamento de software.", situacao: "superada" });
    ok(n(acord) === "problema", "C5f fora de vigor: problema");
    const s160 = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "160", tese: "É defeso ao Poder Executivo atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária." });
    const q160 = a.jurQualidade(s160);
    ok(q160.nivel === "problema" && q160.motivos.some((m) => m.k === "difere"), "C5g difere do oficial: problema");
    a.jurSeloConceder(s160.id, "pessoa", "conferi", "2026-10-21");
    ok(a.jurQualidade(a.jurDe(s160.id)).nivel === "conferido", "C5h a pessoa conferiu e manteve a sua redação: a diferença não vira problema");
    const s436 = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: CAT.itens["STJ|sumula|436"].tese });
    a.jurSeloConceder(s436.id, "oficial", "catálogo", "2026-10-21");
    ok(a.jurQualidade(a.jurDe(s436.id), { hoje: "2026-10-21" }).nivel === "oficial", "C5i selo oficial");
    const s212 = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "212", tese: CAT.itens["STJ|sumula|212"].tese });
    ok(a.jurQualidade(s212).motivos.some((m) => m.k === "oficial_fora"), "C5j o catálogo diz cancelada e o julgado não: problema");
    ok(a.jurLinkOficial(a.jurDe(s436.id)).url.indexOf("toc.jsp") > 0 && a.jurLinkOficial({ tribunal: "STF", classe: "Súmula Vinculante", numero: "8" }).url.indexOf("sumula=1212") > 0,
      "C5k o link oficial: o STF pelo código interno (sumula=1212, não =8)");
    ok(a.jurLinkOficial({ tribunal: "STJ", classe: "Súmula", numero: "999" }).url.indexOf(encodeURIComponent("@num='999'")) > 0, "C5l fora do catálogo, o STJ abre a súmula pelo número exato");
    ok(a.jurCatUrl({ tribunal: "STF", classe: "Súmula", numero: "6", stfId: "2048" }).indexOf("base=30&sumula=2048") > 0
      && a.jurCatUrl({ tribunal: "STF", classe: "Tema", numero: "69", incidente: "2585258", paradigmas: ["RE 574706"] }).indexOf("incidente=2585258&numeroProcesso=574706&classeProcesso=RE&numeroTema=69") > 0
      && a.jurCatUrl({ tribunal: "STJ", classe: "Tema", numero: "962" }).indexOf("cod_tema_inicial=962&cod_tema_final=962") > 0, "C5m a URL é montada do código do STF, do incidente do tema ou do número do STJ");
  }

  /* ---- 5 e 6: o motor da auditoria ---- */
  {
    const { api: a } = rodar();
    a.jurCatDefinir(CAT);
    const g = (o) => a.jurGravar(o);
    const igual = g({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: CAT.itens["STJ|sumula|436"].tese.toUpperCase() });
    const forma = g({ tribunal: "STF", classe: "Súmula Vinculante", numero: "8", tese: "São inconstitucionais o parágrafo único do artigo 5º do Decreto-Lei nº 1.569/1977 e os artigos 45 e 46 da Lei nº 8.212/1991, que tratam de prescrição e decadência de crédito tributário." });
    const difere = g({ tribunal: "STJ", classe: "Súmula", numero: "160", tese: "É defeso ao Poder Executivo atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária.", deMemoria: true, aConferir: ["data"] });
    const trocado = g({ tribunal: "STF", classe: "Súmula", numero: "436", tese: CAT.itens["STJ|sumula|436"].tese });
    const trocadoErrado = g({ tribunal: "STF", classe: "Súmula", numero: "160", tese: "é proibido ao Município atualizar o IPTU por decreto acima da correção." });
    const cancel = g({ tribunal: "STJ", classe: "Súmula", numero: "212", tese: CAT.itens["STJ|sumula|212"].tese });
    /* STF Súmula 212 não está no catálogo; a STJ 212 está, com outro texto: o número sozinho não autoriza trocar */
    const soNumero = g({ tribunal: "STF", classe: "Súmula", numero: "212", tese: "É legítima a cobrança da taxa de lixo." });
    const jaCancel = g({ tribunal: "STF", classe: "Tema", numero: "432", tese: CAT.itens["STF|tema|432"].tese, situacao: "cancelada" });
    const comp = g({ tribunal: "STF", classe: "Tema", numero: "863 / 827", tese: "multa" });
    const isolado = g({ tribunal: "STF", classe: "ADI", numero: "1945", tese: "x" });
    const pelo = g({ tribunal: "STJ", classe: "REsp", numero: "1.377.019", tese: CAT.itens["STJ|tema|962"].tese });
    const aud = a.jurCatAuditar([igual, forma, difere, trocado, trocadoErrado, cancel, soNumero, jaCancel, comp, isolado, pelo].map((x) => a.jurDe(x.id)));
    const L = (j) => aud.linhas.find((x) => x.id === j.id);
    ok(L(igual).estado === "confere" && L(igual).sugestao === "selo", "C6 igual: confere, sugere o selo (sem trocar o texto)");
    ok(L(forma).estado === "confere" && L(forma).cmp === "forma" && L(forma).sugestao === "selo", "C6a só a forma: confere, selo, NÃO troca o texto");
    ok(L(difere).estado === "difere" && L(difere).sugestao === "", "C6b diferente: nenhuma sugestão (a pessoa decide)");
    ok(L(difere).meta.orgao === "Primeira Seção" && L(difere).meta.data === "1996-06-12", "C6c os campos vazios que a página oficial tem");
    ok(L(trocado).trocarTribunal === "STJ" && L(trocado).estado === "confere", "C6d súmula com o tribunal trocado e o TEXTO do outro: sugere corrigir o tribunal");
    ok(L(trocadoErrado).estado === "difere" && !L(trocadoErrado).trocarTribunal, "C6e mesmo número no outro tribunal mas texto diferente: não troca (STF 160 existe e é outra)");
    ok(L(cancel).situacao === "cancelada", "C6f o catálogo diz cancelada: sugere marcar");
    ok(!L(jaCancel).situacao && L(jaCancel).avisos.some((x) => /fica/.test(x)), "C6g a pessoa marcou cancelada e o catálogo diz vigente: NÃO rebaixa, avisa");
    ok(L(soNumero).estado === "fora" && !L(soNumero).trocarTribunal, "C6e1 só o número igual (texto diferente): não vira a súmula do outro tribunal");
    ok(L(comp).estado === "composto" && L(isolado).estado === "fora", "C6h dois temas numa ficha e acórdão isolado ficam de fora");
    ok(L(pelo).estado === "confere" && L(pelo).via === "paradigma", "C6i guardado pelo REsp: comparado com o Tema 962 que ele fixou");
    /* (v18.95.0) súmula do STJ gravada como STF, onde o STF TEM uma súmula com esse número (de outro assunto) */
    const errTri = a.jurGravar({ tribunal: "STF", classe: "Súmula", numero: "160", tese: "É defeso ao município atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária." });
    const assunto = a.jurGravar({ tribunal: "STF", classe: "Tema", numero: "432", tese: "Incide ISS sobre industrialização por encomenda de embalagens personalizadas." });
    const aud2 = a.jurCatAuditar([a.jurDe(errTri.id), a.jurDe(assunto.id), a.jurDe(difere.id)]);
    const L2 = (j) => aud2.linhas.find((x) => x.id === j.id);
    ok(L2(errTri).estado === "difere" && L2(errTri).outroTribunal && L2(errTri).outroTribunal.tribunal === "STJ" && !L2(errTri).outroAssunto,
      "C6k o texto é o da súmula do OUTRO tribunal (o STF 160 existe e é outra): oferece corrigir o tribunal");
    ok(L2(assunto).outroAssunto && L2(assunto).avisos[0] === a.t("jur_aud_av_outro_assunto", { o: "STF Tema 432" }), "C6l quase nada em comum: avisa (em 1º) que pode ser outro assunto");
    ok(!L2(difere).outroAssunto, "C6m a súmula 160 com 'Poder Executivo' tem muito em comum: sem esse aviso");
    ok(a.jurCatSemelhanca("a b", "") === 0 && a.jurCatSemelhanca("município atualizar IPTU", "município atualizar IPTU") === 1, "C6n semelhança 0..1");
    const r2 = a.jurCatAplicar(aud2, { [errTri.id]: "tribunal", [assunto.id]: "manter" }, { hoje: "2026-10-21" });
    const E = a.jurDe(errTri.id);
    ok(E.tribunal === "STJ" && a.jurSeloValido(E) && E.selo.tipo === "oficial" && E.orgao === "Primeira Seção" && r2.feitos.tribunal === 1, "C6o 'corrigir o tribunal': vira STJ, e como o texto é o da STJ 160, ganha o selo e os campos dela");
    ok(a.jurDe(assunto.id).tese === assunto.tese, "C6p 'manter' no outro assunto não troca o texto");
    a.jurCatDesfazer();
    ok(a.jurDe(errTri.id).tribunal === "STF" && !a.jurSeloValido(a.jurDe(errTri.id)), "C6q desfazer volta o tribunal");
    ok(aud.confere === 6 && aud.difere === 2, "C6j as contas: " + JSON.stringify({ c: aud.confere, d: aud.difere }));
    /* aplicar */
    const dec = {}; dec[igual.id] = "selo"; dec[forma.id] = "selo"; dec[difere.id] = "oficial"; dec[trocado.id] = "selo"; dec[cancel.id] = "manter";
    const antes = JSON.stringify(a.jurLerTudo());
    const r = a.jurCatAplicar(aud, dec, { hoje: "2026-10-21" });
    const I = a.jurDe(igual.id), F = a.jurDe(forma.id), D = a.jurDe(difere.id), T = a.jurDe(trocado.id), C = a.jurDe(cancel.id);
    ok(I.tese === igual.tese && a.jurSeloValido(I) && I.selo.tipo === "oficial", "C7 'selo': ganha o selo oficial e o texto fica");
    ok(F.tese === forma.tese && a.jurQualidade(F, { hoje: "2026-10-21" }).nivel === "oficial", "C7a só forma: o texto da pessoa fica, com o selo oficial");
    ok(D.tese === CAT.itens["STJ|sumula|160"].tese && D.teseAnterior === difere.tese && !D.deMemoria && !(D.aConferir || []).length && D.orgao === "Primeira Seção", "C7b 'oficial': troca a tese, guarda a anterior, limpa 'de memória' e completa os campos");
    ok(T.tribunal === "STJ", "C7c tribunal corrigido");
    ok(C.situacao === "cancelada" && !a.jurSeloValido(C) && C.tese === cancel.tese, "C7d 'manter': marca a situação do catálogo, sem selo e sem mexer no texto");
    ok(!a.jurDe(trocadoErrado.id).selo && a.jurDe(jaCancel.id).situacao === "cancelada" && a.jurDe(isolado.id).tese === "x", "C7e o que não foi decidido não muda");
    ok(r.feitos.selo === 3 && r.feitos.oficial === 1 && r.feitos.manter === 1 && a.jurCatReciboLer().itens.length === 5, "C7f contas e recibo guardado: " + JSON.stringify(r.feitos));
    ok(a.jurCatDesfazer() === 5 && JSON.stringify(Object.values(a.jurLerTudo()).map((j) => [j.id, j.tese, j.tribunal, j.situacao || "", !!a.jurSeloValido(j), j.orgao || "", !!j.deMemoria]))
      === JSON.stringify(Object.values(JSON.parse(antes)).map((j) => [j.id, j.tese, j.tribunal, j.situacao || "", false, j.orgao || "", !!j.deMemoria])), "C7g desfazer volta tudo como era");
    ok(!a.jurCatReciboLer(), "C7h e o recibo some");
  }

  /* ---- 7: a tela da auditoria ---- */
  {
    const { api: a } = rodar();
    a.jurCatDefinir(CAT);
    const s160 = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "160", tese: "É defeso ao Poder Executivo atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária." });
    const s436 = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: CAT.itens["STJ|sumula|436"].tese });
    await a.jurAudAbrir([s160.id, s436.id]);
    ok(a.$("dlgJurAud").open && a.jurAudAtual().passo === 3 && a.$("jurAudProg").value === 100, "C8 abre, carrega, compara e para no passo 3 (revisar), barra cheia: " + a.jurAudAtual().passo);
    ok(a.$("jurAudEtapa").textContent === a.t("jur_aud_e_revisar", { n: 1 }), "C8a a etapa diz quantos faltam decidir: " + a.$("jurAudEtapa").textContent);
    ok(a.$("btnJurAudAplicar").textContent === a.t("jur_aud_aplicar", { n: 1 }) && !a.$("btnJurAudAplicar").disabled, "C8b o 'aplicar' conta as decisões (o igual já vem com o selo)");
    ok(a.$("jurAudItem_" + s160.id) && a.$("jurAudItem_" + s160.id).querySelectorAll("del").length >= 1, "C8c o diferente mostra o antes × depois");
    ok(a.$("jurAudEditar_" + s160.id), "C8c1 o que difere tem '✏️ Corrigir à mão'");
    a.$("jurAudOp_oficial_" + s160.id).onclick();
    ok(a.$("jurAudEtapa").textContent === a.t("jur_aud_e_revisado") && a.$("btnJurAudAplicar").textContent === a.t("jur_aud_aplicar", { n: 2 }), "C8d escolher atualiza a contagem e a etapa");
    /* recusar a confirmação não grava */
    await conduzir(a, a.jurAudAplicar(), false);
    ok(a.jurDe(s160.id).tese.indexOf("Poder Executivo") >= 0 && a.$("jurAudEtapa").textContent === a.t("jur_aud_e_cancelado"), "C8e 'cancelar' na confirmação: nada gravado, e a tela diz");
    await conduzir(a, a.jurAudAplicar(), true);
    ok(/município/.test(a.jurDe(s160.id).tese) && a.jurSeloValido(a.jurDe(s436.id)) && a.jurAudAtual().passo === 5, "C8f confirmado: grava e chega ao passo 5");
    ok(a.$("jurAudEtapa").textContent === a.t("jur_aud_e_pronto", { o: 1, s: 1, m: 0, t: 0 }) && a.$("btnJurAudDesfazer").hidden === false, "C8g diz o que fez e oferece desfazer");
    await conduzir(a, a.jurAudDesfazer(), true);
    ok(/Poder Executivo/.test(a.jurDe(s160.id).tese) && !a.jurSeloValido(a.jurDe(s436.id)), "C8h desfazer pela tela");
  }

  /* ---- 8: prévia, biblioteca e gaveta ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const e = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Direito Tributário :: 5", "+ Crédito tributário :: 5"].join(NL));
    a.hubAbrirEdital(e.id);
    a.jurCatDefinir(CAT);
    const base = { disciplina: "Direito Tributário", topico: "Crédito tributário" };
    const c = a.jurCitacoesNoTexto("Súmula 436 do STJ")[0];
    a.jurCitPreviewAbrir(c, a.jurAcharCitado(c), base);
    ok(a.$("jurCitaCorpo").textContent.indexOf(CAT.itens["STJ|sumula|436"].tese) >= 0 && a.$("btnJurCitaGuardarOficial"), "C9 a prévia do não guardado mostra o texto oficial e o botão");
    await conduzir(a, a.$("btnJurCitaGuardarOficial").onclick(), true);
    const g = a.jurLista().find((x) => x.numero === "436");
    ok(g && g.tese === CAT.itens["STJ|sumula|436"].tese && a.jurSeloValido(g) && g.selo.tipo === "oficial" && g.topicos.length === 1 && g.orgao === "Primeira Seção", "C9a guardado no tópico, com o selo oficial e os campos da página");
    ok(a.$("jurCitaCorpo").textContent.indexOf(a.t("jur_q_oficial")) >= 0, "C9b a prévia passa a mostrar o julgado guardado, com o selo");
    const cr = a.jurCitacoesNoTexto("RE 593.849")[0];
    a.jurCitPreviewAbrir(cr, a.jurAcharCitado(cr), base);
    ok(a.$("jurCitaCorpo").textContent.indexOf(a.t("jur_cit_oficial_paradigma", { c: a.$("jurCitaTit").textContent, t: "STF Tema 201" })) >= 0, "C9c citar o RE mostra a tese do tema que ele fixou, dizendo isso");
    /* biblioteca */
    a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "160", tese: "É defeso ao Poder Executivo atualizar o IPTU.", topicos: [a.matChave("Direito Tributário", "Crédito tributário")] });
    a.jurBibAbrir();
    ok(a.$("btnJurBibQ_oficial") && /· 1$/.test(a.$("btnJurBibQ_oficial").textContent) && a.$("btnJurBibQ_problema") && /· 1$/.test(a.$("btnJurBibQ_problema").textContent), "C10 a biblioteca conta por selo");
    a.$("btnJurBibQ_problema").onclick();
    ok(a.jurBibFiltrados().length === 1 && a.jurBibFiltrados()[0].numero === "160" && a.$("jurBibSit").value === "q_problema", "C10a tocar no selo filtra (e o seletor acompanha)");
    ok(/🛡/.test(a.$("btnJurBibAuditar").textContent), "C10b o botão da auditoria está na biblioteca");
    a.$("dlgJurBib").close();
    /* gaveta */
    a.jurAbrir("Direito Tributário", "Crédito tributário");
    const card = (id) => a.$("jurLista").querySelectorAll(".jur-item").find((x) => x.textContent.indexOf(id) >= 0) || a.$("jurLista");
    const chips = a.$("jurLista").querySelectorAll(".jur-q").map((x) => x.textContent);
    ok(chips.some((x) => /Oficial/.test(x)) && chips.some((x) => /Problema/.test(x)), "C11 a gaveta mostra o selo do oficial e o do problema: " + chips.join(" | "));
    const nunca = a.jurGravar({ tribunal: "STF", classe: "ADI", numero: "1945", tese: "y", topicos: [a.matChave("Direito Tributário", "Crédito tributário")] });
    a.jurPintarLista();
    const qs = a.$("jurLista").querySelectorAll(".jur-q").map((x) => x.textContent);
    ok(qs.length === 2, "C11a o nunca conferido não ganha selo na gaveta (ausência de selo = não conferido): " + qs.join(" | "));
    const menu = a.$("jurLista").querySelectorAll(".jur-mais-item").filter((b) => b.textContent.indexOf(a.t("jur_q_menu")) >= 0);
    ok(menu.length === 3, "C11b todo julgado tem 'Qualidade · conferir na fonte' no ⋯");
    const bConf = a.$("btnJurQConferi_" + nunca.id);
    ok(bConf, "C11c o painel do nunca conferido tem '✓ Conferi na fonte'");
    await conduzir(a, bConf.onclick({ stopPropagation() {} }), false);
    ok(!a.jurSeloValido(a.jurDe(nunca.id)), "C11c1 dizer 'não' na confirmação não dá o selo");
    await conduzir(a, bConf.onclick({ stopPropagation() {} }), true);
    ok(a.jurSeloValido(a.jurDe(nunca.id)) && a.jurDe(nunca.id).selo.tipo === "pessoa", "C11d conferi: selo da pessoa");
    a.$("btnJurQEditar_" + nunca.id).onclick({ stopPropagation() {} });
    ok(a.$("jurTese").value === "y", "C11e o painel tem '✏️ Editar', que abre o julgado no formulário");
  }
  return falhas;
}

module.exports = { testes };
