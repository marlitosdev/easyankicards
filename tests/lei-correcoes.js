/* =====================================================================
 * CORREÇÕES À MÃO NA REVISÃO DA COLAGEM E AS DECISÕES NO MAPA (19.162.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  C1. riscar / tirar o risco de um trecho reescreve as marcas certas (trechos vizinhos viram um só);
 *  C2. juntar e separar; as correções se reaplicam sobre o texto colado pelo conteúdo da linha (desfazer uma do meio
 *      não estraga as outras); a que perdeu a sua linha fica "não aplicada" em vez de mexer no lugar errado;
 *  C3. na revisão: riscar o link solto do art. 53 refaz a análise (o artigo fica "Art. 53. (Revogado pela …)"), e as
 *      escolhas já feitas continuam;
 *  C4. ✎ numa linha abre a caixa, gravar vira correção listada no painel, "desfazer" a tira; "ir para" acha a linha;
 *  C5. confirmar entrega o texto corrigido, registra as correções (registro, relatório, histórico de decisões) e elas
 *      entram na lei quando ela é gravada;
 *  C6. o mapa da lei mostra "Decisões tomadas": as correções (com o artigo onde estão) e a limpeza da colagem por tipo,
 *      com as recusadas; a lei nova recebe as decisões que nasceram como "(lei nova)".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);

  /* C1 */
  {
    const { api } = rodar();
    const raw = "~~Art. 53. O art. 1o da~~ Lei nº 7.347, de 1985~~, passa a vigorar:~~ (Revogado pela MP 2.180-35)";
    const C = api.leiCorrLimpo(raw);
    ok(C.txt === "Art. 53. O art. 1o da Lei nº 7.347, de 1985, passa a vigorar: (Revogado pela MP 2.180-35)" && api.leiCorrSerializar(C.txt, C.flag) === raw, "C1a limpar e voltar dá a mesma linha");
    const a = C.txt.indexOf("Lei nº");
    const r = api.leiCorrRiscar(raw, a, a + "Lei nº 7.347, de 1985".length, true);
    ok(r === "~~Art. 53. O art. 1o da Lei nº 7.347, de 1985, passa a vigorar:~~ (Revogado pela MP 2.180-35)", "C1b riscar o link junta os trechos num só: " + r);
    const b = C.txt.indexOf("passa");
    const r2 = api.leiCorrRiscar(r, b, b + "passa a vigorar:".length, false);
    ok(r2 === "~~Art. 53. O art. 1o da Lei nº 7.347, de 1985,~~ passa a vigorar: (Revogado pela MP 2.180-35)", "C1c tirar o risco de um pedaço: " + r2);
    ok(api.leiCorrLocalizar(raw, "1985", 40) === C.txt.indexOf("1985") && api.leiCorrLocalizar(raw, "xyz", 0) === -1, "C1d achar o trecho selecionado na linha");
  }

  /* C2 */
  {
    const { api } = rodar();
    const T = ["Art. 1º Primeiro artigo que foi", "quebrado no meio.", "", "Art. 2º Segundo. Art. 3º Terceiro colado.", "", "Art. 4º Quarto."].join(NL);
    let L = T.split(NL);
    const j = api.leiCorrOpJuntar(L, 2);
    ok(j && j.alvo[0].para === "Art. 1º Primeiro artigo que foi quebrado no meio." && j.alvo[1].para === "", "C2a juntar com a de cima");
    const s = api.leiCorrOpSeparar(L, 4, "Art. 2º Segundo. ".length);
    ok(s && s.alvo[0].para === "Art. 2º Segundo." + NL + "Art. 3º Terceiro colado.", "C2b separar antes do trecho");
    const e = api.leiCorrOpEditar(L, 6, "Art. 4º Quarto, corrigido.");
    const R = api.leiCorrAplicar(T, [s, j, e]);
    ok(R.falhas.length === 0 && R.texto.split(NL).length === 7 && /Art\. 3º Terceiro colado\./.test(R.texto.split(NL)[4]) && /corrigido/.test(R.texto), "C2c as três se aplicam em ordem (a separação acrescenta uma linha): " + JSON.stringify(R.texto.split(NL)));
    const R2 = api.leiCorrAplicar(T, [j, e]);
    ok(R2.falhas.length === 0 && /corrigido/.test(R2.texto) && R2.texto.indexOf("Art. 3º Terceiro colado.") > 0, "C2d sem a do meio, a seguinte acha a sua linha pelo conteúdo");
    const R3 = api.leiCorrAplicar(T, [api.leiCorrOpEditar(L, 6, "x"), e]);
    ok(R3.falhas.length === 1 && R3.falhas[0] === e.id, "C2e a que perdeu a sua linha fica 'não aplicada'");
  }

  /* C3 + C4 + C5 */
  const LEI = ["LEI Nº 10.257, DE 10 DE JULHO DE 2001", "",
    "Art. 52. Texto vivo do artigo.", "",
    "~~Art. 53. O art. 1o da~~ Lei nº 7.347, de 24 de julho de 1985~~, passa a vigorar acrescido de novo inciso III:~~ (Revogado pela Medida Provisória nº 2.180-35, de 24.8.2001)", "",
    "Art. 54. Redação nova do artigo.", "",
    "~~Art. 54. Redação antiga do artigo.~~", "",
    "Art. 55. Último artigo, com uma frase", "quebrada no meio."].join(NL);
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    let conf = null;
    api.leiRevisarColagemAbrir({ modo: "criar", texto: LEI, pre: api.leiPreAnalisar(LEI).pre, aoConfirmar: (r) => { conf = r; } });
    let c = api.leiPreCtxAtual();
    const t53 = () => c.pre.mudancas.filter((m) => m.grupo === "tachado" && m.linhas[0] === 5)[0];
    ok(t53() && /Art\. 53\. \(Revogado\) Lei nº 7\.347/.test(t53().depois), "C3a antes: o link solto ficaria no texto: " + (t53() && t53().depois));
    const t54 = c.pre.mudancas.filter((m) => m.grupo === "tachado" && m.linhas[0] === 9)[0];
    c.decisoes[t54.id] = false;   /* a pessoa manteve o riscado do 54 */
    api.leiCorrSelecaoAgir("riscar", { n: 5, txt: "Lei nº 7.347, de 24 de julho de 1985", ini: 25 });
    c = api.leiPreCtxAtual();
    ok(c.correcoes.length === 1 && c.textoOrig === LEI && t53() && t53().depois === "Art. 53. (Revogado pela Medida Provisória nº 2.180-35, de 24.8.2001)", "C3b riscar o link refaz a análise: " + (t53() && t53().depois));
    const t54b = c.pre.mudancas.filter((m) => m.grupo === "tachado" && m.linhas[0] === 9)[0];
    ok(t54b && c.decisoes[t54b.id] === false, "C3c a escolha já feita (manter o riscado do 54) continua");
    ok(api.$("leiCorr") && /1 correção\(ões\) suas/.test(api.$("leiCorr").textContent) && /riscado · linha 5/.test(api.$("leiCorr").textContent), "C4a o painel lista a correção");
    /* ✎ na linha 12 (a frase quebrada): juntar pela caixa */
    api.leiCorrEditarAbrir(12, "leiCorrJan");
    ok(api.$("leiCorrJan") && api.$("leiCorrEdTa") && api.$("leiCorrEdTa").value === "quebrada no meio.", "C4b ✎ abre a caixa com a linha (na janela 'ir para')");
    api.$("btnLeiCorrEdJuntar").onclick();
    c = api.leiPreCtxAtual();
    ok(c.correcoes.length === 2 && c.texto.split(NL)[10] === "Art. 55. Último artigo, com uma frase quebrada no meio." && c.texto.split(NL)[11] === "", "C4c 'juntar com a de cima' pela caixa");
    /* editar: reescrever a linha 3 */
    api.leiCorrEditarAbrir(3, "leiCorrJan");
    api.$("leiCorrEdTa").value = "Art. 52. Texto vivo do artigo, corrigido.";
    api.$("btnLeiCorrGravar").onclick();
    c = api.leiPreCtxAtual();
    ok(c.correcoes.length === 3 && c.texto.split(NL)[2] === "Art. 52. Texto vivo do artigo, corrigido.", "C4d gravar a linha reescrita");
    const idEd = c.correcoes[2].id;
    api.$("btnLeiCorrDesf_" + idEd).onclick();
    c = api.leiPreCtxAtual();
    ok(c.correcoes.length === 2 && c.texto.split(NL)[2] === "Art. 52. Texto vivo do artigo.", "C4e 'desfazer' tira só aquela correção");
    ok(api.leiCorrIrPara("Medida Provisória") === 5 && api.$("leiCorrJan"), "C4f 'ir para' pelo texto");
    ok(api.leiCorrRelatorio(c).length === 3 && /riscar · linha 5/.test(api.leiCorrRelatorio(c)[1]), "C5a o relatório lista as correções");
    api.leiPreConfirmar();
    ok(conf && conf.correcoes && conf.correcoes.length === 2 && /Art\. 53\. \(Revogado pela Medida/.test(conf.texto) && !/24 de julho de 1985/.test(conf.texto) && /uma frase quebrada no meio\./.test(conf.texto),
      "C5b confirmar entrega o texto corrigido e as correções");
    const decs = api.decLer().filter((d) => d.regra === "colagem.correcao");
    ok(decs.length === 2 && decs.every((d) => d.origem === "voce" && d.decisao === "mudou" && d.lei === "(lei nova)"), "C5c as correções vão para o histórico de decisões");
    /* a lei é gravada: as correções entram nela, e as decisões da colagem ganham o nome dela */
    const l = api.leiGuardar({ id: "lei_est", nome: "Estatuto de teste", texto: conf.texto });
    ok(api.leiCorrGravarPendentes(l.id, "criar") === 2 && api.leiDe(l.id).correcoes.length === 2 && api.leiDe(l.id).correcoes[0].fase === "criar", "C5d as correções entram na lei gravada");
    ok(api.leiCorrGravarPendentes(l.id, "criar") === 0, "C5e e só uma vez");
    ok(api.leiDecBatizar(l.nome) > 2 && api.decLer().every((d) => d.lei === "Estatuto de teste"), "C6a as decisões de '(lei nova)' passam a ter o nome da lei");
    /* C6: o mapa */
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir();
    const dec = api.$("leiMapaDec");
    ok(dec && dec.open !== true && /Decisões tomadas · 2 correção\(ões\) suas/.test(dec.textContent), "C6b o grupo 'Decisões tomadas', recolhido, com a contagem: " + (dec && dec.textContent.slice(0, 120)));
    ok(/riscado · ao incluir/.test(dec.textContent) && api.$("btnLeiMapaCorrVer_1") && /art\. 53/.test(api.$("btnLeiMapaCorrVer_1").textContent), "C6c cada correção com 'ver no texto' no artigo dela");
    ok(/A limpeza do texto colado/.test(dec.textContent) && /1 recusada/.test(dec.textContent) && /✗/.test(dec.textContent), "C6d a limpeza da colagem por tipo, com a recusada à vista");
    ok(api.leiCorrMapaTexto(api.leiDe(l.id)).length === 3, "C6e o relatório do mapa leva as correções");
  }
  {
    const { api } = rodar();
    ["lei_corr_tit", "lei_corr_n", "lei_corr_como", "lei_corr_ir_ph", "lei_corr_ir", "lei_corr_ir_nada", "lei_corr_feita", "lei_corr_desfeita", "lei_corr_desfeitas",
      "lei_corr_nao_juntar", "lei_corr_nao_achei", "lei_corr_nada_riscar", "lei_corr_nada_tirar", "lei_corr_nada_separar", "lei_corr_sel", "lei_corr_riscar", "lei_corr_riscar_tip",
      "lei_corr_tirar", "lei_corr_tirar_tip", "lei_corr_separar", "lei_corr_separar_tip", "lei_corr_juntar", "lei_corr_juntar_tip", "lei_corr_editar", "lei_corr_editar_tip",
      "lei_corr_ed_bt_tip", "lei_corr_ed_tit", "lei_corr_ed_riscado", "lei_corr_ed_dica", "lei_corr_ed_gravar", "lei_corr_ed_cancelar", "lei_corr_tipo_editar", "lei_corr_tipo_riscar",
      "lei_corr_tipo_tirar_risco", "lei_corr_tipo_juntar", "lei_corr_tipo_separar", "lei_corr_linha", "lei_corr_falhou", "lei_corr_desfazer", "lei_corr_desfazer_todas",
      "lei_mapa_dec_tit", "lei_mapa_dec_n_corr", "lei_mapa_dec_n_limpeza", "lei_mapa_dec_expl", "lei_mapa_dec_corr_tit", "lei_mapa_dec_fase_criar", "lei_mapa_dec_fase_upd",
      "lei_mapa_dec_antes", "lei_mapa_dec_depois", "lei_mapa_dec_ver", "lei_mapa_dec_sem_art", "lei_mapa_dec_limpeza_tit", "lei_mapa_dec_contas", "lei_mapa_dec_mais", "lei_mapa_dec_hist"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "C7 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
