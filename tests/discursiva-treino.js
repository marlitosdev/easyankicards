/* =====================================================================
 * DISCURSIVAS — TREINO DE ESQUELETO E CADERNO DE ERROS (19.158.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  E1. o espelho vira itens com a pontuação, nos dois formatos guardados ("Critérios de Conteúdo (Total …)" com
 *      "1. … (14,0 pontos)" e subitens "*"; e "4. … 10,00 pontos" até "7. Apresentação… 5,00 pontos"), com os
 *      descontos à parte; sem itens numerados, os marcadores com pontos viram itens;
 *  E2. no leitor: marcar o que lembrou soma os pontos e compara com o mínimo; guardar fica no tema e conta como lido;
 *  E3. a faixa da agenda conta os esqueletos da semana (etapa leve, 5 min cada);
 *  E4. o caderno de erros: os itens esquecidos nos esqueletos, os descontos dos espelhos ("confira antes de entregar")
 *      e os tipos de erro das correções, com um exemplo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const ESP_A = [
    "Critérios de Conteúdo (Total 40,0 pontos):",
    "1. Poderes de Fiscalização e Prerrogativas (14,0 pontos):",
    "* Demonstrar a improcedência da alegação do contribuinte.",
    "* Explicitar que a fiscalização não depende de autorização judicial.",
    "2. Acesso a Dados Bancários (14,0 pontos):",
    "* Rechaçar o argumento de violação ao sigilo.",
    "3. Dever de Sigilo Fiscal (12,0 pontos):",
    "* Apontar o dever funcional do auditor.",
    "Critérios de Desconto:",
    "* Erros de Língua Portuguesa: desconto de 0,5 ponto por erro.",
    "* Tamanho fora do limite: Desconto de 2,0 pontos.",
    "* Fuga ao tema: atribuição de nota zero.",
  ].join("\n");
  const ESP_B = [
    "4. Regime orçamentário e patrimonial da receita: 10,00 pontos",
    "5. Escrituração no lançamento do IPTU: 10,00 pontos",
    "6. Escrituração na arrecadação: 15,00 pontos",
    "7. Apresentação, estrutura do texto e uso da norma culta: 5,00 pontos",
    "Descontos:",
    "* Ultrapassar ou não atingir o número de linhas.",
    "* Erros de grafia, concordância e regência: até 5,0 pontos.",
  ].join("\n");

  /* E1 */
  {
    const { api } = rodar();
    const A = api.dsEspelhoItens(ESP_A);
    ok(A.itens.length === 3 && A.itens.map((x) => x.pts).join(",") === "14,14,12" && A.total === 40 && A.itens[0].sub.length === 2 && /^Poderes de Fiscalização/.test(A.itens[0].tit) && !/pontos/.test(A.itens[0].tit),
      "E1a formato 'Critérios de Conteúdo': 3 itens (14, 14, 12 = 40), subitens e título sem os pontos: " + JSON.stringify(A.itens.map((x) => [x.n, x.tit.slice(0, 20), x.pts, x.sub.length])));
    ok(A.descontos.length === 3 && /Erros de Língua/.test(A.descontos[0]), "E1b os descontos ficam à parte: " + A.descontos.length);
    const B = api.dsEspelhoItens(ESP_B);
    ok(B.itens.length === 4 && B.total === 40 && B.itens[0].n === 4 && B.itens[3].pts === 5 && B.descontos.length === 2, "E1c formato '4. … 10,00 pontos' (numeração seguindo os comandos): " + JSON.stringify(B.itens.map((x) => [x.n, x.pts])));
    const C = api.dsEspelhoItens("Espelho:\n* Conceito de tributo (10 pts)\n* Espécies tributárias (10 pts)\n* Conclusão");
    ok(C.itens.length === 2 && C.total === 20, "E1d sem itens numerados, os marcadores com pontos viram itens");
    ok(api.dsEspelhoItens("Só um texto corrido sem pontuação.").itens.length === 0, "E1e sem pontuação: nada a treinar");
  }

  /* E2 + E3 + E4 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("Treino", ["# Treino | prova: " + daqui(15) + " | horas: 10", "# discursiva | pontos: 40 | objetiva: 60 | minimo: 50% | linhas: 25-30 | disciplinas: A", "@ A :: 5", "+ Tema um :: 5"].join("\n"));
    const p1 = api.dsPropostaAdicionar(e.id, { tema: "Fiscalização", disc: "A", enunciado: "Disserte.", espelho: ESP_A, fonte: "ia" });
    api.dsPropostaAdicionar(e.id, { tema: "Receita", disc: "A", enunciado: "Disserte 2.", espelho: ESP_B, fonte: "ia" });
    api.loja.setItem("eac_ds_edital", e.id); api.loja.setItem("eac_ds_secao", "propostas");
    api.dsRender();
    const det = api.$("dsEsq_" + p1.id);
    ok(!!det && /3 itens, 40 pontos/.test(det.textContent), "E2a o leitor tem o treino de esqueleto do tema");
    /* marca o item 1 (14 pts): 35%, abaixo do mínimo de 50% */
    const ck0 = api.$("dsEsqCk_" + p1.id + "_0");
    ck0.checked = true; ck0.onchange();
    ok(/garantiria 14 de 40 pontos \(35%\)/.test(det.textContent) && /abaixo do mínimo de 50%/.test(det.textContent), "E2b a soma e o mínimo: " + det.textContent.slice(-160));
    const ck1 = api.$("dsEsqCk_" + p1.id + "_1");
    ck1.checked = true; ck1.onchange();
    ok(/garantiria 28 de 40 pontos \(70%\)/.test(det.textContent) && /acima do mínimo de 50%/.test(det.textContent), "E2c dois itens: 70%, acima do mínimo");
    api.$("btnDsEsqGuardar_" + p1.id).onclick();
    const pg = api.dsPropostas(e.id).filter((p) => p.id === p1.id)[0];
    ok(pg.esq && pg.esq.length === 1 && pg.esq[0].pts === 28 && pg.esq[0].max === 40 && pg.esq[0].ok.join(",") === "0,1" && !!pg.lida, "E2d guardado no tema (28/40, itens 1 e 2) e o tema conta como lido");
    ok(api.dsEsqDaSemana(e.id) === 1, "E3a um esqueleto nesta semana");
    const S = api.dagSemana(e, null);
    const esq = S.etapas.filter((s) => s.tipo === "esq")[0];
    ok(esq && esq.feitos === 1 && esq.n === S.meta && esq.min === 5 * S.meta && S.reservaMin === api.dagReservaMin(e), "E3b a faixa da agenda conta o esqueleto (etapa leve, 5 min cada)");
    /* o caderno */
    api.dsPropostaAtualizar(e.id, p1.id, { correcao: "Tópico 1: 10/14. Faltou citar o fundamento legal (art. 195 do CTN).\nErros de língua: concordância em 'houveram fiscalizações'.\nTamanho dentro do limite.\nNOTA: 28/40" });
    const C = api.dsCaderno([e.id]);
    ok(C.esquecidos.length === 1 && /Dever de Sigilo Fiscal/.test(C.esquecidos[0].item) && C.esquecidos[0].esqueceu === 1 && C.esquecidos[0].treinos === 1, "E4a o que você esquece: o item 3 (não marcado)");
    ok(C.descontos.length === 3 && C.descontos.map((d) => d.k).sort().join(",") === "lingua,tamanho,tema" && C.descontos.filter((d) => d.k === "lingua")[0].n === 2 && C.descontos.some((d) => /Fuga ao tema/i.test(d.texto)),
      "E4b os descontos dos espelhos, agrupados por tipo (língua e tamanho nos 2 espelhos, fuga ao tema em 1): " + JSON.stringify(C.descontos.map((d) => d.k + "×" + d.n)));
    const cats = C.cats.map((c) => c.k);
    ok(C.correcoes === 1 && cats.indexOf("lingua") >= 0 && cats.indexOf("conteudo") >= 0 && cats.indexOf("tamanho") >= 0 && C.cats.every((c) => !/NOTA:/.test(c.ex)),
      "E4c as correções por tipo de erro, com exemplo (sem a linha da NOTA): " + JSON.stringify(C.cats.map((c) => c.k + ":" + c.ex.slice(0, 30))));
    api.loja.setItem("eac_ds_secao", "redacoes");
    api.dsRender();
    const cad = api.$("dsCaderno_" + e.id);
    ok(!!cad && /Caderno de erros/.test(cad.textContent) && /Dever de Sigilo Fiscal/.test(cad.textContent) && /Confira antes de entregar/.test(cad.textContent), "E4d o caderno aparece em 'Escrever e corrigir'");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
