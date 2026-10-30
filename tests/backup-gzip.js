/* =====================================================================
 * BACKUP COMPACTADO E SEM O HISTÓRICO LOCAL (v19.16.0 — Fase 1 do plano de backup)
 *
 * O PEDIDO: o backup de 24/10 tinha 7,4 MB. Com gzip e sem o "eac_hist" (o desfazer da bancada deste aparelho), cai
 * para ~1,2 MB — sem mudar o formato do conteúdo.
 *
 * O QUE PRECISA SER VERDADE:
 *  B-A o .json.gz restaura e devolve exatamente o mesmo conteúdo;
 *  B-B o .json de sempre (inclusive o que traz "eac_hist") continua restaurando;
 *  B-C o arquivo é reconhecido pela ASSINATURA, não pela extensão (renomeado, sem extensão);
 *  B-D sem CompressionStream, sai o .json de sempre; sem DecompressionStream, um .gz é recusado com mensagem própria;
 *  B-E depois de restaurar, o desfazer local ("eac_hist") continua — com a versão "antes de restaurar backup";
 *  B-F "eac_hist" não vai no arquivo;
 *  e: compartilhar que recusa .gz manda o .json; regravar segue o formato do nome do arquivo escolhido.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

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
    await promessa;
    return msgs;
  };
  const arquivo = (nome, bytes) => ({ name: nome, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  const textoGrande = Array.from({ length: 400 }, (_, i) => "Art. " + (i + 1) + ". O contribuinte é obrigado ao pagamento do tributo, nos termos da lei. :: resposta " + i).join("\n");
  const preparar = () => {
    const r = rodar();
    const L = r.api.loja;
    L.setItem("eac_texto", textoGrande);
    L.setItem("eac_hist", JSON.stringify([{ t: 1, m: "ao abrir", txt: "versão local antiga" }]));
    if (r.api.carregarHistorico) r.api.carregarHistorico();
    r.api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    return Object.assign(r, { L });
  };

  /* ---- B-F e o tamanho ---- */
  {
    const { api } = preparar();
    const bk = api.montarBackup();
    ok(!("eac_hist" in bk.dados.cartoes) && !/eac_hist/.test(JSON.stringify(bk)), "B-F 'eac_hist' não vai no arquivo (nem como chave, nem em lugar nenhum)");
    const emb = await api.bkEmbrulhar();
    ok(emb.gz && /^easyankicards-\d{8}-\d{4}\.json\.gz$/.test(emb.nome) && emb.tipo === "application/gzip" && api.bkEhGzip(emb.dados), "G1 o arquivo sai compactado, com nome .json.gz: " + emb.nome);
    const json = api.bkTextoDoArquivo ? JSON.stringify(api.montarBackup(), null, 1) : "";
    ok(emb.dados.length < json.length / 4, "G2 bem menor que o .json (" + emb.dados.length + " de " + json.length + " bytes)");
    const sem = await api.bkEmbrulhar(true);
    ok(!sem.gz && /\.json$/.test(sem.nome) && typeof sem.dados === "string" && JSON.parse(sem.dados).app === "EasyAnkiCards", "G3 'sem compactar' sai o .json de sempre");
  }

  /* ---- B-A, B-C: o .gz volta igual, qualquer que seja o nome ---- */
  {
    const { api, L } = preparar();
    const emb = await api.bkEmbrulhar();
    const dadosAntes = JSON.stringify(api.montarBackup().dados);
    for (const nome of [emb.nome, "backup.dat", "arquivo-sem-extensao"]) {
      await api.bkLerArquivo(arquivo(nome, emb.dados));
      ok(api.$("dlgBkConf").open && /EasyAnkiCards|\d/.test(api.$("bkConfArquivo").textContent) && api.$("bkConfArquivo").textContent.indexOf(nome) >= 0, "B-C '" + nome + "' é reconhecido pela assinatura e vai para a conferência");
      api.$("dlgBkConf").close();
    }
    /* restaurar o .gz noutro aparelho devolve o mesmo conteúdo */
    const { api: api2, L: L2 } = preparar();
    L2.setItem("eac_texto", "outro aparelho :: x");
    await api2.bkLerArquivo(arquivo(emb.nome, emb.dados));
    await conduzir(api2, api2.bkConfirmarRestauro());
    ok(L2.getItem("eac_texto") === textoGrande, "B-A o .gz restaurado devolve o mesmo texto");
    ok(JSON.stringify(api2.montarBackup().dados.cartoes) === JSON.stringify(JSON.parse(dadosAntes).cartoes), "B-A2 as chaves dos cartões ficam idênticas às do aparelho de origem");
  }

  /* ---- B-B: .json antigo, com "eac_hist", pelos dois caminhos de leitura ---- */
  {
    const { api, L } = preparar();
    const velho = api.montarBackup();
    velho.versao_app = "19.12.3";
    velho.dados.cartoes.eac_texto = "do backup antigo :: x";
    velho.dados.cartoes.eac_hist = JSON.stringify([{ t: 2, m: "x", txt: "histórico do OUTRO aparelho" }]);
    const bytes = new TextEncoder().encode(JSON.stringify(velho, null, 1));
    await api.bkLerArquivo(arquivo("easyankicards-20261024-2338.json", bytes));
    ok(api.$("dlgBkConf").open, "B-B .json antigo (lido como bytes) abre a conferência");
    api.$("editor").value = L.getItem("eac_texto");
    await conduzir(api, api.bkConfirmarRestauro());
    ok(L.getItem("eac_texto") === "do backup antigo :: x", "B-B2 restaurou o .json antigo");
    const hist = JSON.parse(L.getItem("eac_hist") || "[]");
    ok(!hist.some((h) => /OUTRO aparelho/.test(h.txt)), "B-E o histórico do arquivo NÃO entra (não apaga o local)");
    ok(hist.some((h) => /versão local antiga/.test(h.txt)) && hist.some((h) => h.m === "antes de restaurar backup" && h.txt === textoGrande),
      "B-E2 o desfazer local continua, com a versão 'antes de restaurar backup': " + hist.map((h) => h.m).join(" | "));
    /* arquivo que só sabe dar texto (sem arrayBuffer) também serve */
    const { api: api3 } = preparar();
    await api3.bkLerArquivo({ name: "b.json", text: async () => JSON.stringify(velho) });
    ok(api3.$("dlgBkConf").open, "B-B3 arquivo só com text() continua funcionando");
  }

  /* ---- B-D: navegador sem compressão ---- */
  {
    const { api } = preparar();
    const CS = globalThis.CompressionStream, DS = globalThis.DecompressionStream;
    const gz = (await api.bkEmbrulhar()).dados;
    try {
      globalThis.CompressionStream = undefined;
      const emb = await api.bkEmbrulhar();
      ok(!emb.gz && /\.json$/.test(emb.nome) && typeof emb.dados === "string", "B-D sem CompressionStream: sai o .json de sempre");
      api.bkIniciar(); api.bkPintarBotoes();
      ok(api.$("btnBkBaixarJson").hidden === true, "B-D2 e o 'baixar sem compactar' some (já é .json)");
      globalThis.DecompressionStream = undefined;
      const msgs = await conduzir(api, api.bkLerArquivo(arquivo("b.json.gz", gz)));
      ok(msgs.some((m) => /backup compactado/.test(m) && /não sabe abri-lo/.test(m)) && !api.$("dlgBkConf").open, "B-D3 .gz num navegador que não descompacta: mensagem própria: " + msgs.join(" / "));
    } finally { globalThis.CompressionStream = CS; globalThis.DecompressionStream = DS; }
    api.bkPintarBotoes();
    ok(api.$("btnBkBaixarJson").hidden === false, "B-D4 com compressão, o 'baixar sem compactar' aparece");
    const msgs = await conduzir(api, api.bkLerArquivo(arquivo("lixo.json", new TextEncoder().encode("não sou um backup"))));
    ok(msgs.some((m) => /não é um backup do EasyAnkiCards/.test(m)), "B-D5 arquivo qualquer: a mensagem fala de .json e .json.gz: " + msgs.join(" / "));
  }

  /* ---- compartilhar e regravar ---- */
  {
    const { api, janela } = preparar();
    const enviados = [];
    janela.navigator.canShare = ({ files }) => !/gzip/.test(files[0].type);
    janela.navigator.share = async ({ files }) => { enviados.push(files[0].name); };
    await conduzir(api, api.bkSalvarNaNuvem());
    ok(enviados.length === 1 && /\.json$/.test(enviados[0]), "S1 o sistema recusa .gz no compartilhar: vai o .json (nunca menos que antes): " + enviados.join());
    janela.navigator.canShare = () => true;
    enviados.length = 0;
    await conduzir(api, api.bkSalvarNaNuvem());
    ok(enviados.length === 1 && /\.json\.gz$/.test(enviados[0]), "S2 o sistema aceita .gz: vai compactado: " + enviados.join());
    /* regravar: o formato segue o NOME do arquivo escolhido */
    let escrito = null;
    const alca = (nome) => ({ name: nome, createWritable: async () => ({ write: async (x) => { escrito = x; }, close: async () => {} }) });
    api.bkPorPasta(alca("easyankicards-dados.json.gz"));
    await conduzir(api, api.bkRegravar());
    ok(escrito && api.bkEhGzip(escrito), "R1 regravar num .json.gz grava compactado");
    api.bkPorPasta(alca("easyankicards-dados.json"));
    await conduzir(api, api.bkRegravar());
    ok(typeof escrito === "string" && JSON.parse(escrito).app === "EasyAnkiCards", "R2 regravar num .json grava .json (um .json com gzip dentro enganaria)");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["bk_erro_sem_gzip", "bk_baixar_json", "bk_baixar_json_tip", "bk_erro_json"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
