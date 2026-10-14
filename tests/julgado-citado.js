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
    /* (v18.35.0) "Criar agora" cria NA PRÉVIA; a gaveta completa fica como opção */
    ok(!api.$("jurCitaNovo").hidden && !api.$("btnJurCitaGaveta").hidden, "J5x 'Criar agora' devia abrir os passos dentro da prévia");
    api.$("btnJurCitaGaveta").onclick();
    ok(!api.$("dlgJurCitaPreview").open && api.$("dlgJuris").open === true, "J5a 'usar a gaveta completa' não abriu a gaveta");
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

  /* =================================================================
   * L1 (v18.34.0): DESLIGAR, RELIGAR E LIGAR A OUTRO
   * ================================================================= */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", especie: "Lei", numero: "5.172",
      texto: "Art. 134. Respondem solidariamente.\nArt. 135. São pessoalmente responsáveis os diretores." });
    api.leiLigar("lei_ctn", ch);
    const s430 = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "430", tese: "inadimplemento não basta" }, DISC, TOP);
    const s435 = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: "dissolução irregular presume" }, DISC, TOP);
    const TXT = "* Os diretores (art. 135 do CTN) e as pessoas do art. 134 do CTN.\n* Não basta o inadimplemento (Súmula 430 do STJ).";
    api.matGravar(ch, TXT, { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const leis = () => api.$("matLeitura").querySelectorAll("button.mat-lei-link");
    const juls = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link");
    /* L1: desligar um link de lei */
    leis().filter((b) => b.textContent === "art. 134 do CTN")[0].onclick({ stopPropagation() {} });
    ok(!api.$("btnLeiCitaDesligar").hidden && !api.$("btnLeiCitaOutro").hidden, "L1 a prévia da lei (vinda do resumo) devia oferecer desligar e ligar a outro");
    api.$("btnLeiCitaDesligar").onclick();
    ok(!api.$("dlgLeiCitaPreview").open, "L1a desligar devia fechar a prévia");
    ok(leis().length === 1 && leis()[0].textContent === "art. 135 do CTN", "L1b o link desligado continua no resumo: " + leis().map((b) => b.textContent).join(" | "));
    ok(/as pessoas do art\. 134 do CTN\./.test(api.$("matLeitura").textContent || ""), "L1c desligar mudou o texto");
    const neg = api.citVinculosLer().filter((v) => v.nenhum)[0];
    ok(neg && neg.chave === ch && neg.trecho === "art. 134 do CTN", "L1d o desligado devia ficar guardado só neste tópico: " + JSON.stringify(neg));
    /* em outro tópico o mesmo trecho continua link */
    const el = api.document.createElement("div");
    api.qsUiComentario(el, { disciplina: DISC, topico: "Outro", comentario: "Ver o art. 134 do CTN." });
    ok(el.querySelectorAll("button.qs-lei-link").length === 1, "L1e o desligado vazou para outro tópico");
    /* L2: religar pela lista de vínculos */
    api.matVinculosAbrir("");
    const rel = api.$("qsVincLista").querySelectorAll("button").filter((b) => /^btnQsVincReligar_/.test(b.id || ""))[0];
    ok(!!rel && /desligado/.test(api.$("qsVincLista").textContent || ""), "L2 a lista de vínculos devia mostrar o desligado com 'religar'");
    rel.onclick();
    ok(leis().length === 2 && api.citVinculosLer().filter((v) => v.nenhum).length === 0, "L2a religar não trouxe o link de volta");
    api.$("dlgQsVinc").close();
    /* L3: ligar a outro (lei) — abre a escolha já com o trecho, e o novo vínculo troca o automático */
    leis().filter((b) => b.textContent === "art. 134 do CTN")[0].onclick({ stopPropagation() {} });
    api.$("btnLeiCitaOutro").onclick();
    ok(api.$("dlgQsVincEsc").open === true && /art\. 134 do CTN/.test(api.$("qsVincEscTrecho").textContent || "") && api.$("qsVincArts").value === "134",
      "L3 'ligar a outro…' não abriu a escolha com o trecho: " + api.$("qsVincArts").value);
    api.$("qsVincLei").value = "lei_ctn"; api.$("qsVincArts").value = "135"; api.$("qsVincArts").oninput();
    api.$("btnQsVincEscOk").onclick();
    const l134 = leis().filter((b) => b.textContent === "art. 134 do CTN")[0];
    ok(!!l134 && /qs-lei-link-perm/.test(cls(l134)), "L3a o trecho devia passar a levar ao novo destino (vínculo fixo)");
    /* L4: desligar um link de julgado */
    juls()[0].onclick({ stopPropagation() {} });
    ok(!api.$("btnJurCitaDesligar").hidden && !api.$("btnJurCitaOutro").hidden, "L4 a prévia do julgado devia oferecer desligar e ligar a outro");
    api.$("btnJurCitaDesligar").onclick();
    ok(juls().length === 0 && /Súmula 430 do STJ/.test(api.$("matLeitura").textContent || ""), "L4a o link de julgado desligado continua (ou o texto sumiu)");
    api.matVinculosAbrir("");
    const relJ = api.$("qsVincLista").querySelectorAll("button").filter((b) => /^btnQsVincReligar_/.test(b.id || ""))[0];
    ok(!!relJ && /julgado desligado/.test(api.$("qsVincLista").textContent || ""), "L4b a lista devia mostrar o julgado desligado");
    relJ.onclick();
    ok(juls().length === 1, "L4c religar o julgado não trouxe o link");
    api.$("dlgQsVinc").close();
    /* L5: ligar a outro julgado — a citação passa a abrir o escolhido */
    juls()[0].onclick({ stopPropagation() {} });
    api.$("btnJurCitaOutro").onclick();
    ok(api.$("dlgJurEscolher").open === true && /Súmula 430 do STJ/.test(api.$("jurEscTrecho").textContent || ""), "L5 'ligar a outro julgado' não abriu a escolha com o trecho");
    const ops = api.$("jurEscLista").querySelectorAll("button.jur-cita-opcao");
    ok(ops.length === 2 && ops.every((b) => /★/.test(b.textContent || "")), "L5a a lista devia trazer os julgados do tópico (★): " + ops.map((b) => b.textContent).join(" | "));
    api.$("btnJurEscOk").onclick();
    ok(api.$("dlgJurEscolher").open === true && /Escolha um julgado/.test(api.$("jurEscAviso").textContent || ""), "L5b ligar sem escolher não pode gravar");
    ops.filter((b) => /435/.test(b.textContent || ""))[0].onclick();
    ok(/dissolução irregular/.test(api.$("jurEscPrev").textContent || ""), "L5c escolher devia mostrar a prévia do julgado");
    api.$("btnJurEscOk").onclick();
    ok(!api.$("dlgJurEscolher").open, "L5d ligar não fechou a escolha");
    const j0 = juls()[0];
    ok(!!j0 && /jur-cit-perm/.test(cls(j0)), "L5e a citação devia virar vínculo fixo");
    j0.onclick({ stopPropagation() {} });
    ok(/dissolução irregular/.test(api.$("jurCitaCorpo").textContent || ""), "L5f a citação devia abrir o julgado escolhido (435), não o 430");
    api.$("dlgJurCitaPreview").close();
    /* L6: busca */
    api.jurEscAbrir("qualquer trecho", { disciplina: DISC, topico: TOP });
    api.$("jurEscBusca").value = "inadimplemento"; api.$("jurEscBusca").oninput();
    const so = api.$("jurEscLista").querySelectorAll("button.jur-cita-opcao");
    ok(so.length === 1 && /430/.test(so[0].textContent || ""), "L6 a busca não filtrou pela tese");
    api.$("dlgJurEscolher").close();
    /* L7: ligar um trecho QUALQUER (sem citação) a um julgado, pela bolha */
    api.jurEscAbrir("Não basta o inadimplemento", { disciplina: DISC, topico: TOP, aoVoltar: () => api.matTrocarModo("ler") });
    api.$("jurEscLista").querySelectorAll("button.jur-cita-opcao").filter((b) => /430/.test(b.textContent || ""))[0].onclick();
    api.$("btnJurEscOk").onclick();
    const livre = juls().filter((b) => b.textContent === "Não basta o inadimplemento")[0];
    ok(!!livre && /jur-cit-perm/.test(cls(livre)), "L7 o trecho livre ligado a um julgado não virou link");
    ok(!!api.$("btnBolhaJurLigar"), "L7a a bolha não tem '⚖ ligar a julgado'");
    void s430; void s435;
  }
  {
    /* L9: o trecho livre numa linha SEM citação nenhuma; a lei automática cede ao julgado fixado; os do tópico primeiro */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: "Art. 134. Respondem." });
    api.leiLigar("lei_ctn", ch);
    const fora = guardar(api, { tribunal: "STF", classe: "RE", numero: "999999", tese: "de outro tópico" }, DISC, "Outro");
    const dele = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "430", tese: "do tópico" }, DISC, TOP);
    api.citVinculoSalvar({ trecho: "Regra sem citação", tipo: "jur", jurId: dele.id, chave: ch });
    api.citVinculoSalvar({ trecho: "art. 134 do CTN", tipo: "jur", jurId: dele.id, chave: ch });
    api.matGravar(ch, "* Regra sem citação nenhuma.\n* Conforme o art. 134 do CTN.", { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const jt = api.$("matLeitura").querySelectorAll("button.jur-cit-link").map((b) => b.textContent);
    ok(jt.indexOf("Regra sem citação") >= 0, "L9 o trecho livre (linha sem citação) ligado a julgado não virou link: " + jt.join(" | "));
    ok(jt.indexOf("art. 134 do CTN") >= 0 && api.$("matLeitura").querySelectorAll("button.mat-lei-link").length === 0,
      "L9a o trecho com citação de lei ligado à mão a um julgado devia levar ao julgado (a lei automática cede)");
    api.jurEscAbrir("x", { disciplina: DISC, topico: TOP });
    const ord = api.$("jurEscLista").querySelectorAll("button.jur-cita-opcao").map((b) => b.textContent || "");
    ok(ord.length === 2 && /★/.test(ord[0]) && !/★/.test(ord[1]) && /999999/.test(ord[1]), "L9b os julgados do tópico deviam vir primeiro: " + ord.join(" | "));
    void fora;
  }
  /* =================================================================
   * C (v18.35.0): CRIAR O JULGADO DENTRO DA PRÉVIA
   * ================================================================= */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    api.matGravar(ch, "* Presume-se dissolvida irregularmente a empresa que deixar de funcionar (Súmula 435 do STJ).", { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const jl = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link");
    jl()[0].onclick({ stopPropagation() {} });
    api.$("btnJurCitaCriar").onclick();
    ok(!api.$("jurCitaNovo").hidden && api.$("btnJurCitaCriar").hidden, "C1 'Criar agora' não abriu os passos na prévia");
    ok(/S%C3%BAmula%20435/.test(api.$("jurCitaBuscar").href || ""), "C1a o link de busca não leva a citação: " + api.$("jurCitaBuscar").href);
    api.$("btnJurCitaPedido").onclick();
    const p = api.$("jurCitaPedidoTxt").value || "";
    ok(/"Súmula 435 do STJ"/.test(p) && /dissolvida irregularmente/.test(p) && new RegExp(TOP).test(p), "C1b o pedido não leva a citação, o trecho e o tópico");
    ok(/traga o enunciado\/tese de memória SÓ se souber/.test(p) && !/<ementa>/.test(p), "C1c sem ementa, o pedido devia avisar que é de memória (e não ter o bloco da ementa)");
    api.$("jurCitaEmenta").value = "Súmula 435: Presume-se dissolvida irregularmente a empresa que deixar de funcionar no seu domicílio fiscal…";
    api.$("btnJurCitaPedido").onclick();
    const p2 = api.$("jurCitaPedidoTxt").value || "";
    ok(/<ementa>[\s\S]*domicílio fiscal[\s\S]*<\/ementa>/.test(p2) && /COPIE a tese dele/.test(p2), "C1d com ementa, o pedido devia levá-la e mandar copiar a tese");
    api.$("jurCitaEmenta").value = "";
    /* o semáforo */
    const sem = (v) => { api.$("jurCitaResp").value = v; api.$("jurCitaResp").oninput(); return api.$("jurCitaSem").textContent || ""; };
    ok(/Cole aqui a resposta/.test(sem("")) && api.$("btnJurCitaGuardar").hidden, "C2 vazio: devia pedir a resposta e esconder o Guardar");
    ok(/Isto é o PEDIDO/.test(sem(p)), "C2a colar o próprio pedido devia ser avisado");
    ok(/Não consegui ler/.test(sem("blá blá")), "C2b texto qualquer devia dar 'não consegui ler'");
    ok(/a IA trouxe STJ Súmula 436/.test(sem('{"tribunal":"STJ","classe":"Súmula","numero":"436","tese_curta":"x"}')), "C2c número diferente da citação devia ser avisado");
    ok(/Veio sem a tese/.test(sem('{"tribunal":"STJ","classe":"Súmula","numero":"435","tese_curta":"","resumo":"r"}')), "C2d sem tese devia ser avisado");
    const RESP = '{"tribunal":"STJ","classe":"Súmula","numero":"435","tese_curta":"Presume-se dissolvida irregularmente a empresa que deixar de funcionar no seu domicílio fiscal, sem comunicação aos órgãos competentes, legitimando o redirecionamento da execução fiscal para o sócio-gerente.","certeza_da_tese":"media","resumo":"Dissolução irregular permite redirecionar.","assuntos":["dissolução irregular","redirecionamento"]}';
    ok(/^Lido: STJ Súmula 435/.test(sem(RESP)), "C2e resposta boa devia ficar verde: " + api.$("jurCitaSem").textContent);
    ok(/domicílio fiscal/.test(api.$("jurCitaTese").value) && /redirecionar/.test(api.$("jurCitaResumo").value), "C2f a tese e o resumo não foram para os campos de conferir");
    ok(/certeza: média/.test(api.$("jurCitaMemAviso").textContent || ""), "C2g sem ementa devia avisar que é de memória (certeza média)");
    ok(!api.$("btnJurCitaGuardar").hidden && !api.$("btnJurCitaGuardar").disabled, "C2h o Guardar devia aparecer ligado");
    api.$("jurCitaTese").value = ""; api.$("jurCitaResumo").value = ""; api.$("jurCitaTese").oninput();
    ok(api.$("btnJurCitaGuardar").disabled === true, "C2i sem tese nem resumo, o Guardar devia desligar");
    sem(""); sem(RESP);
    /* guardar */
    api.$("btnJurCitaGuardar").onclick();
    const g = api.jurLista().filter((j) => j.numero === "435")[0];
    ok(g && g.tribunal === "STJ" && g.classe === "Súmula" && g.deMemoria === true && g.certeza === "media" && (g.tags || []).indexOf("redirecionamento") >= 0,
      "C3 o julgado não foi guardado com identidade, 'de memória' e assuntos: " + JSON.stringify(g));
    ok(g && (g.topicos || []).some((x) => api.jurChaveComparavel(x) === api.jurChaveComparavel(ch)), "C3a o julgado não foi ligado ao tópico");
    ok(api.$("dlgJurCitaPreview").open && api.$("jurCitaNovo").hidden && /domicílio fiscal/.test(api.$("jurCitaCorpo").textContent || ""), "C3b depois de guardar, a prévia devia mostrar o julgado");
    ok(/memória da IA/.test(api.$("jurCitaCorpo").textContent || "") && !api.$("btnJurCitaConferi").hidden, "C3c a prévia devia mostrar o aviso 'de memória' e o '✓ conferi'");
    ok(jl().length === 1 && !/jur-cit-sem/.test(cls(jl()[0])), "C3d o resumo atrás não foi repintado (o link devia achar o julgado)");
    api.$("btnJurCitaConferi").onclick();
    ok(api.jurDe(g.id).deMemoria === false && !/memória da IA/.test(api.$("jurCitaCorpo").textContent || "") && api.$("btnJurCitaConferi").hidden, "C4 '✓ conferi' não tirou o aviso");
  }
  {
    /* C5: com ementa colada, não fica 'de memória' */
    const { api } = rodar();
    api.matIniciar();
    const base = { disciplina: DISC, topico: TOP };
    const c = api.jurCitacoesNoTexto("Súmula 7 do STJ")[0];
    api.jurCitPreviewAbrir(c, { julgado: null }, base);
    api.$("btnJurCitaCriar").onclick();
    api.$("jurCitaEmenta").value = "A pretensão de simples reexame de prova não enseja recurso especial.";
    api.$("jurCitaResp").value = '{"tribunal":"STJ","classe":"Súmula","numero":"7","tese_curta":"A pretensão de simples reexame de prova não enseja recurso especial.","certeza_da_tese":"alta"}';
    api.$("jurCitaResp").oninput();
    ok(api.$("jurCitaMemAviso").textContent === "", "C5 com ementa colada não devia avisar 'de memória'");
    api.$("btnJurCitaGuardar").onclick();
    const g = api.jurLista().filter((j) => j.numero === "7")[0];
    ok(g && !g.deMemoria && /reexame de prova/.test(g.texto || ""), "C5a com ementa, o julgado não devia ficar 'de memória' e a ementa devia ir para o texto: " + JSON.stringify(g));
  }
  {
    /* L8: modelo — vínculo antigo intacto; o de julgado não vira link de lei */
    const { api } = rodar();
    api.citVinculoSalvar({ trecho: "regra x", leiId: "lei_a", artigos: [{ num: "1", numCru: "1" }] });
    api.citVinculoSalvar({ trecho: "regra x", tipo: "jur", jurId: "j1" });
    const vs = api.citVinculosLer();
    ok(vs.length === 2 && vs.some((v) => v.k === "regra x" && v.leiId === "lei_a") && vs.some((v) => v.k === "jur:regra x" && v.jurId === "j1"),
      "L8 lei e julgado do mesmo trecho deviam conviver (chaves distintas): " + JSON.stringify(vs.map((v) => v.k)));
    ok(api.citVinculosAplicar("a regra x aqui", []).length === 1 && api.citVinculosAplicar("a regra x aqui", [])[0].leiId === "lei_a", "L8a o vínculo de julgado entrou como link de lei");
    ok(api.citVinculoSalvar({ trecho: "y" }) === null, "L8b vínculo sem destino e sem 'desligado' não pode ser gravado");
  }

  return falhas;
}

module.exports = { testes };
