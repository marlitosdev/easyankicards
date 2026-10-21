/* =====================================================================
 * GEMINI DIRETO NA JURISPRUDÊNCIA (v18.97.0) — opcional, desligado por padrão
 *
 * O QUE PRECISA SER VERDADE:
 *  1. desligado por padrão: com chave e sem ligar, nenhum botão (só o link "configurar"); a tela da chave liga e desliga;
 *  2. a chamada: chave no cabeçalho (nunca na URL), busca só quando pedida, modelo indisponível → tenta o próximo,
 *     cada erro com nome (chave recusada, cota, servidor, rede, tempo, sem resposta);
 *  3. a resposta cai na MESMA caixa e passa pela conferência de sempre — nada é gravado antes do "aplicar";
 *  4. a tela diz o que está acontecendo (esperando, ok, erro com "nada foi gravado") e mostra onde a IA pesquisou
 *     como links — nunca no campo "fonte";
 *  5. os cinco lugares ganham o botão: conferir julgados (passo 6), gaveta (ler a ementa), julgado citado, completar,
 *     melhorar o resumo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const tique = () => new Promise((r) => setImmediate(r));
  /* um Gemini de mentira: registra as chamadas e responde o que o teste mandar */
  const gemini = (J, respostas) => {
    const chamadas = [];
    J.fetch = async (url, op) => {
      chamadas.push({ url, op, corpo: JSON.parse(op.body) });
      const r = typeof respostas === "function" ? respostas(url, chamadas.length) : respostas.shift();
      if (r instanceof Error) throw r;
      return { ok: r.status === 200, status: r.status, json: async () => r.json };
    };
    return chamadas;
  };
  const resposta = (texto, fontes) => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: texto }] }, groundingMetadata: { groundingChunks: (fontes || []).map((f) => ({ web: f })) } }] } });
  const ligar = (a) => { a.vzGuardarChave("AIzaTESTE123456"); a.jurIaLigar(true); };

  /* ---- 1: opcional e desligado ---- */
  {
    const { api: a } = rodar();
    a.vzGuardarChave("AIzaTESTE123456");
    ok(a.jurIaLigada() === false && a.jurIaPronta() === false, "G1 com a chave guardada, mas sem ligar: desligado");
    const el = a.jurIaBotao({ id: "x", pedido: () => "p", destino: "y" });
    ok(el.querySelectorAll(".jur-ia-bt").length === 0 && el.querySelectorAll(".jur-ia-config").length === 1, "G1a sem ligar: nenhum botão de consulta, só o link para configurar");
    a.vkIniciarTela();
    a.vzAbrirChave();
    ok(a.$("chkVzJurIa").checked === false, "G1b a tela da chave mostra desligado");
    a.$("chkVzJurIa").checked = true;
    a.$("vzChaveCampo").value = "AIzaTESTE123456";
    a.$("btnVzChaveOk").onclick();
    ok(a.jurIaLigada() === true && a.jurIaPronta() === true, "G1c ligar na tela da chave liga");
    a.$("chkVzJurIa").checked = false;
    a.vzAbrirChave();
    ok(a.$("chkVzJurIa").checked === true, "G1d a tela reabre mostrando o que está GUARDADO (ligado), não o que ficou na caixa");
    a.$("chkVzJurIa").checked = false; a.$("vzChaveCampo").value = "AIzaTESTE123456"; a.$("btnVzChaveOk").onclick();
    ok(a.jurIaLigada() === false, "G1e desligar desliga");
    a.$("chkVzJurIa").checked = true;
    a.vzAbrirChave();
    ok(a.$("chkVzJurIa").checked === false, "G1e1 e reabre mostrando desligado");
    ok(/só se você ligar/.test(a.t("vz_chave_ajuda")), "G1f o texto da chave não promete mais 'só para os tópicos'");
  }

  /* ---- 2: a chamada ---- */
  {
    const { api: a, janela: J } = rodar();
    ligar(a);
    a.segurarAdiados();
    let ch = gemini(J, [resposta("{\"ok\":1}", [{ title: "stj.jus.br", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" }, { title: "x", uri: "javascript:alert(1)" }])]);
    const r = await a.jurIaPerguntar("pedido", { busca: true });
    ok(r.texto === "{\"ok\":1}" && r.fontes.length === 1 && r.fontes[0].titulo === "stj.jus.br", "G2 devolve o texto e as fontes (só http/https)");
    ok(ch[0].url.indexOf("AIza") < 0 && ch[0].op.headers["x-goog-api-key"] === "AIzaTESTE123456", "G2a a chave vai no cabeçalho, nunca na URL");
    ok(ch[0].corpo.tools && ch[0].corpo.tools[0].google_search, "G2b com busca: a ferramenta de busca do Google vai junto");
    ch = gemini(J, [resposta("t")]);
    await a.jurIaPerguntar("p", { busca: false });
    ok(!ch[0].corpo.tools, "G2c sem busca: sem a ferramenta");
    ch = gemini(J, [{ status: 404, json: {} }, resposta("t2")]);
    const r2 = await a.jurIaPerguntar("p");
    ok(r2.texto === "t2" && ch.length === 2 && ch[0].url !== ch[1].url, "G2d modelo indisponível (404): tenta o próximo");
    const erro = async (resp) => { gemini(J, Array.isArray(resp) ? resp : [resp]); try { await a.jurIaPerguntar("p"); return "sem erro"; } catch (e) { return e.codigo; } };
    ok(await erro({ status: 400, json: { error: { message: "API key not valid. Please pass a valid API key." } } }) === "chave_recusada", "G2e chave inválida: chave_recusada");
    ok(await erro({ status: 429, json: { error: { message: "Resource has been exhausted" } } }) === "cota", "G2f 429: cota");
    ok(await erro({ status: 503, json: {} }) === "servidor", "G2g 503: servidor");
    ok(await erro([new Error("Failed to fetch")]) === "rede", "G2h sem conexão: rede");
    ok(await erro({ status: 200, json: { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] } }) === "sem_resposta", "G2i sem texto: sem_resposta");
    ok(await erro([{ status: 404, json: {} }, { status: 404, json: {} }]) === "modelo", "G2j nenhum modelo: modelo");
    a.soltarAdiados();
    /* o tempo-limite: o temporizador dispara antes da resposta */
    gemini(J, () => { throw new Error("aborted"); });
    let cod = "";
    try { await a.jurIaPerguntar("p"); } catch (e) { cod = e.codigo; }
    ok(cod === "tempo", "G2k passou do tempo: tempo (" + cod + ")");
    ok(a.jurIaEmCursoAtual() === null, "G2l depois de cada consulta, nenhuma fica presa 'em andamento'");
    a.vzGuardarChave("");
    try { await a.jurIaPerguntar("p"); cod = ""; } catch (e) { cod = e.codigo; }
    ok(cod === "sem_chave", "G2m sem chave: sem_chave");
  }

  /* ---- 3 e 4: na biblioteca (passo 6 do conferir julgados) ---- */
  {
    const { api: a, janela: J } = rodar();
    ligar(a);
    const adi = a.jurGravar({ tribunal: "STF", classe: "ADI", numero: "1945", tese: "ISS no software.", deMemoria: true });
    a.jurBibAbrir();
    a.jurBibAtualIniciar("unico", [adi.id]);
    const bt = a.$("jurIaBib_bt");
    ok(bt && !a.$("jurIaBib_config"), "G3 ligado: o botão aparece ao lado do copiar");
    a.segurarAdiados();
    const resp = JSON.stringify({ julgados: [{ id: adi.id, tese_oficial: "É constitucional a incidência do ISS no licenciamento de software.", tese_confere: "nao", situacao: "vigente", certeza: "alta", fonte: "STF", explicacao: "e" }] });
    const ch = gemini(J, [resposta(resp, [{ title: "portal.stf.jus.br", uri: "https://vertexaisearch.cloud.google.com/r/1" }])]);
    const antes = JSON.stringify(a.jurDe(adi.id));
    await bt.onclick();
    a.soltarAdiados();
    ok(ch.length === 1 && ch[0].corpo.contents[0].parts[0].text.indexOf(adi.id) >= 0 && ch[0].corpo.tools, "G3a mandou o pedido único (com o id do julgado) e com a busca");
    ok(a.$("jurBibAtualResp").value === resp && a.$("jurBibAtualPrev").querySelectorAll("ins").length >= 1, "G3b a resposta caiu na caixa e a conferência de sempre apareceu");
    ok(JSON.stringify(a.jurDe(adi.id)) === antes, "G3c NADA gravado antes do aplicar");
    ok(a.$("jurIaBib_status").textContent.indexOf("✓") === 0 && a.$("jurIaBib_fontes").querySelectorAll("a").length === 1, "G3d a tela diz que chegou e mostra onde pesquisou");
    a.$("btnJurBibAtualAplicar").onclick();
    ok(/licenciamento de software/.test(a.jurDe(adi.id).tese) && a.jurDe(adi.id).fonte !== "https://vertexaisearch.cloud.google.com/r/1" && !a.jurSeloValido(a.jurDe(adi.id)),
      "G3e aplicado pela pessoa: grava, SEM selo, e o endereço da busca NUNCA vira 'fonte'");
    /* erro: dito, e nada muda */
    a.segurarAdiados();
    gemini(J, [{ status: 429, json: { error: { message: "quota" } } }]);
    const t0 = a.jurDe(adi.id).tese;
    await a.$("jurIaBib_bt").onclick();
    a.soltarAdiados();
    ok(/Cota esgotada/.test(a.$("jurIaBib_status").textContent) && /Nada foi gravado/.test(a.$("jurIaBib_status").textContent) && a.jurDe(adi.id).tese === t0 && a.$("jurIaBib_bt").disabled === false,
      "G4 erro: diz qual, diz que nada foi gravado, o botão volta");
  }

  /* ---- 5: a gaveta (ler a ementa colada) ---- */
  {
    const { api: a, janela: J } = rodar();
    ligar(a);
    a.matIniciar(); a.edIniciar();
    const e = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Direito Tributário :: 5", "+ Imunidades :: 4"].join(NL));
    a.hubAbrirEdital(e.id);
    a.jurAbrir("Direito Tributário", "Imunidades");
    ok(a.$("jurIaLeitura").hidden === true, "G5 caixa vazia: sem o botão do Gemini");
    const ementa = "EMENTA: RECURSO EXTRAORDINÁRIO. TRIBUTÁRIO. IMUNIDADE RECÍPROCA. ".repeat(6);
    a.$("jurColar").value = ementa;
    a.jurPintarPrincipal && a.jurPintarPrincipal();
    if (a.$("jurColar").oninput) a.$("jurColar").oninput();
    ok(a.$("jurIaLeitura").hidden === false && a.$("jurIaLer_bt"), "G5a com a ementa na caixa: o botão aparece");
    a.segurarAdiados();
    const json = JSON.stringify({ tipo_do_texto: "ementa", tribunal: "STF", classe: "RE", numero: "601392", tese: "A imunidade recíproca alcança a ECT.", resumo: "r", tags: ["#imunidade"] });
    const ch = gemini(J, [resposta(json, [{ title: "stf.jus.br", uri: "https://vertexaisearch.cloud.google.com/r/2" }])]);
    await a.$("jurIaLer_bt").onclick();
    a.soltarAdiados();
    ok(ch.length === 1 && ch[0].corpo.contents[0].parts[0].text.indexOf("IMUNIDADE RECÍPROCA") >= 0 && !ch[0].corpo.tools, "G5b o pedido de leitura com a ementa; ementa longa: sem busca");
    ok(a.$("jurTese").value === "A imunidade recíproca alcança a ECT." && a.$("jurNumero").value === "601392", "G5c a resposta foi lida e preencheu o formulário (como colar a resposta)");
    ok(a.$("jurFonte").value.indexOf("vertexaisearch") < 0, "G5d o endereço da busca não vai para o campo 'fonte'");
    ok(a.jurLista().length === 0, "G5e nada guardado antes do 'Guardar'");
  }

  /* ---- 6: os outros lugares ganham o botão ---- */
  {
    const { api: a, janela: J } = rodar();
    ligar(a);
    a.matIniciar(); a.edIniciar();
    const e = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Direito Tributário :: 5", "+ Imunidades :: 4"].join(NL));
    a.hubAbrirEdital(e.id);
    const j = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: "x", topicos: [a.matChave("Direito Tributário", "Imunidades")] });
    a.jurAbrir("Direito Tributário", "Imunidades");
    a.jurCompletarAbrir(j.id);
    ok(a.$("jurIaCpl_bt"), "G6 completar um julgado: tem o botão");
    a.jurEditar(j.id);
    a.jurMelAbrir();
    ok(a.$("jurIaMel_bt"), "G6a melhorar o resumo: tem o botão");
    const c = a.jurCitacoesNoTexto("Súmula 999 do STJ")[0];
    a.jurCitPreviewAbrir(c, { julgado: null }, { disciplina: "Direito Tributário", topico: "Imunidades" });
    a.$("btnJurCitaCriar").onclick();
    ok(a.$("jurIaCita_bt"), "G6b criar o julgado citado: tem o botão");
    a.jurIaLigar(false);
    a.jurCompletarAbrir(j.id);
    ok(a.$("jurCplIa").querySelectorAll(".jur-ia-bt").length === 0 && a.$("jurCplIa").querySelectorAll(".jur-ia-config").length === 1, "G6c desligado: em vez do botão, o link 'configurar'");
  }
  return falhas;
}

module.exports = { testes };
