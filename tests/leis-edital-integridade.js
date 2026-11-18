/* =====================================================================
 * LEIS DO EDITAL — A INTEGRIDADE DE "FALTAM NA BIBLIOTECA" (19.164.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  I1. o catálogo: sigla e nome popular viram a lei (espécie e número); o nome mais longo ganha do mais curto;
 *  I2. "LGPD" num tópico vira lacuna "Lei 13.709/2018 (LGPD)", com origem edital + sigla; "LEF" casa com a Lei 6.830
 *      da biblioteca (e ela passa a ser lei do tópico);
 *  I3. a EC que alterou a Constituição da biblioteca (nota "(Incluído pela Emenda Constitucional nº 131, de 2023)") sai
 *      de "faltam" e vai para "já dentro de leis que você tem";
 *  I4. o que mudou desde a última vez: ao reabrir, o que entrou (com a origem e a marca "novo") e o que saiu (com o
 *      motivo: incluída, dispensada, coberta, não mais citada); na primeira vez, nada; repintar não recalcula;
 *  I5. a tela diz o critério.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const arts = (k) => Array.from({ length: k }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".").join(NL);

  /* I1 */
  {
    const { api } = rodar();
    ok(api.ledCanon("LGPD") === "Lei 13.709/2018" && api.ledCanon("Estatuto da Cidade") === "Lei 10.257/2001" && api.ledCanon("a Lei de Improbidade") === "Lei 8.429/1992" && api.ledCanon("ISS") === "", "I1a sigla e nome popular viram a lei");
    const C = api.ledCatalogoNoTexto("Noções de LGPD, do Estatuto da Cidade e da Nova Lei de Licitações. CLTs não.");
    ok(C.map((x) => x.canon).sort().join() === ["Lei 10.257/2001", "Lei 13.709/2018", "Lei 14.133/2021"].sort().join() && C.filter((x) => x.canon === "Lei 14.133/2021").length === 1,
      "I1b as menções do texto (o nome mais longo ganha; 'CLTs' não é CLT): " + JSON.stringify(C));
  }

  /* I2 + I3 + I4 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    api.ledIniciar();
    const e = api.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20",
      "@ Informática :: 2", "+ Segurança da informação :: 3 :: LGPD",
      "@ Sistema Tributário :: 5", "+ Dívida ativa :: 3 :: LEF", "+ Imunidades :: 4 :: CF e EC 131/2023, art. 2º", "+ Concessões :: 2 :: Lei 8.987/95"].join(NL));
    const lef = api.leiGuardar({ nome: "Lei 6.830/1980 - Cobrança Judicial da Dívida Ativa", texto: arts(8), topicos: [] });
    const cf = api.leiGuardar({ nome: "Constituição Federal", apelido: "CF", texto: arts(3) + NL + "Art. 4º Texto novo. (Incluído pela Emenda Constitucional nº 131, de 2023)", topicos: [] });
    let M = api.ledModelo(e.id);
    const g = M.lacunas.filter((G) => G.chave === "lei:13709")[0];
    ok(g && g.rotulo === "Lei 13.709/2018 (LGPD)" && api.ledOrigens(g).join() === "edital,sigla", "I2a 'LGPD' vira lacuna com o número e a origem: " + JSON.stringify(g && { r: g.rotulo, o: api.ledOrigens(g) }));
    ok(M.leis[lef.id] && M.leis[lef.id].topicos.some((T) => T.nome === "Dívida ativa"), "I2b 'LEF' casa com a Lei 6.830 da biblioteca");
    ok(!M.lacunas.some((G) => /131/.test(G.rotulo)) && M.cobertas.length === 1 && M.cobertas[0].dentroDe[0].id === cf.id, "I3a a EC 131 não falta: já está dentro da Constituição");
    ok(M.lacunas.map((G) => G.chave).sort().join() === "lei:13709,lei:8987", "I3b faltam só as que faltam de verdade: " + M.lacunas.map((G) => G.chave).join());
    /* primeira abertura: nada a comparar */
    api.ledAbrir(e.id);
    ok(!api.$("ledCorpo").querySelectorAll("div").some((x) => x.id === "ledDif") && /Já dentro de leis que você tem · 1/.test(api.$("ledCorpo").textContent) && /Critério:/.test(api.$("ledLac").textContent),
      "I3c/I5 primeira vez: sem 'o que mudou'; a seção das cobertas e o critério aparecem");
    ok(/sigla ou nome popular/.test(api.$("ledLac_lei_13709").textContent), "I2c a linha diz a origem");
    /* muda: a LGPD entra na biblioteca, a 8.987 é dispensada, e uma discursiva passa a citar a Lei 8.429/1992 */
    api.leiGuardar({ nome: "Lei 13.709/2018 - LGPD", texto: arts(5), topicos: [] });
    api.ledDispensar(e.id, "lei:8987", true);
    api.dsPropostaAdicionar(e.id, { tema: "Improbidade", disc: "Sistema Tributário", enunciado: "Disserte.", espelho: "Citar o art. 9º da Lei 8.429/1992 (10 pts)", fonte: "ia" });
    api.ledAbrir(e.id);
    const dif = api.$("ledCorpo").querySelectorAll("div").filter((x) => x.id === "ledDif")[0];
    ok(dif && /＋ Lei 8\.429\/1992 — discursiva/.test(dif.textContent), "I4a o que entrou, com a origem: " + (dif && dif.textContent));
    ok(dif && /− Lei 13\.709\/2018 \(LGPD\) — saiu: está na biblioteca agora/.test(dif.textContent) && /− Lei 8\.987\/95 — saiu: você dispensou/.test(dif.textContent), "I4b o que saiu, com o motivo");
    ok(/novo/.test(api.$("ledLac_lei_8429").textContent), "I4c a lacuna nova tem a marca 'novo'");
    api.ledPintar();
    ok(api.$("ledCorpo").querySelectorAll("div").some((x) => x.id === "ledDif"), "I4d repintar mantém o 'o que mudou' (só ao reabrir ele é refeito)");
    api.ledAbrir(e.id);
    ok(!api.$("ledCorpo").querySelectorAll("div").some((x) => x.id === "ledDif"), "I4e reabrir sem mudança: nada a mostrar");
    void M;
  }
  /* I7: a lei citada PELO NOME (sem número) e a lista "leis citadas no edital" */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    api.ledIniciar();
    const N = api.ledNomesNoTexto("Código Tributário Municipal e Lei Orgânica do Município de Caruaru; lei municipal; Constituição do crédito; a Lei de Responsabilidade Fiscal; Lei de");
    ok(N.join("|") === "Código Tributário Municipal|Lei Orgânica do Município de Caruaru|Lei de Responsabilidade Fiscal", "I7a os nomes de lei no texto (e o que não é nome fica de fora): " + JSON.stringify(N));
    const e = api.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20",
      "@ Legislação Municipal :: 4", "+ Tributos municipais :: 4 :: Código Tributário Municipal", "+ Organização :: 2 :: Lei Orgânica do Município",
      "@ Informática :: 2", "+ Segurança :: 3 :: LGPD",
      "@ Sistema Tributário :: 5", "+ Dívida ativa :: 3 :: LEF e Lei 6.830/80", "+ Concessões :: 2 :: Lei 8.987/95"].join(NL));
    const ctm = api.leiGuardar({ nome: "LC 015/2009 - Código Tributário Municipal de Caruaru", texto: arts(6), topicos: [] });
    const lef = api.leiGuardar({ nome: "Lei 6.830/1980 - Cobrança Judicial da Dívida Ativa", texto: arts(8), topicos: [] });
    const M = api.ledModelo(e.id);
    ok(M.leis[ctm.id] && M.leis[ctm.id].topicos.some((T) => T.nome === "Tributos municipais"), "I7b 'Código Tributário Municipal' casa pelo nome com a lei da biblioteca");
    const lo = M.lacunas.filter((G) => /^nome:/.test(G.chave))[0];
    ok(lo && lo.rotulo === "Lei Orgânica do Município" && api.ledOrigens(lo).join() === "edital,nome", "I7c a lei sem número e fora da biblioteca vira lacuna 'citada pelo nome': " + JSON.stringify(lo && { r: lo.rotulo, k: lo.chave, o: api.ledOrigens(lo) }));
    const C = api.ledCitadasSituacao(M);
    const st = {};
    C.forEach((x) => { st[x.rotulo] = x.st; });
    ok(C.length === 5 && st[ctm.nome] === "biblioteca" && st[lef.nome] === "biblioteca" && st["Lei Orgânica do Município"] === "falta" && st["Lei 13.709/2018 (LGPD)"] === "falta" && st["Lei 8.987/95"] === "falta",
      "I7d a lista de leis citadas no edital, com a situação de cada uma: " + JSON.stringify(st));
    ok(C[0].st === "falta" && C[C.length - 1].st === "biblioteca", "I7e as que faltam vêm primeiro");
    api.ledAbrir(e.id);
    const cit = api.$("ledCit");
    ok(cit && cit.open !== true && /Leis citadas no edital · 5 \(2 na biblioteca · 3 falta\(m\)\)/.test(cit.textContent) && /citada pelo nome/.test(cit.textContent), "I7f a tela mostra a lista, recolhida, com a contagem: " + (cit && cit.textContent.slice(0, 120)));
  }
  /* I8: o artigo citado que não está na lei (item 5) e as leis citadas só no material (item 4) */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    api.ledIniciar();
    const e = api.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20",
      "@ Sistema Tributário :: 5", "+ Fiscalização :: 3 :: art. 3º e art. 195 do CTN", "+ Sigilo :: 3"].join(NL));
    const ctn = api.leiGuardar({ nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: arts(12), topicos: [] });
    api.dsPropostaAdicionar(e.id, { tema: "Fiscalização", disc: "Sistema Tributário", enunciado: "Disserte.", espelho: "Citar o art. 300 do CTN (10 pts)", fonte: "ia" });
    const M = api.ledModelo(e.id);
    const af = (M.artsFalta || []).filter((x) => x.leiId === ctn.id)[0];
    ok(af && af.nums.map((y) => y.num).sort().join() === "195,300" && af.nums.filter((y) => y.num === "195")[0].onde[0].fonte === "edital" && af.nums.filter((y) => y.num === "300")[0].onde[0].fonte === "discursiva",
      "I8a os artigos citados que não estão no CTN guardado (195 do edital, 300 da discursiva); o 3º está e não entra: " + JSON.stringify(af && af.nums));
    /* o material dos tópicos: resumo, cartões e comentário de questão */
    const chS = api.matChave("Sistema Tributário", "Sigilo");
    api.matGravar(chS, "Resumo: o sigilo bancário está na LC 105/2001; ver também a LGPD.", { disciplina: "Sistema Tributário", topico: "Sigilo" });
    api.qsTodas().push({ id: "q_teste", chave: chS, enunciado: "Questão.", comentario: "Fundamento: Lei 9.784/99 e LC 105/2001." });
    const O = api.ledOutrasFontes(e.id, M);
    const lc105 = O.filter((G) => G.chave === "lc:105")[0], l9784 = O.filter((G) => G.chave === "lei:9784")[0], lgpd = O.filter((G) => G.chave === "lei:13709")[0];
    ok(lc105 && lc105.fontes.resumo === 1 && lc105.fontes.questao === 1 && l9784 && l9784.fontes.questao === 1 && lgpd && lgpd.fontes.resumo === 1 && lc105.topicos[0].nome === "Sigilo",
      "I8b as leis citadas só no material, com a fonte e o tópico: " + JSON.stringify(O.map((G) => [G.chave, G.fontes])));
    ok(!O.some((G) => G.chave === "lei:5172") && !M.lacunas.some((G) => G.chave === "lc:105"), "I8c lei da biblioteca não entra; e as do material não vão para 'faltam'");
    /* as correções vistas com o backup real: "Lcp" e o zero à esquerda, a EC que já está dentro da CF, nomes repetidos e "Lei de Direito Material" */
    ok(api.leiChaveDeEspecieNumero("Lcp nº 118, de 2005") === api.leiChaveDeEspecieNumero("LC 118/2005") && api.leiChaveDeEspecieNumero("LC 015/2009") === api.leiChaveDeEspecieNumero("LC nº 15/2009"),
      "I8f 'Lcp' é Lei Complementar e o zero à esquerda não conta");
    const ctmT = api.leiGuardar({ nome: "LC 015/2009 - Código Tributário Municipal de Caruaru", numero: "015", especie: "Lei Complementar", ano: "2009", texto: arts(3), topicos: [] });
    ok((api.leiCasarRotulo("LC nº 15/2009", api.leisLista()) || {}).id === ctmT.id, "I8f2 a 'LC nº 15/2009' citada casa com a 'LC 015/2009' guardada");
    ok(api.ledNomesNoTexto("a Lei de Direito Material e a Lei Orgânica Municipal").join("|") === "Lei Orgânica Municipal", "I8g 'Lei de Direito Material' não é nome de lei");
    api.leiGuardar({ nome: "Constituição Federal", apelido: "CF", texto: arts(3) + NL + "Art. 4º Texto. (Redação dada pela Emenda Constitucional nº 29, de 2000)", topicos: [] });
    const chF = api.matChave("Sistema Tributário", "Fiscalização");
    api.matGravar(chF, "Ver a EC 29/2000. A Lei Orgânica Municipal, a Lei Orgânica de Caruaru e a Lei Orgânica Municipal de Caruaru tratam disso.", { disciplina: "Sistema Tributário", topico: "Fiscalização" });
    const O2 = api.ledOutrasFontes(e.id, api.ledModelo(e.id));
    const orgs = O2.filter((G) => /org[aâ]nica/i.test(G.rotulo));
    ok(!O2.some((G) => /29/.test(G.rotulo)) && orgs.length === 1 && orgs[0].rotulo === "Lei Orgânica Municipal de Caruaru" && orgs[0].fontes.resumo === 3,
      "I8h a EC que já está na CF não entra, e o mesmo nome escrito de três jeitos vira um: " + JSON.stringify(O2.map((G) => [G.rotulo, G.fontes])));
    api.ledAbrir(e.id);
    ok(api.$("ledArtFalta") && /Artigos citados que não estão no texto da lei · 2/.test(api.$("ledArtFalta").textContent) && /abrir a lei/.test(api.$("ledArtFalta").textContent), "I8d a tela avisa os artigos que faltam, com 'abrir a lei'");
    ok(api.$("ledOutras") && /Citadas só no seu material · 4/.test(api.$("ledOutras").textContent) && /questões \(1\)/.test(api.$("ledOutras").textContent) && api.$("btnLedOutrasInc_lc_105"), "I8e e a seção das citadas só no material, com '＋ incluir'");
  }
  {
    const { api } = rodar();
    ["led_orig_edital", "led_orig_discursiva", "led_orig_ia", "led_orig_sigla", "led_tag_novo", "led_lac_criterio", "led_dif_tit", "led_dif_saiu_incluida", "led_dif_saiu_coberta",
      "led_dif_saiu_dispensada", "led_dif_saiu_nao_citada", "led_cob_tit", "led_cob_expl", "led_cob_dentro", "led_orig_nome", "led_cit_tit", "led_cit_expl", "led_cit_st_biblioteca", "led_cit_st_falta", "led_cit_st_coberta", "led_cit_st_dispensada", "led_cit_em", "led_outras_tit", "led_outras_expl", "led_outras_f_resumo", "led_outras_f_cartao", "led_outras_f_questao", "led_artfalta_tit", "led_artfalta_expl", "led_artfalta_arts", "led_artfalta_abrir"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I6 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
