/* =====================================================================
 * OS AVISOS DO BACKUP AUTOMÁTICO E O DIAGNÓSTICO (19.167.0)
 *
 * O caso real: "recebi notificação sobre backup faltando arquivos" — o painel mostrava, em inglês, "A requested file or
 * directory could not be found…" (a pasta do Google Drive não respondeu por um instante), o balão dizia "Backup falhou"
 * logo na primeira vez, a próxima tentativa só vinha em 30 minutos, e o diagnóstico dizia "✓ o último há 13 h" num dia
 * inteiro de uso sem cópia.
 *
 * O QUE PRECISA SER VERDADE:
 *  V1. o erro vira causa (pasta que não respondeu, permissão, espaço, arquivo em uso, interrompido) e quem é passageiro;
 *  V2. a 1ª e a 2ª falhas passageiras são AVISO ("Tentando de novo"), com a hora da próxima tentativa sozinha; da 3ª em
 *      diante, ALARME ("Backup falhou"); o painel explica em português e deixa o técnico à parte, com "Tentar agora";
 *  V3. a pasta volta e os dados são os mesmos do último backup bom: o aviso SAI (antes ficava para sempre);
 *  V4. permissão negada não é passageira: alarme de cara, sem nova tentativa sozinha, com "Reconectar";
 *  V5. o diagnóstico diz por que o automático parou (pasta, permissão) e se há mudanças ainda sem cópia, e lista os
 *      últimos eventos do backup.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  let agora = new Date(2026, 10, 17, 10, 0).getTime();
  const erroNome = (name, message) => { const e = new Error(message); e.name = name; return e; };
  const pasta = () => {
    const arqs = new Map();
    const P = { kind: "directory", name: "Meu Drive/EasyAnkiCards Backup", arqs, perm: "granted", resposta: "granted", falha: null, falhaLista: null };
    const fh = (nm) => ({ kind: "file", name: nm,
      createWritable: async () => { let buf = null; return { write: async (d) => { buf = d; }, close: async () => { arqs.set(nm, { dados: buf, mod: agora }); }, abort: async () => {} }; },
      getFile: async () => ({ name: nm, lastModified: arqs.get(nm).mod, size: 1, arrayBuffer: async () => new ArrayBuffer(1), text: async () => "" }) });
    P.queryPermission = async () => P.perm;
    P.requestPermission = async () => { P.perm = P.resposta; return P.perm; };
    P.getFileHandle = async (nm) => { if (P.falha) throw P.falha; return fh(nm); };
    P.removeEntry = async (nm) => { arqs.delete(nm); };
    P.entries = async function* () { if (P.falhaLista) throw P.falhaLista; for (const nm of [...arqs.keys()]) yield [nm, fh(nm)]; };
    return P;
  };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    const ate = Date.now() + 20000;
    while (!pronto && Date.now() < ate) { await new Promise((r) => setImmediate(r)); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };

  /* V1 */
  {
    const { api } = rodar();
    const c = (e) => api.bkaErroExplicar(e);
    ok(c(erroNome("NotFoundError", "A requested file or directory could not be found at the time an operation was processed.")).cod === "pasta_sumiu" && c(erroNome("NotFoundError", "x")).transitorio, "V1a 'could not be found' = a pasta não respondeu, passageiro");
    ok(c(erroNome("NotAllowedError", "The request is not allowed")).cod === "permissao" && !c(erroNome("NotAllowedError", "")).transitorio, "V1b permissão negada, não passageiro");
    ok(c(erroNome("QuotaExceededError", "")).cod === "espaco" && c(erroNome("NoModificationAllowedError", "")).cod === "ocupado" && c(erroNome("AbortError", "")).cod === "interrompido", "V1c espaço, arquivo em uso, interrompido");
  }

  /* V2 + V3 + V5 */
  {
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    L.setItem("eac_texto", Array.from({ length: 20 }, (_, i) => "Pergunta " + i + " :: Resposta " + i).join("\n"));
    L.setItem("eac_aparelho", "PC da sala");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    await conduzir(api, api.bkaConectar());
    ok(!api.bkaEstado().erro && P.arqs.size === 1, "V2-pre conectado e gravado");
    /* a pasta some (o Drive desconectou) e há mudança */
    L.setItem("eac_texto", L.getItem("eac_texto") + "\nMais :: x");
    P.falha = erroNome("NotFoundError", "A requested file or directory could not be found at the time an operation was processed.");
    agora += 60000;
    let res = await api.bkaGravarAgora("periódico");
    let est = api.bkaEstado();
    ok(res.cod === "pasta_sumiu" && est.erro.n === 1 && est.erro.cod === "pasta_sumiu" && new Date(est.erro.proxima).getTime() - agora === 2 * 60000, "V2a 1ª falha: guardada com a causa e a próxima tentativa em 2 min");
    api.bkPintarPainel();
    const corpo = () => api.$("bkaCorpo").textContent;
    ok(/vai tentar de novo sozinho: a pasta do backup não respondeu/.test(corpo()) && /próxima tentativa sozinho às/.test(corpo()) && /Detalhe técnico \(para relatar\): A requested file/.test(corpo()) && api.$("btnBkaErroTentar"),
      "V2b o painel explica em português, diz a próxima tentativa, o técnico fica à parte e há 'Tentar agora': " + corpo().slice(0, 300));
    ok(api.bkaBolhaEstado().rot === "Tentando de novo" && /tentando de novo/.test(api.$("seloBase").textContent), "V2c no começo é aviso: 'Tentando de novo' (não 'Backup falhou')");
    agora += 2 * 60000; await api.bkaGravarAgora("nova tentativa");
    agora += 5 * 60000; res = await api.bkaGravarAgora("nova tentativa");
    est = api.bkaEstado();
    ok(est.erro.n === 3 && new Date(est.erro.proxima).getTime() - agora === 15 * 60000 && api.bkaBolhaEstado().rot === "Backup falhou" && /falhou/.test(api.$("seloBase").textContent),
      "V2d da 3ª falha seguida em diante: alarme, e a próxima em 15 min");
    /* V5: o diagnóstico com a falha */
    const dg = await api.montarDiagnostico();
    ok(/Backup automático com erro \(pasta_sumiu, 3ª seguida/.test(dg) && /últimos eventos do backup:/.test(dg) && /automático falhou/.test(dg), "V5a o diagnóstico mostra a falha explicada e os últimos eventos do backup");
    /* V3: a pasta volta; os dados voltam a ser os do último backup bom */
    P.falha = null;
    L.setItem("eac_texto", L.getItem("eac_texto").replace("\nMais :: x", ""));
    agora += 60000;
    res = await api.bkaGravarAgora("periódico");
    est = api.bkaEstado();
    ok(res.igual && !est.erro && api.bkaBolhaEstado() === null, "V3 a pasta voltou e nada mudou desde o último backup bom: o aviso sai");
    /* V5: sem permissão e com mudança: o diagnóstico diz por quê e que há mudança sem cópia */
    L.setItem("eac_texto", L.getItem("eac_texto") + "\nOutra :: y");
    P.perm = "prompt";
    await api.bkaPermitido(false);
    ok(/permissão da pasta venceu/.test(api.bkaMotivoParado()) && api.bkaMudancasSemCopia().mudou, "V5b o motivo da parada e a mudança ainda sem cópia");
    const dg2 = await api.montarDiagnostico();
    ok(/Backup automático parado: a permissão da pasta venceu/.test(dg2) && /mudanças desde o último backup: SIM/.test(dg2) && /permissão: prompt/.test(dg2), "V5c o diagnóstico diz que o automático parou, por quê, e que há mudança sem cópia");
  }

  /* V7 + V8 (19.167.1): sem alarme falso logo depois de abrir; o automático que nem tenta gravar deixa rastro */
  {
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    L.setItem("eac_texto", "A :: B");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    await conduzir(api, api.bkaConectar());
    await api.bkaIniciar();
    L.setItem("eac_texto", "A :: B" + String.fromCharCode(10) + "C :: D");
    let dg = await api.montarDiagnostico();
    ok(!/NÃO GRAVOU/.test(dg) && /normal logo depois de abrir/.test(dg), "V7a logo depois de abrir, mudança sem cópia não é alarme");
    agora += 11 * 60000;
    dg = await api.montarDiagnostico();
    ok(/o automático NÃO GRAVOU/.test(dg), "V7b passados 10 minutos sem gravar, é alarme");
    P.perm = "prompt";
    await api.bkaGravarAgora("periódico");
    await api.bkaGravarAgora("periódico");
    const ev = api.rtTudo({}).filter((x) => /automático não gravou/.test(x.msg));
    ok(ev.length === 1 && /permissao prompt/.test(ev[0].extra), "V8 o automático que nem tenta gravar deixa UM registro por motivo na sessão: " + JSON.stringify(ev.map((x) => x.extra)));
  }

  /* V4 */
  {
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    L.setItem("eac_texto", "A :: B");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    await conduzir(api, api.bkaConectar());
    L.setItem("eac_texto", "A :: B\nC :: D");
    P.falha = erroNome("NotAllowedError", "The request is not allowed by the user agent.");
    await api.bkaGravarAgora("periódico");
    const est = api.bkaEstado();
    api.bkPintarPainel();
    ok(est.erro.cod === "permissao" && !est.erro.proxima && api.bkaBolhaEstado().rot === "Backup falhou" && api.$("btnBkaErroReconectar") && /não tenta de novo sozinho/.test(api.$("bkaCorpo").textContent),
      "V4 permissão negada: alarme de cara, sem nova tentativa sozinha, com 'Reconectar'");
  }

  {
    const { api } = rodar();
    ["bka_erro_pasta_sumiu", "bka_erro_permissao", "bka_erro_espaco", "bka_erro_ocupado", "bka_erro_interrompido", "bka_erro_outro", "bka_erro_tentando", "bka_erro_quando",
      "bka_erro_proxima", "bka_erro_sozinho_nao", "bka_erro_tentar", "bka_erro_tecnico", "bka_selo_tentando", "bka_rot_tentando"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "V6 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  /* (19.206.0) V9: A PASTA QUE NÃO RESPONDE (o caso real de 26/11: Google Drive travado, "permissão: ?", quatro dias sem
   * backup e "Salvar agora" sem fazer nada) */
  {
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    L.setItem("eac_texto", "A :: B");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    await conduzir(api, api.bkaConectar());
    /* o Drive trava: a pergunta da permissão nunca responde. O prazo vence (nos testes, a pedido) */
    P.queryPermission = () => new Promise(() => {});
    api.bkaPrazoDefinir((fn) => { Promise.resolve().then(() => Promise.resolve()).then(fn); return 1; }, () => {});
    L.setItem("eac_texto", "A :: B" + String.fromCharCode(10) + "C :: D");
    const res = await api.bkaGravarAgora("periódico");
    const est = api.bkaEstado();
    ok(res && res.ok === false && est.erro && est.erro.cod === "sem_resposta" && !!est.erro.proxima && api.bkaPermissaoAtual() === "sem_resposta",
      "V9 a pasta que não responde vira falha passageira 'sem resposta', com nova tentativa sozinha: " + JSON.stringify(res));
    ok(!api.bkaGravandoAtual(), "V9a nada fica preso: a próxima gravação pode começar");
    ok(!api.bkaPermVencida() && !/Reconectar/.test(api.bkaBolhaEstado().rot || ""), "V9b não é 'permissão vencida': o balão não manda reconectar");
    const ts = api.bkaTentativas();
    ok(ts.length >= 1 && ts[0].r === "erro" && ts[0].e.some((x) => x.n === "permissão") && /permissão/.test(api.bkaTentLinha(ts[0])), "V9c a tentativa fica no registro, com a etapa onde parou: " + (ts[0] && api.bkaTentLinha(ts[0])));
    /* "Salvar agora" com o PEDIDO também mudo: responde, e diz por quê */
    const pedirAntes = P.requestPermission;
    P.requestPermission = () => new Promise(() => {});
    api.bkPintarPainel();
    const p = api.bkaGravarPedido();
    await conduzir(api, p);
    const rp = await p;
    ok(rp.ok === false && /não respondeu/.test(api.bkaPorQueNaoGravou(rp)), "V9d 'Salvar agora' sem gravar diz por quê: " + api.bkaPorQueNaoGravou(rp));
    /* o painel mostra o registro, o relatório e "escolher a pasta de novo" */
    api.bkPintarPainel();
    ok(api.$("bkaRegistro") && api.$("btnBkaRelatorio") && /Registro das tentativas \(\d+\)/.test(api.$("bkaRegistro").textContent), "V9e o painel tem o registro das tentativas e 'copiar relatório'");
    ok(api.$("btnBkaEscolherDeNovo") && /mesma pasta de novo/i.test(api.$("bkaCorpo").textContent), "V9e2 sem resposta: o painel oferece escolher a mesma pasta de novo");
    /* (19.208.0) a pasta muda em destaque: o cartão, o selo e a frase do topo dizem o que fazer */
    ok(api.bkaPastaMuda() && /perdeu a ligação com a pasta/.test(api.$("bkaMuda").textContent) && api.$("btnBkaMudaBaixar")
      && /perdeu a pasta/.test(api.bkaAvisoDoSelo().txt) && api.bkaAvisoDoSelo().cls === "sb-alerta" && api.bkaBolhaEstado().rot === "Escolher a pasta"
      && /perdeu a ligação/.test(api.bkSituacao().txt) && api.bkSituacao().fn === api.bkaEscolherDeNovo,
      "V9e3 a pasta muda: cartão com 'escolher de novo' e 'baixar uma cópia', selo em alarme, balão 'Escolher a pasta' e a frase do topo");
    /* (19.207.0) o caso real: a CONSULTA trava, mas o pedido com toque responde — "Salvar agora" grava */
    P.requestPermission = pedirAntes;
    api.bkaPrazoDefinir(() => null, () => {});
    L.setItem("eac_texto", "A :: B" + String.fromCharCode(10) + "C :: D" + String.fromCharCode(10) + "E :: F");
    const p2 = api.bkaGravarPedido();
    await conduzir(api, p2);
    const rp2 = await p2;
    ok(rp2.ok === true && !api.bkaEstado().erro && api.bkaTentativas()[0].m === "ao escolher a pasta" && !api.bkaPastaMuda(),
      "V9k com a pasta muda, 'Salvar agora' abre a escolha da pasta e grava (sem esperar o pedido que não vem): " + JSON.stringify(rp2));
    const lt = api.bkaTentLinha(api.bkaTentativas()[0]);
    ok(/etapas: permissão \d+,\d s › dados/.test(lt), "V9l cada etapa com quanto levou: " + lt);
    api.bkaPrazoDefinir((fn) => { Promise.resolve().then(() => Promise.resolve()).then(fn); return 1; }, () => {});
    const rel = api.bkaRelatorio();
    ok(/relatório do backup automático/.test(rel) && /permissão: sem_resposta/.test(rel) && /tentativas \(\d+/.test(rel) && !/C :: D/.test(rel), "V9f o relatório traz o estado e as tentativas, sem os dados: " + rel.split(String.fromCharCode(10)).slice(0, 4).join(" | "));
    const dg = await api.montarDiagnostico();
    ok(/últimas tentativas/.test(dg), "V9g o diagnóstico traz as últimas tentativas");
    /* o Drive volta: grava */
    api.bkaPrazoDefinir(() => null, () => {});
    P.queryPermission = async () => "granted";
    L.setItem("eac_texto", "A :: B" + String.fromCharCode(10) + "G :: H");
    const ok2 = await api.bkaGravarAgora("nova tentativa");
    ok(ok2.ok === true && !api.bkaEstado().erro && api.bkaTentativas()[0].r === "gravou", "V9h a pasta volta: grava e a falha sai");
    api.bkaPrazoDefinir(() => null, () => {});
  }
  {
    const { api } = rodar();
    ["bka_erro_sem_resposta", "bka_salvando", "bka_nao_gravou", "bka_reg_tit", "bka_rel_copiar", "bka_tent_r_erro", "bka_tent_r_gravou"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "V9i falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  {
    /* (19.208.0) V9n: o caso de 26/11 18:31 — um "Salvar agora" fica esperando a pasta antiga; no meio, a pasta é escolhida
     * de novo e grava; quando a velha termina (falha), NÃO regrava o estado de antes por cima */
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    L.setItem("eac_texto", "A :: B");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    await conduzir(api, api.bkaConectar());
    /* a pasta guardada emudece; o prazo da tentativa velha só vence quando o teste mandar */
    P.requestPermission = () => new Promise(() => {});
    P.queryPermission = () => new Promise(() => {});
    let vencer = null;
    api.bkaPrazoDefinir((fn) => { vencer = fn; return 1; }, () => {});
    L.setItem("eac_texto", "A :: B" + String.fromCharCode(10) + "C :: D");
    const velha = api.bkaGravarAgora("pedido", { gesto: true, forcar: true });
    /* a pessoa escolhe a pasta de novo: pasta nova, que responde */
    const P2 = pasta();
    janela.showDirectoryPicker = async () => P2;
    api.bkaPrazoDefinir(() => null, () => {});
    const nova = await api.bkaConectar();
    const ultimoBom = api.bkaEstado().ultimo && api.bkaEstado().ultimo.nome;
    ok(nova.ok === true && !!ultimoBom, "V9n a pasta escolhida de novo grava no meio da espera da velha: " + JSON.stringify(nova));
    if (vencer) vencer();
    const rv = await velha;
    const est = api.bkaEstado();
    ok(rv.razao === "obsoleta" && !est.erro && est.ultimo && est.ultimo.nome === ultimoBom && api.bkaPermissaoAtual() === "granted",
      "V9o a tentativa velha sai como 'substituída' e não desfaz o backup novo: " + JSON.stringify({ rv, erro: est.erro, ultimo: est.ultimo && est.ultimo.nome, perm: api.bkaPermissaoAtual() }));
  }
  {
    /* (19.209.0) V10: "Nome deste computador" — a pergunta aparece (na camada de topo, por cima do painel) e o nome novo
     * é salvo com o aviso de como as próximas cópias vão se chamar */
    const { api } = rodar();
    api.loja.setItem("eac_aparelho", "PC da sala");
    const pp = api.uiPrompt("Nome?", "valor inicial");
    ok(api.$("uiModal").open === true && api.$("uiPromptInput") && api.$("uiPromptInput").style.display !== "none" && api.$("uiPromptInput").value === "valor inicial",
      "V10 a pergunta abre como <dialog> (showModal), com o campo à vista e o valor de agora");
    api.$("uiPromptInput").value = "outro";
    api._uiFechar(true);
    ok((await pp) === "outro" && api.$("uiModal").open !== true, "V10a OK devolve o texto digitado e fecha");
    const pr = api.bkaRenomearAparelho();
    await new Promise((r) => setImmediate(r));
    ok(api.$("uiModal").open === true && api.$("uiPromptInput").value === "PC da sala", "V10b 'Nome deste computador' abre a pergunta com o nome atual");
    api.$("uiPromptInput").value = "Notebook Novo";
    api._uiFechar(true);
    await new Promise((r) => setImmediate(r));
    const aviso = api.$("uiModalMsg").textContent;
    ok(api.$("uiModal").open === true && /Notebook Novo/.test(aviso) && /easyankicards-auto-notebook-novo-\d{8}\.json/.test(aviso) && /PC da sala/.test(aviso),
      "V10c o aviso diz o nome novo e como as próximas cópias vão se chamar: " + aviso);
    api._uiFechar(true);
    const rr = await pr;
    ok(rr.ok === true && api.loja.getItem("eac_aparelho") === "Notebook Novo" && api.rtTudo({}).some((x) => /nome do aparelho trocado/.test(x.msg)), "V10d o nome fica salvo e entra no registro");
    ["bka_renomear_ok", "bka_renomear_igual"].forEach((k) => ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "V10e falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  {
    /* V9j: ao abrir, a pasta que não responde não prende a abertura (antes: bkaIniciar esperava para sempre) */
    const r = rodar();
    const { api, janela } = r;
    api.loja.setItem("eac_texto", "A :: B");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    await conduzir(api, api.bkaConectar());
    P.queryPermission = () => new Promise(() => {});
    api.bkaPrazoDefinir((fn) => { Promise.resolve().then(fn); return 1; }, () => {});
    let terminou = false;
    const pi = api.bkaIniciar().then(() => { terminou = true; });
    await conduzir(api, pi);
    ok(terminou && api.bkaPermissaoAtual() === "sem_resposta" && api.rtTudo({}).some((x) => /não respondeu ao abrir/.test(x.msg)), "V9j a abertura termina mesmo com a pasta muda, e o registro diz isso");
    api.bkaPrazoDefinir(() => null, () => {});
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
