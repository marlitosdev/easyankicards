/* =====================================================================
 * CONSUMO DA API DO GEMINI (v18.99.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. cada chamada é anotada: tokens do Google (entrada; saída + "pensamento"), modelo que respondeu, busca, tempo,
 *     status — e NUNCA o texto do pedido; erro de cota contado à parte; incorporações com estimativa marcada;
 *  2. o custo sai da tabela (editável, com data); no plano gratuito o efetivo é zero (e diz quanto seria);
 *  3. o limite diário é o da pessoa (sem ele, só conta); a cotação é dela (sem ela, só US$);
 *  4. testar a chave: chave no cabeçalho, nunca na URL; ativa, recusada, cota;
 *  5. faturas são anotações (mês, valor, situação), e a estimativa do app vem marcada como estimativa;
 *  6. a tela: selo no cabeçalho só com chave; abas da tela da chave; a linha "N consultas hoje" na jurisprudência;
 *  7. nada disso entra no backup.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, sim) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 20 && !pronto; i++) { await new Promise((r) => setImmediate(r)); try { api._uiFechar(sim !== false); } catch (e) {} }
    return promessa;
  };
  const gemini = (J, respostas) => {
    const chamadas = [];
    J.fetch = async (url, op) => {
      chamadas.push({ url, op });
      const r = respostas.shift();
      if (r instanceof Error) throw r;
      return { ok: r.status === 200, status: r.status, json: async () => r.json };
    };
    return chamadas;
  };
  const respOk = { status: 200, json: { modelVersion: "gemini-2.5-flash", usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 300, thoughtsTokenCount: 200 },
    candidates: [{ content: { parts: [{ text: "{}" }] }, groundingMetadata: { groundingChunks: [{ web: { title: "stf.jus.br", uri: "https://x.test/r" } }] } }] } };

  /* ---- 1 e 2: anotar e custo ---- */
  {
    const { api: a, janela: J } = rodar();
    a.vzGuardarChave("AIzaTESTE123456");
    a.segurarAdiados();
    gemini(J, [JSON.parse(JSON.stringify(respOk)), { status: 429, json: { error: { message: "quota" } } }]);
    await a.jurIaPerguntar("PEDIDO SECRETO COM O TEXTO DA EMENTA", { busca: true, modulo: "JURIS" });
    try { await a.jurIaPerguntar("outro pedido"); } catch (e) {}
    a.soltarAdiados();
    const r = a.iacResumo();
    ok(r.hoje.n === 2 && r.hoje.ok === 1 && r.hoje.erros === 1 && r.hoje.cota === 1, "K1 duas chamadas anotadas: 1 certa, 1 por cota: " + JSON.stringify(r.hoje));
    ok(r.recentes[0].erro === "cota" && r.recentes[0].status === 429 && r.recentes[0].ok === false, "K1c a chamada recusada guarda o motivo (cota) e o status: " + JSON.stringify(r.recentes[0]));
    ok(r.hoje.tkIn === 1000 && r.hoje.tkOut === 500 && r.hoje.buscas === 1, "K1a tokens do Google: entrada 1000; saída 300 + 200 de 'pensamento'; 1 busca");
    const usd = 1000 / 1e6 * 0.30 + 500 / 1e6 * 2.50 + 0.035;
    ok(Math.abs(r.usdTabela - usd) < 1e-9 && r.usdEfetivo === 0 && r.plano === "gratuito", "K2 custo de tabela calculado; no plano gratuito o efetivo é zero: " + r.usdTabela);
    const bruto = a.lojaLer(a.IAC_CH);
    ok(bruto.indexOf("SECRETO") < 0 && bruto.indexOf("EMENTA") < 0 && r.recentes[1].modelo === "gemini-2.5-flash" && r.recentes[1].busca === true, "K1b o texto do pedido NUNCA é guardado; o modelo que respondeu e a busca sim");
    a.iacConfigurar({ plano: "pago", cotacao: "5,40", limiteDia: 250 });
    const r2 = a.iacResumo();
    ok(Math.abs(r2.usdEfetivo - usd) < 1e-9 && r2.cotacao === 5.4 && r2.limiteDia === 250, "K2a pago: o efetivo é a tabela; cotação aceita vírgula; limite guardado");
    ok(Math.abs(a.iacCusto({ modelo: "gemini-embedding-001", tkIn: 2e6 }) - 0.30) < 1e-9 && Math.abs(a.iacCusto({ modelo: "gemini-flash-latest", tkIn: 1e6 }) - 0.30) < 1e-9, "K2b o preço vai pela família do modelo (flash-latest = flash; embedding)");
    a.iacLimpar();
    ok(a.iacResumo().hoje.n === 0, "K2c limpar zera o registro");
  }

  /* ---- incorporações (vínculos) ---- */
  {
    const { api: a } = rodar();
    a.vzGuardarChave("AIzaTESTE123456");
    const buscar = async () => ({ ok: true, status: 200, json: async () => ({ embeddings: [{ values: [1, 0] }, { values: [0, 1] }] }) });
    await a.vzVetores(["Direito Tributário", "Imunidades"], { buscar });
    const x = a.iacResumo().recentes[0];
    ok(x && x.modulo === "VINCULO" && x.modelo === "gemini-embedding-001" && x.estimado === true && x.tkIn === Math.ceil("Direito Tributário Imunidades".length / 4), "K3 as incorporações anotadas, com tokens estimados e marcados: " + JSON.stringify(x));
  }

  /* ---- 4: testar a chave ---- */
  {
    const { api: a, janela: J } = rodar();
    a.vzGuardarChave("AIzaTESTE123456");
    let ch = gemini(J, [{ status: 200, json: { models: [{ name: "models/gemini-2.5-flash" }, { name: "models/gemini-embedding-001" }] } }]);
    const d = await a.iacTestarChave();
    ok(d.ativa && d.temFlash && d.temEmbedding && d.n === 2 && ch[0].url.indexOf("AIza") < 0 && ch[0].op.headers["x-goog-api-key"] === "AIzaTESTE123456",
      "K4 chave ativa, modelos vistos, chave no cabeçalho (nunca na URL)");
    gemini(J, [{ status: 400, json: { error: { message: "API key not valid." } } }]);
    ok((await a.iacTestarChave()).erro === "chave_recusada", "K4a chave inválida: recusada");
    gemini(J, [{ status: 429, json: {} }]);
    ok((await a.iacTestarChave()).erro === "cota", "K4b 429: cota");
    a.vzGuardarChave("");
    ok((await a.iacTestarChave()).erro === "sem_chave", "K4c sem chave");
  }

  /* ---- 5: faturas ---- */
  {
    const { api: a } = rodar();
    ok(a.iacFaturaGuardar({ competencia: "out/2026", valor: 3 }) === null, "K5 mês inválido não entra");
    a.iacFaturaGuardar({ competencia: "2026-09", valor: "12,50", moeda: "USD", status: "aberta" });
    a.iacFaturaGuardar({ competencia: "2026-10", valor: 0, status: "isenta" });
    ok(a.iacFaturas().map((f) => f.competencia + ":" + f.valor + ":" + f.status).join() === "2026-10:0:isenta,2026-09:12.5:aberta", "K5a anotadas, a mais nova primeiro, valor com vírgula");
    a.iacFaturaStatus("2026-09", "paga");
    ok(a.iacFaturas().find((f) => f.competencia === "2026-09").status === "paga", "K5b marcar paga");
  }

  /* ---- 6: a tela ---- */
  {
    const { api: a, janela: J } = rodar();
    a.iacIniciarTela();
    a.vkIniciarTela();
    ok(a.$("btnHdrIa").hidden === true, "K6 sem chave: nenhum selo no cabeçalho");
    a.vzGuardarChave("AIzaTESTE123456");
    a.jurIaLigar(true);
    a.iacConfigurar({ limiteDia: 250 });
    a.segurarAdiados();
    gemini(J, [JSON.parse(JSON.stringify(respOk))]);
    await a.jurIaPerguntar("p", { busca: false });
    a.soltarAdiados();
    ok(a.$("btnHdrIa").hidden === false && /1 hoje/.test(a.$("btnHdrIa").textContent), "K6a com chave: o selo mostra o consumo de hoje: " + a.$("btnHdrIa").textContent);
    a.$("btnHdrIa").onclick();
    ok(a.$("dlgVzChave").open && a.$("vzAba_consumo").hidden === false && a.$("vzAba_chave").hidden === true && a.$("btnVzAba_consumo").className.indexOf("ativa") >= 0, "K6b o selo abre a tela da chave já na aba Consumo");
    ok(/de 250 \(seu limite\)/.test(a.$("iacKpiHoje").textContent) && a.$("iacLimiteBarra").hidden === false, "K6c o cartão de hoje compara com o limite que a pessoa informou");
    ok(a.$("iacRecentes").querySelectorAll("li").length === 1 && /Jurisprudência/.test(a.$("iacRecentes").textContent), "K6d as últimas chamadas aparecem");
    /* configuração pela tela */
    a.$("iacCotacao").value = "5,40"; a.$("iacPlano").value = "pago"; a.$("iacLimite").value = "100";
    a.$("btnIacSalvarCfg").onclick();
    ok(/R\$/.test(a.$("iacKpiCusto").textContent) && /de 100/.test(a.$("iacKpiHoje").textContent), "K6e salvar a configuração: R$ aparece e o limite muda");
    /* faturas pela tela */
    a.$("btnVzAba_faturas").onclick();
    ok(a.$("vzAba_faturas").hidden === false && /estimativa/i.test(a.$("iacFatEstimativa").textContent) && a.$("iacLinks").querySelectorAll("a").length === 5, "K6f aba Faturas: estimativa marcada e os 5 atalhos oficiais");
    a.$("iacFatMes").value = "2026-09"; a.$("iacFatValor").value = "3,20"; a.$("iacFatMoeda").value = "BRL"; a.$("iacFatStatus").value = "aberta"; a.$("iacFatNota").value = "";
    a.$("btnIacFatGuardar").onclick();
    ok(a.$("iacFat_2026-09") && /em aberto/.test(a.$("iacFat_2026-09").textContent) && /09\/2026/.test(a.$("iacFatMsg").textContent), "K6g anotar pela tela (a confirmação diz o mês como 09/2026)");
    {
      const css = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      ok(!/^\.btn-link\{background:none/m.test(css) && /\.iac-links a\{color:var\(--info\)\}/.test(css) && /\.iac-fat-form input\[type=month\]\{[^}]*background:var\(--campo\)/.test(css), "K6l o estilo do painel não redefine o .btn-link do resto do app; os atalhos têm cor legível");
    }
    a.$("iacFat_2026-09_paga").onclick();
    ok(/paga/.test(a.$("iacFat_2026-09").textContent), "K6h marcar paga pela tela");
    await conduzir(a, a.$("iacFat_2026-09_apagar").onclick(), true);
    ok(a.iacFaturas().length === 0, "K6i apagar (com confirmação)");
    a.$("btnVzAba_chave").onclick();
    ok(a.$("vzAba_chave").hidden === false && a.$("vzAba_consumo").hidden === true, "K6j volta à aba da chave");
    /* a linha na jurisprudência */
    const el = a.jurIaBotao({ id: "t", pedido: () => "p", destino: "x" });
    ok(/1 consulta\(s\) hoje/.test(el.textContent) && el.querySelectorAll(".btn-link").length === 1, "K6k ao lado do botão do Gemini: quantas hoje e 'ver consumo'");
  }

  /* ---- 7: fora do backup ---- */
  {
    const bk = fs.readFileSync(path.join(__dirname, "..", "docs", "backup.js"), "utf8");
    ok(bk.indexOf("eac_ia_consumo") < 0, "K7 o registro de consumo não entra no backup");
  }
  return falhas;
}

module.exports = { testes };
