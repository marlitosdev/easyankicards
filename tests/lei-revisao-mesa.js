/* =====================================================================
 * A MESA DE REVISÃO da atualização por lei que altera (19.35.0)
 *
 * A tela de decisão mostrava, para cada artigo, três cópias do texto
 * inteiro (como está, como ficaria e a caixa editável), um alerta por
 * dispositivo (14 caixas iguais no art. 273-A do CTM de Caruaru) e tratava
 * como "precisa de atenção" o artigo em que a lei já tinha sido aplicada
 * (16 dos 38 itens da LC 95/2022 eram isso).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O que muda é mostrado DISPOSITIVO A DISPOSITIVO (só o que difere), com
 *     a frase do item dizendo o que a alteração faz ("nova redação: II").
 *  2. A nota de vigência "(Redação dada por…)" sozinha não conta como mudança.
 *  3. O item já aplicado vai para o grupo "já aplicadas", não conta como
 *     "precisa de atenção" e se dispensa de uma vez (não entra na gravação).
 *  4. Alertas iguais se juntam numa linha com os dispositivos listados.
 *  5. A lista lateral é agrupada; a tela abre no primeiro que precisa de você.
 *  6. Tela cheia com botão no cabeçalho, lembrada entre aberturas.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const BASE = [
  "Art. 96. Correção do parcelamento:",
  "I - pagamento em parcelas;",
  "II - a atualização monetária será calculada pela taxa Selic;",
  "III - juros de mora de 1%.",
  "Art. 100. Os pagamentos:",
  "I - dinheiro;",
  "II - cheque;",
  "III - depósito.",
  "Art. 106. A multa de mora será reduzida em até 10%.",
  "Art. 300. Outro artigo.",
].join("\n");

const LC95 = ["LEI COMPLEMENTAR Nº 95, DE 28 DE SETEMBRO DE 2022.", "Altera Lei Complementar nº 015, 05 de janeiro de 2009, e dá outras providências.",
  "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações:",
  "\"Art. 96. [ ... ]",
  "II a atualização monetária sobre o saldo devedor será calculada com base na variação do IPCA; (NR)",
  "Art. 100. [ ... ]",
  "IV cartão magnético. (AC)",
  "Art. 106. A multa de mora será reduzida em até 25% (vinte e cinco por cento) se o sujeito passivo recolher, em pagamento único, a totalidade. (NR)",
  "Art. 2º Esta Lei entra em vigor na data de sua publicação."].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const abrirLC95 = (api, id) => {
    api.leiAbrir("Direito", "T", id);
    api.leiAtualizarAbrir();
    api.$("leiUpdModoAlt").checked = true;
    api.$("leiUpdModoAlt").onchange();
    api.$("leiUpdFonte").value = "LC 95/2022";
    api.$("leiUpdTexto").value = LC95;
    api.leiAtualizarComparar();
    return api.leiUpdComparoAtual();
  };

  /* ---- 1 e 2: a diferença por dispositivo ---- */
  {
    const p = iniciar();
    const d = p.leiUpdDispositivosDif(
      "Art. 96. Correção:\nI - parcelas;\nII - pela taxa Selic;\nIII - juros.",
      "Art. 96. Correção:\nI - parcelas;\nII - pela variação do IPCA; (Redação dada por LC 95/2022)\nIII - juros. (Redação dada por LC 95/2022)\nIV - multa. (Incluído por LC 95/2022)");
    ok(d && d.mudou.length === 2, "M1 so os dispositivos que diferem (II mudou, IV entrou): " + JSON.stringify(d && d.mudou.map((x) => x.rotulo + ":" + x.tipo)));
    ok(d.mudou[0].tipo === "mudou" && /^II/.test(d.mudou[0].rotulo) && d.mudou[1].tipo === "entrou" && /^IV/.test(d.mudou[1].rotulo), "M1a o II e' nova redacao, o IV e' acrescentado");
    ok(d.iguais === 2 && d.soNota === 1, "M2 caput e I iguais; o III so' ganhou a nota de vigencia: " + d.iguais + "/" + d.soNota);
    const r = p.leiUpdDispositivosDif("Art. 5. Caput.\n§ 1º Pedidos.\n§ 2º Prazo.", "Art. 5. Caput.\n§ 1º Pedidos.\n§ 2º (Revogado pela LC 95/2022)");
    ok(r.mudou.length === 1 && r.mudou[0].tipo === "revogado", "M2a o paragrafo revogado aparece como revogado: " + JSON.stringify(r.mudou));
    const fr = p.leiUpdResumoItem({ tipo: "mudou", alertas: [] }, d);
    ok(/nova redação: II/.test(fr) && /acrescenta IV/.test(fr), "M2b a frase do item diz o que a alteracao faz: " + fr);
  }

  /* ---- 4: alertas juntados ---- */
  {
    const p = iniciar();
    const al = p.leiUpdAlertasJuntos({ alertas: [{ k: "parcial", sev: "info" }, { k: "ja_existia", sev: "alerta", u: "§ 1º" },
      { k: "ja_existia", sev: "alerta", u: "§ 2º" }, { k: "ja_existia", sev: "alerta", u: "§ 1º" }, { k: "fora_ordem", sev: "alerta", d1: "a", d2: "b" }] });
    ok(al.length === 2 && al[0].k === "ja_existia" && al[0].u === "§ 1º, § 2º" && al[1].k === "fora_ordem",
      "A1 um alerta por tipo, com os dispositivos listados uma vez; o 'parcial' nao aparece: " + JSON.stringify(al.map((a) => a.k + ":" + a.u)));
  }

  /* ---- 1, 5 e 6: o fluxo na tela ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ id: "lei_mesa", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE });
    const itens = abrirLC95(api, l.id);
    ok(itens.length === 3, "F1 tres artigos-alvo (96, 100, 106): " + itens.map((x) => x.num));
    ok(api.$("leiUpdModoCx").hidden === true && api.$("leiUpdIntro").hidden === true, "F2 no passo 2 o topo nao repete a escolha do modo nem a introducao");
    const i96 = itens.findIndex((x) => x.num === "96");
    api.leiUpdIrPara(i96);
    ok(/nova redação: II/.test(api.$("leiUpdAtualInfo").textContent), "F3 a faixa diz o que muda no art. 96: " + api.$("leiUpdAtualInfo").textContent);
    const linhas = api.$("leiUpdItem").querySelectorAll(".lei-upd-muda-lin");
    ok(linhas.length === 1 && /IPCA/.test(linhas[0].textContent) && /Selic/.test(linhas[0].textContent), "F4 so' o inciso II aparece, com antes e depois: " + linhas.map((x) => x.textContent).join(" | "));
    ok(linhas[0].querySelectorAll(".lei-upd-entra").length > 0 && linhas[0].querySelectorAll(".lei-upd-sai").length > 0, "F4a o que entra e o que sai vem marcado");
    const det = api.$("leiUpdItem").querySelectorAll(".lei-upd-inteiro")[0];
    ok(det && det.open !== true && (det.querySelectorAll ? det.querySelectorAll(".lei-upd-lado").length === 1 : true), "F5 o artigo inteiro fica recolhido, com um lado so' (a caixa editavel faz as vezes do 'como ficaria')");
    ok(api.$("leiUpdVisao").querySelectorAll(".lei-upd-grp").length >= 1, "F6 a lista lateral tem grupos");
    ok(api.$("leiUpdBarra") && typeof api.$("leiUpdBarra").title === "string" && /sem decisão/.test(api.$("leiUpdBarra").title), "F7 a barra do andamento diz o que falta: " + (api.$("leiUpdBarra") && api.$("leiUpdBarra").title));

    /* aceita tudo e grava: a LC 95 entra na lei */
    itens.forEach((it, i) => { api.leiUpdIrPara(i); api.leiUpdAceitar(); });
    api.leiAtualizarAplicar();

    /* ---- 3: a mesma lei de novo — tudo já aplicado ---- */
    const de2 = abrirLC95(api, l.id);
    ok(de2.length === 3 && de2.every((x) => api.leiUpdJaAplicada(x)), "J1 aplicada de novo, os 3 itens sao 'ja aplicada': " + de2.map((x) => x.num + ":" + (x.alertas || []).map((a) => a.k)));
    ok(de2.every((x) => api.leiUpdGrupo(x) === "ja"), "J2 todos no grupo 'ja aplicadas'");
    ok(!/precisam de atenção/.test(api.$("leiUpdSegurosTxt").textContent) || /^0 |· 0 precisam/.test(api.$("leiUpdSegurosTxt").textContent),
      "J3 nenhum conta como 'precisa de atencao': " + api.$("leiUpdSegurosTxt").textContent);
    ok(api.$("btnLeiUpdDispensarJa").hidden === false && /3/.test(api.$("btnLeiUpdDispensarJa").textContent), "J4 o botao 'dispensar as 3 ja aplicadas' aparece");
    ok(/nada muda/.test(api.$("leiUpdAtualInfo").textContent), "J5 a faixa diz que nada muda: " + api.$("leiUpdAtualInfo").textContent);
    api.$("btnLeiUpdDispensarJa").onclick();
    ok(api.leiUpdComparoAtual().every((x) => x.recusado && x.jaAplicada && !x.aceito), "J6 dispensadas: recusadas, com o selo 'ja aplicada'");
    ok(api.$("btnLeiUpdDispensarJa").hidden === true, "J7 o botao some depois de usado");
  }

  /* ---- 6: tela cheia lembrada ---- */
  {
    const api = iniciar();
    const l = api.leiGuardar({ id: "lei_cheia", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: BASE });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    ok(api.$("dlgLeiAtualizar").classList.contains("lei-upd-cheia") && /Janela/.test(api.$("btnLeiUpdCheia").textContent), "C1 abre em tela cheia de saida, com o botao para voltar a janela: " + api.$("btnLeiUpdCheia").textContent);
    api.$("btnLeiUpdCheia").onclick();
    ok(!api.$("dlgLeiAtualizar").classList.contains("lei-upd-cheia") && /Tela cheia/.test(api.$("btnLeiUpdCheia").textContent), "C2 o botao volta para a janela");
    ok(api.leiUpdCheiaPreferida() === false, "C3 a escolha fica lembrada");
    api.$("dlgLeiAtualizar").close();
    api.leiAtualizarAbrir();
    ok(!api.$("dlgLeiAtualizar").classList.contains("lei-upd-cheia"), "C4 reaberta, a janela vem como foi deixada");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
