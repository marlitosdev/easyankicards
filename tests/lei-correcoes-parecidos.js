/* =====================================================================
 * CORREÇÕES — FASE 3: OS PARECIDOS E O CASO DE TESTE (19.165.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  P1. riscar o link solto oferece os OUTROS links soltos na mesma situação (entre riscados), e não o mesmo texto vivo
 *      fora do riscado; aplicar é UMA correção (um desfazer desfaz o lote);
 *  P2. reescrever com uma troca curta oferece as outras linhas com o mesmo trecho;
 *  P3. juntar oferece as outras frases quebradas (minúscula depois de linha sem ponto final), não a que vem depois de ":";
 *  P4. separar oferece o mesmo começo de dispositivo colado no meio de outras linhas;
 *  P5. "agora não" descarta; o caso de teste leva o antes, o depois e o trecho do HTML de origem;
 *  P6. no leitor: a mesma troca nos outros artigos da lei, cada um como correção (em lote), com desfazer.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const abrir = (api, texto) => { api.leiRevisarColagemAbrir({ modo: "criar", texto, pre: api.leiPreAnalisar(texto).pre, aoConfirmar: () => {} }); return api.leiPreCtxAtual(); };

  /* P1 + P5 */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const T = ["Art. 52. Texto vivo.", "",
      "~~Art. 53. O art. 1o da~~ Lei nº 7.347, de 24 de julho de 1985~~, passa a vigorar:~~ (Revogado pela MP 2.180-35)", "",
      "Art. 54. Cita a Lei nº 7.347, de 24 de julho de 1985 como texto vivo.", "",
      "~~Art. 55. O art. 4o da~~ Lei nº 7.347, de 24 de julho de 1985~~, passa a vigorar:~~ (Revogado pela MP 2.180-35)", "",
      "Art. 56. Último."].join(NL);
    let c = abrir(api, T);
    api.leiCorrSelecaoAgir("riscar", { n: 3, txt: "Lei nº 7.347, de 24 de julho de 1985", ini: 25 });
    c = api.leiPreCtxAtual();
    ok(c.corrParecidos && c.corrParecidos.itens.length === 1 && c.corrParecidos.itens[0].n === 7, "P1a o outro link solto entre riscados é oferecido (e o texto vivo do art. 54 não): " + JSON.stringify(c.corrParecidos && c.corrParecidos.itens.map((x) => x.n)));
    ok(api.$("leiCorrPar") && /1 trecho\(s\) parecido/.test(api.$("leiCorrPar").textContent), "P1b o painel mostra os parecidos");
    api.$("btnLeiCorrParAplicar").onclick();
    c = api.leiPreCtxAtual();
    const lote = c.correcoes[1];
    ok(c.correcoes.length === 2 && lote.lote && /^~~Art\. 55\. O art\. 4o da Lei nº 7\.347, de 24 de julho de 1985, passa a vigorar:~~/.test(c.texto.split(NL)[6]) && !c.corrParecidos, "P1c aplicar: uma correção em lote, e a linha 7 riscada inteira");
    ok(/Lei nº 7\.347, de 24 de julho de 1985 como texto vivo/.test(c.texto) && c.texto.split(NL)[4].indexOf("~~") < 0, "P1d o texto vivo continua vivo");
    /* P5: o caso de teste */
    api.leiMarcarTachado("Art. 53. O art. 1o da Lei nº 7.347, de 24 de julho de 1985, passa a vigorar:", '<p><strike>Art. 53. O art. 1o da </strike><a href="x">Lei nº 7.347, de 24 de julho de 1985</a><strike>, passa a vigorar:</strike></p>');
    const caso = api.leiCorrCasoDeTeste(c);
    ok(/CASO DE TESTE/.test(caso) && /ANTES \(como o leitor deixou\):/.test(caso) && /DEPOIS \(como deve ficar\):/.test(caso) && /HTML DE ORIGEM/.test(caso) && /<strike>/.test(caso) && /lote de 1/.test(caso),
      "P5a o caso de teste: antes, depois e o HTML de origem: " + caso.slice(0, 200));
    ok(api.leiCorrRelatorio(c).some((x) => /html: .*<strike>/.test(x)), "P5b o relatório leva o trecho do HTML");
    api.$("btnLeiCorrDesf_" + lote.id).onclick();
    c = api.leiPreCtxAtual();
    ok(c.correcoes.length === 1 && c.texto.split(NL)[6].indexOf("~~ Lei nº") >= 0, "P1e desfazer o lote volta as linhas dele");
  }

  /* P2 + P5 ("agora não") */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const T = ["~~Texto antigo.~~", "", "Art. 1º Texto com leitrua errada.", "", "Art. 2º Outra leitrua aqui.", "", "Art. 3º Nada a ver."].join(NL);
    let c = abrir(api, T);
    api.leiCorrEditarAbrir(3, "leiCorrJan");
    api.$("leiCorrEdTa").value = "Art. 1º Texto com leitura errada.";
    api.$("btnLeiCorrGravar").onclick();
    c = api.leiPreCtxAtual();
    ok(c.corrParecidos && c.corrParecidos.itens.length === 1 && c.corrParecidos.itens[0].para === "Art. 2º Outra leitura aqui.", "P2a a mesma troca em outra linha é oferecida");
    api.$("btnLeiCorrParNao").onclick();
    c = api.leiPreCtxAtual();
    ok(!c.corrParecidos && /Outra leitrua/.test(c.texto), "P5c 'agora não' descarta sem mudar nada");
  }

  /* P3 */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const T = ["~~Texto antigo.~~", "", "Art. 1º Frase que foi", "quebrada aqui.", "", "Art. 2º Outra frase", "partida também.", "", "Art. 3º São deveres:", "cumprir a lei."].join(NL);
    let c = abrir(api, T);
    api.leiCorrSelecaoAgir("juntar", { n: 4 });
    c = api.leiPreCtxAtual();
    const it = (c.corrParecidos && c.corrParecidos.itens) || [];
    ok(it.length === 2 && it[0].para === "Art. 2º Outra frase partida também." && it[1].para === "", "P3a a outra frase quebrada é oferecida (e a que vem depois de ':' não): " + JSON.stringify(it));
    api.leiCorrAplicarParecidos();
    c = api.leiPreCtxAtual();
    ok(c.texto.split(NL)[5] === "Art. 2º Outra frase partida também." && /São deveres:\ncumprir/.test(c.texto), "P3b aplicado");
  }

  /* P4 */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const T = ["~~Texto antigo.~~", "", "Art. 2º Segundo. Art. 3º Terceiro.", "", "Art. 4º Quarto; Art. 5º Quinto.", "", "Art. 6º Cita o art. 7º no meio."].join(NL);
    let c = abrir(api, T);
    api.leiCorrSelecaoAgir("separar", { n: 3, txt: "Art. 3º", ini: 17 });
    c = api.leiPreCtxAtual();
    const it = (c.corrParecidos && c.corrParecidos.itens) || [];
    ok(it.length === 1 && it[0].n === 6 && it[0].para === "Art. 4º Quarto;" + NL + "Art. 5º Quinto.", "P4 o mesmo começo colado em outra linha (e a citação 'o art. 7º' não): " + JSON.stringify(it));
  }

  /* P6: no leitor */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const LEI = ["Art. 1º Primeiro.", "", "Art. 2º Texto com leitrua.", "", "Art. 3º Outro com leitrua também.", "", "Art. 4º Sem erro."].join(NL);
    const l0 = api.leiGuardar({ id: "lei_par", nome: "Lei dos Parecidos", texto: LEI });
    const r = api.leiCorrArtigoSalvar(l0.id, "2", "Art. 2º Texto com leitura.");
    ok(api.leiDe(l0.id).texto.indexOf("Texto com leitura." + NL + NL + "Art. 3º") >= 0, "P6z a linha em branco entre os artigos continua (o artigo corrigido não gruda no seguinte)");
    const par = api.leiCorrArtigoParecidos(l0.id, r.entrada);
    ok(par.length === 1 && par[0].num === "3" && par[0].novo === "Art. 3º Outro com leitura também.", "P6a a mesma troca no outro artigo: " + JSON.stringify(par));
    ok(api.leiCorrArtigoAplicarParecidos(l0.id, par, r.entrada.id) === 1, "P6b aplicado");
    const l = api.leiDe(l0.id);
    const e3 = l.correcoes.filter((x) => x.num === "3")[0];
    ok(!/leitrua/.test(l.texto) && e3 && e3.lote && e3.origem === r.entrada.id, "P6c cada artigo vira correção sua, marcada como do lote");
    ok(api.leiCorrArtigoDesfazer(l0.id, e3.id).ok && /Outro com leitrua/.test(api.leiDe(l0.id).texto), "P6d e se desfaz sozinha");
  }

  {
    const { api } = rodar();
    ["lei_corr_par_tit", "lei_corr_par_expl_riscar", "lei_corr_par_expl_tirar_risco", "lei_corr_par_expl_editar", "lei_corr_par_expl_juntar", "lei_corr_par_expl_separar",
      "lei_corr_par_mais", "lei_corr_par_aplicar", "lei_corr_par_nao", "lei_corr_lote", "lei_corr_caso_bt", "lei_corr_caso_tip", "lei_corr_caso_ok", "lei_corr_par_art",
      "lei_corr_par_art_ok", "lei_corr_par_art_feito", "lei_mapa_dec_lote"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "P7 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
