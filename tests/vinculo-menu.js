/* =====================================================================
 * ESCOLHER A LEI NO MENU GUARDA O VÍNCULO (v18.50.0)
 *
 * O relato, com print: "o art. 148 ... mesmo depois de carregar a nova
 * versão, o vínculo ainda não efetiva" e "é gerado link mas ele sempre
 * pergunta de qual lei se trata. É necessário salvar?". A causa: o menu
 * "o art. 148 está em qual delas?" valia SÓ DESTA VEZ — abria a prévia na
 * lei escolhida, mas o link continuava "sem lei". Agora (1) a escolha,
 * com a caixa "lembrar" marcada (padrão), vira o vínculo do trecho neste
 * tópico, com o aviso, o 🔗 e o destaque; (2) desmarcada, vale só agora;
 * (3) "art. 149 e art. 149-A da CONSTITUIÇÃO" — a lei dita no fim vale
 * também para o primeiro artigo da enumeração; (4) "art. 10 ou" não vira
 * "art. 10o".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  /* ---- motor: a lei do fim da enumeração vale para todos ---- */
  {
    const { api } = rodar();
    const c1 = api.leiCitacoesNoTexto("art. 149 e art. 149-A da CONSTITUIÇÃO DA REPÚBLICA");
    ok(c1.length === 2 && c1.every((c) => /CONSTITUI/i.test(c.rotulo || "")),
       "V1 'art. 149 e art. 149-A da CONSTITUIÇÃO': os dois são da Constituição: " + JSON.stringify(c1.map((c) => [c.numCru, c.rotulo])));
    ok(c1[0].rotuloCompartilhado === true && !c1[1].rotuloCompartilhado, "V1a só o primeiro herdou a lei do vizinho");
    const c2 = api.leiCitacoesNoTexto("art. 3º, art. 4º e art. 5º do CTN");
    ok(c2.length === 3 && c2.every((c) => c.rotulo === "CTN"), "V2 vírgulas e 'e' passam a lei adiante: " + JSON.stringify(c2.map((c) => [c.numCru, c.rotulo])));
    const c3 = api.leiCitacoesNoTexto("art. 10 ou no art. 11 da LRF");
    ok(c3.length === 2 && c3[0].numCru === "10" && c3.every((c) => c.rotulo === "LRF"),
       "V3 'art. 10 ou no art. 11 da LRF': número sem o 'o' e os dois da LRF: " + JSON.stringify(c3.map((c) => [c.numCru, c.rotulo])));
    /* texto no meio: não é enumeração, não herda */
    const c4 = api.leiCitacoesNoTexto("art. 148 trata do empréstimo; já o art. 149 da CF trata das contribuições");
    ok(c4.length === 2 && !c4[0].rotulo && /CF/.test(c4[1].rotulo || ""), "V4 citações separadas por frase não herdam a lei: " + JSON.stringify(c4.map((c) => [c.numCru, c.rotulo])));
    /* a lei do PRIMEIRO não passa para trás nem para frente */
    const c5 = api.leiCitacoesNoTexto("art. 3º do CTN e art. 4º");
    const c6 = api.leiCitacoesNoTexto("art. 3º do CTN e art. 4º da LRF");
    ok(c6.length === 2 && c6[0].rotulo === "CTN" && c6[1].rotulo === "LRF", "V6 cada um com a sua lei: a do vizinho não sobrescreve: " + JSON.stringify(c6.map((c) => [c.numCru, c.rotulo])));
    ok(c5.length === 2 && c5[0].rotulo === "CTN" && !c5[1].rotulo, "V5 a lei só desce do fim da enumeração para o começo: " + JSON.stringify(c5.map((c) => [c.numCru, c.rotulo])));
  }

  /* ---- o menu de escolha guarda o vínculo ---- */
  const DISC = "Sistema Tributário Brasileiro", TOP = "Tributos e suas espécies";
  const montar = () => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "cf88", nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", apelido: "CF88", especie: "Constituição", topicos: [ch],
      texto: "Art. 148. A União, mediante lei complementar, poderá instituir empréstimos compulsórios.\nArt. 149. Compete exclusivamente à União instituir contribuições sociais." });
    api.leiGuardar({ id: "ctn", nome: "CÓDIGO TRIBUTÁRIO NACIONAL", apelido: "CTN", especie: "Lei", topicos: [ch],
      texto: "Art. 3º Tributo é toda prestação pecuniária compulsória.\nArt. 148. Quando o cálculo do tributo tenha por base o valor de bens." });
    api.matGravar(ch, "2. A destinação legal do produto da arrecadação é irrelevante (art. 148 e outros).", { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    return { api, ch };
  };
  const do148 = (api) => api.$("matLeitura").querySelectorAll("button.mat-lei-link").find((b) => b.textContent === "art. 148");
  const opcaoDe = (api, nome) => Array.from(api.$("qsLeiMenu").children || []).find((b) => b.tagName === "BUTTON" && String(b.textContent || "").indexOf(nome) === 0);

  {
    const { api, ch } = montar();
    const l0 = do148(api);
    ok(l0 && /qs-lei-link-sem/.test(l0.className) && /fica guardada/.test(l0.title),
       "M0 antes: 'art. 148' é link sem lei, e o balão diz que a escolha fica guardada: " + (l0 && l0.className + " | " + l0.title));
    l0.onclick({ stopPropagation() {} });
    const cx = api.$("qsLeiLembrarVinc");
    ok(cx && cx.checked === true, "M1 o menu traz a caixa 'lembrar' marcada");
    ok(/«art\. 148» é desta lei/.test(String((cx && cx.parentNode && cx.parentNode.textContent) || "")), "M1a a caixa diz o que será lembrado: " + (cx && cx.parentNode && cx.parentNode.textContent));
    const op = opcaoDe(api, "CONSTITUIÇÃO");
    ok(!!op, "M1b a opção da Constituição está no menu");
    op.onclick();
    const vs = api.citVinculosLer();
    ok(vs.length === 1 && vs[0].leiId === "cf88" && vs[0].chave === ch && vs[0].trecho === "art. 148" && vs[0].artigos[0].num === "148",
       "M2 escolher a lei gravou o vínculo do trecho neste tópico: " + JSON.stringify(vs));
    ok(/^✓ Vínculo guardado: «art\. 148» → CF88, art\. 148 · só neste tópico\./.test(api.$("toast").textContent),
       "M3 o aviso diz o que foi ligado: " + api.$("toast").textContent);
    const dq = api.citUltimoDestaqueLer();
    ok(dq && dq.trecho === "art. 148", "M3a o link recém-ligado é destacado na tela: " + JSON.stringify(dq));
    ok(api.$("dlgLeiCitaPreview").open === true && api.$("leiCitaVincInfo").hidden === false,
       "M4 a prévia abre já dizendo que o vínculo é seu");
    const l1 = do148(api);
    ok(l1 && /qs-lei-link-perm/.test(l1.className) && !/qs-lei-link-sem/.test(l1.className),
       "M5 depois: o link tem o 🔗 e deixou de ser 'sem lei': " + (l1 && l1.className));
    /* reabrir o tópico: continua ligado (o defeito do relato era o 'ainda não efetiva') */
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const l2 = do148(api);
    ok(l2 && /qs-lei-link-perm/.test(l2.className), "M6 ao reabrir o resumo o vínculo continua");
    /* tocar de novo abre a prévia direto, sem perguntar */
    api.$("dlgLeiCitaPreview").open = false;
    api.qsFerFechar();
    l2.onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true && (!api.$("qsLeiMenu") || api.$("qsLeiMenu").hidden !== false),
       "M7 o próximo toque abre direto, sem o menu");
  }
  {
    /* desmarcada: consulta avulsa, nada guardado */
    const { api } = montar();
    do148(api).onclick({ stopPropagation() {} });
    api.$("qsLeiLembrarVinc").checked = false;
    opcaoDe(api, "CÓDIGO").onclick();
    ok(api.citVinculosLer().length === 0, "M8 com a caixa desmarcada nada é guardado");
    ok(/qs-lei-link-sem/.test(do148(api).className), "M8a e o link continua sem lei");
  }
  {
    /* nas QUESTÕES: o mesmo menu, a mesma caixa */
    const { api, ch } = montar();
    const q = { id: "q1", disciplina: DISC, topico: TOP, enunciado: "x", comentario: "Ver art. 148." };
    const bt = api.document.createElement("button");
    api.document.body.append(bt);
    const cit = api.leiCitacoesNoTexto(q.comentario)[0];
    api.qsUiLeiEscolher(bt, q, cit);
    ok(api.$("qsLeiLembrarVinc") && api.$("qsLeiLembrarVinc").checked, "M9 nas questões o menu também traz a caixa marcada");
    opcaoDe(api, "CÓDIGO").onclick();
    const vs = api.citVinculosLer();
    ok(vs.length === 1 && vs[0].leiId === "ctn" && vs[0].chave === ch, "M9a a escolha nas questões também vira vínculo: " + JSON.stringify(vs));
    const alvo = api.qsUiLeiAlvo(api.citVinculosAplicar(q.comentario, api.leiCitacoesNoTexto(q.comentario), ch)[0], api.leisLista(), api.leisDoTopico(ch));
    ok(alvo.lei && alvo.lei.id === "ctn", "M9b a mesma citação passa a resolver sozinha: " + JSON.stringify(alvo.motivo));
  }
  {
    /* citação que NOMEIA a lei: não há trecho a lembrar como vínculo (a sigla já é o caminho) */
    const { api } = montar();
    const bt = api.document.createElement("button");
    api.document.body.append(bt);
    api.qsUiLeiEscolher(bt, { disciplina: DISC, topico: TOP }, api.leiCitacoesNoTexto("art. 12 do ZZZ")[0]);
    ok(!api.$("qsLeiLembrarVinc"),
       "M10 citação com sigla não mostra a caixa de vínculo");
  }
  return falhas;
}

module.exports = { testes };
