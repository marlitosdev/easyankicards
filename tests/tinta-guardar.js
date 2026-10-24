/* =====================================================================
 * GUARDAR AS MARCAS DO LÁPIS (v19.8.0)
 *
 * A DÚVIDA DO USUÁRIO: guardar traços ocupa espaço? A resposta escolhida: guardar no IndexedDB (nunca no
 * localStorage), sozinho só nas questões ERRADAS ou CHUTADAS, a pedido (📌) nas outras; limpar sozinho ao acertar
 * numa revisão e depois de 90 dias sem abrir; fora do backup por padrão.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. a regra: errou/chutou + marcas → guarda; acertou de primeira → não guarda; acertou depois de errar → apaga;
 *     a pedido continua mesmo acertando; sem marcas → apaga; tirar o 📌 → apaga e o automático não volta a guardar;
 *  2. reabrir o app (sessão nova) traz as marcas guardadas de volta à questão;
 *  3. 90 dias sem abrir → vencida;
 *  4. backup: fora por padrão; ligada a opção, vai e volta;
 *  5. o ⋮ diz quanto ocupa e apaga todas (com confirmação); nada disso toca o localStorage além da preferência.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, resp) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(resp.length > 1 ? resp.shift() : resp[0]); } catch (e) {} }
    return promessa;
  };

  /* ---- a regra, pura ---- */
  {
    const { api } = rodar();
    ok(api.tnMotivoAuto({ tentativas: [] }) === "" && api.tnMotivoAuto({ tentativas: [{ acertou: false }] }) === "errou"
      && api.tnMotivoAuto({ tentativas: [{ acertou: false }, { acertou: true }] }) === "acertou"
      && api.tnMotivoAuto({ tentativas: [{ acertou: true, chute: true }] }) === "chute", "R1 o motivo vem da ÚLTIMA tentativa");
    const D = api.tnDecidir;
    ok(D(null, "errou", true, false) === "guardar" && D(null, "chute", true, false) === "guardar", "R2 errou/chutou com marcas: guarda");
    ok(D(null, "acertou", true, false) === "nada" && D(null, "", true, false) === "nada", "R3 acertou de primeira, ou ainda não respondeu: não guarda");
    ok(D({ motivo: "errou" }, "acertou", true, false) === "apagar", "R4 acertou depois de errar: apaga");
    ok(D({ motivo: "pedido" }, "acertou", true, false) === "guardar", "R5 a pedido fica mesmo acertando");
    ok(D({ motivo: "errou" }, "errou", false, false) === "apagar", "R6 sem marcas: apaga");
    ok(D(null, "errou", true, true) === "nada", "R7 tirou o 📌: o automático não volta a guardar");
    const agora = Date.parse("2026-10-24T12:00:00Z");
    const v = api.tnVencidos({ a: { aberto: "2026-07-01T00:00:00Z" }, b: { aberto: "2026-10-01T00:00:00Z" }, c: { salvo: "2026-01-01T00:00:00Z" } }, agora, 90);
    ok(v.sort().join() === "a,c", "R8 90 dias sem abrir: vence (sem 'aberto', vale o 'salvo'): " + v);
  }

  /* ---- na sessão de questões ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const txt = [1, 2, 3].map((i) => "? CE :: FGV :: Afirmacao numero " + i + " para responder com calma.\n= C :: comentario " + i).join("\n\n");
    api.qsAplicar(api.qsLerResposta(txt, { disciplina: "D", topico: "T", chave: ch }).achados);
    api.tnGeoDefinir({
      base: () => ({ x: 0, y: 0 }),
      blocos: (corpo) => { const en = corpo.querySelectorAll(".qs-enunciado")[0]; return en ? [{ id: "en", el: en }] : []; },
      caixa: () => ({ l: 0, t: 100, r: 400, b: 196 }),
      em: () => 16,
      letraEm: (el, x, y) => Math.max(0, Math.floor((y - 100) / 24)) * 50 + Math.min(49, Math.max(0, Math.floor(x / 8))),
      letraCaixa: (el, i) => ({ x: (i % 50) * 8, y: 100 + Math.floor(i / 50) * 24 }),
      linhas: (el, i, j) => [{ l: (i % 50) * 8, r: (j % 50) * 8 + 8, t: 100, b: 124 }],
    });
    const ev = (x, y) => ({ clientX: x, clientY: y, pointerType: "mouse", button: 0, pointerId: 1, preventDefault() {} });
    const riscar = () => { api.tnFerramenta("lapis"); api.tnComecar(ev(40, 120)); api.tnMover(ev(80, 150)); api.tnMover(ev(120, 120)); api.tnSoltar(); };
    const qs = api.qsTodas();
    let q1, q2, q3;
    const deId = (id) => qs.filter((q) => q.id === id)[0];
    api.qsUiResponderAbrir(qs, "aba", "teste-guardar");
    api.tnAbrir();

    /* q1: marca e erra → guarda */
    q1 = api.qsAtual().id;
    ok(!!q1, "S0 começa numa questão");
    riscar();
    ok(!api.tnSalvosAtual()[q1], "S1 marca antes de responder: ainda não guarda");
    api.qsResponder("E"); api.qsUiPintarSessao();
    ok(api.tnSalvosAtual()[q1] && api.tnSalvosAtual()[q1].motivo === "errou" && api.tnSalvosAtual()[q1].tracos.length === 1, "S2 errou: as marcas ficam guardadas");
    ok(api.$("btnTnGuardar").classList.contains("on") && /errou/.test(api.$("btnTnGuardar").title), "S2a o 📌 aceso diz por quê");
    const corpo = api.$("qsSessCorpo");
    const lap = () => corpo.querySelectorAll("button").filter((b) => b.id === "btnQsTinta")[0];
    ok(lap() && lap().classList.contains("tn-tem"), "S2b o ✏️ ganha o ponto (há marcas)");
    /* mexer depois de guardada: acompanha */
    api.tnComecar(ev(40, 160)); api.tnMover(ev(60, 190)); api.tnSoltar();
    ok(api.tnSalvosAtual()[q1].tracos.length === 2, "S3 marca nova numa questão guardada também é guardada");
    api.$("btnQsProxima").onclick();

    /* q2: marca e acerta → NÃO guarda; 📌 → guarda a pedido */
    q2 = api.qsAtual().id;
    ok(q2 && q2 !== q1, "S4 segunda questão");
    riscar();
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(!api.tnSalvosAtual()[q2], "S4a acertou de primeira: não guarda");
    ok(!api.$("btnTnGuardar").classList.contains("on"), "S4b o 📌 apagado");
    api.$("btnTnGuardar").onclick();
    ok(api.tnSalvosAtual()[q2] && api.tnSalvosAtual()[q2].motivo === "pedido", "S5 o 📌 guarda a pedido");
    api.$("btnQsProxima").onclick();

    /* q3: chuta → guarda; tira o 📌 → apaga e não volta */
    q3 = api.qsAtual().id;
    riscar();
    api.qsResponder("C", undefined, { chute: true }); api.qsUiPintarSessao();
    ok(api.tnSalvosAtual()[q3] && api.tnSalvosAtual()[q3].motivo === "chute", "S6 chutou: guarda");
    api.$("btnTnGuardar").onclick();
    ok(!api.tnSalvosAtual()[q3], "S7 tirar o 📌 apaga");
    api.tnComecar(ev(40, 160)); api.tnMover(ev(60, 190)); api.tnSoltar();
    ok(!api.tnSalvosAtual()[q3] && api.tnContar() === 2, "S7a e o automático não volta a guardar (a marca continua na tela)");

    /* o ⋮ diz quanto ocupa */
    const bg = corpo.querySelectorAll("button").filter((b) => b.id === "btnTnGuardadas")[0];
    ok(bg && /questões: 2 /.test(bg.textContent) && /KB/.test(bg.textContent), "S8 o ⋮ diz quantas questões e quantos KB: " + (bg && bg.textContent));

    /* backup: fora por padrão; ligado, vai e volta */
    ok(!("eac_tinta" in api.montarBackup().dados.material), "B1 fora do backup por padrão");
    api.tnBackupDefinir(true);
    const bk = api.montarBackup();
    ok(bk.dados.material.eac_tinta && JSON.parse(bk.dados.material.eac_tinta)[q1], "B2 com a opção, as marcas vão no backup");

    /* "reabrir o app": a sessão esquece; as guardadas voltam à questão */
    const guardados = JSON.parse(JSON.stringify(api.tnSalvosAtual()));
    api.tnSessaoEsquecer();
    api.qsUiResponderAbrir([deId(q1)], "aba", "teste-guardar-2");
    ok(api.qsAtual().id === q1 && api.tnContar() === 2, "V1 reabrindo, as marcas guardadas da q1 voltam: " + api.tnContar());
    /* acertou na revisão → apaga */
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(!api.tnSalvosAtual()[q1] && api.tnContar() === 2, "V2 acertou na revisão: o guardado some (a tela continua com as marcas até fechar)");
    /* o pedido não some ao acertar */
    api.tnSessaoEsquecer();
    api.qsUiResponderAbrir([deId(q2)], "aba", "teste-guardar-3");
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(api.tnSalvosAtual()[q2] && api.tnContar() === 1, "V3 a pedido: continua guardada mesmo acertando");
    /* apagar todas as marcas da questão guardada → apaga o guardado */
    api.tnLimpar();
    ok(!api.tnSalvosAtual()[q2], "V4 apagar todos os traços de uma questão guardada apaga o guardado");
    api.tnDesfazer();
    ok(api.tnSalvosAtual()[q2] && api.tnSalvosAtual()[q2].motivo === "pedido", "V4a e desfazer devolve a questão guardada, com o mesmo motivo");

    /* restaurar o backup traz as marcas */
    api.tnApagarTodasGuardadas();
    ok(!Object.keys(api.tnSalvosAtual()).length, "B3 apagar todas");
    api.restaurarBackup(bk);
    ok(api.tnSalvosAtual()[q1] && api.tnSalvosAtual()[q2], "B4 restaurar o backup (com as marcas) as traz de volta");
    api.tnBackupDefinir(false);

    /* o ⋮: apagar todas, com confirmação — negar não apaga nada */
    const p0 = api.tnGuardadasAbrir();
    await conduzir(api, p0, ["apagar", false]);
    ok(Object.keys(api.tnSalvosAtual()).length === 2, "G0 negar a confirmação não apaga");
    const p = api.tnGuardadasAbrir();
    await conduzir(api, p, ["apagar", true]);
    ok(!Object.keys(api.tnSalvosAtual()).length, "G1 o ⋮ apaga todas (depois de confirmar)");
    void guardados;
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["tn_guardar_off", "tn_guardar_on_errou", "tn_guardar_on_chute", "tn_guardar_on_pedido", "tn_guardou", "tn_desguardou", "tn_guardar_vazio", "tn_ger_btn", "tn_ger_aj",
      "tn_ger_txt", "tn_ger_bk_sim", "tn_ger_bk_nao", "tn_ger_bk_on", "tn_ger_bk_off", "tn_ger_bk_pos", "tn_ger_bk_tirou", "tn_ger_fechar", "tn_ger_apagar",
      "tn_ger_apagar_conf", "tn_ger_apagado"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
