/* =====================================================================
 * QUESTÕES (v19.4.0): prompt para a IA comentar · retomar × recomeçar com aviso · links de lei na dica
 *
 * O QUE PRECISA SER VERDADE:
 *  1. a caixa da dica tem DOIS botões: "copiar a questão" e "prompt para a IA comentar"; o prompt leva a questão,
 *     o gabarito e o comentário (não a dica que se está escrevendo) e as regras — citação no formato que vira link;
 *  2. ao reabrir a lista, cada opção diz o que acontece; a que DESCARTA a rodada é vermelha e pede segunda confirmação
 *     — negar volta à pergunta sem perder nada; o mesmo vale para a rodada terminada;
 *  3. a citação de lei na DICA vira link, como no comentário.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const tique = async (n) => { for (let i = 0; i < (n || 4); i++) await Promise.resolve(); };
  const responder = (api, op) => { if (!op) return; op.onclick(); api.$("btnQsProxima").onclick(); };
  let jan = null;
  const montar = (n) => {
    const { api, janela } = rodar();
    jan = janela;
    api.matIniciar(); api.qsUiIniciar(); api.leiIniciar && api.leiIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const txt = [];
    for (let i = 1; i <= (n || 1); i++) txt.push("? CE :: FGV :: Afirmacao numero " + i + " para responder.\n= C :: comentario da questao " + i + ", art. 113, § 3º, do CTN.");
    api.qsAplicar(api.qsLerResposta(txt.join("\n\n"), { disciplina: "D", topico: "T", chave: ch }).achados);
    return api;
  };

  /* ---- 1: o prompt para a IA comentar ---- */
  {
    const api = montar(1);
    const q = api.qsTodas()[0];
    q.concurso = "ISS Caruaru"; q.banca = "FGV";
    api.qsGravarDica(q.id, "RASCUNHO DA MINHA DICA");
    const ex = api.qsUiExtrasDaDica(q);
    ok(ex.length === 2 && /copiar/i.test(ex[0].rotulo) && /IA/.test(ex[1].rotulo), "P1 a caixa da dica tem 'copiar a questão' e 'prompt para a IA comentar': " + ex.map((x) => x.rotulo).join(" | "));
    const pr = ex[1].faz();
    ok(/professor de concursos/.test(pr) && /ISS Caruaru · FGV/.test(pr), "P1a o pedido diz o alvo (concurso e banca)");
    ok(/Afirmacao numero 1/.test(pr) && /comentario da questao 1/.test(pr) && /Certo/.test(pr), "P1b leva o enunciado, o gabarito por extenso e o comentário");
    ok(/art\. 113, § 3º, do CTN/.test(pr) && /Não invente/.test(pr) && /DICA curta/.test(pr), "P1c pede o fundamento no formato que vira link, sem inventar, e uma dica curta");
    ok(!/RASCUNHO DA MINHA DICA/.test(pr), "P1d a dica que se está escrevendo não vai junto");
    /* a caixa mostra os dois botões; sem o segundo, ele some */
    const p1 = api.uiTexto("dica", "", null, ex);
    ok(api.$("btnTxtLivreExtra").hidden === false && api.$("btnTxtLivreExtra2").hidden === false && /IA/.test(api.$("btnTxtLivreExtra2").textContent),
      "P1e os dois botões aparecem na caixa");
    api.$("btnTxtLivreNao").onclick(); await p1;
    const p2 = api.uiTexto("dica", "", null, ex[0]);
    ok(api.$("btnTxtLivreExtra").hidden === false && api.$("btnTxtLivreExtra2").hidden === true, "P1f com um só extra, o segundo botão some");
    api.$("btnTxtLivreNao").onclick(); await p2;
  }

  /* ---- 2: retomar × recomeçar ---- */
  {
    const api = montar(3);
    api.qsUiResponderDoTopico();
    responder(api, api.$("qsSessCorpo").querySelectorAll(".qs-op")[0]);
    api.$("btnQsSessFechar").onclick();
    const p = api.qsUiResponderDoTopico();
    await tique();
    const msg = api.$("uiModalMsg").textContent;
    ok(/Continuar de onde parei: volta/.test(msg) && /Recomeçar do zero: esta rodada é DESCARTADA/.test(msg) && /histórico de cada questão/.test(msg),
      "R1 a pergunta diz o que cada opção faz: " + msg);
    ok(/btn-perigo/.test(api.$("uiModalCancel").className) && /btn-verde/.test(api.$("uiModalOk").className), "R1a 'recomeçar do zero' em vermelho, 'continuar' em verde");
    api._uiFechar("recomecar");
    await tique();
    ok(/Descartar a rodada com 1 respondida/.test(api.$("uiModalMsg").textContent), "R2 recomeçar pede a segunda confirmação: " + api.$("uiModalMsg").textContent);
    ok(/btn-perigo/.test(api.$("uiModalOk").className) && api.$("uiModalOk").textContent === "descartar a rodada" && /btn-cinza/.test(api.$("uiModalCancel").className),
      "R2c na confirmação, o vermelho é o 'descartar a rodada'; o Cancelar é neutro (não herda o vermelho da pergunta anterior): ok="
      + api.$("uiModalOk").className + " cancel=" + api.$("uiModalCancel").className);
    api._uiFechar(false);                        /* negou: volta à pergunta, nada perdido */
    await tique();
    ok(/Recomeçar do zero/.test(api.$("uiModalMsg").textContent), "R2a negar a confirmação volta à pergunta");
    api._uiFechar("continuar");
    await p;
    ok(api.qsPlacar().feitas === 1, "R2b e a rodada continua com o placar: " + api.qsPlacar().feitas);
    /* agora recomeça de verdade */
    api.$("btnQsSessFechar").onclick();
    const p2 = api.qsUiResponderDoTopico();
    await tique();
    api._uiFechar("recomecar"); await tique(); api._uiFechar(true);
    await p2;
    ok(api.qsPlacar().feitas === 0, "R3 confirmado, a rodada recomeça do zero");
  }

  /* ---- 2b: a rodada terminada ---- */
  {
    const api = montar(1);
    api.qsUiResponderDoTopico();
    responder(api, api.$("qsSessCorpo").querySelectorAll(".qs-op")[0]);
    api.$("btnQsSessFechar").onclick();
    const p = api.qsUiResponderDoTopico();
    await tique();
    const msg = api.$("uiModalMsg").textContent;
    ok(/Registrar esta rodada: abre o registro/.test(msg) && /SEM ser registrada/.test(msg), "R4 a rodada terminada diz o que cada opção faz: " + msg);
    ok(/btn-perigo/.test(api.$("uiModalCancel").className), "R4a 'descartar e começar outra' em vermelho");
    api._uiFechar("recomecar"); await tique();
    ok(/Descartar a rodada/.test(api.$("uiModalMsg").textContent), "R4b e pede a segunda confirmação");
    api._uiFechar(false); await tique();
    api._uiFechar("sair");
    await p;
    ok(api.qsSessaoRetomavel(api.qsSessaoAtual() ? api.qsSessaoAtual().escopo : "") !== null || api.qsPlacar().feitas === 1, "R4c negado e saindo, a rodada continua guardada");
  }

  /* ---- 3: links de lei na dica ---- */
  {
    const api = montar(1);
    api.leiGuardar({ id: "ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN",
      texto: "Art. 113. A obrigação tributária é principal ou acessória.\n§ 3º A obrigação acessória converte-se em principal." });
    const q = api.qsTodas()[0];
    api.qsGravarDica(q.id, "Macete: a acessória vira principal (art. 113, § 3º, do CTN).");
    api.qsUiResponderDoTopico();
    responder(api, api.$("qsSessCorpo").querySelectorAll(".qs-op")[0]);
    const cx = api.$("qsSessCorpo").querySelector(".qs-minha-dica");
    const links = cx ? cx.querySelectorAll("button").filter((b) => /art\. 113/.test(b.textContent)) : [];
    ok(cx && links.length === 1 && /Macete/.test(cx.textContent), "L1 a citação da dica vira link: " + (cx ? cx.textContent : "sem dica"));
    ok(api.qsUiCitBase(q).chave === api.matChave("D", "T") && api.qsUiCitBase(q).onde === "questao", "L1a a citação sabe o tópico da questão");
  }

  /* ---- 3b (19.117.1): o vínculo feito NA DICA, com a questão aberta, passa a valer na hora ----
   * O relato: "tentei gravar um vínculo de lei na dica de uma questão que errei mas não está efetivando". O registro:
   * "vínculo criado pelo menu de escolha (permanente) art. 86 → Lei 4.320/1964" e, no toque seguinte no mesmo
   * "art. 86", de novo "citação não resolvida". A dica não era redesenhada com a questão aberta (a volta só repintava
   * com a janela fechada) e o toque no link antigo resolvia a citação antiga, sem a lei. */
  {
    const api = montar(1);
    const ch = api.matChave("D", "T");
    api.leiGuardar({ id: "cf", nome: "Constituição Federal de 1988", especie: "Constituição", texto: "Art. 1º A República.\nArt. 2º Os Poderes.", topicos: [ch] });
    api.leiGuardar({ id: "l4320", nome: "Lei 4.320/1964", especie: "Lei", numero: "4320", ano: "1964",
      texto: "Art. 86. A escrituração sintética das operações financeiras e patrimoniais efetuar-se-á pelo método das partidas dobradas.\nArt. 100. As alterações da situação líquida patrimonial.", topicos: [] });
    const q = api.qsTodas()[0];
    api.qsGravarDica(q.id, "O fundamento: partidas dobradas da Lei nº 4.320/1964 (art. 86 e art. 100).");
    api.qsUiResponderDoTopico();
    responder(api, api.$("qsSessCorpo").querySelectorAll(".qs-op")[0]);
    const link86 = () => {
      const cx = api.$("qsSessCorpo").querySelector(".qs-minha-dica");
      return cx ? cx.querySelectorAll("button").filter((b) => b.textContent === "art. 86")[0] : null;
    };
    const antigo = link86();
    ok(antigo && /qs-lei-link-sem/.test(antigo.className), "V0 sem vínculo, o 'art. 86' da dica não tem lei: " + (antigo && antigo.className));
    /* o que o menu de escolha grava, e a volta que ele chama */
    ok(!!api.citVinculoSalvar({ trecho: "art. 86", leiId: "l4320", artigos: [{ num: "86", numCru: "86" }], chave: ch }), "V0a vínculo gravado");
    api.qsUiCitBase(q).aoVoltar();
    const novo = link86();
    ok(novo && !/qs-lei-link-sem/.test(novo.className) && /qs-lei-link-perm/.test(novo.className),
      "V1 com a questão aberta, a dica é redesenhada e o 'art. 86' passa a levar à lei: " + (novo && novo.className));
    /* o link que ficou na tela de antes (outra volta, outra tela) também resolve: confere o vínculo na hora do toque */
    antigo.onclick({});
    ok(api.$("dlgLeiCitaPreview").open === true && /4\.320/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
      "V2 o toque num link desenhado antes do vínculo abre a lei vinculada, não a pergunta de novo: " + api.$("leiCitaPreviewTitulo").textContent);
    api.$("dlgLeiCitaPreview").close && api.$("dlgLeiCitaPreview").close();
    /* o vínculo é do tópico: a mesma citação noutro tópico continua sem lei */
    const c0 = api.citVinculosAplicar("ver art. 86", [], api.matChave("D", "Outro")).filter((c) => c.permanente);
    ok(c0.length === 0, "V3 o vínculo 'só neste tópico' não vale noutro tópico");
  }

  /* ---- (19.117.2) A RODADA SUBSTITUÍDA ----
   * O relato: "pressionei F5 sem querer e perdi todo o progresso de questões que havia respondido". O backup mostrou:
   * as mesmas 13 questões abertas por outro caminho (o tópico inteiro, não o recorte) — outro escopo, nenhuma
   * pergunta, e a rodada nova gravada POR CIMA da que tinha 7 de 13. */
  {
    const api = montar(13);
    const lista = api.qsTodas().slice();
    const A = "topico:d›t#recorte", B = "topico:d›t";
    const passar = (n) => {
      for (let k = 0; k < n; k++) {
        responder(api, api.$("qsSessCorpo").querySelectorAll(".qs-op")[0]);
        api.$("btnQsProxima").onclick();
      }
    };
    api.qsUiResponderAbrir(lista, "aba", A);
    await tique();
    passar(3);
    ok(api.qsPlacar().feitas === 3, "S0 três respondidas pelo recorte: " + api.qsPlacar().feitas);
    /* recarregou (a sessão em memória some) e abriu pelo tópico inteiro */
    api.$("dlgQsResponder").close();
    const p = api.qsUiResponderAbrir(lista, "aba", B);
    await tique();
    ok(/pela metade: 3 de 13/.test(api.$("uiModalMsg").textContent || ""), "S1 as mesmas questões por outro caminho oferecem continuar: " + String(api.$("uiModalMsg").textContent).slice(0, 90));
    api._uiFechar("continuar");
    await p;
    ok(api.qsPlacar().feitas === 3 && api.qsSessaoAtual().escopo === A, "S1a continuou a mesma rodada (3 de 13)");
    api.$("dlgQsResponder").close();

    /* o estado que a versão anterior deixou: uma rodada nova, vazia, gravada por cima (outro escopo) */
    const ag = Date.now();
    api.qsSessaoIniciar(lista, { escopo: B });
    api.qhIniciar(lista, { escopo: B });
    const iso = (ms) => new Date(ms).toISOString();
    const h = JSON.parse(jan.localStorage.getItem("eac_qs_hist"));
    const velho = h.filter((x) => x.escopo === A)[0], novo = h.filter((x) => x.escopo === B)[0];
    velho.q = iso(ag - 3 * 3600000); novo.q = iso(ag - 3600000);
    jan.localStorage.setItem("eac_qs_hist", JSON.stringify(h));
    api.qhCarregar();
    const s = JSON.parse(jan.localStorage.getItem("eac_qs_sessao"));
    s.comecou = novo.q;
    jan.localStorage.setItem("eac_qs_sessao", JSON.stringify(s));
    api.qsTodas().forEach((q) => (q.tentativas || []).forEach((t) => { t.q = iso(ag - 2 * 3600000); }));
    const rec = api.qsSessaoRecuperavel(lista.map((q) => q.id), null);
    ok(rec && rec.feitas === 3 && rec.bloco === velho.id, "S2 as respostas da rodada substituída são refeitas pelo histórico: " + JSON.stringify(rec && [rec.feitas, rec.certas]));
    const p2 = api.qsUiResponderAbrir(lista, "aba", A);
    await tique();
    ok(/Achei 3 resposta/.test(api.$("uiModalMsg").textContent || ""), "S3 ao abrir, a recuperação é oferecida: " + String(api.$("uiModalMsg").textContent).slice(0, 90));
    api._uiFechar("juntar");
    await p2;
    ok(api.qsPlacar().feitas === 3 && api.$("dlgQsResponder").open === true, "S3a juntou: a rodada volta com 3 de 13 e abre na próxima: " + api.qsPlacar().feitas);
    ok(JSON.parse(jan.localStorage.getItem("eac_qs_hist")).filter((x) => x.id === velho.id)[0].recuperada, "S3b o bloco velho fica marcado: não é oferecido de novo");
    ok(api.qsSessaoRecuperavel(lista.map((q) => q.id), api.qsSessaoAtual()) === null, "S3c nada mais a recuperar");
  }

  /* ---- as cores do aviso voltam ao padrão depois de uma pergunta de escolha ---- */
  {
    const { api } = rodar();
    const p1 = api.uiEscolha("escolha", [{ valor: "a", rot: "A", classe: "btn-azul" }, { valor: "b", rot: "B", classe: "btn-perigo" }]);
    await tique(); api._uiFechar("a"); await p1;
    const p2 = api.uiConfirm("tem certeza?");
    await tique();
    ok(api.$("uiModalOk").className === "btn btn-verde" && api.$("uiModalCancel").className === "btn btn-cinza" && api.$("uiModalOk").textContent === "OK",
      "C1 a confirmação comum volta às cores padrão: " + api.$("uiModalOk").className + " / " + api.$("uiModalCancel").className);
    api._uiFechar(false); await p2;
    const p3 = api.uiEscolha("escolha", [{ valor: "a", rot: "A", classe: "btn-azul" }, { valor: "b", rot: "B", classe: "btn-perigo" }]);
    await tique(); api._uiFechar("a"); await p3;
    const p4 = api.uiPrompt ? api.uiPrompt("nome?", "") : null;
    if (p4) {
      await tique();
      ok(api.$("uiModalOk").className === "btn btn-verde" && api.$("uiModalCancel").className === "btn btn-cinza", "C1a a caixa de digitar também volta às cores padrão");
      api._uiFechar(false); await p4;
    }
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["dic_prompt_ia", "dic_prompt_ia_ajuda", "pl_ia_cab", "pl_ia_regras", "qs_retomar_efeitos", "qs_terminada_efeitos", "qs_descartar_conf"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
