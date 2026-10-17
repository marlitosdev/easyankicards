/* =====================================================================
 * A LEI E AS LEIS QUE A ALTERAM, NUM FLUXO ÚNICO (v18.67.0)
 *
 * Pedido: "incluir a lei e suas respectivas alterações em um único fluxo
 * (…) as alterações estão separadas, mas fazendo alterações no texto
 * original. Permitir incluir em fluxo único e também depois, de acordo com
 * a vontade do usuário." O QUE PRECISA SER VERDADE:
 *  1. na criação, as leis que alteram entram numa fila (arquivo ou colar),
 *     em ORDEM DE DATA, com nome tirado do próprio texto; tira-se da fila;
 *  2. criada a lei, a fila vai com ela e começa sozinha: a atualização abre
 *     no modo "lei que altera", com a primeira, e a faixa diz qual é e quais
 *     vêm depois; aplicada, sai da fila e vem a próxima;
 *  3. "pular esta" vai à próxima (a pulada fica na fila); "parar" fecha e
 *     deixa a fila guardada na lei — "Aplicar agora" retoma depois;
 *  4. tudo entra no registro da inclusão.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const espera = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 3)); };
  const BASE = "LEI COMPLEMENTAR Nº 15, DE 05 DE JANEIRO DE 2009\nArt. 1º Este Código regula os tributos.\nArt. 2º O imposto incide sobre serviços.\nArt. 3º A taxa é devida.\nArt. 4º Esta Lei entra em vigor.";
  const LC95 = "LEI COMPLEMENTAR Nº 95, DE 28 DE SETEMBRO DE 2022. Altera a Lei Complementar nº 15, de 05 de janeiro de 2009. Art. 1º A Lei Complementar nº 15, de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações: “Art. 2º O imposto incide sobre serviços e obras. (NR)” Art. 2º Esta Lei Complementar entra em vigor na data de sua publicação.";
  const LC112 = "LEI COMPLEMENTAR Nº 112, DE 09 DE JUNHO DE 2023. Altera a Lei Complementar nº 15, de 05 de janeiro de 2009. Art. 1º A Lei Complementar nº 15, de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações: “Art. 1º Este Código regula os tributos municipais. (NR)” Art. 2º Esta Lei Complementar entra em vigor na data de sua publicação.";
  const LC145 = "LEI COMPLEMENTAR Nº 145, DE 23 DE DEZEMBRO DE 2024. Altera a Lei Complementar nº 15, de 05 de janeiro de 2009. Art. 1º A Lei Complementar nº 15, de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações: “Art. 3º A taxa é devida anualmente. (NR)” Art. 2º Esta Lei Complementar entra em vigor na data de sua publicação.";

  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  api.leiAbrir("Direito Tributário", "CTM");
  api.leiTrocarModo("editar");
  api.leiAltFilaPintar();

  /* ---- 1: a fila na criação ---- */
  ok(api.$("leiAltFilaBox").hidden === false && /Leis que alteram esta \(opcional\)/.test(api.$("leiAltFilaTit").textContent), "A1 na criação a caixa aparece e explica: " + api.$("leiAltFilaTit").textContent);
  api.leiAltFilaAdicionar(LC145, "");
  api.$("btnLeiAltFilaColar").onclick();
  ok(api.$("leiAltFilaColarCx").hidden === false, "A2 'colar o texto' abre a caixa");
  api.$("leiAltFilaColarTexto").value = LC95;
  api.$("btnLeiAltFilaColarOk").onclick();
  const arq = (nome, txt) => ({ name: nome, arrayBuffer: async () => new TextEncoder().encode(txt).buffer });
  const n = await api.leiAltFilaArquivos([arq("lc112.htm", "<p>" + LC112 + "</p>")]);
  ok(n === 1, "A3 arquivo .htm entra na fila");
  const nomes = () => api.leiAltFilaLista().map((x) => x.nome).join(",");
  ok(nomes() === "LC 95/2022,LC 112/2023,LC 145/2024", "A4 em ordem de DATA, com o nome do próprio texto: " + nomes());
  ok((api.$("leiAltFilaLista").children || []).length === 3 && /Leis que alteram esta: 3 na fila/.test(api.$("leiAltFilaTit").textContent), "A5 a lista na tela");
  api.leiAltFilaAdicionar("NORMA EM VIGOR " + LC95, "lc95.pdf");
  ok(api.leiAltFilaLista().length === 3 && nomes().indexOf("lc95") < 0, "A6 a mesma lei duas vezes fica uma só (e o título é achado mesmo depois de 'NORMA EM VIGOR', como no PDF do Leis.org): " + nomes());
  const sus = api.leiAltFilaAdicionar("Texto qualquer sem nada de lei.", "nota.htm");
  ok(sus && sus.alteradora === false && /não parece lei que altera/.test(api.$("leiAltFilaLista").textContent), "A7 texto que não parece lei que altera fica marcado para conferir");
  api.$("btnLeiAltFilaTirar_3").onclick();
  ok(api.leiAltFilaLista().length === 3 && nomes().indexOf("nota") < 0, "A8 '✕' tira da fila: " + nomes());

  /* ---- 2: criar a lei — a fila vai com ela e começa ---- */
  api.$("leiTexto").value = BASE;
  api.leiGravar();
  await espera();
  const l = api.leisLista()[0];
  ok(!!l && (l.altPendentes || []).length === 3, "B1 a lei nasceu com a fila guardada");
  ok(api.$("dlgLeiAtualizar").open === true && api.$("leiUpdModoAlt").checked === true && api.$("leiUpdFonte").value === "LC 95/2022" && /Nº 95/.test(api.$("leiUpdTexto").value),
     "B2 a fila começa sozinha: a atualização abre no modo 'lei que altera', já com a LC 95/2022");
  ok(api.$("leiUpdFilaFaixa").hidden === false && /1 de 3 — LC 95\/2022 \(28\/09\/2022\)/.test(api.$("leiUpdFilaTxt").textContent) && /Depois: LC 112\/2023, LC 145\/2024/.test(api.$("leiUpdFilaTxt").textContent),
     "B3 a faixa diz qual é e quais vêm depois: " + api.$("leiUpdFilaTxt").textContent);
  /* aplica a LC 95 */
  api.$("leiUpdLadoAuto").checked = false;
  api.leiAtualizarComparar({ modoAlt: true, guardado: true });
  await espera();
  ok(api.$("leiUpdPasso2").hidden === false, "B4-pre a comparação abriu");
  (api.leiUpdComparoAtual() || []).forEach((x) => { x.aceito = true; });
  api.leiAtualizarAplicar();
  await espera();
  ok(/obras/.test(api.leiArtigosEfetivos ? JSON.stringify(api.leiArtigosEfetivos(api.leiDe(l.id))) : JSON.stringify(api.leiDe(l.id).alteracoes)), "B4 a LC 95 foi aplicada (art. 2º com 'obras')");
  ok((api.leiDe(l.id).altPendentes || []).length === 2, "B5 aplicada, sai da fila");
  api._uiFechar(true);
  await espera();
  ok(api.$("dlgLeiAtualizar").open === true && api.$("leiUpdFonte").value === "LC 112/2023" && /2 de 3 — LC 112\/2023/.test(api.$("leiUpdFilaTxt").textContent),
     "B6 fechado o aviso de 'pronto', vem a próxima (2 de 3): " + api.$("leiUpdFilaTxt").textContent);

  /* ---- 3: pular e parar ---- */
  api.$("btnLeiUpdFilaPular").onclick();
  await espera();
  ok(api.$("leiUpdFonte").value === "LC 145/2024" && /É a última da fila/.test(api.$("leiUpdFilaTxt").textContent), "C1 'pular esta' vai à próxima");
  api.$("btnLeiUpdFilaParar").onclick();
  await espera();
  ok(api.$("dlgLeiAtualizar").open !== true && (api.leiDe(l.id).altPendentes || []).length === 2, "C2 'parar' fecha e a fila fica guardada na lei (a pulada também)");
  api.leiPintar();
  api.leiAltFilaPintar();
  ok(api.$("leiAltFilaBox").hidden === false && /2 lei\(s\) que alteram esta esperando/.test(api.$("leiAltFilaTit").textContent) && api.$("btnLeiAltFilaComecar").hidden === false && /Aplicar agora \(2\)/.test(api.$("btnLeiAltFilaComecar").textContent),
     "C3 a lei mostra o que espera e 'Aplicar agora (2)': " + api.$("leiAltFilaTit").textContent);
  /* depois: retomar */
  api.$("btnLeiAltFilaComecar").onclick();
  await espera();
  ok(api.$("dlgLeiAtualizar").open === true && api.$("leiUpdFonte").value === "LC 112/2023", "C4 'Aplicar agora' retoma pela mais antiga");
  /* abrir a atualização à mão desfaz a fila em curso (a faixa some) */
  api.$("dlgLeiAtualizar").close();
  api.leiAtualizarAbrir();
  ok(api.$("leiUpdFilaFaixa").hidden === true, "C5 atualizar à mão não mostra a faixa da fila");
  api.$("dlgLeiAtualizar").close();

  /* ---- 4: no registro ---- */
  const fx = api.leiFluxoAtual();
  const fila = fx.etapas.filter((e) => e.etapa === "fila").map((e) => e.resumo).join(" | ");
  ok(/adicionada: LC 145\/2024/.test(fila) && /começou a aplicar 3 lei/.test(fila) && /pulada \(continua na fila\): LC 112\/2023/.test(fila) && /parou: 1 aplicada/.test(fila), "D1 a fila no registro: " + fila);
  ok(fx.etapas.some((e) => e.etapa === "aplicada" && /LC 95\/2022/.test(e.resumo)), "D2 a aplicação também");

  /* textos */
  ["lei_altfila_tit_criar", "lei_altfila_tit_criar_n", "lei_altfila_tit_lei", "lei_altfila_arq", "lei_altfila_colar", "lei_altfila_colar_ph", "lei_altfila_colar_ok", "lei_altfila_comecar", "lei_altfila_faixa", "lei_altfila_depois",
    "lei_altfila_ultima", "lei_altfila_pular", "lei_altfila_parar", "lei_altfila_parou", "lei_altfila_fim", "lei_altfila_fim_pend", "lei_altfila_nao_alt", "lei_fx_e_fila", "lei_fx_r_fila_add", "lei_fx_r_fila_comecou", "lei_fx_r_fila_pulou", "lei_fx_r_fila_parou", "lei_fx_r_fila_fim"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
