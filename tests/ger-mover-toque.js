/* =====================================================================
 * MOVER CARTÕES COM O DEDO E PELA PRÉVIA (v18.70.0)
 *
 * Pedidos: "mover cartões entre pastas de forma mais simples em tela de
 * toque — colocar o dedo e deslizar até o local desejado, tal qual as
 * pastas do Windows" e "ao estar visualizando um cartão deve ser possível
 * movê-lo para outro tópico dali, com confirmação". O QUE PRECISA SER VERDADE:
 *  1. dedo (não mouse): segurar pega o cartão (a pílula aparece); a pasta
 *     sob o dedo acende; soltar nela PERGUNTA e move — o mesmo mover, com
 *     desfazer; soltar fora não faz nada; "não" não mexe em nada;
 *  2. cartão marcado leva os marcados;
 *  3. celular: passar sobre a aba "Pastas" abre a árvore no meio do arrasto;
 *  4. prévia: "📁 mover para…" abre a janela de destino (de onde vem, a
 *     pasta atual desligada, últimos destinos); escolher pergunta e move.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, sim) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(sim !== false); } catch (e) {} }
    return promessa;
  };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const iss = a.matChave("Trib", "ISS"), iptu = a.matChave("Trib", "IPTU");
    a.matGravarCartoes(iss, ["Qual o fato gerador do ISS? :: Serviço :: x", "", "Qual a alíquota máxima do ISS? :: Cinco por cento :: x"].join("\n"), { disciplina: "Trib", topico: "ISS" });
    a.matGravarCartoes(iptu, "Quem paga o IPTU? :: O proprietário :: y", { disciplina: "Trib", topico: "IPTU" });
    a.gerAbrir();
    a.$("gerAgrupar").value = "disciplina"; a.$("gerAgrupar").onchange();
    return { a, iss, iptu };
  };
  const linhas = (a) => achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
  const pasta = (a, re) => achar(a.$("gerArvore"), (e) => cls(e, "ger-top") && re.test(e.textContent))[0];
  const toque = (x, y, alvo) => ({ pointerType: "touch", clientX: x, clientY: y, cancelable: true, preventDefault() {}, _alvo: alvo });

  /* ---- 1: arrastar com o dedo ---- */
  {
    const { a, iss, iptu } = montar();
    const i = linhas(a).findIndex((l) => /alíquota/.test(l.textContent));
    const lin = linhas(a)[i];
    ok(typeof lin.onpointerdown === "function", "T0 a linha do cartão aceita o dedo");
    /* mouse não entra por aqui (tem o arrastar do navegador) */
    ok(a.gerToqueInicio({ pointerType: "mouse", clientX: 1, clientY: 1 }, i, lin) === false && !a.gerToqueAtual(), "T1 mouse não usa o arrastar de toque");
    lin.onpointerdown(toque(10, 10));
    const t0 = a.gerToqueAtual();
    ok(t0 && t0.ativo === true && t0.ghost && /Movendo 1 cartão/.test(t0.ghost.textContent) && /solte numa pasta/.test(t0.ghost.textContent), "T2 segurar pega o cartão: a pílula diz o que vai e o que fazer");
    ok(a.$("dlgGerCartoes").classList.contains("ger-arrastando"), "T2a a janela entra no modo arrastando (as pastas se mostram como alvo)");
    const dest = pasta(a, /IPTU/);
    a.gerToqueMover(toque(40, 40, dest));
    ok(cls(dest, "ger-alvo"), "T3 a pasta sob o dedo acende como alvo");
    const antes = JSON.stringify(a.matResumosAtual());
    await conduzir(a, a.gerToqueFim(toque(40, 40, dest)), false);
    ok(JSON.stringify(a.matResumosAtual()) === antes && !a.gerToqueAtual() && !a.$("dlgGerCartoes").classList.contains("ger-arrastando"), "T4 soltar pergunta; 'não' não mexe em nada e o arrasto acaba");
    linhas(a)[linhas(a).findIndex((l) => /alíquota/.test(l.textContent))].onpointerdown(toque(10, 10));
    a.gerToqueMover(toque(40, 40, pasta(a, /IPTU/)));
    await conduzir(a, a.gerToqueFim(toque(40, 40)));
    ok(/alíquota/.test(a.matResumosAtual()[iptu].cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes) && a.$("btnGerMsgDesfazer").hidden === false,
       "T5 'sim': o cartão vai para o IPTU, com desfazer");
    /* soltar fora de uma pasta: nada */
    const antes2 = JSON.stringify(a.matResumosAtual());
    linhas(a)[0].onpointerdown(toque(10, 10));
    a.gerToqueMover(toque(300, 300, a.$("gerLista")));
    const r = a.gerToqueFim(toque(300, 300));
    ok(r === null && JSON.stringify(a.matResumosAtual()) === antes2 && !a.gerToqueAtual(), "T6 soltar fora de uma pasta não faz nada");
  }

  /* ---- 1b (v18.71.0): o defeito do aparelho real — o arrastar NATIVO roubava o arrasto do dedo ---- */
  {
    const { a, iss, iptu } = montar();
    const i = linhas(a).findIndex((l) => /alíquota/.test(l.textContent));
    const lin = linhas(a)[i];
    ok(lin.draggable === true, "D0 premissa: com mouse o cartão é arrastável (arrastar do navegador)");
    lin.onpointerdown(toque(10, 10));
    ok(lin.draggable === false, "D1 com o dedo no cartão, o navegador não pode iniciar o arrastar nativo dele");
    let recusado = false;
    lin.ondragstart({ preventDefault() { recusado = true; }, dataTransfer: null });
    ok(recusado && a.gerToqueAtual() && a.gerToqueAtual().ativo, "D2 se o arrastar nativo começar mesmo assim, é recusado — o do dedo continua");
    /* a faixa diz para onde vai, antes de soltar */
    ok(a.$("gerArrastoInfo").hidden === false && /Leve até uma pasta/.test(a.$("gerArrastoInfo").textContent), "D3 ao pegar, a faixa pede para levar até uma pasta");
    a.gerToqueMover(toque(40, 40, pasta(a, /IPTU/)));
    ok(/Soltar em: IPTU/.test(a.$("gerArrastoInfo").textContent) && cls(a.$("gerArrastoInfo"), "ok") && /→ Soltar em: IPTU/.test(a.gerToqueAtual().ghost.textContent), "D4 sobre a pasta: 'Soltar em: IPTU' (verde), também na pílula: " + a.$("gerArrastoInfo").textContent);
    a.gerToqueMover(toque(40, 60, pasta(a, /ISS/)));
    ok(/Já está nesta pasta/.test(a.$("gerArrastoInfo").textContent) && cls(a.$("gerArrastoInfo"), "no"), "D5 sobre a própria pasta: 'Já está nesta pasta'");
    a.gerToqueMover(toque(300, 300, a.$("gerLista")));
    a.gerToqueFim(toque(300, 300));
    ok(/Nada foi movido: solte o cartão sobre uma pasta/.test(a.$("gerMsg").textContent) && a.$("gerArrastoInfo").hidden === true && lin.draggable === true,
       "D6 soltar fora avisa (não fica em silêncio), a faixa some e o cartão volta a ser arrastável pelo mouse");
    /* soltar numa disciplina (que não recebe cartão) */
    const disc = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc") && /Trib/.test(e.textContent))[0];
    linhas(a)[0].onpointerdown(toque(10, 10));
    a.gerToqueMover(toque(5, 5, disc));
    ok(/Disciplina: segure para abrir/.test(a.$("gerArrastoInfo").textContent) && cls(a.$("gerArrastoInfo"), "disc"), "D7 sobre a disciplina a faixa explica (abra e solte num tópico)");
    a.gerToqueFim(toque(5, 5));
    ok(/disciplina não recebe cartões/.test(a.$("gerMsg").textContent), "D8 soltar na disciplina avisa: " + a.$("gerMsg").textContent);
    /* o arrasto que o sistema cancelou: soltar depois avisa em vez de não fazer nada */
    linhas(a)[0].onpointerdown(toque(10, 10));
    a.gerToqueCancelar();
    const antes = JSON.stringify(a.matResumosAtual());
    await a.gerSoltarEm(pasta(a, /IPTU/));
    ok(/o arrasto foi interrompido/.test(a.$("gerMsg").textContent) && JSON.stringify(a.matResumosAtual()) === antes, "D9 soltar depois de o arrasto se perder avisa ('interrompido'), sem mexer em nada");
    /* o mouse também mostra a faixa */
    linhas(a)[i].ondragstart({ dataTransfer: null, preventDefault() {} });
    pasta(a, /IPTU/).ondragover({ preventDefault() {}, dataTransfer: null });
    ok(/Soltar em: IPTU/.test(a.$("gerArrastoInfo").textContent), "D10 com mouse, a faixa também diz para onde vai");
    await conduzir(a, pasta(a, /IPTU/).ondrop({ preventDefault() {}, dataTransfer: null }));
    ok(/alíquota/.test(a.matResumosAtual()[iptu].cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes), "D11 e soltar move (mouse)");
  }

  /* a cor da pasta-alvo: a regra precisa vencer "#gerArvore .ger-top" (antes só sobrava um contorno fino) */
  {
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/#gerArvore .ger-pasta.ger-alvo{background:#1f8f4e;color:#fff/.test(html) && /.ger-arrasto-info.ok{background:#1f8f4e/.test(html), "D12 pasta-alvo verde cheio (com o #gerArvore para vencer a cor do nível) e a faixa verde");
  }

  /* ---- 2: o marcado leva os marcados ---- */
  {
    const { a, iss, iptu } = montar();
    const cks = achar(a.$("gerLista"), (e) => e.tag === "input");
    cks.forEach((c) => { c.checked = true; c.onchange(); });
    const issLinhas = linhas(a).map((l, k) => [l, k]).filter(([l]) => /ISS/.test(l.textContent));
    issLinhas[0][0].onpointerdown(toque(10, 10));
    ok(/Movendo 3 cartões|3 cart/.test(a.gerToqueAtual().ghost.textContent), "M1 segurar um cartão marcado leva TODOS os marcados: " + a.gerToqueAtual().ghost.textContent);
    a.gerToqueCancelar();
    ok(!a.gerToqueAtual() && !a.$("dlgGerCartoes").classList.contains("ger-arrastando"), "M2 cancelar (o sistema tirou o toque) desfaz o arrasto");
    /* (v18.72.0) no celular, "Mover para…" dos marcados abre a janela grande; na tela larga, o seletor de sempre */
    a.$("btnGerMover").onclick();
    ok(a.$("gerPop").hidden === false && a.$("dlgGerDestino").open !== true, "M3 tela larga: 'Mover para…' abre o seletor de sempre");
    a.$("btnGerMover").onclick();
    a.gerCelularForcar(true);
    a.$("btnGerMover").onclick();
    ok(a.$("dlgGerDestino").open === true && /Mover 3 cartões para/.test(a.$("gerDestTit").textContent), "M4 celular: abre a janela grande com os marcados: " + a.$("gerDestTit").textContent);
    a.$("btnGerDestFechar").onclick();
    a.gerCelularForcar(null);
    void iss; void iptu;
  }

  /* ---- 3: celular — a aba "Pastas" abre a árvore no meio do arrasto ---- */
  {
    const { a } = montar();
    a.gerCelularForcar(true);
    a.gerVista("cartoes");
    ok(a.gerVistaAtualLer() === "cartoes", "C0 premissa: na aba dos cartões");
    linhas(a)[0].onpointerdown(toque(10, 10));
    ok(/passe sobre “Pastas”/.test(a.gerToqueAtual().ghost.textContent), "C1 no celular a pílula diz para passar sobre 'Pastas'");
    a.gerToqueMover(toque(20, 5, a.$("btnGerAbaPastas")));
    ok(a.gerVistaAtualLer() === "pastas", "C2 passar o dedo sobre a aba 'Pastas' abre a árvore");
    a.gerToqueCancelar();
    a.gerCelularForcar(null);
  }

  /* ---- 4: mover pela prévia ---- */
  {
    const { a, iss, iptu } = montar();
    const i = linhas(a).findIndex((l) => /alíquota/.test(l.textContent));
    a.$("btnGerModoExportar").onclick();
    ok(a.$("btnGerPrevMover").disabled === true, "P0 no 'Montar pacote' (nada se move de verdade) o botão fica desligado");
    a.$("btnGerModoGerenciar").onclick();
    linhas(a)[i].onclick();
    ok(a.$("btnGerPrevMover").disabled === false, "P0a com o cartão na prévia, o botão liga");
    a.$("btnGerPrevMover").onclick();
    ok(a.$("dlgGerDestino").open === true && a.$("gerDestTit").textContent === "Mover este cartão para…" && /Está em: Trib › ISS/.test(a.$("gerDestDe").textContent), "P1 abre a janela de destino: " + a.$("gerDestDe").textContent);
    const itens = () => achar(a.$("gerDestLista"), (e) => cls(e, "ger-dest-item"));
    const aqui = itens().find((b) => /ISS/.test(b.textContent));
    ok(aqui && aqui.disabled === true && /está aqui/.test(aqui.textContent), "P2 a pasta onde o cartão já está aparece desligada ('está aqui')");
    a.$("gerDestBusca").value = "iptu"; a.$("gerDestBusca").oninput();
    ok(itens().length === 1 && /IPTU/.test(itens()[0].textContent), "P3 a busca filtra as pastas");
    const antes = JSON.stringify(a.matResumosAtual());
    await conduzir(a, itens()[0].onclick(), false);
    ok(JSON.stringify(a.matResumosAtual()) === antes && a.$("dlgGerDestino").open !== true, "P4 escolher pergunta; 'não' não move nada (e a janela fecha)");
    linhas(a)[linhas(a).findIndex((l) => /alíquota/.test(l.textContent))].onclick();
    a.$("btnGerPrevMover").onclick();
    ok(/Últimos destinos/.test(a.$("gerDestLista").textContent) && /IPTU/.test(a.$("gerDestRec_0").textContent), "P5 o destino escolhido aparece em 'Últimos destinos'");
    await conduzir(a, a.$("gerDestRec_0").onclick());
    ok(/alíquota/.test(a.matResumosAtual()[iptu].cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes) && a.$("btnGerMsgDesfazer").hidden === false, "P6 'sim': o cartão vai para o IPTU, com desfazer");
  }

  /* textos */
  {
    const { api } = rodar();
    ["ger_prev_mover", "ger_tip_prev_mover", "ger_dest_tit_1", "ger_dest_tit", "ger_dest_de", "ger_dest_varias", "ger_dest_aqui", "ger_dest_recentes", "ger_dest_todas", "ger_toque_dica", "ger_toque_dica_cel"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
