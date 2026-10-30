/* =====================================================================
 * RESTAURAR É TUDO-OU-NADA, E TEM VOLTA (v19.15.0)
 *
 * O ACHADO (avaliação do plano de backup): a regra "restauração é tudo-ou-nada" estava escrita e não era cumprida —
 * cada chave era gravada com um catch vazio, e faltar espaço no meio deixava o app com metade de cada lado, com a tela
 * dizendo "restaurado". E a confirmação prometia "o estado atual vai para o histórico de versões": era só o texto da
 * bancada, e nem ele sobrevivia (o histórico do arquivo era gravado por cima).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. parte estragada do arquivo → recusa ANTES de gravar qualquer coisa;
 *  2. faltou espaço / o navegador recusou / não ficou gravado → cada chave volta ao que era (e a que não existia some);
 *  3. falhou numa lei/julgado → também volta o que já tinha ido; se nem o desfazer der certo, o erro diz "desfeito: não";
 *  4. antes de restaurar, uma cópia COMPLETA do estado atual fica no aparelho (as 3 últimas, sem repetir a igual);
 *     sem conseguir guardá-la, pergunta antes de seguir;
 *  5. "Voltar a esta base" passa pela mesma conferência e devolve o estado de antes.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  const memoria = () => {
    let lista = [];
    return { ler: async () => JSON.parse(JSON.stringify(lista)), gravar: async (l) => { lista = JSON.parse(JSON.stringify(l)); }, _ver: () => lista };
  };
  /* conduz as caixas de diálogo: responde cada uma com resp(mensagem) e anota as mensagens */
  const conduzir = async (api, promessa, resp) => {
    const msgs = [];
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 60 && !pronto; i++) {
      await new Promise((r) => setImmediate(r));
      const m = api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "";
      if (m && msgs[msgs.length - 1] !== m) msgs.push(m);
      try { api._uiFechar(resp ? resp(m) : true); } catch (e) {}
      if (api.$("uiModalMsg")) api.$("uiModalMsg").textContent = "";
    }
    await promessa;
    return msgs;
  };
  const preparar = () => {
    const r = rodar();
    const { api } = r;
    const L = api.loja;
    L.setItem("eac_texto", "Pergunta A :: Resposta A");
    L.setItem("eac_resumos", JSON.stringify({ "d›t": { texto: "resumo A" } }));
    L.removeItem("eac_qs_hist");
    const bk = api.montarBackup();
    bk.dados.cartoes.eac_texto = "Pergunta B :: Resposta B";
    bk.dados.material.eac_resumos = JSON.stringify({ "d›t": { texto: "resumo B" } });
    bk.dados.material.eac_qs_hist = JSON.stringify({ q1: [1] });
    return Object.assign(r, { L, bk });
  };
  const comoEra = (L) => L.getItem("eac_texto") === "Pergunta A :: Resposta A" && /resumo A/.test(L.getItem("eac_resumos")) && L.getItem("eac_qs_hist") === null;

  /* ---- 0. o caminho normal continua funcionando ---- */
  {
    const { api, L, bk } = preparar();
    const n = api.restaurarBackup(bk);
    ok(n > 3 && L.getItem("eac_texto") === "Pergunta B :: Resposta B" && /resumo B/.test(L.getItem("eac_resumos")) && L.getItem("eac_qs_hist"), "N1 restauro normal grava tudo");
  }

  /* ---- 0b. arquivo comum NÃO apaga o que ele não traz (backup antigo não conhece as chaves novas) ---- */
  {
    const { api, L, bk } = preparar();
    L.setItem("eac_qs_hist", "{\"local\":1}");
    delete bk.dados.material.eac_qs_hist;
    api.restaurarBackup(bk);
    ok(L.getItem("eac_qs_hist") === "{\"local\":1}", "N2 restauro comum: chave ausente no arquivo fica como estava");
    /* exato: só as chaves da lista da cópia saem */
    L.setItem("eac_qs_hist", "{\"x\":1}");
    L.setItem("eac_pastas", "[1]");
    delete bk.dados.material.eac_pastas;
    api.restaurarBackup(bk, { exato: ["eac_qs_hist"] });
    ok(L.getItem("eac_qs_hist") === null && L.getItem("eac_pastas") === "[1]", "N3 exato: sai a chave da lista que a cópia não tinha; a que a cópia não conhecia fica");
  }

  /* ---- 1. parte estragada: nada é gravado ---- */
  {
    const { api, L, bk } = preparar();
    bk.dados.material.eac_leis = "{quebrado";
    let e = null;
    try { api.restaurarBackup(bk); } catch (x) { e = x; }
    ok(e && e.tipo === "parte" && e.chave === "eac_leis" && /estragada/.test(e.message), "P1 lei com JSON quebrado: recusa dizendo qual parte: " + (e && e.message));
    ok(comoEra(L), "P2 e nada foi gravado (nem as chaves que vinham antes da lei)");
    bk.dados.material.eac_leis = "[1,2]";
    bk.dados.edital.eac_juris = "{}";
    e = null;
    try { api.restaurarBackup(bk); } catch (x) { e = x; }
    ok(e && e.chave === "eac_leis" && comoEra(L), "P3 lei com tipo errado (lista no lugar do objeto) também recusa");
  }

  /* ---- 2. faltou espaço no meio: tudo volta ---- */
  {
    const { api, L, bk } = preparar();
    const orig = L.setItem.bind(L);
    L.setItem = (k, v) => { if (k === "eac_resumos" && /resumo B/.test(v)) { const x = new Error("cota"); x.name = "QuotaExceededError"; throw x; } return orig(k, v); };
    let e = null;
    try { api.restaurarBackup(bk); } catch (x) { e = x; }
    L.setItem = orig;
    ok(e && e.tipo === "espaco" && e.chave === "eac_resumos" && e.desfeito === true && /faltou espaço/.test(e.message), "E1 faltou espaço: o erro diz onde e que desfez: " + (e && e.message));
    ok(comoEra(L), "E2 o que já tinha sido gravado voltou (eac_texto A; a chave que não existia sumiu): " + L.getItem("eac_texto") + " | " + L.getItem("eac_qs_hist"));
  }

  /* ---- 2b. o navegador "aceitou" mas não gravou ---- */
  {
    const { api, L, bk } = preparar();
    const orig = L.setItem.bind(L);
    L.setItem = (k, v) => (k === "eac_resumos" && /resumo B/.test(v) ? undefined : orig(k, v));
    let leisTocadas = 0;
    const gl = api.BK_ESPECIAIS.eac_leis.gravar;
    api.BK_ESPECIAIS.eac_leis.gravar = (o) => { leisTocadas++; return gl(o); };
    let e = null;
    try { api.restaurarBackup(bk); } catch (x) { e = x; }
    L.setItem = orig;
    api.BK_ESPECIAIS.eac_leis.gravar = gl;
    ok(e && e.tipo === "conferir" && comoEra(L), "C1 gravado diferente do arquivo: recusa e desfaz: " + (e && e.message));
    ok(leisTocadas === 0, "C2 a conferência é feita ANTES das leis: elas nem são tocadas (" + leisTocadas + " gravações)");
  }

  /* ---- 2c. nem o desfazer deu certo: o erro precisa dizer ---- */
  {
    const { api, L, bk } = preparar();
    const orig = L.setItem.bind(L);
    L.setItem = (k, v) => {
      if (k === "eac_resumos" && /resumo B/.test(v)) { const x = new Error("cota"); x.name = "QuotaExceededError"; throw x; }
      if (k === "eac_texto" && /Pergunta A/.test(v)) throw new Error("recusado");
      return orig(k, v);
    };
    let e = null;
    try { api.restaurarBackup(bk); } catch (x) { e = x; }
    L.setItem = orig;
    ok(e && e.desfeito === false, "D1 desfazer que falha: o erro diz desfeito=false");
  }

  /* ---- 3. falhou numa lei: volta também o que já tinha ido ---- */
  {
    const { api, L, bk } = preparar();
    bk.dados.material.eac_leis = JSON.stringify({ l1: { titulo: "Lei B", texto: "Art. 1º B" } });
    const gravarOrig = api.BK_ESPECIAIS.eac_leis.gravar;
    api.BK_ESPECIAIS.eac_leis.gravar = () => { throw new Error("idb"); };
    let e = null;
    try { api.restaurarBackup(bk); } catch (x) { e = x; }
    api.BK_ESPECIAIS.eac_leis.gravar = gravarOrig;
    ok(e && e.tipo === "gravar" && e.chave === "eac_leis" && e.desfeito === true && comoEra(L), "S1 falhou ao gravar a lei: o localStorage volta: " + (e && e.message));
  }

  /* ---- 3b. uma função do passo 3 regrava uma chave comum: a do arquivo vence ---- */
  {
    const { api, L, bk } = preparar();
    bk.dados.material.eac_decisoes_resumo = JSON.stringify({ doArquivo: 1 });
    L.setItem("eac_decisoes_resumo", JSON.stringify({ doAparelho: 1 }));
    const g = api.BK_ESPECIAIS.eac_decisoes.gravar;
    api.BK_ESPECIAIS.eac_decisoes.gravar = (o) => { g(o); L.setItem("eac_decisoes_resumo", JSON.stringify({ daMemoria: 1 })); };
    api.restaurarBackup(bk);
    api.BK_ESPECIAIS.eac_decisoes.gravar = g;
    ok(L.getItem("eac_decisoes_resumo") === JSON.stringify({ doArquivo: 1 }), "R1 decisões regravaram o resumo com o da memória: o do arquivo é gravado de novo: " + L.getItem("eac_decisoes_resumo"));
    /* e no modo exato, a chave que não existia na cópia não volta pelas costas */
    const { api: api2, L: L2, bk: bk2 } = preparar();
    delete bk2.dados.material.eac_decisoes_resumo;
    const g2 = api2.BK_ESPECIAIS.eac_decisoes.gravar;
    api2.BK_ESPECIAIS.eac_decisoes.gravar = (o) => { g2(o); L2.setItem("eac_decisoes_resumo", "{}"); };
    api2.restaurarBackup(bk2, { exato: ["eac_decisoes_resumo"] });
    api2.BK_ESPECIAIS.eac_decisoes.gravar = g2;
    ok(L2.getItem("eac_decisoes_resumo") === null, "R2 exato: a chave ausente na cópia continua ausente mesmo que uma função a recrie");
    /* a regravação final também falha: erro e tudo de volta */
    const { api: api3, L: L3, bk: bk3 } = preparar();
    bk3.dados.material.eac_decisoes_resumo = JSON.stringify({ doArquivo: 1 });
    const g3 = api3.BK_ESPECIAIS.eac_decisoes.gravar;
    api3.BK_ESPECIAIS.eac_decisoes.gravar = (o) => { g3(o); L3.setItem("eac_decisoes_resumo", JSON.stringify({ daMemoria: 1 })); };
    const s3 = L3.setItem.bind(L3);
    let vez = 0;
    L3.setItem = (k, v) => { if (k === "eac_decisoes_resumo" && /doArquivo/.test(v) && ++vez > 1) throw new Error("recusado"); return s3(k, v); };
    let e3 = null;
    try { api3.restaurarBackup(bk3); } catch (x) { e3 = x; }
    L3.setItem = s3;
    api3.BK_ESPECIAIS.eac_decisoes.gravar = g3;
    ok(e3 && e3.tipo === "conferir" && e3.chave === "eac_decisoes_resumo" && comoEra(L3), "R3 a regravação final falhou: recusa e desfaz: " + (e3 && e3.message));
  }

  /* ---- 4 e 5. a cópia de antes, pela tela ---- */
  {
    const { api, L, bk, janela } = preparar();
    const loja = memoria();
    api.bkAntesLojaDefinir(loja);
    api.tnSalvosForcar({ q9: { tracos: [1], motivo: "pedido" } });
    ok(!api.tnBackupLigado() && !api.montarBackup().dados.material.eac_tinta && /q9/.test(api.bkCopiaCompleta().dados.material.eac_tinta || ""),
      "A0 a cópia leva as marcas do lápis mesmo com a opção de backup do lápis desligada");
    await api.bkLerArquivo({ name: "base-B.json", text: async () => JSON.stringify(bk) });
    const msgs = await conduzir(api, api.bkConfirmarRestauro());
    ok(L.getItem("eac_texto") === "Pergunta B :: Resposta B" && janela.location.recargas === 1, "A1 restaurou e recarregou: " + msgs.join(" / "));
    const lista = await api.bkAntesLer();
    ok(lista.length === 1 && lista[0].bk.dados.cartoes.eac_texto === "Pergunta A :: Resposta A" && /antes de restaurar base-B\.json/.test(lista[0].motivo),
      "A2 ficou a cópia completa do estado de ANTES, com o nome do arquivo: " + (lista[0] && lista[0].motivo));
    ok(/A :: Resposta A/.test(lista[0].bk.dados.cartoes.eac_texto) && /resumo A/.test(lista[0].bk.dados.material.eac_resumos), "A2a a cópia tem resumos, não só a bancada");
    /* o painel mostra e volta */
    await api.bkPintarAntes();
    const lis = api.$("bkAntes").querySelectorAll(".bk-antes-li");
    ok(!api.$("bkAntes").hidden && lis.length === 1 && /Voltar a esta base/.test(lis[0].textContent) && /antes de restaurar base-B/.test(lis[0].textContent), "V1 o painel lista a cópia com 'Voltar a esta base'");
    lis[0].querySelectorAll(".bk-antes-voltar")[0].onclick();
    ok(api.$("dlgBkConf").open && /cópia de antes do restauro/.test(api.$("bkConfArquivo").textContent), "V2 voltar abre a mesma tabela de conferência");
    await conduzir(api, api.bkConfirmarRestauro());
    ok(comoEra(L), "V3 confirmado: o estado de antes voltou (texto A, resumo A, sem o histórico que veio do arquivo)");
    const l2 = await api.bkAntesLer();
    ok(l2.length === 2 && l2[0].bk.dados.cartoes.eac_texto === "Pergunta B :: Resposta B", "V4 voltar também guardou a cópia do estado B (dá para desfazer o voltar)");
    /* a mesma situação de novo não empurra a cópia boa para fora */
    await api.bkGuardarAntes("x");
    await api.bkGuardarAntes("y");
    ok((await api.bkAntesLer()).length === 3, "M1 estado novo entra na lista (A)");
    await api.bkGuardarAntes("z");
    const lm = await api.bkAntesLer();
    ok(lm.length === 3 && lm[0].motivo === "x" && lm[2].bk.dados.cartoes.eac_texto === "Pergunta A :: Resposta A",
      "M2 cópia igual à mais recente não entra de novo — e a cópia boa mais antiga (A) não é empurrada para fora: " + lm.map((c) => c.motivo).join(" | "));
    L.setItem("eac_texto", "outro 1 :: x"); await api.bkGuardarAntes("1");
    L.setItem("eac_texto", "outro 2 :: x"); await api.bkGuardarAntes("2");
    const l3 = await api.bkAntesLer();
    ok(l3.length === 3 && l3[0].motivo === "2", "M3 ficam as 3 últimas");
  }

  /* ---- 4b. sem conseguir guardar a cópia: pergunta; cancelar não restaura ---- */
  {
    const { api, L, bk } = preparar();
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => { throw new Error("sem espaço"); } });
    await api.bkLerArquivo({ name: "b.json", text: async () => JSON.stringify(bk) });
    const msgs = await conduzir(api, api.bkConfirmarRestauro(), (m) => !/Não consegui guardar uma cópia/.test(m));
    ok(msgs.some((m) => /Não consegui guardar uma cópia/.test(m) && /sem espaço/.test(m)), "F1 avisa que a cópia falhou, com o motivo: " + msgs.join(" / "));
    ok(comoEra(L), "F2 cancelado: nada foi restaurado");
  }

  /* ---- 4c. restauro que falha pela tela: a mensagem conta a verdade ---- */
  {
    const { api, L, bk } = preparar();
    api.bkAntesLojaDefinir(memoria());
    const orig = L.setItem.bind(L);
    L.setItem = (k, v) => { if (k === "eac_resumos" && /resumo B/.test(v)) { const x = new Error("cota"); x.name = "QuotaExceededError"; throw x; } return orig(k, v); };
    await api.bkLerArquivo({ name: "b.json", text: async () => JSON.stringify(bk) });
    const msgs = await conduzir(api, api.bkConfirmarRestauro());
    L.setItem = orig;
    ok(msgs.some((m) => /^Nada foi alterado/.test(m) && /faltou espaço/.test(m)) && comoEra(L), "U1 falhou e desfez: 'Nada foi alterado' — agora verdade: " + msgs.join(" / "));
  }

  /* ---- onde ficou a base: código, não texto traduzido ---- */
  {
    const { api, L } = preparar();
    ok(api.bkOndeTexto("arquivo") === "restaurada de arquivo" && api.bkOndeTexto("restaurada de arquivo") === "restaurada de arquivo" && api.bkOndeTexto(null) === "na pasta de downloads",
      "O1 o código vira texto; o texto já gravado (versões antigas) aparece como está, sem 'bk_onde_'");
    api.bkAntesLojaDefinir(memoria());
    const bk = api.montarBackup();
    await api.bkLerArquivo({ name: "b.json", text: async () => JSON.stringify(bk) });
    await conduzir(api, api.bkConfirmarRestauro());
    api.bkPintarPainel();
    ok(L.getItem("eac_backup_onde") === "arquivo" && !/bk_onde_/.test(api.$("bkUltimo").textContent) && /restaurada de arquivo/.test(api.$("bkUltimo").textContent),
      "O2 depois de restaurar, o painel diz 'restaurada de arquivo': " + api.$("bkUltimo").textContent);
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["bk_erro_restaurar_parcial", "bk_err_parte", "bk_err_espaco", "bk_err_gravar", "bk_err_conferir", "bk_antes_motivo", "bk_antes_falhou", "bk_antes_falhou_ok",
      "bk_antes_rot", "bk_antes_exp", "bk_antes_conta", "bk_antes_voltar", "bk_antes_baixar", "bk_antes_nome", "bk_antes_tip_voltar", "bk_antes_tip_baixar"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
    ok(!/histórico de versões/.test(api.t("bk_conf_perde")) && /cópia completa/.test(api.t("bk_conf_perde")), "X3 o aviso vermelho da conferência também não promete o histórico");
    ok(!/histórico de versões/.test(api.t("bk_conf_confirma")) && /cópia completa/.test(api.t("bk_conf_confirma")), "X2 a confirmação não promete mais o que não cumpria");
  }
  return falhas;
}

module.exports = { testes };
