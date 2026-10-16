/* =====================================================================
 * O VÍNCULO QUE ATRAVESSA UMA FORMATAÇÃO (v18.53.0)
 *
 * O relato: "mesmo após salvar e voltar, o link criado não fica visível
 * nem clicável caso não esteja com a marcação pontilhada embaixo" —
 * "aplica-se somente aos novos criados sem haver sublinhado prévio".
 * Reproduzido com o resumo real: o trecho "As limitações ao poder de
 * tributar constituem o conjunto" passa por um negrito; o vínculo era
 * guardado, o aviso dizia "o link agora tem 🔗", e link nenhum aparecia.
 * Agora: (1) o trecho que atravessa negrito/grifo vira link em pedaços
 * (um 🔗 só, no último); (2) vale no resumo, nos julgados e no leitor da
 * lei; (3) o destaque acha os pedaços; (4) quando o link não pode
 * aparecer (trecho em dois parágrafos), o aviso DIZ isso; (5) a leitura
 * aberta antes de as leis carregarem é redesenhada quando elas chegam.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const DISC = "Sistema Tributário Brasileiro", TOP = "Limitações ao poder de tributar";
  const CF = { id: "cf88", nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", apelido: "CF88", especie: "Constituição",
    texto: "Art. 150. Sem prejuízo de outras garantias asseguradas ao contribuinte, é vedado à União.\nArt. 151. É vedado à União instituir tributo que não seja uniforme." };
  const RESUMO = [
    "As **limitações ao poder de tributar** constituem o conjunto de princípios e imunidades.",
    "A imunidade recíproca protege os entes federados.",
    "O _princípio da anterioridade_ proíbe cobrar no mesmo exercício.",
    "Fim do primeiro parágrafo aqui.",
    "Começo do segundo parágrafo ali.",
  ].join("\n\n");
  const montar = (comLei) => {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    if (comLei !== false) api.leiGuardar(Object.assign({ topicos: [ch] }, CF));
    api.matGravar(ch, RESUMO, { disciplina: DISC, topico: TOP });
    return { api, ch };
  };
  const vinc = (api, ch, trecho) => api.citVinculoSalvar({ trecho, leiId: "cf88", artigos: [{ num: "150", numCru: "150", base: "150", sub: {} }], chave: ch });
  const abrir = (api) => api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
  const links = (api) => api.$("matLeitura").querySelectorAll("button.mat-lei-link");
  const pecas = (api) => links(api).filter((b) => /cit-parte/.test(b.className));

  {
    const { api, ch } = montar();
    vinc(api, ch, "As limitações ao poder de tributar constituem");
    vinc(api, ch, "imunidade recíproca protege");
    abrir(api);
    const p = pecas(api);
    ok(p.length === 3 && p.map((b) => b.textContent).join("") === "As limitações ao poder de tributar constituem",
       "A1 o trecho que passa pelo negrito vira link em pedaços, que juntos são o trecho: " + JSON.stringify(p.map((b) => b.textContent)));
    ok(p.every((b) => /qs-lei-link-perm/.test(b.className) && !/qs-lei-link-sem/.test(b.className)), "A1a cada pedaço é link do vínculo (🔗), já com a lei: " + p.map((b) => b.className).join(" | "));
    ok(/cit-parte-ini/.test(p[0].className) && !/cit-parte-fim/.test(p[0].className) && /cit-parte-fim/.test(p[2].className) && !/cit-parte-(ini|fim)/.test(p[1].className),
       "A1b o primeiro pedaço é o início e o último é o fim (o 🔗 sai só nele)");
    ok(p.every((b) => b._citTrecho === "As limitações ao poder de tributar constituem"), "A1c cada pedaço sabe o trecho inteiro");
    const um = links(api).find((b) => b.textContent === "imunidade recíproca protege");
    ok(um && !/cit-parte/.test(um.className) && /qs-lei-link-perm/.test(um.className), "A2 o trecho num pedaço só continua como sempre (um link inteiro)");
    /* num parágrafo com negrito, o trecho que cabe num nó só fica com a passada de sempre (link inteiro, com a nota) */
    vinc(api, ch, "princípios e imunidades");
    abrir(api);
    const pi = links(api).find((b) => b.textContent === "princípios e imunidades");
    ok(pi && !/cit-parte/.test(pi.className), "A2a trecho inteiro num nó, mesmo em parágrafo com negrito, não vira 'pedaços': " + (pi && pi.className));
    p[1].onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true && /Art\. 150/.test(api.$("leiCitaPreviewArtigo").textContent + api.$("leiCitaPreviewTexto").textContent),
       "A3 tocar em qualquer pedaço abre a prévia do artigo ligado");
    ok(api.citDestacarRecem("As limitações ao poder de tributar constituem") === 3, "A4 o destaque de recém-ligado acha os pedaços");
  }
  {
    /* itálico + julgado ligado à mão atravessando */
    const { api, ch } = montar();
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1", tese: "anterioridade" });
    api.citVinculoSalvar({ trecho: "O princípio da anterioridade proíbe", tipo: "jur", jurId: j.id, chave: ch });
    abrir(api);
    const jp = api.$("matLeitura").querySelectorAll("button.jur-cit-link").filter((b) => /cit-parte/.test(b.className));
    ok(jp.length === 3 && jp.map((b) => b.textContent).join("") === "O princípio da anterioridade proíbe", "A5 o vínculo de JULGADO que atravessa o itálico também vira link: " + JSON.stringify(jp.map((b) => b.textContent)));
  }
  {
    /* vínculo de outro tópico não vale aqui; desligado não liga */
    const { api } = montar();
    vinc(api, "outra disciplina›outro tópico", "As limitações ao poder de tributar constituem");
    api.citVinculoSalvar({ trecho: "imunidade recíproca protege", nenhum: true, chave: api.matChave(DISC, TOP) });
    abrir(api);
    ok(!pecas(api).length && !links(api).some((b) => /imunidade/.test(b.textContent)), "A6 vínculo de outro tópico e vínculo desligado não viram link");
  }

  /* ---- o aviso confere a tela ---- */
  {
    const { api } = montar();
    abrir(api);
    api.qsVincEscolherPara({ disciplina: DISC, topico: TOP, comentario: RESUMO, _onde: "resumo", _aoVoltar: () => abrir(api) },
      { trecho: "As limitações ao poder de tributar constituem", cit: null });
    api.$("qsVincLei").value = "cf88"; api.$("qsVincArts").value = "150";
    ok(api.qsVincSalvar() === true && /^✓ Vínculo guardado/.test(api.$("toast").textContent), "N1 trecho que atravessa o negrito: o aviso confirma (e o link está lá): " + api.$("toast").textContent);
    ok(pecas(api).length === 3, "N1a os pedaços aparecem logo depois de guardar");
  }
  {
    const { api } = montar();
    abrir(api);
    api.qsVincEscolherPara({ disciplina: DISC, topico: TOP, comentario: RESUMO, _onde: "resumo", _aoVoltar: () => abrir(api) },
      { trecho: "Fim do primeiro parágrafo aqui.\n\nComeço do segundo", cit: null });
    api.$("qsVincLei").value = "cf88"; api.$("qsVincArts").value = "150";
    api.qsVincSalvar();
    ok(/^⚠ Vínculo guardado, mas «.*» não virou link na tela: o trecho pega mais de um parágrafo/.test(api.$("toast").textContent),
       "N2 trecho em dois parágrafos: o aviso diz que o link não apareceu e por quê: " + api.$("toast").textContent);
  }

  /* ---- leitor da lei: o grifo parte o texto ---- */
  {
    const { api } = montar();
    api.citVinculoSalvar({ trecho: "outras garantias asseguradas", leiId: "cf88", artigos: [{ num: "151", numCru: "151", base: "151", sub: {} }] });
    const d = api.document.createElement("div");
    const mk = api.document.createElement("mark");
    mk.append(api.document.createTextNode("garantias"));
    d.append(api.document.createTextNode("Sem prejuízo de outras "), mk, api.document.createTextNode(" asseguradas ao contribuinte"));
    api.leiLigarCitacoesEm(d, "150");
    const bs = d.querySelectorAll("button");
    const txt = bs.map((b) => b.textContent);
    ok(bs.length === 3 && bs.every((b) => /lei-cita-link/.test(b.className) && /cit-parte/.test(b.className)) && txt.join("") === "outras garantias asseguradas",
       "L1 no leitor da lei, o trecho ligado à mão que passa por um grifo também vira link: " + JSON.stringify(txt));
    ok(mk.querySelectorAll("button").length === 1, "L1a o pedaço dentro do grifo continua dentro dele (o grifo não se perde)");
  }

  {
    /* o pedaço que contém uma citação não ganha um botão DENTRO do botão */
    const { api } = montar();
    api.citVinculoSalvar({ trecho: "conforme o art. 5º da CF dispõe", leiId: "cf88", artigos: [{ num: "150", numCru: "150", base: "150", sub: {} }] });
    const d = api.document.createElement("div");
    const mk = api.document.createElement("mark");
    mk.append(api.document.createTextNode("art. 5º da CF"));
    d.append(api.document.createTextNode("conforme o "), mk, api.document.createTextNode(" dispõe"));
    api.leiLigarCitacoesEm(d, "150");
    const dentro = mk.querySelectorAll("button");
    ok(dentro.length === 1 && !(dentro[0].querySelectorAll("button") || []).length && dentro[0].textContent === "art. 5º da CF",
       "L2 o pedaço com citação dentro continua UM botão (sem botão dentro de botão)");
    /* botão que já existe no meio do trecho: o trecho não casa (o texto do botão não conta) */
    const d2 = api.document.createElement("div");
    const bt = api.document.createElement("button");
    bt.append(api.document.createTextNode("prejuízo"));
    d2.append(api.document.createTextNode("Sem "), bt, api.document.createTextNode(" de outras"));
    api.citVinculoSalvar({ trecho: "Sem prejuízo de outras", leiId: "cf88", artigos: [{ num: "150", numCru: "150", base: "150", sub: {} }] });
    ok(api.citLigarAtravessando(d2, "", (c) => api.document.createElement("button")) === 0 && d2.querySelectorAll("button").length === 1,
       "L3 um botão no meio do trecho não é lido como texto");
  }

  /* ---- as leis chegam depois da leitura ---- */
  {
    const { api, ch } = montar(false);
    api.matGravar(ch, "Ver o art. 150 da CF.", { disciplina: DISC, topico: TOP });
    abrir(api);
    api.matTrocarModo("ler");
    const l0 = links(api).find((b) => /art\. 150/.test(b.textContent));
    ok(l0 && /qs-lei-link-sem/.test(l0.className), "R0 sem a lei carregada, o link nasce 'sem lei'");
    api.leiGuardar(Object.assign({ topicos: [ch] }, CF));
    api.$("dlgMaterial").open = false;
    ok(api.citRepintarAposLeis() === false, "R0a resumo fechado: nada a redesenhar");
    api.$("dlgMaterial").open = true;
    ok(api.citRepintarAposLeis() === true, "R1 quando as leis chegam, a leitura aberta é redesenhada");
    const l1 = links(api).find((b) => /art\. 150/.test(b.textContent));
    ok(l1 && !/qs-lei-link-sem/.test(l1.className), "R1a e o link passa a ter a lei: " + (l1 && l1.className));
    ok(api.citRepintarAposLeis() === false, "R2 sem link 'sem lei' na tela, não redesenha à toa");
    api.$("dlgMaterial").open = false;
    ok(api.citRepintarAposLeis() === false, "R2a resumo fechado: nada a fazer");
  }

  /* ---- o CSS e o i18n ---- */
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  ok(html.indexOf(".qs-lei-link-perm.cit-parte:not(.cit-parte-fim)::after,.lei-cita-link.lei-cita-perm.cit-parte:not(.cit-parte-fim)::after{content:none}") > 0,
     "C1 o 🔗 sai só no último pedaço (CSS)");
  {
    const { api } = rodar();
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t("cit_vinc_invisivel") !== "cit_vinc_invisivel", "C2 falta cit_vinc_invisivel em " + lg); });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
