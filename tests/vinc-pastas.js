/* =====================================================================
 * ACHAR A LEI NA JANELA "VINCULAR ESTE TRECHO" — E INCLUIR A QUE FALTA (19.49.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Acima do select de leis, a fileira de pastas da Biblioteca (📁 livres, com quantas leis); escolher uma pasta
 *     deixa no select só as leis dela (as do tópico continuam primeiro, com ★);
 *  2. a busca filtra por nome, apelido, número e ano; com uma lei só no filtro, ela já vem escolhida;
 *  3. a lei já escolhida nunca some do select por causa do filtro;
 *  4. "＋ a lei não está na lista? incluir nova lei" abre o assistente; criada a lei, a janela volta com o mesmo
 *     trecho e a lei nova escolhida.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const tique = () => new Promise((r) => setImmediate(r));
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const DISC = "Direito Tributário", TOP = "Processo";
  const ch = api.matChave(DISC, TOP);
  api.matGravar(ch, "R.", { disciplina: DISC, topico: TOP, concurso: "ISS" });
  api.leiGuardar({ id: "lei_cf", nome: "Constituição Federal", texto: "Art. 1º Um." });
  api.leiLigar("lei_cf", ch);
  api.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", numero: "5.172", ano: "1966", texto: "Art. 1º Um." });
  api.leiGuardar({ id: "lei_lc105", nome: "LC 105/2001 Lei de Sigilo Bancário", numero: "105", ano: "2001", texto: "Art. 1º Um." });
  api.leiGuardar({ id: "lei_8137", nome: "Lei 8.137/1990", numero: "8.137", ano: "1990", texto: "Art. 1º Um." });
  const fiscal = api.pasCriar("Área fiscal");
  api.pasAlternar(fiscal.id, "lei", "lei_ctn", true);
  api.pasAlternar(fiscal.id, "lei", "lei_8137", true);

  api.qsVincEscolherPara({ disciplina: DISC, topico: TOP, comentario: "x" }, { trecho: "Lei nº 9.784/1999", cit: null });
  const opcoes = () => Array.from(api.$("qsVincLei").children).filter((o) => o.value).map((o) => o.value);
  ok(api.$("dlgQsVincEsc").open && opcoes().length === 4 && opcoes()[0] === "lei_cf", "V1 sem filtro, todas as leis (a do topico primeiro): " + opcoes().join(","));

  /* ---- 1: pasta ---- */
  const fichas = Array.from(api.$("qsVincPastas").children);
  const fFiscal = fichas.find((b) => /Área fiscal · 2/.test(b.textContent));
  ok(api.$("qsVincPastas").hidden === false && !!fFiscal, "V2 a fileira de pastas aparece, com a contagem: " + fichas.map((b) => b.textContent).join(" | "));
  fFiscal.onclick();
  ok(opcoes().join(",") === "lei_ctn,lei_8137" && /2 de 4/.test(api.$("qsVincLei").children[0].textContent), "V3 a pasta deixa so as leis dela: " + opcoes().join(","));

  /* ---- 2: busca ---- */
  Array.from(api.$("qsVincPastas").children)[0].onclick();   /* "todas" */
  api.$("qsVincLeiBusca").value = "ctn"; api.$("qsVincLeiBusca").oninput();
  ok(opcoes().join(",") === "lei_ctn" && api.$("qsVincLei").value === "lei_ctn", "V4 a busca pelo apelido acha e, sendo uma so, ja escolhe: " + opcoes().join(","));

  /* ---- 3: a escolhida (pela pessoa) não some ---- */
  api.$("qsVincLei").onchange();
  api.$("qsVincLeiBusca").value = "sigilo"; api.$("qsVincLeiBusca").oninput();
  ok(opcoes().indexOf("lei_ctn") >= 0 && opcoes().indexOf("lei_lc105") >= 0 && api.$("qsVincLei").value === "lei_ctn", "V5 a lei ja escolhida continua no select mesmo fora do filtro");
  api.$("qsVincLeiBusca").value = "1990"; api.$("qsVincLeiBusca").oninput();
  ok(opcoes().indexOf("lei_8137") >= 0, "V6 a busca acha pelo ano");

  /* ---- 4: incluir a lei que falta ---- */
  api.$("btnQsVincNovaLei").onclick();
  ok(api.$("dlgLeiNova").open && !api.$("dlgQsVincEsc").open, "V7 'incluir nova lei' abre o assistente");
  api.leiNovaDefinirPrincipal("LEI Nº 9.784, DE 29 DE JANEIRO DE 1999\nRegula o processo administrativo.\nArt. 1º Esta Lei estabelece normas.\nArt. 2º A Administração obedecerá aos princípios.", "", "colado", 0);
  api.leiNovaIr(2);
  api.$("leiNovaNome").value = "Lei 9.784/1999 - Processo Administrativo"; api.$("leiNovaNome").oninput();
  api.leiNovaIr(4);
  api.$("btnLeiNovaCriar").onclick();
  for (let i = 0; i < 6; i++) await tique();
  const nova = api.leisLista().find((l) => /Processo Administrativo/.test(l.nome));
  ok(!!nova, "V8 a lei nasce com o nome escolhido");
  ok(api.$("dlgQsVincEsc").open && nova && api.$("qsVincLei").value === nova.id && /9\.784\/1999/.test(api.$("qsVincEscTrecho").textContent),
    "V9 criada a lei, a janela de vinculo volta com o mesmo trecho e a lei nova escolhida: " + api.$("qsVincLei").value);

  /* ---- 5 (19.50.0): ligar de novo um trecho DESLIGADO neste tópico, valendo em todo o app ---- */
  {
    const T = "Lei nº 9.784/1999 desligada";
    api.citVinculoSalvar({ trecho: T, nenhum: true, chave: ch });
    api.qsVincEscolherPara({ disciplina: DISC, topico: TOP, comentario: "x" }, { trecho: T, cit: null });
    api.$("qsVincLei").value = "lei_ctn"; api.$("qsVincLei").onchange();
    api.$("qsVincAlcTudo").checked = true; api.$("qsVincAlcTopico").checked = false;
    api.qsVincSalvar();
    const vs = api.citVinculosLer().filter((v) => v.trecho === T);
    ok(vs.length === 1 && !vs[0].nenhum && !vs[0].chave && vs[0].leiId === "lei_ctn", "D1 ligar de novo (em todo o app) tira o 'desligado' do topico: " + JSON.stringify(vs));
    const cs = api.citVinculosAplicar("Ver a " + T + " hoje.", [], ch);
    ok(cs.length === 1 && cs[0].permanente && cs[0].leiId === "lei_ctn", "D2 no topico, o trecho agora vira link");
    ok(api.t("cit_vinc_invisivel_outro") !== "cit_vinc_invisivel_outro", "D3 o aviso sem 'parágrafos' existe");
  }

  ["qs_vinc_escolha_n", "qs_vinc_lei_busca_ph", "qs_vinc_nova_lei", "qs_vinc_nova_lei_tip", "lei_nova_pnome", "lei_nova_snome_aj", "lei_nova_nome_rot", "lei_nova_nome_sug", "lei_nova_apelido_rot", "lei_nova_apelido_ph", "lei_nova_falta_nome"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");

  /* ---- (19.72.0) D: o "desligado" de um pedaço não apaga o vínculo maior feito à mão ---- */
  {
    api.citVinculosGravar([]);
    const ch = "noções de direito administrativo›atos administrativos";
    const tx = "Exceção: competência exclusiva, por imposição do art. 13 da Lei nº 9.784/1999. E a Lei nº 9.784/1999 sozinha.";
    api.citVinculoSalvar({ trecho: "Lei nº 9.784/1999", nenhum: true, chave: ch });
    api.citVinculoSalvar({ trecho: "art. 13 da Lei nº 9.784/1999", leiId: "L9784", artigos: [{ num: "13", numCru: "13" }] });
    const out = api.citVinculosAplicar(tx, [], ch);
    const longo = out.find((c) => c.permanente && /art\. 13 da Lei/.test(c.texto));
    ok(!!longo && longo.leiId === "L9784", "D1 o vínculo maior (todo o app) aparece mesmo com o desligado do pedaço no tópico: " + JSON.stringify(out.map((c) => c.texto)));
    ok(!out.some((c) => c.texto === "Lei nº 9.784/1999"), "D2 a 'Lei nº 9.784/1999' sozinha continua desligada (texto)");
    /* desligado do trecho INTEIRO continua vencendo */
    api.citVinculoSalvar({ trecho: "art. 13 da Lei nº 9.784/1999", nenhum: true, chave: ch });
    ok(!api.citVinculosAplicar(tx, [], ch).some((c) => /art\. 13/.test(c.texto)), "D3 desligar o mesmo trecho no tópico continua tirando o link");
    api.citVinculosGravar([]);
  }
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
