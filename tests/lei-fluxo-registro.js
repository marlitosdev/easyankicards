/* =====================================================================
 * O REGISTRO DA INCLUSÃO DE UMA LEI (v18.66.0)
 *
 * Pedido: "criar um registro específico deste fluxo de inclusão de lei
 * (…) que contemple as problemáticas mais complexas; deve poder ser
 * consultado e copiado durante o fluxo". O QUE PRECISA SER VERDADE:
 *  1. criar uma lei abre um fluxo com registro próprio; cada etapa
 *     (entrada, separação, conferência, repetidos, lei criada) entra no
 *     RESUMO, com o detalhe (o que se juntou, separou, escolheu);
 *  2. a LINHA DO TEMPO tem tudo do fluxo, sem o corte de 240 caracteres;
 *  3. atualizar a mesma lei CONTINUA o fluxo dela (fluxo único: criar e
 *     aplicar as leis que alteram); comparação e aplicação entram;
 *  4. "📋 registro" em cada tela abre o registro para ler e copiar (tudo
 *     ou só o resumo), com "o que está na tela agora";
 *  5. o "copiar relatório desta tela" leva o registro do fluxo INTEIRO;
 *  6. erro vira etapa; os últimos 5 fluxos ficam guardados.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const espera = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 2)); };
  const TXT = "LEI COMPLEMENTAR Nº 15, DE 2009 Institui o Código Tributário de Caruaru. "
    + "Art. 1º Este Código regula os tributos. Art. 2º O imposto incide sobre serviços. "
    + "Art. 3º A taxa é devida. Art. 3º A taxa é devida anualmente. (Redação dada pela LC 18/2009) Art. 4º Fim.";

  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  api.leiAbrir("Direito Tributário", "CTM");
  api.$("leiTexto").value = TXT;

  /* ---- 1: criar a lei ---- */
  api.leiGravar();
  await espera();
  const fx = api.leiFluxoAtual();
  ok(fx && fx.tipo === "criar" && fx.situacao === "em andamento" && fx.etapas.map((e) => e.etapa).join() === "entrada,separacao", "F1 o fluxo começa com a entrada e a separação: " + (fx && fx.etapas.map((e) => e.etapa).join()));
  ok(/texto colado: \d+ caracteres/.test(fx.etapas[0].resumo) && /5 artigos separados/.test(fx.etapas[1].resumo), "F1a o que entrou e o que a separação achou: " + fx.etapas.map((e) => e.resumo).join(" | "));
  /* o registro durante a separação */
  api.$("btnLeiSepFx").onclick();
  ok(api.$("dlgLeiFluxoReg").open === true, "F2 '📋 registro' na tela da separação abre o registro");
  const txt = api.$("leiFxTexto").value;
  ok(/RESUMO POR ETAPA/.test(txt) && /Separação dos artigos/.test(txt) && /LINHA DO TEMPO/.test(txt) && /O QUE ESTÁ NA TELA AGORA \(separar artigos\)/.test(txt), "F2a resumo, linha do tempo e a tela de agora: " + txt.slice(0, 300));
  ok(/Tela: separar artigos/.test(txt) && /Lei aberta:/.test(txt), "F2a2 e o conteúdo da tela (o relatório da tela, sem repetir o registro)");
  const so = api.leiFluxoCopiar(true);
  ok(/RESUMO POR ETAPA/.test(so) && !/LINHA DO TEMPO/.test(so), "F2b 'copiar só o resumo'");
  ok(/LINHA DO TEMPO/.test(api.leiFluxoCopiar(false)), "F2c 'copiar tudo'");
  api.$("btnLeiFxFechar").onclick();
  /* juntar o art. 3º repetido ao anterior? não — continuar e escolher no passo dos repetidos */
  api.$("btnLeiSepContinuar").onclick();
  await espera();
  ok(api.$("dlgLeiDup").open === true, "F3-pre segue para os repetidos");
  api.$("btnLeiDupFx").onclick();
  ok(api.$("dlgLeiFluxoReg").open === true && /artigos repetidos/.test(api.$("leiFxTexto").value), "F3 '📋 registro' também na tela dos repetidos");
  api.$("btnLeiFxFechar").onclick();
  api.$("btnLeiDupConfirmar").onclick();
  await espera();
  const etapas = () => api.leiFluxoAtual().etapas.map((e) => e.etapa).join();
  ok(etapas() === "entrada,separacao,separacao_fim,repetidos,lei", "F4 as etapas até a lei criada: " + etapas());
  const l = api.leisLista()[0];
  ok(api.leiFluxoAtual().leiId === l.id && /Lei criada/.test(api.leiFluxoTexto(api.leiFluxoAtual())), "F4a o fluxo passa a ser da lei criada");
  const rep = api.leiFluxoAtual().etapas.find((e) => e.etapa === "repetidos");
  ok(/art\. 3 → /.test(rep.detalhe.join(" ")), "F4b o detalhe dos repetidos diz o que ficou de cada um: " + rep.detalhe.join(" | "));

  /* ---- 2: a linha do tempo não corta em 240 caracteres ---- */
  const longo = "x".repeat(900);
  api.leiReg("gravar", "teste de detalhe longo", longo);
  const ult = api.leiFluxoAtual().linhas[api.leiFluxoAtual().linhas.length - 1];
  ok(ult.d.length === 900, "L1 o detalhe entra inteiro no registro do fluxo: " + ult.d.length);

  /* ---- 3: atualizar a mesma lei CONTINUA o fluxo ---- */
  const idAntes = api.leiFluxoAtual().id;
  api.leiAbrir("Direito Tributário", "CTM", l.id);
  api.leiAtualizarAbrir();
  ok(api.leiFluxoAtual().id === idAntes, "U1 atualizar a lei recém-criada continua o mesmo fluxo (fluxo único)");
  api.$("btnLeiUpdFx1").onclick();
  ok(api.$("dlgLeiFluxoReg").open === true, "U1a '📋 registro' na tela de atualizar");
  api.$("btnLeiFxFechar").onclick();
  api.$("leiUpdModoAlt").checked = true;
  if (api.$("leiUpdModoCompleta")) api.$("leiUpdModoCompleta").checked = false;
  api.$("leiUpdLadoAuto").checked = false;
  api.$("leiUpdFonte").value = "LC 95/2022";
  api.$("leiUpdTexto").value = "LEI COMPLEMENTAR Nº 95, DE 28 DE SETEMBRO DE 2022. Art. 1º A Lei Complementar nº 15 de 2009 passa a vigorar com as seguintes alterações: “Art. 2º O imposto incide sobre serviços e obras. (NR)” Art. 2º Esta Lei entra em vigor na data de sua publicação.";
  api.leiAtualizarComparar({ modoAlt: true, guardado: true });
  await espera();
  const cmp = api.leiFluxoAtual().etapas.find((e) => e.etapa === "comparacao");
  ok(cmp && /lei que altera \(LC 95\/2022\): 1 artigo/.test(cmp.resumo) && /art\. 2 — mudou/.test(cmp.detalhe.join(" ")), "U2 a comparação entra no registro: " + (cmp && cmp.resumo + " / " + cmp.detalhe.join(" ")));
  (api.leiUpdComparoAtual() || []).forEach((x) => { x.aceito = true; });
  api.leiAtualizarAplicar();
  await espera();
  const apl = api.leiFluxoAtual().etapas.find((e) => e.etapa === "aplicada");
  ok(apl && /LC 95\/2022: 1 aceito/.test(apl.resumo) && /2 \(mudou\)/.test(apl.detalhe.join(" ")), "U3 a aplicação entra no registro: " + (apl && apl.resumo));

  /* ---- 5: o relatório da tela leva o registro inteiro do fluxo ---- */
  const rel = api.leiRelatorioFluxo("atualizar a lei");
  ok(/Registro desta inclusão \(inteiro\)/.test(rel) && /texto colado:/.test(rel) && /Atualização aplicada/.test(rel), "R1 'copiar relatório desta tela' leva o fluxo desde a entrada");

  /* ---- 6: erro vira etapa; novo fluxo encerra o anterior; guarda 5 ---- */
  api.leiReg("erro", "falha em comparar", "TypeError: x");
  ok(api.leiFluxoAtual().etapas.some((e) => e.etapa === "erro" && /falha em comparar/.test(e.resumo)), "E1 a falha aparece no resumo como ERRO");
  const anterior = api.leiFluxoAtual().id;
  api.leiFluxoGarantir("criar", null, true);
  const lidos = api.leiFluxosLer();
  ok(lidos.find((f) => f.id === anterior).situacao === "concluído" && api.leiFluxoAtual().id !== anterior, "E2 uma lei nova começa outro fluxo; o anterior (que criou a lei) fica 'concluído'");
  api.leiFluxoGarantir("criar", null, true);
  ok(api.leiFluxosLer().filter((f) => f.situacao === "interrompido").length === 1, "E3 o fluxo que parou antes de criar a lei fica 'interrompido'");
  for (let i = 0; i < 6; i++) api.leiFluxoGarantir("criar", null, true);
  ok(api.leiFluxosLer().length === 5, "E4 guarda os 5 últimos fluxos");
  api.leiFluxoAbrir("teste");
  ok((api.$("leiFxSel").children || []).length === 5, "E5 o seletor da janela lista os fluxos guardados");

  /* textos nos dois idiomas */
  ["lei_fx_btn", "lei_fx_btn_tip", "lei_fx_titulo", "lei_fx_ajuda", "lei_fx_qual", "lei_fx_info", "lei_fx_copiar", "lei_fx_copiar_resumo", "lei_fx_fechar", "lei_fx_nenhum", "lei_fx_cab",
    "lei_fx_tipo_criar", "lei_fx_tipo_atualizar", "lei_fx_sit_and", "lei_fx_sit_ok", "lei_fx_sit_int", "lei_fx_resumo", "lei_fx_tempo", "lei_fx_tela", "lei_fx_rel_titulo",
    "lei_fx_e_entrada", "lei_fx_e_separacao", "lei_fx_e_separacao_fim", "lei_fx_e_limpeza", "lei_fx_e_repetidos", "lei_fx_e_lei", "lei_fx_e_comparacao", "lei_fx_e_aplicada", "lei_fx_e_erro",
    "lei_fx_r_colado", "lei_fx_r_arquivo", "lei_fx_r_sep", "lei_fx_r_sep_fim", "lei_fx_r_limpeza", "lei_fx_r_repetidos", "lei_fx_r_lei", "lei_fx_r_comp", "lei_fx_r_comp_alt", "lei_fx_r_aplicada"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
