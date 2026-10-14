/* =====================================================================
 * O JULGADO CITADO VIRA LINK (v18.33.0)
 *
 * O pedido, com print: "(Súmula 430 do STJ)" no resumo era texto morto.
 * Agora a citação de julgado — súmula, súmula vinculante, tema, processo —
 * vira link no resumo, nos cartões e no comentário das questões; tocar abre
 * a prévia do julgado guardado; sem julgado, "Criar agora" abre a gaveta já
 * com a identidade, e ao guardar o link passa a achá-lo sozinho.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const DISC = "Direito Tributário", TOP = "Responsabilidade tributária";
  const cls = (b) => String((b && b.className) || "");
  const guardar = (api, dados, disciplina, topico) => {
    const j = api.jurGravar(Object.assign({ tese: "tese qualquer" }, dados));
    if (disciplina) api.jurLigar(j.id, api.matChave(disciplina, topico), disciplina, topico);
    return api.jurDe(j.id);
  };

  /* J1: o leitor reconhece as formas de citar */
  {
    const { api } = rodar();
    const ler = (s) => api.jurCitacoesNoTexto(s).map((c) => [c.texto, c.classe, c.numero, c.tribunal].join("|"));
    const a = ler("O mero inadimplemento não gera (Súmula 430 do STJ). Presume-se (Súmula 435 do STJ).");
    ok(a.join(" ; ") === "Súmula 430 do STJ|Súmula|430|STJ ; Súmula 435 do STJ|Súmula|435|STJ",
      "J1 súmulas do STJ, sem levar o parêntese de fora: " + a.join(" ; "));
    const b = ler("RE 574.706 (Tema 69 da Repercussão Geral); REsp 1.101.728/SP; ADI 5835 e ADPF 499; Tema 981 do STJ.");
    ok(b.join(" ; ") === "RE 574.706|RE|574.706|STF ; Tema 69 da Repercussão Geral|Tema|69|STF ; REsp 1.101.728/SP|REsp|1.101.728|STJ ; ADI 5835|ADI|5835|STF ; ADPF 499|ADPF|499|STF ; Tema 981 do STJ|Tema|981|STJ",
      "J1a processos, tema e tribunal pela classe: " + b.join(" ; "));
    const c = ler("Súmula Vinculante 8, SV 31, Súmula 7/STJ, Súmula 435 (STJ), AgRg no REsp 123456/RS do STJ, Tema Repetitivo 1.");
    ok(c.join(" ; ") === "Súmula Vinculante 8|Súmula Vinculante|8|STF ; SV 31|Súmula Vinculante|31|STF ; Súmula 7/STJ|Súmula|7|STJ ; Súmula 435 (STJ)|Súmula|435|STJ ; AgRg no REsp 123456/RS do STJ|AgRg no REsp|123456|STJ ; Tema Repetitivo 1|Tema|1|STJ",
      "J1b vinculante, '/STJ', '(STJ)', classe composta e tema repetitivo: " + c.join(" ; "));
    ok(ler("No RE do contribuinte, o MS foi negado; o tema de casa; HC 1; re 574706.").length === 0,
      "J1c sem número de processo (ou minúsculo) não é citação: " + ler("No RE do contribuinte, o MS foi negado; o tema de casa; HC 1; re 574706.").join(" ; "));
    const s = "x (Súmula 430 do STJ) y";
    const c0 = api.jurCitacoesNoTexto(s)[0];
    ok(c0 && s.slice(c0.ini, c0.fim) === c0.texto, "J1d as posições não batem com o texto");
  }

  /* J2: achar o julgado guardado */
  {
    const { api } = rodar();
    api.matIniciar();
    const s430 = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "430", tese: "O inadimplemento da obrigação tributária pela sociedade não gera, por si só, a responsabilidade solidária do sócio-gerente." }, DISC, TOP);
    const re = guardar(api, { tribunal: "STF", classe: "RE", numero: "574706", tese: "O ICMS não compõe a base de cálculo do PIS e da COFINS (Tema 69)." }, DISC, "Outro");
    const resp = guardar(api, { tribunal: "STJ", classe: "REsp", numero: "1101728", tese: "redirecionamento" });
    const achar = (txt, ch) => api.jurAcharCitado(api.jurCitacoesNoTexto(txt)[0], null, ch);
    ok((achar("Súmula 430 do STJ").julgado || {}).id === s430.id, "J2 a Súmula 430 do STJ guardada não foi achada");
    ok(!achar("Súmula 430 do STF").julgado, "J2a tribunal diferente achou o julgado do STJ");
    ok((achar("Súmula 430").julgado || {}).id === s430.id, "J2b sem tribunal escrito, o único guardado devia ser achado");
    ok((achar("Tema 69 da Repercussão Geral").julgado || {}).id === re.id, "J2c o tema devia achar o RE que diz 'Tema 69'");
    ok((achar("REsp 1.101.728/SP").julgado || {}).id === resp.id, "J2d os pontos e a UF do número atrapalharam a busca");
    ok(!achar("Súmula 435 do STJ").julgado && !achar("Súmula 435 do STJ").ambiguos, "J2e julgado não guardado devia dar 'não achado'");
    const s7a = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "7", tese: "reexame de prova" }, DISC, TOP);
    guardar(api, { tribunal: "STF", classe: "Súmula", numero: "7", tese: "outra" }, DISC, "Outro");
    const amb = achar("Súmula 7");
    ok(!amb.julgado && amb.ambiguos && amb.ambiguos.length === 2, "J2f duas súmulas 7 (STJ e STF) sem tribunal na citação deviam dar dúvida");
    ok((achar("Súmula 7", api.matChave(DISC, TOP)).julgado || {}).id === s7a.id, "J2g na dúvida, a do tópico devia vencer");
  }

  /* J3-J6: o resumo — link, prévia, criar agora e o link que passa a achar */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", especie: "Lei", numero: "5.172",
      texto: "Art. 135. São pessoalmente responsáveis os diretores." });
    api.leiLigar("lei_ctn", ch);
    const s430 = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "430", tese: "O inadimplemento não gera, por si só, a responsabilidade do sócio-gerente.", resumo: "Precisa de dolo ou infração.", texto: "EMENTA longa…" }, DISC, TOP);
    const TXT = "* O mero inadimplemento não gera responsabilidade (Súmula 430 do STJ), salvo o art. 135 do CTN.\n* Presume-se dissolvida irregularmente (Súmula 435 do STJ).";
    api.matGravar(ch, TXT, { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const jl = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link");
    const ls = jl();
    ok(ls.length === 2 && ls[0].textContent === "Súmula 430 do STJ" && ls[1].textContent === "Súmula 435 do STJ", "J3 as súmulas do resumo não viraram links: " + ls.map((b) => b.textContent).join(" | "));
    ok(!/jur-cit-sem/.test(cls(ls[0])) && /jur-cit-sem/.test(cls(ls[1])), "J3a a guardada e a não guardada deviam se distinguir antes do toque");
    ok(api.$("matLeitura").querySelectorAll("button.mat-lei-link").length === 1, "J3b a citação de lei deixou de ser link ao lado das súmulas");
    ok(/Súmula 430 do STJ\), salvo o art\. 135 do CTN/.test(api.$("matLeitura").textContent || ""), "J3c o texto na tela mudou");
    ls[0].onclick({ stopPropagation() {} });
    ok(api.$("dlgJurCitaPreview").open === true, "J4 tocar na súmula guardada não abriu a prévia");
    ok(/sócio-gerente/.test(api.$("jurCitaCorpo").textContent || "") && /dolo/.test(api.$("jurCitaCorpo").textContent || ""), "J4a a prévia não mostra a tese e o resumo");
    ok(/STJ · Súmula 430/.test(api.$("jurCitaMeta").textContent || ""), "J4b a prévia não diz qual julgado é: " + api.$("jurCitaMeta").textContent);
    ok(api.$("btnJurCitaCriar").hidden && !api.$("btnJurCitaAbrir").hidden, "J4c julgado guardado: 'abrir na gaveta' sim, 'criar' não");
    ok(api.$("dlgMaterial").open === true, "J4d a prévia fechou o resumo");
    api.$("btnJurCitaAbrir").onclick();
    ok(api.$("dlgJuris").open === true && api.$("jurTese").value === s430.tese, "J4e 'abrir na gaveta' não abriu este julgado");
    api.$("dlgJuris").close(); api.jurVoltarPara();
    /* a não guardada: criar agora */
    jl()[1].onclick({ stopPropagation() {} });
    ok(/ainda não está entre os seus julgados/.test(api.$("jurCitaCorpo").textContent || "") && !api.$("btnJurCitaCriar").hidden,
      "J5 a súmula não guardada devia oferecer 'Criar agora'");
    api.$("btnJurCitaCriar").onclick();
    ok(!api.$("dlgJurCitaPreview").open && api.$("dlgJuris").open === true, "J5a 'Criar agora' não abriu a gaveta");
    ok(api.$("jurTribunal").value === "STJ" && api.$("jurClasse").value === "Súmula" && api.$("jurNumero").value === "435",
      "J5b a gaveta não veio com a identidade: " + [api.$("jurTribunal").value, api.$("jurClasse").value, api.$("jurNumero").value].join("|"));
    ok(api.$("jurMetaCampos").hidden === false && /vieram da citação “Súmula 435 do STJ”/.test(api.$("jurColarAviso").textContent || ""),
      "J5c a identidade preenchida devia ficar à vista, com o aviso de onde veio");
    /* guarda (como a gaveta guardaria) e fecha: o link passa a achar */
    guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: "Presume-se dissolvida irregularmente a empresa…" }, DISC, TOP);
    api.$("dlgJuris").close(); api.jurVoltarPara();
    ok(jl().length === 2 && !/jur-cit-sem/.test(cls(jl()[1])), "J6 depois de criar, a citação devia achar o julgado sozinha");
  }

  /* J7: na questão e no cartão */
  {
    const { api } = rodar();
    api.matIniciar();
    guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "430", tese: "não gera responsabilidade" }, DISC, TOP);
    const q = { disciplina: DISC, topico: TOP, comentario: "Errado: o inadimplemento não basta (Súmula 430 do STJ)." };
    const el = api.document.createElement("div");
    api.qsUiComentario(el, q);
    const b = el.querySelectorAll("button.jur-cit-link")[0];
    ok(!!b && !/jur-cit-sem/.test(cls(b)) && el.textContent === q.comentario, "J7 no comentário da questão a súmula não virou link (ou o texto mudou)");
    b.onclick({ stopPropagation() {} });
    ok(api.$("dlgJurCitaPreview").open === true && /não gera responsabilidade/.test(api.$("jurCitaCorpo").textContent || ""), "J7a a súmula da questão não abriu a prévia");
    api.$("dlgJurCitaPreview").close();
    const sem = api.document.createElement("div");
    api.qsUiComentario(sem, { disciplina: DISC, topico: TOP, comentario: "Sem citação nenhuma aqui." });
    ok(sem.textContent === "Sem citação nenhuma aqui." && sem.querySelectorAll("button").length === 0, "J7b comentário sem citação ganhou botão");
    /* o trecho que a PESSOA ligou à lei vence: a súmula dentro dele não vira um segundo link por cima */
    api.leiIniciar();
    api.leiGuardar({ id: "lei_x", nome: "Lei X", texto: "Art. 1º Um." });
    api.citVinculoSalvar({ trecho: "regra da Súmula 430 do STJ", leiId: "lei_x", artigos: [{ num: "1", numCru: "1" }] });
    const vv = api.document.createElement("div");
    vv.append(api.document.createTextNode("Veja a regra da Súmula 430 do STJ aqui."));
    api.citLigarEm(vv, { disciplina: DISC, topico: TOP, onde: "resumo" });
    ok(vv.querySelectorAll("button.jur-cit-link").length === 0 && vv.querySelectorAll("button.qs-lei-link-perm").length === 1,
      "J7e o vínculo fixado pela pessoa devia vencer a súmula de dentro dele (sem dois links sobrepostos)");
    const card = api.document.createElement("div");
    card.append(api.document.createTextNode("Responde? Não (Súmula 430 do STJ)."));
    api.citLigarEm(card, { disciplina: DISC, topico: TOP, onde: "cartao" });
    const cb = card.querySelectorAll("button.jur-cit-link")[0];
    ok(!!cb && /car-jur-link/.test(cls(cb)), "J7c no cartão a súmula não virou link (com a cor do cartão)");
    /* cartão sem tópico (bancada): mostra, mas não oferece criar */
    api.jurCitPreviewAbrir(api.jurCitacoesNoTexto("Súmula 999 do STJ")[0], { julgado: null }, { onde: "cartao" });
    ok(api.$("btnJurCitaCriar").hidden && /não é de um tópico/.test(api.$("jurCitaCorpo").textContent || ""), "J7d sem tópico, 'criar' não devia aparecer");
  }

  return falhas;
}

module.exports = { testes };
