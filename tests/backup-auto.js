/* =====================================================================
 * BACKUP AUTOMÁTICO NUMA PASTA (v19.17.0 — Fase 2 do plano de backup)
 *
 * O PEDIDO: "prosseguir; o backup de download também deve prosseguir funcionando, para que exista alternativa de
 * backup manual". O automático é um caminho A MAIS.
 *
 * O QUE PRECISA SER VERDADE (os testes S-A…S-F do plano, mais as proteções da avaliação):
 *  S-A gravação cortada no meio não destrói a cópia anterior;
 *  S-B com 7 dias na pasta, o oitavo apaga o mais antigo — nunca o mais novo, nunca o de outro aparelho, nunca um manual;
 *  S-D permissão vencida mostra "reconectar" (selo e painel) — nunca falha calada;
 *  S-E sem mudança, nenhuma gravação nova;
 *  S-F backup mais novo de outro aparelho: aviso, e só restaura passando pela conferência;
 *  E   os dados ENCOLHERAM muito: não sobrescreve a cópia do dia, grava à parte, pausa até "fui eu";
 *  M   o backup manual (baixar) continua lá e funcionando.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const zlib = require("zlib");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, resp) => {
    const msgs = [];
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    /* por TEMPO, não por número de voltas: o gzip (CompressionStream) roda fora do laço de eventos e, com a máquina
     * ocupada (a suíte inteira), atravessa mais de 80 voltas — e o uiAlert que vem depois dele ficava sem resposta */
    const ate = Date.now() + 20000;
    while (!pronto && Date.now() < ate) {
      await new Promise((r) => setImmediate(r));
      const m = api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "";
      if (m && msgs[msgs.length - 1] !== m) msgs.push(m);
      try { api._uiFechar(resp ? resp(m) : true); } catch (e) {}
      if (api.$("uiModalMsg")) api.$("uiModalMsg").textContent = "";
    }
    const r = await promessa;
    return { r, msgs };
  };

  /* uma pasta de mentira com o contrato do File System Access: grava no close (atômico), lista, remove, permissão */
  let agora = new Date(2026, 9, 25, 10, 0).getTime();
  const pasta = (nome) => {
    const arqs = new Map();
    const P = { kind: "directory", name: nome || "OneDrive/Backups", arqs, perm: "granted", resposta: "granted", escritas: 0, quebrarEscrita: false };
    const fh = (n) => ({
      kind: "file", name: n,
      createWritable: async () => {
        let buf = null;
        return {
          write: async (d) => { if (P.quebrarEscrita) throw new Error("disco cheio"); buf = d; },
          close: async () => { arqs.set(n, { dados: buf, mod: agora }); P.escritas++; },
          abort: async () => {},
        };
      },
      getFile: async () => {
        const a = arqs.get(n);
        const bytes = typeof a.dados === "string" ? new TextEncoder().encode(a.dados) : a.dados;
        return { name: n, lastModified: a.mod, size: bytes.length,
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          text: async () => new TextDecoder().decode(bytes) };
      },
    });
    P.queryPermission = async () => P.perm;
    P.requestPermission = async () => { P.perm = P.resposta; return P.perm; };
    P.getFileHandle = async (n) => fh(n);
    P.removeEntry = async (n) => { arqs.delete(n); };
    P.entries = async function* () { for (const n of [...arqs.keys()]) yield [n, fh(n)]; };
    P.conteudo = (n) => { const a = arqs.get(n); return JSON.parse(zlib.gunzipSync(Buffer.from(a.dados)).toString("utf8")); };
    return P;
  };
  const preparar = (opc) => {
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    const qs = Array.from({ length: 30 }, (_, i) => ({ id: "q" + i, enunciado: "Questão " + i }));
    L.setItem("eac_questoes", JSON.stringify(qs));
    L.setItem("eac_texto", Array.from({ length: 30 }, (_, i) => "Pergunta " + i + " :: Resposta " + i).join("\n"));
    L.setItem("eac_aparelho", "PC da sala");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = pasta();
    if (!(opc && opc.semSuporte)) janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    return Object.assign(r, { L, P, loja });
  };
  const dia = (d) => { agora = new Date(2026, 9, 25 + d, 10, 0).getTime(); };
  const corpo = (api) => api.$("bkaCorpo").textContent;

  /* ---- nomes ---- */
  {
    const { api } = preparar();
    const n = api.bkaNome("PC da Sala", new Date(2026, 9, 25, 8, 5), false, true);
    ok(n === "easyankicards-auto-pc-da-sala-20261025.json.gz", "N1 nome do arquivo do dia: " + n);
    const ne = api.bkaNome("pc-7k2", new Date(2026, 9, 25, 8, 5), true, true);
    ok(ne === "easyankicards-auto-pc-7k2-20261025-0805-encolheu.json.gz" && api.bkaLerNome(ne).encolheu && api.bkaLerNome(ne).aparelho === "pc-7k2", "N2 o 'encolheu' tem hora e é reconhecido: " + ne);
    ok(!api.bkaLerNome("easyankicards-20261025-1015.json.gz"), "N3 um backup MANUAL não tem nome de automático (a rotação nunca o toca)");
  }

  /* ---- sem suporte: o painel diz, e o manual continua ---- */
  {
    const { api } = preparar({ semSuporte: true });
    api.bkPintarPainel();
    ok(/não deixa o app gravar sozinho/.test(corpo(api)) && !api.$("btnBkaConectar"), "U1 sem showDirectoryPicker: explica e não oferece conectar");
    ok(!api.$("btnBkBaixar").hidden && /Baixar uma cópia/.test(api.$("btnBkBaixar").textContent), "M1 o 'Baixar uma cópia' continua no painel");
  }

  /* ---- conectar, gravar, nada mudou, mudou ---- */
  {
    dia(0);
    const { api, L, P, loja } = preparar();
    api.bkPintarPainel();
    ok(api.$("btnBkaConectar") && /Escolha uma pasta/.test(corpo(api)) && /continuam funcionando/.test(corpo(api)), "C0 desligado: explica e oferece escolher a pasta (e lembra que os botões manuais continuam)");
    const { r } = await conduzir(api, api.bkaConectar());
    const nome = "easyankicards-auto-pc-da-sala-20261025.json.gz";
    ok(r.ok && P.arqs.has(nome) && loja.h === P, "C1 escolher a pasta grava a cópia do dia na hora e guarda a pasta: " + JSON.stringify(r));
    const c = P.conteudo(nome);
    ok(c.app === "EasyAnkiCards" && JSON.stringify(c.dados) === JSON.stringify(api.montarBackup().dados), "C2 o arquivo é um backup completo (gzip), igual ao estado do app");
    ok(/Último automático/.test(corpo(api)) && api.loja.getItem("eac_backup_onde") === "auto", "C3 o painel e o selo sabem do backup automático");
    const n0 = P.escritas;
    const r2 = await api.bkaGravarAgora("periódico");
    ok(r2.igual && P.escritas === n0, "S-E nada mudou: nenhuma gravação nova");
    L.setItem("eac_texto", L.getItem("eac_texto") + "\nNova :: x");
    agora += 30 * 60000;
    const r3 = await api.bkaGravarAgora("periódico");
    ok(r3.ok && P.escritas === n0 + 1 && P.arqs.size === 1 && /Nova :: x/.test(P.conteudo(nome).dados.cartoes.eac_texto), "C4 mudou: regrava o MESMO arquivo do dia (um só por dia)");
    ok(api.bkHistorico().filter((x) => x.nome === nome).length === 1, "C5 a lista de cópias ganha UMA linha pelo arquivo do dia, não uma a cada 30 minutos");
    /* apagar 3 de 30 cartões não é "encolher" */
    L.setItem("eac_texto", Array.from({ length: 27 }, (_, i) => "Pergunta " + i + " :: Resposta " + i).join("\n"));
    const r4 = await api.bkaGravarAgora("periódico");
    ok(r4.ok && !api.bkaEstado().pausado, "E0 apagar 3 de 30 cartões grava normalmente (não pausa)");
  }

  /* ---- S-B: rotação ---- */
  {
    dia(0);
    const { api, L, P } = preparar();
    P.arqs.set("easyankicards-20261001-1000.json.gz", { dados: new Uint8Array([1]), mod: 1 });
    P.arqs.set("easyankicards-auto-notebook-20260901.json.gz", { dados: new Uint8Array([1]), mod: 1 });
    P.arqs.set("outra-coisa.txt", { dados: new Uint8Array([1]), mod: 1 });
    await conduzir(api, api.bkaConectar());
    for (let d = 1; d <= 8; d++) {
      dia(d);
      L.setItem("eac_texto", L.getItem("eac_texto") + "\nDia " + d + " :: x");
      await api.bkaGravarAgora("periódico");
    }
    const meus = [...P.arqs.keys()].filter((n) => /auto-pc-da-sala/.test(n)).sort();
    /* (19.129.0) retenção em degraus: as 7 diárias (27/10 a 02/11) e, das mais velhas, a mais nova de cada semana —
     * 26/10 (segunda, a semana de 26/10) e 25/10 (domingo, a semana anterior) ficam como semanais */
    ok(meus.length === 9 && meus[0] === "easyankicards-auto-pc-da-sala-20261025.json.gz" && meus[8] === "easyankicards-auto-pc-da-sala-20261102.json.gz",
      "S-B ficam as 7 diárias e as duas semanais (25 e 26/10): " + meus.join(" "));
    {
      /* 120 dias seguidos, até 14/11/2026 */
      const dias = [];
      for (let k = 0; k < 120; k++) { const d = new Date(2026, 10, 14 - k); dias.push(d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0")); }
      const f = [...api.bkaQuaisFicam(dias)].sort().reverse();
      ok(f.length === 15 && f.slice(0, 7).join() === "20261114,20261113,20261112,20261111,20261110,20261109,20261108",
        "S-B3 de 120 dias ficam 15 (7 diárias + 4 semanais + os 4 meses que existem): " + f.join(" "));
      ok(f.slice(7, 11).join() === "20261107,20261101,20261025,20261018", "S-B4 depois, a mais nova de cada uma das 4 semanas anteriores: " + f.slice(7, 11).join());
      ok(f.slice(11).join() === "20261011,20260930,20260831,20260731", "S-B5 e, do que é mais velho que as semanais, a mais nova de cada mês: " + f.slice(11).join());
      const ano = [];
      for (let k = 0; k < 400; k++) { const d = new Date(2026, 10, 14 - k); ano.push(d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0")); }
      ok([...api.bkaQuaisFicam(ano)].length === 17, "S-B5a com mais de um ano de cópias, ficam 17 (7 + 4 + 6): " + [...api.bkaQuaisFicam(ano)].length);
      ok(api.bkaSemanaDe("20261114") === "20261109" && api.bkaSemanaDe("20261109") === "20261109" && api.bkaSemanaDe("20261108") === "20261102", "S-B6 a semana vai de segunda a domingo");
      ok([...api.bkaQuaisFicam(["20261114", "20261113"])].length === 2 && [...api.bkaQuaisFicam([])].length === 0, "S-B7 com poucos arquivos, nada sai");
    }
    {
      /* o registro vai no arquivo, fora de "dados" — e não muda a impressão */
      const ultimo = P.conteudo("easyankicards-auto-pc-da-sala-20261102.json.gz");
      ok(ultimo.registro && Array.isArray(ultimo.registro.eventos) && ultimo.registro.eventos.length > 0 && !("registro" in ultimo.dados) && !JSON.stringify(ultimo.dados).includes("automático gravado"),
        "S-B8 o arquivo leva o registro do momento, fora dos dados: " + (ultimo.registro && ultimo.registro.n));
      const b1 = api.montarBackup(), i1 = api.bkaImpressao(b1.dados);
      api.bkComRegistro(b1);
      ok(api.bkaImpressao(b1.dados) === i1 && api.validarBackup(b1) === null, "S-B9 o registro não entra na impressão dos dados, e o arquivo continua válido");
    }
    ok(P.arqs.has("easyankicards-20261001-1000.json.gz") && P.arqs.has("easyankicards-auto-notebook-20260901.json.gz") && P.arqs.has("outra-coisa.txt"),
      "S-B2 a rotação não toca no backup manual, no do outro aparelho, nem em outro arquivo");
  }

  /* ---- E: os dados encolheram ---- */
  {
    dia(0);
    const { api, L, P } = preparar();
    await conduzir(api, api.bkaConectar());
    const doDia = "easyankicards-auto-pc-da-sala-20261025.json.gz";
    const bom = JSON.stringify(P.conteudo(doDia));
    L.setItem("eac_questoes", "[]");
    agora += 30 * 60000;
    const r = await api.bkaGravarAgora("periódico");
    ok(r.razao === "encolheu" && r.encolheu.some((x) => x.chave === "questoes" && x.de === 30 && x.para === 0), "E1 questões zeraram: pausa e diz o que encolheu: " + JSON.stringify(r.encolheu));
    ok(JSON.stringify(P.conteudo(doDia)) === bom, "E2 a cópia boa do dia NÃO foi sobrescrita");
    ok(P.arqs.has(r.nome) && /-1030-encolheu\.json\.gz$/.test(r.nome) && P.conteudo(r.nome).resumo.questoes === 0, "E3 o estado encolhido foi gravado à parte: " + r.nome);
    const n0 = P.escritas;
    agora += 30 * 60000;
    const r2 = await api.bkaGravarAgora("periódico");
    ok(r2.razao === "encolheu" && r2.jaGravado && P.escritas === n0, "E4 a mesma situação não grava outro 'encolheu' a cada 30 minutos");
    api.bkPintarPainel();
    ok(/pausado: questões caiu de 30 para 0/.test(corpo(api)) && /cópias boas/.test(corpo(api)) && api.$("btnBkaAceitar"), "E5 o painel explica e oferece 'Fui eu, pode seguir': " + corpo(api).slice(0, 120));
    ok(/pausado/.test(api.$("seloBase").textContent) && /sb-alerta/.test(api.$("seloBase").className) && api.$("seloBase").onclick, "E6 o selo do topo avisa (e abre o painel)");
    /* (19.127.0) o que encolheu, à vista: números, selo, barra, o que ficou igual, e as duas saídas */
    {
      const cmp = api.bkaComparacao();
      ok(cmp.caiu.length === 1 && cmp.caiu[0].chave === "questoes" && cmp.caiu[0].de === 30 && cmp.caiu[0].para === 0 && cmp.caiu[0].pct === -100
         && cmp.iguais.length === cmp.linhas.length - 1, "E6a a comparação: só as questões caíram, o resto está igual: " + JSON.stringify(cmp.caiu) + " iguais " + cmp.iguais.length);
      const enc = api.$("bkaEnc");
      const it = enc && enc.querySelectorAll(".bka-enc-item");
      ok(enc && it.length === 1 && /questões/.test(it[0].textContent) && /30 → 0/.test(it[0].textContent) && /▼ −30 \(−100%\)/.test(it[0].textContent),
         "E6b o item que caiu aparece com antes → agora e o selo da queda: " + (it && it[0] && it[0].textContent));
      ok(enc.querySelectorAll(".bka-enc-fica")[0].style.width === "0%", "E6c a barra mostra quanto ficou");
      ok(new RegExp("✓ " + (cmp.linhas.length - 1) + " de " + cmp.linhas.length + " itens sem mudança").test(enc.textContent) && enc.querySelectorAll("tr").length === cmp.linhas.length,
         "E6d diz quantos itens ficaram iguais, e a tabela inteira está a um toque: " + enc.textContent.slice(-120));
      ok(/Foi você que apagou isso\?/.test(corpo(api)) && api.$("btnBkaVerBoa") && /Não — ver a cópia boa/.test(api.$("btnBkaVerBoa").textContent) && /só restaura se você confirmar/.test(api.$("btnBkaVerBoa").textContent)
         && /Sim, fui eu/.test(api.$("btnBkaAceitar").textContent) && /como estão agora/.test(api.$("btnBkaAceitar").textContent),
         "E6e a pergunta e as duas saídas, cada uma com a consequência: " + api.$("btnBkaVerBoa").textContent + " | " + api.$("btnBkaAceitar").textContent);
      const onde = await api.bkaOndeEncolheu();
      ok(onde && onde.nome === doDia && Array.isArray(onde.editais), "E6f a última cópia boa é lida da pasta para dizer em qual edital foi: " + JSON.stringify(onde).slice(0, 160));
    }
    /* (19.127.0) "fui eu" pede uma SEGUNDA confirmação, com o que se perde escrito; cancelar não muda nada */
    {
      const c1 = await conduzir(api, api.bkaAceitarPedido(), () => false);
      ok(c1.r.razao === "cancelado" && api.bkaEstado().pausado && /DE PROPÓSITO/.test(c1.msgs.join("|")) && /questões: 30 → 0 \(some 30\)/.test(c1.msgs.join("|")) && /COMO ESTÃO AGORA/.test(c1.msgs.join("|")),
         "E6g a confirmação diz o que some e o efeito; cancelada, o backup continua pausado: " + c1.msgs.join("|").slice(0, 200));
      ok(P.conteudo(doDia).resumo.questoes === 30, "E6h e a cópia boa do dia segue intacta");
      /* a impressão ignora o carimbo "tocado" dos editais: abrir o app não é mudança */
      const d1 = { edital: { eac_editais: JSON.stringify([{ id: "a", nome: "X", tocado: "2026-11-13T02:00:00.000Z", progresso: { k: 1 } }]) } };
      const d2 = { edital: { eac_editais: JSON.stringify([{ id: "a", nome: "X", tocado: "2026-11-14T11:32:01.958Z", progresso: { k: 1 } }]) } };
      const d3 = { edital: { eac_editais: JSON.stringify([{ id: "a", nome: "X", tocado: "2026-11-14T11:32:01.958Z", progresso: {} }]) } };
      ok(api.bkaImpressao(d1) === api.bkaImpressao(d2) && api.bkaImpressao(d1) !== api.bkaImpressao(d3), "E6i só o 'tocado' diferente = mesma impressão; progresso diferente = outra");
    }
    /* a rotação não apaga um "encolheu" recente */
    await api.bkaAceitarEncolhido();
    {
      const u = api.bkaUltimasCopias(3);
      api.bkPintarPainel();
      ok(u.length >= 1 && u.length <= 3 && api.$("bkaHist") && /Últimas cópias/.test(api.$("bkaHist").textContent) && /automático/.test(api.$("bkaHist").textContent),
         "E7a o painel mostra as últimas cópias, resumidas: " + (api.$("bkaHist") && api.$("bkaHist").textContent.slice(0, 160)));
    }
    ok(!api.bkaEstado().pausado && P.conteudo(doDia).resumo.questoes === 0 && P.arqs.has(r.nome), "E7 'fui eu': volta a gravar a cópia do dia; o arquivo à parte fica");
    /* sem cópia automática anterior, compara com a última cópia MANUAL */
    const { api: a2, L: L2 } = preparar();
    a2.bkRegistrarCopia("download", "manual.json.gz");
    L2.setItem("eac_questoes", "[]");
    const r3 = await conduzir(a2, a2.bkaConectar());
    ok(r3.r.razao === "encolheu", "E8 primeira gravação na pasta: compara com a última cópia manual (questões 30 → 0 pausa)");
  }

  /* ---- S-A: gravação cortada ---- */
  {
    dia(0);
    const { api, L, P } = preparar();
    await conduzir(api, api.bkaConectar());
    const doDia = "easyankicards-auto-pc-da-sala-20261025.json.gz";
    const antes = JSON.stringify(P.conteudo(doDia));
    L.setItem("eac_texto", L.getItem("eac_texto") + "\nMais :: x");
    P.quebrarEscrita = true;
    const r = await api.bkaGravarAgora("periódico");
    P.quebrarEscrita = false;
    ok(r.razao === "erro" && JSON.stringify(P.conteudo(doDia)) === antes, "S-A gravação cortada: a cópia anterior fica intacta");
    api.bkPintarPainel();
    ok(/falhou: disco cheio/.test(corpo(api)) && /falhou/.test(api.$("seloBase").textContent), "S-A2 a falha aparece no painel e no selo (não fica calada)");
    const r2 = await api.bkaGravarAgora("periódico");
    ok(r2.ok && !api.bkaEstado().erro, "S-A3 na próxima tentativa grava e o aviso some");
  }

  /* ---- S-D: permissão vencida ---- */
  {
    dia(0);
    const { api, L, P } = preparar();
    await conduzir(api, api.bkaConectar());
    P.perm = "prompt";
    L.setItem("eac_texto", L.getItem("eac_texto") + "\nOutra :: x");
    const r = await api.bkaGravarAgora("periódico");
    ok(r.razao === "permissao" && P.perm === "prompt", "S-D sem permissão e sem gesto: não pede sozinho, não grava");
    api.bkPintarPainel();
    ok(api.$("btnBkaReconectar") && /pede de novo a permissão/.test(corpo(api)) && /reconectar/.test(api.$("seloBase").textContent), "S-D2 painel e selo mostram 'reconectar'");
    const n0 = P.escritas;
    const r2 = await api.bkaReconectar();
    ok(r2.ok && P.escritas === n0 + 1 && !/reconectar/.test(api.$("seloBase").textContent), "S-D3 reconectar (gesto) pede a permissão e grava");
    /* depois de recarregar a página: a pasta vem do IndexedDB e a permissão é consultada */
    const { api: a2, P: P2, loja: l2 } = preparar();
    l2.h = P2;
    a2.loja.setItem("eac_bk_auto", JSON.stringify({ ligado: true, pasta: P2.name }));
    P2.perm = "prompt";
    await a2.bkaIniciar();
    ok(a2.bkaPermissaoAtual() === "prompt" && a2.$("btnBkaReconectar"), "S-D4 ao abrir com a permissão vencida: oferece reconectar");
  }

  /* ---- S-F: backup mais novo de outro aparelho ---- */
  {
    dia(0);
    const { api, L, P } = preparar();
    await conduzir(api, api.bkaConectar());
    /* o notebook gravou depois, com outro conteúdo */
    const outro = api.montarBackup();
    outro.dados.cartoes.eac_texto = "Do notebook :: x";
    agora += 3 * 3600000;
    P.arqs.set("easyankicards-auto-notebook-20261025.json.gz", { dados: new Uint8Array(zlib.gzipSync(JSON.stringify(outro))), mod: agora });
    const m = await api.bkaProcurarMaisNovo();
    ok(m && m.aparelho === "notebook" && m.localMudou === false, "S-F achou o backup mais novo do notebook (e este aparelho não mudou desde o seu): " + JSON.stringify(m && { a: m.aparelho, l: m.localMudou }));
    api.bkPintarPainel();
    ok(/mais novo de outro aparelho \(notebook\)/.test(corpo(api)) && api.$("btnBkaVerMaisNovo") && /notebook/.test(api.$("seloBase").textContent), "S-F2 aviso no painel e no selo");
    ok(L.getItem("eac_texto") !== "Do notebook :: x", "S-F3 nada foi restaurado sozinho");
    await api.bkaVerMaisNovo();
    ok(api.$("dlgBkConf").open && /notebook/.test(api.$("bkConfArquivo").textContent), "S-F4 'Ver e restaurar' abre a conferência de sempre");
    await conduzir(api, api.bkConfirmarRestauro());
    ok(L.getItem("eac_texto") === "Do notebook :: x" && !api.bkaMaisNovoAtual(), "S-F5 confirmado: restaurou, e o aviso some");
    const m2 = await api.bkaProcurarMaisNovo();
    ok(!m2, "S-F6 o arquivo restaurado não volta a ser 'mais novo'");
    /* este aparelho mudou também: o aviso diz */
    L.setItem("eac_texto", "mexi aqui :: x");
    agora += 3600000;
    P.arqs.set("easyankicards-auto-notebook-20261025.json.gz", { dados: new Uint8Array(zlib.gzipSync(JSON.stringify(outro))), mod: agora });
    const m3 = await api.bkaProcurarMaisNovo();
    api.bkPintarPainel();
    ok(m3 && m3.localMudou && /também tem mudanças/.test(corpo(api)), "S-F7 este aparelho também mudou: o aviso diz que restaurar troca essas mudanças");
    /* restaurar uma base menor não pausa o automático (a referência passa a ser o que veio) */
    const menor = api.montarBackup();
    menor.dados.material.eac_questoes = "[]";
    await api.bkLerArquivo({ name: "menor.json", text: async () => JSON.stringify(menor) });
    await conduzir(api, api.bkConfirmarRestauro());
    agora += 60000;
    const r = await api.bkaGravarAgora("periódico");
    ok(r.ok && !api.bkaEstado().pausado, "S-F8 depois de restaurar uma base com menos questões, o automático grava (não pausa)");
    /* o arquivo DESTE aparelho mais novo que a base (outra aba do mesmo computador gravou) não é "outro aparelho" */
    const { api: a9, P: P9 } = preparar();
    await conduzir(a9, a9.bkaConectar());
    agora += 3 * 3600000;
    const meuNome = "easyankicards-auto-pc-da-sala-20261025.json.gz";
    P9.arqs.set(meuNome, Object.assign({}, P9.arqs.get(meuNome), { mod: agora }));
    ok(!(await a9.bkaProcurarMaisNovo()), "S-F9 o arquivo deste mesmo aparelho (outra aba) nunca vira 'backup mais novo de outro aparelho'");
  }

  /* ---- desligar; o manual continua ---- */
  {
    dia(0);
    const { api, P, loja } = preparar();
    await conduzir(api, api.bkaConectar());
    await conduzir(api, api.bkaDesligar());
    ok(!api.bkaEstado().ligado && loja.h === null && P.arqs.size === 1, "D1 desligar esquece a pasta e não apaga os arquivos");
    const r = await api.bkaGravarAgora("periódico");
    ok(r.razao === "sem_pasta", "D2 desligado: não grava");
    api.bkPintarPainel();
    ok(api.$("btnBkaConectar") && !api.$("btnBkBaixar").hidden, "M2 o painel volta a oferecer a pasta, e o 'Baixar arquivo' segue lá");
    const { msgs } = await conduzir(api, api.bkBaixar());
    ok(msgs.some((m) => /Backup baixado como easyankicards-\d{8}-\d{4}\.json\.gz/.test(m)) && api.loja.getItem("eac_backup_onde") === "download", "M3 o backup manual (baixar) continua funcionando: " + msgs.join(" / "));
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["bk_onde_auto", "bka_tit", "bka_exp", "bka_sem_suporte", "bka_conectar", "bka_pasta", "bka_pasta_perdida", "bka_permissao", "bka_reconectar", "bka_pausado", "bka_pausado_item",
      "bka_aceitar", "bka_aceitar_tip", "bka_erro", "bka_ultimo", "bka_ainda_nao", "bka_mais_novo", "bka_mais_novo_local", "bka_ver_mais_novo", "bka_gravar_agora", "bka_gravado",
      "bka_renomear", "bka_renomear_pergunta", "bka_trocar", "bka_desligar", "bka_desligado", "bka_selo_reconectar", "bka_selo_pausado", "bka_selo_erro", "bka_selo_mais_novo"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }

  /* ---- I (19.128.0): o retrato na abertura e a conferência de integridade ---- */
  {
    dia(0);
    const { api, L } = preparar();
    const regs = () => (api.registroAtual ? api.registroAtual() : []).map((x) => JSON.stringify(x));
    const r1 = await api.intConferir({ semAviso: true });
    ok(r1.semReferencia && api.intLer() && api.intLer().resumo.questoes === 30 && api.intLer().versao, "I1 primeira abertura: o retrato vira a referência: " + JSON.stringify(api.intLer()).slice(0, 140));
    ok(regs().some((x) => /ABERTURA/.test(x) && /versão /.test(x) && /questões 30/.test(x)), "I2 o registro ganha o evento ABERTURA com a versão e os totais");
    ok(/primeira abertura/.test(api.intLinhaDiagnostico().txt), "I2a o diagnóstico diz que é a primeira conferência");
    const r2 = await api.intConferir({ semAviso: true });
    ok(!r2.caiu.length && api.intLinhaDiagnostico().tipo === "ok" && /nada menor/.test(api.intLinhaDiagnostico().txt), "I3 nada mudou: conferência limpa: " + api.intLinhaDiagnostico().txt);
    /* o incidente: entre o fim de uma sessão e a abertura seguinte, as questões somem */
    L.setItem("eac_questoes", "[]");
    const c3 = await conduzir(api, api.intConferir());
    const r3 = c3.r;
    ok(r3.caiu.length === 1 && r3.caiu[0].chave === "questoes" && r3.caiu[0].de === 30 && r3.caiu[0].para === 0, "I4 a queda é vista NA ABERTURA: " + JSON.stringify(r3.caiu));
    ok(/MENOS dados/.test(c3.msgs.join("|")) && /questões: 30 → 0 \(faltam 30\)/.test(c3.msgs.join("|")) && /Restaurar de um arquivo/.test(c3.msgs.join("|")), "I5 o aviso sai na hora, com os números e o caminho: " + c3.msgs.join("|").slice(0, 200));
    ok(regs().some((x) => /INTEGRIDADE/.test(x) && /menores que no fim da última sessão/.test(x) && /questões 30 → 0/.test(x)), "I6 e vai para o registro como INTEGRIDADE");
    ok(api.intLinhaDiagnostico().tipo === "aviso" && /questões 30 → 0/.test(api.intLinhaDiagnostico().txt), "I7 o resumo do diagnóstico mostra a queda: " + api.intLinhaDiagnostico().txt);
    ok(api.intLer().resumo.questoes === 30, "I8 a referência boa NÃO é trocada pela encolhida na abertura (reabrir repete o aviso)");
    /* o fim da sessão regrava a referência: apagar de propósito não vira alarme depois */
    api.intFecharSessao();
    const r4 = await api.intConferir({ semAviso: true });
    ok(api.intLer().resumo.questoes === 0 && !r4.caiu.length, "I9 no fim da sessão o retrato de agora vira a referência; a abertura seguinte não alarma");
    ok(api.intQuedas({ questoes: 100, resumos: 10 }, { questoes: 97, resumos: 10 }).length === 0, "I10 queda pequena (3 de 100) não alarma");
  }
  /* ---- A (19.130.0): duas abas do app abertas ---- */
  {
    const { api } = rodar();
    let rel = 1000000;
    const enviadas = [];
    api.abasRelogioDefinir(() => rel);
    api.abasEnviarDefinir((m) => enviadas.push(m));
    api.abasIniciar({ semCanal: true });
    api.abasEnviarDefinir((m) => enviadas.push(m));
    const fx = api.$("abasFaixa");
    const regs = () => (api.registroAtual ? api.registroAtual() : []).map((x) => JSON.stringify(x));
    ok(fx && fx.hidden === true && api.abasLinhaDiagnostico().tipo === "ok", "A1 sozinha: sem faixa, diagnóstico 'só esta aberta'");
    api.abasReceber({ t: "ola", id: "outra1" });
    ok(api.abasEstado().outras === 1 && fx.hidden === false && /aberto em outra aba/.test(api.$("abasFaixaTxt").textContent) && !/grave/.test(fx.className),
       "A2 outra aba diz olá: a faixa avisa: " + api.$("abasFaixaTxt").textContent.slice(0, 80));
    ok(enviadas.some((m) => m.t === "aqui" && m.id === api.abasEstado().id), "A2a e esta responde 'aqui' (a outra também fica sabendo)");
    ok(regs().filter((x) => /ABAS/.test(x) && /aberto em outra aba/.test(x)).length === 1, "A3 vai para o registro");
    api.abasReceber({ t: "viva", id: "outra1" });
    ok(regs().filter((x) => /ABAS/.test(x) && /aberto em outra aba/.test(x)).length === 1, "A3a uma vez só por aparição (o sinal de 10 s não repete)");
    api.abasReceber({ t: "ola", id: api.abasEstado().id });
    ok(api.abasEstado().outras === 1, "A4 a própria mensagem não conta como outra aba");
    api.$("btnAbasFechar").onclick();
    ok(fx.hidden === true && /mais 1 aba/.test(api.abasLinhaDiagnostico().txt), "A5 'entendi' recolhe a faixa; o diagnóstico continua dizendo");
    /* a outra aba grava: esta fica desatualizada — e a faixa volta, vermelha, com o recarregar */
    ok(api.abasGravouFora({ key: "eac_tema_x", oldValue: "a", newValue: "b" }) === false && fx.hidden === true, "A6 preferência gravada pela outra aba não é alarme");
    ok(api.abasGravouFora({ key: "eac_editais", oldValue: "[1]", newValue: "[]" }) === true, "A7 dado gravado pela outra aba é");
    ok(fx.hidden === false && /grave/.test(fx.className) && /A outra aba gravou dados \(editais e progresso\)/.test(api.$("abasFaixaTxt").textContent)
       && api.$("btnAbasRecarregar").hidden === false && api.$("btnAbasFechar").hidden === true,
       "A7a a faixa fica vermelha, diz o que mudou e oferece recarregar (sem 'entendi'): " + api.$("abasFaixaTxt").textContent.slice(0, 110));
    api.abasGravouFora({ key: "eac_questoes", oldValue: "[]", newValue: "[1]" });
    ok(/editais e progresso, questões/.test(api.$("abasFaixaTxt").textContent) && regs().filter((x) => /outra aba gravou dados/.test(x)).length === 2, "A7b cada tipo de dado entra na lista e no registro");
    ok(api.abasLinhaDiagnostico().tipo === "aviso" && /desatualizada/.test(api.abasLinhaDiagnostico().txt), "A8 o diagnóstico diz que esta aba está desatualizada");
    /* a outra fecha */
    api.abasReceber({ t: "tchau", id: "outra1" });
    ok(api.abasEstado().outras === 0 && fx.hidden === false, "A9 a outra fechou, mas esta continua desatualizada: a faixa fica até recarregar");
    /* e some sozinha quem parou de dar sinal */
    const b = rodar().api;
    let r2 = 5000000;
    b.abasRelogioDefinir(() => r2);
    b.abasReceber({ t: "ola", id: "z" });
    r2 += 26000;
    b.abasReceber({ t: "viva", id: "y" });
    ok(b.abasEstado().outras === 1, "A10 aba que não dá sinal há 25 s sai da conta (ficou só a que acabou de falar): " + b.abasEstado().outras);
  }
  return falhas;
}

module.exports = { testes };
