/* =====================================================================
 * A RODADA DE UM TÓPICO COM DUAS GRAFIAS (v19.0.0)
 *
 * RELATADO (23/10): na revisão de "Fato gerador, sujeito ativo e sujeito passivo" as questões abriram já todas
 * respondidas (22 de 22) e o registro dizia que a sessão "misturou 2 tópicos". As questões do tópico estavam
 * gravadas com duas grafias da chave (acento/caixa). A lista junta as duas (qsFiltrar compara a chave normalizada);
 * o registro contava as grafias cruas — recusava, a rodada nunca era lançada e voltava na revisão seguinte.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. a mesma chave em grafias diferentes é UM tópico para o registro, que abre e lança no tópico da rodada;
 *  2. dois tópicos de verdade continuam recusados, e a mensagem diz quais são;
 *  3. a pergunta da rodada terminada mostra a DATA dela.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const EDITAL = ["# ISS | prova: 2027-06-01 | horas: 20", "@ Sistema Tributário :: 5",
    "+ Fato gerador, sujeito ativo e sujeito passivo :: 5", "+ Lançamento :: 4"].join("\n");
  const preparar = (api) => {
    api.matIniciar(); api.edIniciar(); api.edCarregarLista();
    api.edCriar("ISS", EDITAL);
    api.$("editalTexto").value = EDITAL;
    api.$("edHoras").value = 20;
    api.$("edProva").value = "2027-06-01";
    return api.matChave("Sistema Tributário", "Fato gerador, sujeito ativo e sujeito passivo");
  };
  const q = (enun, chave, topico) => ({ tipo: "ce", enunciado: enun, gabarito: "C", disciplina: "Sistema Tributário", topico, chave });

  /* ---- 1: duas grafias = um tópico ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    const outra = "Sistema Tributário›Fato Gerador, Sujeito Ativo e Sujeito Passivo";
    api.qsAplicar([
      q("O fato gerador da obrigação principal é a situação definida em lei como necessária e suficiente.", ch, "Fato gerador, sujeito ativo e sujeito passivo"),
      q("Sujeito ativo da obrigação é a pessoa jurídica de direito público titular da competência para exigir.", ch, "Fato gerador, sujeito ativo e sujeito passivo"),
      q("A capacidade tributária passiva independe da capacidade civil das pessoas naturais.", outra, "Fato Gerador, Sujeito Ativo e Sujeito Passivo"),
    ]);
    const lista = api.qsFiltrar({ chave: ch });
    ok(lista.length === 3, "Q1 a lista do tópico junta as duas grafias (é o que a rodada responde): " + lista.length);
    api.qsSessaoIniciar(lista, { escopo: "topico:" + ch });
    for (let i = 0; i < 3; i++) { api.qsResponder("C"); api.qsAndar(1); }
    api.$("uiModalMsg").textContent = "";
    api.qsUiRegistrarEstudo();
    ok(api.$("dlgRegistro").open === true && !/misturou/.test(api.$("uiModalMsg").textContent),
      "Q1a a rodada do mesmo tópico em duas grafias abre o registro (não 'misturou 2 tópicos'): " + api.$("uiModalMsg").textContent);
    ok(String(api.$("regQFeitas").value) === "3", "Q1b as 3 respondidas chegam ao registro: " + api.$("regQFeitas").value);
    ok(api.regAtualLer() && api.regAtualLer().chave === ch, "Q1c lança no tópico de onde a rodada foi aberta");
    const txt = api.registroTexto();
    ok(/mesmo tópico em grafias diferentes/.test(txt) && txt.indexOf(outra + " ×1") >= 0 && txt.indexOf(ch + " ×2") >= 0,
      "Q1d o registro de diagnóstico guarda as duas grafias e quantas questões de cada (sem deduzir): " + txt.slice(-300));
  }

  /* ---- 1e: a grafia da rodada vence mesmo sendo a MENOS frequente ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    const outra = "Sistema Tributário›Fato Gerador, Sujeito Ativo e Sujeito Passivo";
    api.qsAplicar([
      q("O fato gerador da obrigação principal é a situação definida em lei como necessária e suficiente.", ch, "Fato gerador, sujeito ativo e sujeito passivo"),
      q("Sujeito ativo da obrigação é a pessoa jurídica de direito público titular da competência para exigir.", outra, "Fato Gerador, Sujeito Ativo e Sujeito Passivo"),
      q("A capacidade tributária passiva independe da capacidade civil das pessoas naturais.", outra, "Fato Gerador, Sujeito Ativo e Sujeito Passivo"),
    ]);
    api.qsSessaoIniciar(api.qsFiltrar({ chave: ch }), { escopo: "topico:" + ch });
    api.qsResponder("C");
    api.qsUiRegistrarEstudo();
    ok(api.regAtualLer() && api.regAtualLer().chave === ch, "Q1e lança na grafia do tópico de onde a rodada foi aberta, não na mais frequente: " + (api.regAtualLer() || {}).chave);
  }

  /* ---- 2: dois tópicos de verdade — não é beco: lança só as do tópico da rodada, dizendo o que fica de fora ---- */
  for (const escolha of ["sair", "parte"]) {
    const { api } = rodar();
    const ch = preparar(api);
    const ch2 = api.matChave("Sistema Tributário", "Lançamento");
    api.qsAplicar([
      q("O fato gerador da obrigação principal é a situação definida em lei como necessária e suficiente.", ch, "Fato gerador, sujeito ativo e sujeito passivo"),
      q("Sujeito ativo da obrigação é a pessoa jurídica de direito público titular da competência para exigir.", ch, "Fato gerador, sujeito ativo e sujeito passivo"),
      q("O lançamento é ato privativo da autoridade administrativa, plenamente vinculado.", ch2, "Lançamento"),
    ]);
    /* a rodada foi aberta em Lançamento (o tópico com MENOS questões): é ele o principal */
    api.qsSessaoIniciar(api.qsTodas(), { escopo: "topico:" + ch2 });
    for (let i = 0; i < 3; i++) { api.qsResponder(api.qsAtual().chave === ch2 ? "E" : "C"); api.qsAndar(1); }
    const pr = api.qsUiRegistrarEstudo();
    await new Promise((r) => setImmediate(r));
    const msg = api.$("uiModalMsg").textContent;
    ok(/misturou 2 tópicos/.test(msg) && /Lançamento/.test(msg) && /Fato gerador/.test(msg) && /só as 1 de «Lançamento»/.test(msg) && /outras 2 ficam de fora/.test(msg),
      "Q2 dois tópicos: diz quais são e oferece lançar só as do tópico da rodada: " + msg);
    api._uiFechar(escolha);
    await pr;
    const txt = api.registroTexto();
    ok(/registro recusado: a rodada tem 2 tópicos/.test(txt) && txt.indexOf(ch2 + " ×1") >= 0 && txt.indexOf(ch + " ×2") >= 0, "Q2a a recusa fica no registro, com as chaves e quantas de cada: " + txt.slice(-300));
    if (escolha === "sair") ok(api.$("dlgRegistro").open !== true, "Q2b cancelar não abre o registro");
    else {
      ok(api.$("dlgRegistro").open === true && String(api.$("regQFeitas").value) === "1" && String(api.$("regQCertas").value) === "0"
        && api.regAtualLer() && api.regAtualLer().chave === ch2,
        "Q2c lançar só as do tópico: abre no tópico da rodada com o placar só dele (1 feita, 0 certa): " + api.$("regQFeitas").value + "/" + api.$("regQCertas").value);
      ok(/lançada só no tópico principal/.test(api.registroTexto()), "Q2d a escolha fica no registro");
    }
  }

  /* ---- 4: arquivo do app que não carrega fica no registro ---- */
  {
    const { api, janela: J } = rodar();
    (J.__ouv && J.__ouv.error || []).forEach((fn) => { try { fn({ target: { tagName: "SCRIPT", src: "https://x.test/questoes.js?v=1" } }); } catch (e) {} });
    ok(/arquivo do app não carregou: questoes\.js/.test(api.registroTexto()), "Q4 o .js que não carregou é registrado pelo nome (não só o efeito)");
    ok(api.t("carga_falhou", { lista: "questoes.js" }).indexOf("questoes.js") >= 0, "Q4a o aviso na tela diz qual arquivo");
  }

  /* ---- 5: o service worker não guarda resposta de erro nem serve a página no lugar de um .js ---- */
  {
    const sw = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/if \(resp && resp\.ok\) \{\s*const cp = resp\.clone\(\);\s*caches\.open\(CACHE\)\.then\(\(c\) => c\.put\(req, cp\)\);/.test(sw),
      "Q5 só resposta boa entra no cache (um 404 não substitui a cópia boa)");
    ok(/req\.mode === "navigate" \? caches\.match\("index\.html"\)/.test(sw), "Q5a o index.html só substitui uma página, nunca um .js");
  }

  /* ---- 3: a pergunta da rodada terminada tem a data ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.qsAplicar([q("O fato gerador da obrigação principal é a situação definida em lei como necessária e suficiente.", ch, "Fato gerador, sujeito ativo e sujeito passivo")]);
    const lista = api.qsFiltrar({ chave: ch });
    api.qsSessaoIniciar(lista, { escopo: "topico:" + ch });
    api.qsResponder("C");
    const s = JSON.parse(api.lojaLer("eac_qs_sessao"));
    s.comecou = "2026-10-16T12:00:00.000Z";
    api.lojaGravar ? api.lojaGravar("eac_qs_sessao", JSON.stringify(s)) : null;
    const p = api.qsUiResponderAbrir(lista, "resumo", "topico:" + ch);
    await new Promise((r) => setImmediate(r));
    const txt = api.$("uiModalMsg").textContent;
    const d = new Date("2026-10-16T12:00:00.000Z").toLocaleDateString();
    ok(/terminou uma rodada em/.test(txt) && txt.indexOf(d) >= 0, "Q3 a rodada terminada diz de quando é (" + d + "): " + txt);
    try { api._uiFechar("sair"); } catch (e) {}
    await p;
  }
  return falhas;
}

module.exports = { testes };
