/* =====================================================================
 * MOVER A QUESTÃO PARA OUTRO TÓPICO (v18.56.0)
 *
 * O pedido: "criar forma de mover a questão para outro tópico, caso o
 * usuário ache que está no tópico errado". No ⋮ da questão (na resolução
 * e na lista): a janela com os tópicos dos editais (busca), o ramo do
 * destino quando houver, "Mover" — e "desfazer mover" no mesmo ⋮.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const ED = ["# ISS | prova: 2027-06-01", "@ Tributário :: 5", "+ Obrigação tributária :: 5", "+ Crédito tributário :: 3",
    "++ Lançamento :: 4", "++ Suspensão :: 3", "@ Financeiro :: 3", "+ Receita pública :: 3"].join("\n");
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    api.edCriar("ISS Caruaru", ED);
    const ch = api.matChave("Tributário", "Obrigação tributária");
    api.qsAplicar(api.qsLerResposta([
      "[QUESTAO] ENUNCIADO: O lançamento é ato privativo da autoridade administrativa. GABARITO: C COMENTARIO: art. 142 do CTN.",
      "[QUESTAO] ENUNCIADO: Outra questão. GABARITO: E COMENTARIO: c.",
    ].join("\n"), { disciplina: "Tributário", topico: "Obrigação tributária", chave: ch, concurso: "ISS Caruaru" }).achados);
    return { api, ch };
  };

  /* ---- motor ---- */
  {
    const { api, ch } = montar();
    const q = api.qsFiltrar({ chave: ch })[0];
    q.tentativas = [{ q: "2026-10-01T10:00:00Z", resp: "C", acertou: true }];
    api.qsLigarRamo([q.id], "ramo_velho", "Ramo velho");
    const rec = api.qsMover([q.id], { disciplina: "Tributário", topico: "Crédito tributário", concurso: "ISS Caruaru", ramo: "lancamento", ramoNome: "Lançamento" });
    const q2 = api.qsTodas().find((x) => x.id === q.id);
    ok(rec.length === 1 && q2.topico === "Crédito tributário" && q2.chave === api.matChave("Tributário", "Crédito tributário") && q2.ramo === "lancamento" && q2.ramoNome === "Lançamento",
       "M1 mover troca tópico, chave e o ramo: " + JSON.stringify([q2.topico, q2.chave, q2.ramo]));
    ok(q2.tentativas.length === 1 && /Obrigação tributária/.test((q2.movida || {}).de || ""), "M1a o histórico vai junto e a questão lembra de onde veio");
    ok(api.qsFiltrar({ chave: ch }).length === 1 && api.qsFiltrar({ chave: q2.chave }).length === 1, "M1b ela sai da contagem do tópico velho e entra na do novo");
    ok(api.qsMover([q.id], { disciplina: "Tributário", topico: "Crédito tributário", ramo: "lancamento" }).length === 0, "M2 mover para onde já está não faz nada (recibo vazio)");
    api.qsDesfazerMover(rec);
    const q3 = api.qsTodas().find((x) => x.id === q.id);
    ok(q3.topico === "Obrigação tributária" && q3.chave === ch && q3.ramo === "ramo_velho" && q3.ramoNome === "Ramo velho" && q3.movida === undefined,
       "M3 desfazer devolve tudo como era (inclusive o ramo velho, e sem a marca de movida)");
    const rec2 = api.qsMover([q.id], { disciplina: "Financeiro", topico: "Receita pública" });
    const q4 = api.qsTodas().find((x) => x.id === q.id);
    ok(rec2.length === 1 && q4.ramo === undefined && q4.ramoNome === undefined && q4.concurso === "ISS Caruaru", "M4 sem ramo no destino, o ramo velho sai (não vale no tópico novo); sem concurso no destino, fica o que era");
    ok(api.qsMover([q.id], { disciplina: "", topico: "x" }).length === 0, "M5 destino sem disciplina ou tópico: nada");
  }

  /* ---- a janela ---- */
  {
    const { api, ch } = montar();
    const q = api.qsFiltrar({ chave: ch })[0];
    let voltou = 0;
    /* outro edital com o MESMO tópico: aparece uma vez só (é a mesma chave) */
    api.edCriar("SEFAZ", "# SEFAZ\n@ Tributário :: 5\n+ Obrigação tributária :: 5");
    api.qsUiMoverAbrir(q, () => { voltou++; });
    ok(api.$("dlgQsMover").open === true && /Está em: Tributário › Obrigação tributária/.test(api.$("qsMoverAtual").textContent), "J1 a janela abre dizendo onde a questão está");
    const ops = () => (api.$("qsMoverLista").children || []).filter((b) => /qs-mover-op/.test(b.className || ""));
    ok(ops().length === 3 && ops().some((b) => /Obrigação tributária \(está aqui\)/.test(b.textContent)), "J2 lista os tópicos dos editais e marca o atual: " + ops().map((b) => b.textContent).join(" | "));
    ok((api.$("qsMoverLista").children || []).some((x) => /qs-mover-disc/.test(x.className || "") && /Financeiro · ISS Caruaru/.test(x.textContent)), "J2a agrupa por disciplina, com o edital");
    ok(api.$("btnQsMoverOk").disabled === true, "J3 sem destino escolhido, 'Mover' fica desligado");
    api.$("qsMoverBusca").value = "credito";
    api.$("qsMoverBusca").oninput();
    ok(ops().length === 1 && /Crédito tributário/.test(ops()[0].textContent), "J4 a busca filtra (sem acento também)");
    ops()[0].onclick();
    const ramos = (api.$("qsMoverRamos").children || []).filter((b) => b.tagName === "BUTTON");
    ok(api.$("qsMoverRamos").hidden === false && ramos.map((b) => b.textContent).join("|") === "tópico inteiro|Lançamento|Suspensão", "J5 tópico com ramos: escolhe o ramo do destino (ou o tópico inteiro)");
    ramos[2].onclick();
    api.$("btnQsMoverOk").onclick();
    const q2 = api.qsTodas().find((x) => x.id === q.id);
    ok(q2.topico === "Crédito tributário" && q2.ramo === "suspensao" && q2.concurso === "ISS Caruaru", "J6 'Mover' move para o tópico e o ramo escolhidos: " + JSON.stringify([q2.topico, q2.ramo]));
    ok(api.$("dlgQsMover").open === false && voltou === 1 && /^✓ Questão movida para Tributário › Crédito tributário/.test(api.$("toast").textContent), "J7 fecha, avisa e repinta quem chamou: " + api.$("toast").textContent);
    /* mesmo lugar: avisa em vez de fingir */
    api.qsUiMoverAbrir(q2);
    (api.$("qsMoverLista").children || []).filter((b) => /qs-mover-op/.test(b.className || "") && /Crédito/.test(b.textContent))[0].onclick();
    (api.$("qsMoverRamos").children || []).filter((b) => b.tagName === "BUTTON")[2].onclick();
    ok(api.qsUiMoverConfirmar() === null && /já está nesse tópico/.test(api.$("qsMoverAviso").textContent), "J8 mover para onde já está avisa e não fecha");
    api.$("dlgQsMover").close();
  }

  /* ---- na sessão e na lista: o ⋮ ---- */
  {
    const { api, ch } = montar();
    api.qsUiResponderAbrir(api.qsFiltrar({ chave: ch }), "aba", "t");
    const q = api.qsAtual();
    const menuDe = () => api.$("qsSessCorpo").querySelectorAll(".qs-fer-menu")[0];
    const botao = (re) => (menuDe().children || []).find((b) => re.test(b.textContent || ""));
    ok(botao(/mover para outro tópico/) && !botao(/desfazer mover/), "S1 o ⋮ da questão tem 'mover para outro tópico' (e ainda não tem desfazer)");
    botao(/mover para outro tópico/).onclick();
    ok(api.$("dlgQsMover").open === true, "S2 abre a janela por cima da questão");
    (api.$("qsMoverLista").children || []).filter((b) => /Receita pública/.test(b.textContent || ""))[0].onclick();
    api.$("btnQsMoverOk").onclick();
    ok(/Financeiro · Receita pública/.test(api.$("qsSessCorpo").querySelectorAll(".qs-de")[0].textContent) && api.qsAtual().id === q.id,
       "S3 a questão continua na tela, já com o tópico novo: " + api.$("qsSessCorpo").querySelectorAll(".qs-de")[0].textContent);
    const des = botao(/desfazer mover \(voltar para Obrigação tributária\)/);
    ok(!!des, "S4 o ⋮ oferece desfazer o mover");
    des.onclick();
    ok(api.qsAtual().topico === "Obrigação tributária" && /Obrigação tributária/.test(api.$("qsSessCorpo").querySelectorAll(".qs-de")[0].textContent) && !botao(/desfazer mover/),
       "S5 desfazer devolve a questão ao tópico e o botão some");
    ok(/A questão voltou para Tributário › Obrigação tributária/.test(api.$("toast").textContent), "S5a e avisa");
    /* a lista também */
    api.$("dlgQsResponder").close();
    api.qsUiRender();
    const li = api.$("qsLista").querySelectorAll(".qs-item")[0];
    li.querySelectorAll(".qs-item-mais")[0].onclick();
    const m = li.querySelectorAll(".qs-item-menu")[0];
    ok(m && (m.children || []).some((b) => /mover para outro tópico/.test(b.textContent || "")), "S6 o ⋮ da lista de questões também tem 'mover'");
  }
  {
    const { api } = rodar();
    ["qs_mover_btn", "qs_mover_tit", "qs_mover_atual", "qs_mover_ok", "qs_mover_feito", "qs_mover_desfazer", "qs_mover_desfeito", "qs_mover_ramo_rot"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "T1 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
