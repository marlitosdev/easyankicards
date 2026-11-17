/* =====================================================================
 * CORRIGIR A LEITURA DE UM ARTIGO DEPOIS QUE A LEI EXISTE (19.163.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  L1. "✎" no artigo abre a janela como CORREÇÃO DE LEITURA; gravar troca o texto onde o artigo mora (aqui, a base),
 *      sem criar alteração da lei (sem selo, sem norma), e guarda na lei o que era e o que ficou;
 *  L2. o campo do texto da lei aberta acompanha (o leitor e as outras gravações não desfazem a correção); o leitor mostra
 *      "✎ corrigido";
 *  L3. a correção não renumera; "editar" (alteração da lei) continua gravando na camada, com a norma;
 *  L4. o artigo que tem redação na camada é corrigido NA CAMADA, sem perder a norma;
 *  L5. desfazer volta ao texto de antes (e recusa se o artigo mudou depois);
 *  L6. depois de uma versão nova: o mesmo texto errado de volta → reaplica; redação nova → "ficou para trás";
 *  L7. o mapa lista as correções do leitor (só o trecho que mudou, o estado e "desfazer").
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const LEI = ["Art. 1º Texto do primeiro artigo.", "", "Art. 2º Texto com erro de leitrua no meio.", "", "Art. 3º Terceiro artigo, com texto longo o bastante."].join(NL);
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const l0 = api.leiGuardar({ id: "lei_cl", nome: "Lei de Correção", texto: LEI });
  api.leiAbrir("Direito", "Testes", l0.id);
  const btsDoArt = (num) => { const b = api.$("leiLeitura").querySelectorAll("button"); return b.filter((x) => x.closest && x.closest(".lei-art") && (x.closest(".lei-art").id || "").indexOf(num) >= 0); };
  const corrBt = () => api.$("leiLeitura").querySelectorAll("button").filter((x) => x.title === api.t("lei_art_corr_bt_tip"));

  /* L1 */
  ok(corrBt().length === 3, "L1a cada artigo tem o ✎ de corrigir a leitura: " + corrBt().length);
  api.leiEdAbrir("2", "correcao");
  ok(api.$("dlgLeiArt").open && !api.$("leiArtTipoCx").hidden && api.$("leiArtTipoCorr").checked && /Corrigir a leitura do Art\. 2/.test(api.$("leiArtTitulo").textContent) && api.$("leiArtFonteCx").hidden,
    "L1b a janela abre como correção de leitura (sem o campo da norma): " + api.$("leiArtTitulo").textContent);
  api.$("leiArtTexto").value = "Art. 2º Texto com erro de leitura no meio.";
  api.leiEdSalvar(false);
  let l = api.leiDe(l0.id);
  ok(/erro de leitura no meio/.test(l.texto) && !/leitrua/.test(l.texto) && !Object.keys(l.alteracoes || {}).length, "L1c a base foi corrigida, sem alteração da lei");
  const c1 = (l.correcoes || [])[0];
  ok(c1 && c1.fase === "leitor" && c1.num === "2" && c1.onde === "base" && /leitrua/.test(c1.antes) && /leitura no meio/.test(c1.depois), "L1d a correção fica na lei com o antes e o depois: " + JSON.stringify(c1 && { f: c1.fase, n: c1.num, o: c1.onde }));
  /* L2 */
  ok(/leitura no meio/.test(api.$("leiTexto").value) && !/leitrua/.test(api.$("leiTexto").value), "L2a o campo do texto da lei acompanha");
  api.leiPintar();
  ok(/✎ corrigido/.test(api.$("leiLeitura").textContent), "L2b o leitor mostra '✎ corrigido'");
  /* L3 */
  ok(/não muda o número/.test(api.leiCorrArtigoSalvar(l0.id, "3", "Art. 4º Terceiro artigo, com texto longo o bastante.").erro || ""), "L3a a correção não renumera");
  ok(/Nada mudou/.test(api.leiCorrArtigoSalvar(l0.id, "3", "Art. 3º Terceiro artigo, com texto longo o bastante.").erro || ""), "L3b sem mudança, nada é gravado");
  api.leiEdAbrir("3", "alteracao");
  ok(!api.$("leiArtTipoCorr").checked && api.$("leiArtTipoAlt").checked && !api.$("leiArtFonteCx").hidden, "L3c 'editar' abre como alteração da lei");
  api.$("leiArtTexto").value = "Art. 3º Terceiro artigo, com a redação nova dada pela norma.";
  api.$("leiArtFonte").value = "Lei 9.999/2026";
  api.leiEdSalvar(false);
  l = api.leiDe(l0.id);
  ok(l.alteracoes && l.alteracoes["3"] && l.alteracoes["3"].fonteAlteracao === "Lei 9.999/2026" && l.correcoes.length === 1, "L3d a alteração vai para a camada, com a norma, e não conta como correção");
  /* L4: a correção no artigo com redação na camada */
  const r4 = api.leiCorrArtigoSalvar(l0.id, "3", "Art. 3º Terceiro artigo, com a redação nova dada pela norma, corrigida.");
  l = api.leiDe(l0.id);
  ok(r4.ok && r4.entrada.onde === "alteracao" && /corrigida/.test(l.alteracoes["3"].texto) && l.alteracoes["3"].fonteAlteracao === "Lei 9.999/2026" && !/corrigida/.test(l.texto),
    "L4 o artigo com redação na camada é corrigido NA CAMADA, sem perder a norma");
  /* L5 */
  const r5 = api.leiCorrArtigoDesfazer(l0.id, r4.entrada.id);
  l = api.leiDe(l0.id);
  ok(r5.ok && !/corrigida/.test(l.alteracoes["3"].texto) && l.correcoes.filter((x) => x.id === r4.entrada.id)[0].desfeita, "L5a desfazer volta ao texto de antes e fica no histórico como desfeita");
  ok(/não pode ser desfeita/.test(api.leiCorrArtigoDesfazer(l0.id, r4.entrada.id).erro || ""), "L5b desfazer de novo é recusado (o texto não é mais o corrigido)");
  /* L6: uma versão nova traz o MESMO erro no art. 2 e redação nova no art. 1 corrigido */
  const r6 = api.leiCorrArtigoSalvar(l0.id, "1", "Art. 1º Texto do primeiro artigo, corrigido.");
  const alt = Object.assign({}, api.leiDe(l0.id).alteracoes, {
    "2": { texto: "Art. 2º Texto com erro de leitrua no meio.", fonteAlteracao: "versão nova", data: "2026-11-17", revogado: false },
    "1": { texto: "Art. 1º Redação totalmente nova do primeiro artigo.", fonteAlteracao: "versão nova", data: "2026-11-17", revogado: false } });
  api.leiGuardar({ id: l0.id, alteracoes: alt });
  const R = api.leiCorrReaplicar(l0.id);
  l = api.leiDe(l0.id);
  ok(R.reaplicadas === 1 && R.atras === 1 && /leitura no meio/.test(l.alteracoes["2"].texto), "L6a o mesmo erro de volta é corrigido de novo; a redação nova deixa a correção para trás: " + JSON.stringify(R));
  ok(l.correcoes.filter((x) => x.id === r6.entrada.id)[0].atras && l.correcoes.filter((x) => x.num === "2")[0].reaplicada === 1, "L6b os estados ficam na lei");
  /* L7: o mapa */
  api.leiMapaAbrir();
  const dec = api.$("leiMapaDec");
  ok(dec && /no leitor/.test(dec.textContent) && /ficou para trás/.test(dec.textContent) && /reaplicada na versão nova/.test(dec.textContent) && /desfeita/.test(dec.textContent),
    "L7a o mapa lista as correções do leitor com o estado: " + (dec && dec.textContent.slice(0, 200)));
  ok(/leitrua/.test(dec.textContent) && !/Texto do primeiro artigo\.Art\. 2/.test(dec.textContent), "L7b só o trecho que mudou, com contexto curto");
  const bDesf = dec.querySelectorAll("button").filter((b) => /^btnLeiMapaCorrDesf_/.test(b.id || ""));
  ok(bDesf.length === 1, "L7c 'desfazer' só na correção ativa: " + bDesf.length);
  bDesf[0].onclick();
  ok(/leitrua/.test(api.leiDe(l0.id).alteracoes["2"].texto), "L7d desfazer pelo mapa");
  void btsDoArt;

  ["lei_art_tipo_rot", "lei_art_tipo_corr", "lei_art_tipo_alt", "lei_art_corr_titulo", "lei_art_corr_aviso", "lei_art_corr_bt_tip", "lei_corr_art_ok", "lei_corr_art_igual", "lei_corr_art_numero",
    "lei_corr_art_desfeita", "lei_corr_art_nao_desf", "lei_corr_selo", "lei_corr_selo_atras", "lei_corr_selo_tip", "lei_corr_selo_ver", "lei_corr_selo_desf", "lei_corr_reaplic", "lei_corr_atras",
    "lei_corr_tipo_artigo", "lei_mapa_dec_fase_leitor", "lei_mapa_dec_st_desfeita", "lei_mapa_dec_st_atras", "lei_mapa_dec_st_reaplicada"].forEach((k) =>
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "L8 falta " + k + " em " + lg); }));
  api.setLanguage("pt");
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
