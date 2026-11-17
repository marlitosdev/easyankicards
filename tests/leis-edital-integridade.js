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
  {
    const { api } = rodar();
    ["led_orig_edital", "led_orig_discursiva", "led_orig_ia", "led_orig_sigla", "led_tag_novo", "led_lac_criterio", "led_dif_tit", "led_dif_saiu_incluida", "led_dif_saiu_coberta",
      "led_dif_saiu_dispensada", "led_dif_saiu_nao_citada", "led_cob_tit", "led_cob_expl", "led_cob_dentro", "led_orig_nome", "led_cit_tit", "led_cit_expl", "led_cit_st_biblioteca", "led_cit_st_falta", "led_cit_st_coberta", "led_cit_st_dispensada", "led_cit_em"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I6 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
