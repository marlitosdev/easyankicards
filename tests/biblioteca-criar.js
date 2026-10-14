/* =====================================================================
 * CRIAR CARTÕES SEM SAIR DA BIBLIOTECA (v18.37.0)
 *
 * O relato, com print: criar cartões de um tópico a partir da Biblioteca
 * levava à bancada; a Biblioteca fechava e a pessoa se perdia ("não sabe
 * mais onde parou"). A escolha do usuário: B1 + B2.
 *  B1: na pasta do tópico, "＋ criar cartões" abre um painel ali mesmo —
 *      copiar o pedido (o mesmo da bancada), colar a resposta, conferir na
 *      prévia (os que o tópico já tem vêm desmarcados) e guardar, com
 *      desfazer. Os novos aparecem MARCADOS na lista.
 *  B2: quem vai à bancada a partir da Biblioteca tem "↩ Voltar à
 *      Biblioteca" (na caixa do tópico e depois de salvar).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const tique = () => new Promise((r) => setImmediate(r));

  const montar = () => {
    const a = rodar().api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const iss = a.matChave("Trib", "ISS"), iptu = a.matChave("Trib", "IPTU");
    a.matGravarCartoes(iss, "Qual o fato gerador do ISS? :: A prestação de serviço da lista anexa :: x", { disciplina: "Trib", topico: "ISS" });
    a.matGravarCartoes(iptu, "Quem paga o IPTU? :: O proprietário :: y", { disciplina: "Trib", topico: "IPTU" });
    return { a, iss, iptu };
  };
  const RESPOSTA = [
    "Qual a alíquota máxima do ISS? :: 5%, pela LC 116/2003, art. 8º, II :: x",
    "Qual o fato gerador do ISS? :: A prestação de serviço da lista anexa :: x",
    "O ISS incide sobre exportação de serviços? :: Não, art. 2º, I, da LC 116 :: x",
  ].join("\n");

  /* BC1: os lugares no HTML */
  {
    const iCol = HTML.indexOf('class="ger-col ger-col-cartoes"'), iF = HTML.indexOf('class="ger-ferr"', iCol);
    const ferr = HTML.slice(iF, HTML.indexOf("</div>", iF));
    ok(ferr.indexOf('id="btnGerCriar"') >= 0, "BC1 o botão '＋ criar cartões' devia estar nas ferramentas dos cartões");
    ok(HTML.indexOf('id="gerCriarBox"') > 0 && HTML.indexOf('id="gerCriarBox"') < HTML.indexOf('id="gerLista"'), "BC1a o painel de criar devia ficar acima da lista");
    const box = HTML.slice(HTML.indexOf('id="bancAlvoBox"'), HTML.indexOf('id="btnBancAlvoSair"'));
    ok(box.indexOf('id="btnBancAlvoVoltar"') >= 0, "BC1b a caixa do tópico na bancada não tem o 'voltar à Biblioteca'");
    ["btnGerCriar", "gerCriarBox", "btnGerCriarGuardar", "btnBancAlvoVoltar"].forEach((id) => ok(HTML.split('id="' + id + '"').length === 2, "BC1c o id " + id + " aparece mais de uma vez"));
    ok(HTML.indexOf(".ger-criar-item") > 0 && HTML.indexOf(".ger-criar-item.rep") > 0, "BC1d o painel de criar não tem CSS");
  }

  /* BC2: o botão só existe numa pasta de TÓPICO, no modo de gerenciar */
  {
    const { a } = montar();
    a.gerAbrir();
    ok(a.$("btnGerCriar").hidden === true && !a.gerCriarInfo(), "BC2 sem pasta escolhida o botão aparece");
    a.gerAbrirNoTopico("Trib", "ISS");
    ok(a.$("btnGerCriar").hidden === false && a.gerCriarInfo() && a.gerCriarInfo().topico === "ISS", "BC2a na pasta ISS o botão não aparece");
    a.gerAlternarModo("exportar");
    ok(a.$("btnGerCriar").hidden === true, "BC2b no modo 'Montar pacote' o botão aparece");
  }
  {
    const { a } = montar();
    a.$("editor").value = "Cartão da bancada? :: Resposta da bancada";
    a.gerAbrir();
    const banc = achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => e.textContent.indexOf("Texto do editor") === 0);
    ok(!!banc, "BC2c a Bancada devia aparecer na árvore");
    if (banc) banc.onclick();
    ok(a.gerPastaAtual() && a.$("btnGerCriar").hidden === true && !a.gerCriarInfo(), "BC2d na pasta da Bancada não há 'criar cartões' (ela não é um tópico)");
  }

  /* BC3-BC9: o caminho inteiro dentro da Biblioteca */
  {
    const { a, iss } = montar();
    a.gerAbrirNoTopico("Trib", "ISS");
    a.$("btnGerCriar").onclick();
    ok(a.$("gerCriarBox").hidden === false && /ISS/.test(a.$("gerCriarTit").textContent), "BC3 abrir mostra o painel com o nome do tópico: " + a.$("gerCriarTit").textContent);
    ok(a.$("gerCriarTipo").children.length === a.PC_TIPOS.length && a.$("gerCriarQtd").children.length === a.PC_QTDS.length, "BC3a tipo e quantidade vêm das mesmas listas da bancada");
    ok(a.$("dlgGerCartoes").open === true && !a.bancAlvoAtual(), "BC3b abrir o painel não sai da Biblioteca nem aponta a bancada");
    ok(a.$("btnGerCriarGuardar").hidden === true && /RESPOSTA/.test(a.$("gerCriarSem").textContent), "BC3c sem resposta colada não há o que guardar e o semáforo pede só a resposta: " + a.$("gerCriarSem").textContent);

    /* BC4: o pedido é o MESMO da bancada, com o tipo escolhido */
    a.$("gerCriarTipo").value = "certo_errado";
    a.$("btnGerCriarPedido").onclick();
    const p = a.$("gerCriarPedidoTxt").value;
    ok(p && p === a.bancAlvoTextoPrompt({ disciplina: "Trib", topico: "ISS", chave: iss }), "BC4 o pedido devia ser o mesmo da bancada");
    ok(/Qual o fato gerador do ISS\?/.test(p), "BC4a o pedido leva os cartões que o tópico já tem (para a IA não repetir)");
    ok(a.pcEscolhaLer().tipo === "certo_errado", "BC4b o tipo escolhido no painel fica guardado (é o que o pedido usa): " + JSON.stringify(a.pcEscolhaLer()));
    ok(a.$("gerCriarPedidoTxt").hidden === false && a.$("gerCriarPedidoMsg").textContent.length > 10, "BC4c o pedido fica visível (para copiar à mão se a cópia falhar)");

    /* BC5: o semáforo — o pedido colado no lugar da resposta; texto sem cartão */
    a.$("gerCriarResp").value = p; a.$("gerCriarResp").oninput();
    ok(/PEDIDO/.test(a.$("gerCriarSem").textContent) && cls(a.$("gerCriarSem"), "erro") && a.$("btnGerCriarGuardar").hidden === true, "BC5 colar o pedido no lugar da resposta é avisado e não deixa guardar: " + a.$("gerCriarSem").textContent);
    a.$("gerCriarResp").value = "só um texto qualquer, sem cartão nenhum"; a.$("gerCriarResp").oninput();
    ok(cls(a.$("gerCriarSem"), "erro") && a.$("btnGerCriarGuardar").hidden === true, "BC5a texto sem cartão é avisado: " + a.$("gerCriarSem").textContent);

    /* BC6: a resposta: 3 lidos, 1 que o tópico já tem vem desmarcado e avisado */
    a.$("gerCriarResp").value = RESPOSTA; a.$("gerCriarResp").oninput();
    const itens = achar(a.$("gerCriarPrevia"), (e) => cls(e, "ger-criar-item"));
    ok(itens.length === 3 && /3 cartões lidos · 1 já/.test(a.$("gerCriarSem").textContent) && cls(a.$("gerCriarSem"), "ok"), "BC6 a prévia mostra os 3 lidos e conta o repetido: " + a.$("gerCriarSem").textContent);
    const ck = (i) => a.$("gerCriarCk_" + i);
    ok(ck(0).checked && !ck(1).checked && ck(2).checked && cls(itens[1], "rep") && /já existe/.test(itens[1].textContent), "BC6a o que o tópico já tem vem desmarcado, apagado e com 'já existe'");
    ok(/Guardar 2/.test(a.$("btnGerCriarGuardar").textContent) && a.$("btnGerCriarGuardar").disabled === false, "BC6b o botão diz quantos vão: " + a.$("btnGerCriarGuardar").textContent);

    /* BC7: desmarcar muda a conta; nenhum marcado não guarda */
    ck(2).checked = false; ck(2).onchange();
    ok(/Guardar 1/.test(a.$("btnGerCriarGuardar").textContent), "BC7 desmarcar tira da conta: " + a.$("btnGerCriarGuardar").textContent);
    ck(0).checked = false; ck(0).onchange();
    ok(a.$("btnGerCriarGuardar").disabled === true && a.gerCriarGuardar() === null, "BC7a sem nenhum marcado não guarda nada");
    ck(0).checked = true; ck(0).onchange(); ck(2).checked = true; ck(2).onchange();

    /* BC8: guardar — no tópico, sem duplicar, sem sair, com os novos MARCADOS na lista */
    const antes = a.matResumosAtual()[iss].cartoes;
    a.$("btnGerCriarGuardar").onclick();
    const depois = a.matResumosAtual()[iss].cartoes;
    ok(/alíquota máxima/.test(depois) && /exportação de serviços/.test(depois) && (depois.match(/fato gerador do ISS/g) || []).length === 1, "BC8 guardou os 2 novos sem duplicar o que já havia: " + depois.replace(/\n/g, " | "));
    ok(a.$("dlgGerCartoes").open === true && a.modoAtual !== "cartoes-alvo" && !a.bancAlvoAtual(), "BC8a guardar não sai da Biblioteca");
    const vis = a.gerVisAtual().map((i) => a.gerNotasAtual()[i]);
    ok(vis.length === 3, "BC8b a lista da pasta já mostra os 3 cartões: " + vis.length);
    const marcados = [...a.gerSelAtual()].map((pos) => vis[pos].card.front);
    ok(marcados.length === 2 && marcados.every((f) => /alíquota|exportação/.test(f)), "BC8c os novos ficam MARCADOS na lista (prontos para Melhorar/Estudar): " + JSON.stringify(marcados));
    ok(/2 cartões guardados/.test(a.$("gerCriarFeito").textContent) && a.$("btnGerCriarDesfazer").hidden === false, "BC8d diz o que guardou e oferece desfazer: " + a.$("gerCriarFeito").textContent);
    ok(a.$("gerCriarResp").value === "" && a.$("btnGerCriarGuardar").hidden === true, "BC8e a caixa fica limpa (não dá para guardar duas vezes)");
    const rec = JSON.parse(a.lojaLer("eac_cm_recibo") || "null");
    ok(rec && rec.novos === 2 && rec.repetidos === 0, "BC8f o recibo do desfazer foi guardado: " + JSON.stringify(rec && { n: rec.novos, r: rec.repetidos }));

    /* BC9: desfazer devolve o tópico ao que era */
    const desf = a.gerCriarDesfazer();
    for (let i = 0; i < 6; i++) { await tique(); try { a.uiModalResponder(true); } catch (e) {} }
    await desf;
    ok(a.matResumosAtual()[iss].cartoes.trim() === antes.trim(), "BC9 desfazer tirou os cartões guardados: " + a.matResumosAtual()[iss].cartoes.replace(/\n/g, " | "));
    ok(a.$("btnGerCriarDesfazer").hidden === true && a.gerVisAtual().length === 1, "BC9a e a lista volta a ter só o que havia");

    /* BC10: trocar de pasta fecha o painel (ele era de outro tópico) */
    a.gerAbrirNoTopico("Trib", "IPTU");
    ok(a.$("gerCriarBox").hidden === true && !a.gerCriarAtual(), "BC10 trocar de pasta fecha o painel do outro tópico");
    a.$("btnGerCriar").onclick();
    ok(a.gerCriarAtual() && a.gerCriarAtual().topico === "IPTU", "BC10a reabrir na nova pasta é deste tópico");
    a.$("btnGerCriarX").onclick();
    ok(a.$("gerCriarBox").hidden === true && !a.gerCriarAtual(), "BC10b o ✖ fecha o painel");
  }

  /* BC11-BC13: ir à bancada e VOLTAR (B2) */
  {
    const { a, iss } = montar();
    a.gerAbrirNoTopico("Trib", "ISS");
    a.$("btnGerCriar").onclick();
    a.$("gerCriarResp").value = RESPOSTA; a.$("gerCriarResp").oninput();
    a.$("btnGerCriarBancada").onclick();
    ok(a.$("dlgGerCartoes").open === false && a.bancAlvoAtual() && a.bancAlvoAtual().topico === "ISS" && a.bancAlvoAtual().volta === "biblioteca", "BC11 'ferramentas completas' leva à bancada lembrando que veio da Biblioteca: " + JSON.stringify(a.bancAlvoAtual()));
    ok(/alíquota máxima/.test(a.$("editor").value), "BC11a a resposta colada vai junto para a bancada");
    ok(a.$("btnBancAlvoVoltar").hidden === false, "BC11b a bancada mostra '↩ Voltar à Biblioteca'");
    /* salvar no tópico oferece voltar à Biblioteca como primeira opção */
    const salvando = a.bancAlvoSalvar();
    await tique(); a.uiModalResponder(true);
    await tique();
    const ops = [a.$("uiModalOk"), a.$("uiModalCancel"), a.$("uiModalTerceiro")].map((b) => b && b.textContent);
    ok(/Voltar à Biblioteca/.test(ops[0] || ""), "BC12 depois de salvar, a primeira opção é voltar à Biblioteca: " + JSON.stringify(ops));
    a.uiModalResponder("biblioteca");
    await salvando;
    ok(a.$("dlgGerCartoes").open === true && a.gerPastaAtual() && a.gerPastaAtual().chave === iss, "BC12a escolher 'voltar' reabre a Biblioteca na pasta do tópico: " + JSON.stringify(a.gerPastaAtual()));
    ok(a.gerVisAtual().length === 3, "BC12b e lá os cartões salvos já aparecem: " + a.gerVisAtual().length);
    /* o botão da caixa também volta */
    a.$("dlgGerCartoes").close();
    a.$("btnBancAlvoVoltar").onclick();
    ok(a.$("dlgGerCartoes").open === true && a.gerPastaAtual().chave === iss, "BC12c o botão da caixa também volta à pasta");
  }
  {
    /* BC11c: o texto de EXEMPLO da bancada é trocado (senão iria para o tópico junto); texto da pessoa é preservado */
    const { a } = montar();
    a.$("editor").value = a.t("example");
    a.gerAbrirNoTopico("Trib", "ISS");
    a.$("btnGerCriar").onclick();
    a.$("gerCriarResp").value = RESPOSTA; a.$("gerCriarResp").oninput();
    a.$("btnGerCriarBancada").onclick();
    ok(a.$("editor").value.indexOf(a.t("example").trim().split("\n")[0]) < 0 && /alíquota máxima/.test(a.$("editor").value), "BC11c o exemplo da bancada devia ser trocado pela resposta: " + a.$("editor").value.slice(0, 80));
    a.$("editor").value = "Meu cartão? :: Minha resposta";
    a.gerAbrirNoTopico("Trib", "ISS");
    a.$("btnGerCriar").onclick();
    a.$("gerCriarResp").value = RESPOSTA; a.$("gerCriarResp").oninput();
    a.$("btnGerCriarBancada").onclick();
    ok(/^Meu cartão\? :: Minha resposta\n\n/.test(a.$("editor").value) && /alíquota máxima/.test(a.$("editor").value), "BC11d o texto da pessoa na bancada fica, e a resposta vai depois: " + a.$("editor").value.slice(0, 80));
  }
  {
    const { a } = montar();
    a.bancAlvoDefinir("Trib", "ISS");
    ok(a.bancAlvoAtual().volta === "" && a.$("btnBancAlvoVoltar").hidden === true, "BC13 vindo de fora da Biblioteca, a bancada não oferece voltar a ela");
    const salvando = (a.$("editor").value = "Pergunta nova BC13? :: resposta BC13 :: x", a.bancAlvoSalvar());
    await tique(); a.uiModalResponder(true);
    await tique();
    const ops = [a.$("uiModalOk"), a.$("uiModalCancel"), a.$("uiModalTerceiro")].map((b) => b && !b.hidden && b.style.display !== "none" ? b.textContent : "");
    ok(!ops.some((s) => /Biblioteca/.test(s || "")), "BC13a sem ter vindo da Biblioteca, salvar não oferece voltar a ela: " + JSON.stringify(ops));
    a.uiModalResponder("ok");
    await salvando;
  }

  /* BC14: os textos novos existem nos dois idiomas */
  {
    const { a } = montar();
    const chaves = ["ger_criar_btn", "ger_criar_tit", "ger_criar_p1", "ger_criar_p2", "ger_criar_copiar", "ger_criar_bancada", "ger_criar_sem_ok", "ger_criar_guardar", "ger_criar_feito", "banc_alvo_voltar", "banc_alvo_tip_voltar", "ger_tip_criar"];
    ["pt", "en"].forEach((l) => { a.setLanguage(l); chaves.forEach((k) => ok(a.t(k) && a.t(k) !== k, "BC14 falta " + k + " em " + l)); });
    a.setLanguage("pt");
  }

  return falhas;
}

module.exports = { testes };
