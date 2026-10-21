/* =====================================================================
 * QUEM É QUEM NA JURISPRUDÊNCIA (v18.94.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. salvar a edição de um julgado NÃO apaga os outros tópicos dele (o "topicos: undefined" do formulário apagava);
 *  2. editar pela prévia de uma citação NÃO liga o julgado ao tópico do texto;
 *  3. súmula não é cobrada por relator (o resto continua cobrado);
 *  4. o julgado é achado do jeito que foi guardado: "Tema Repetitivo" + "Tema 1134 (REsp 1.914.902/SP)", "863 / 827",
 *     "RE-AgR / RE" + "259.976 / 250.844", "2405/RS";
 *  5. citar o processo entre parênteses acha o tema ("paradigma") e a prévia diz isso; quem É vence quem é paradigma,
 *     que vence quem só menciona; tribunal diferente não casa;
 *  6. "AgRg no REsp 123" não abre o "REsp 123" guardado (outra decisão), mas a prévia avisa que ele existe.
 * Casos tirados da base real (backup de 19/10/2026).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };
  const NL = String.fromCharCode(10);
  const montar = (a) => {
    a.matIniciar(); a.edIniciar();
    const e = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Direito Tributário :: 5", "+ Imunidades :: 4", "+ Crédito tributário :: 5"].join(NL));
    a.hubAbrirEdital(e.id);
    return e;
  };

  /* ---- 1 e 2: tópicos ---- */
  {
    const { api: a } = rodar();
    montar(a);
    const chI = a.matChave("Direito Tributário", "Imunidades"), chC = a.matChave("Direito Tributário", "Crédito tributário");
    const j = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "430", tese: "O inadimplemento não gera, por si só, a responsabilidade.", topicos: [chI, chC] });
    const r = a.jurGravar({ id: j.id, tese: "nova", topicos: undefined, resumo: undefined });
    ok(r.topicos.length === 2 && r.tese === "nova", "I1 jurGravar com topicos: undefined mantém os 2 tópicos: " + JSON.stringify(r.topicos));
    ok(a.jurGravar({ id: j.id, topicos: [] }).topicos.length === 0 && a.jurGravar({ id: j.id, topicos: [chI, chC] }).topicos.length === 2,
      "I1a [] continua limpando de propósito");
    /* pela tela: editar e salvar no tópico Imunidades mantém o Crédito tributário */
    a.jurAbrir("Direito Tributário", "Imunidades");
    a.jurEditar(j.id);
    a.$("jurTese").value = "O inadimplemento da obrigação tributária pela sociedade não gera, por si só, a responsabilidade solidária do sócio-gerente.";
    await conduzir(a, a.jurSalvar());
    const s = a.jurDe(j.id);
    ok(s.topicos.length === 2 && /sócio-gerente/.test(s.tese), "I1b salvar a edição pela gaveta mantém os 2 tópicos: " + JSON.stringify(s.topicos));
    /* julgado só do Crédito tributário, editado com a gaveta aberta em Imunidades (o caminho da prévia de citação) */
    const k = a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: "A entrega de declaração constitui o crédito.", topicos: [chC] });
    a.jurAbrir("Direito Tributário", "Imunidades");
    a.jurEditar(k.id);
    a.$("jurTese").value = "A entrega de declaração pelo contribuinte reconhecendo débito fiscal constitui o crédito tributário.";
    await conduzir(a, a.jurSalvar());
    const kk = a.jurDe(k.id);
    ok(kk.topicos.length === 1 && kk.topicos[0] === chC && /reconhecendo/.test(kk.tese), "I2 editar um julgado de outro tópico não o liga ao tópico aberto: " + JSON.stringify(kk.topicos));
    /* novo continua sendo ligado ao tópico aberto */
    a.jurAbrir("Direito Tributário", "Imunidades");
    a.$("jurTribunal").value = "STF"; a.$("jurClasse").value = "Súmula Vinculante"; a.$("jurNumero").value = "52";
    a.$("jurTese").value = "Ainda quando alugado a terceiros, permanece imune ao IPTU o imóvel.";
    await conduzir(a, a.jurSalvar());
    const nv = a.jurLista().find((x) => x.numero === "52");
    ok(nv && nv.topicos.length === 1 && nv.topicos[0] === chI, "I2a o julgado NOVO continua ligado ao tópico aberto");
    const rot = nv && nv.rotulos && nv.rotulos[a.jurChaveComparavel(chI)];
    ok(rot && rot.t === "Imunidades" && rot.d === "Direito Tributário", "I2b e com o rótulo do tópico (é ele que dá o nome certo na estante)");
    ok(!(kk.rotulos && kk.rotulos[a.jurChaveComparavel(chI)]), "I2c o editado de outro tópico não ganha rótulo do tópico aberto");
  }

  /* ---- 3: relator ---- */
  {
    const { api: a } = rodar();
    ok(a.jurEhSumula({ classe: "Súmula Vinculante" }) && a.jurEhSumula({ classe: "Súmula" }) && a.jurEhSumula({ classe: "", categoria: "SÚMULA" }) && !a.jurEhSumula({ classe: "RE" }) && !a.jurEhSumula({ classe: "Tema" }),
      "I3 o que é súmula");
    ok(a.jurFaltando({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: "t" }).indexOf("relator") < 0, "I3a súmula não é cobrada por relator");
    ok(a.jurFaltando({ tribunal: "STF", classe: "RE", numero: "574706", tese: "t" }).indexOf("relator") >= 0
      && a.jurFaltando({ tribunal: "STF", classe: "Tema", numero: "69", tese: "t" }).indexOf("relator") >= 0, "I3b acórdão e tema continuam cobrados por relator");
  }

  /* ---- 4: identidades ---- */
  {
    const { api: a } = rodar();
    const id = (classe, numero) => a.jurIdentidadesDe({ classe, numero }).map((x) => x.cc + " " + x.numero + (x.paradigma ? "*" : "")).join(", ");
    ok(id("Tema Repetitivo", "Tema 1134 (REsp 1.914.902/SP)") === "tema 1134, resp 1914902*", "I4 tema com o REsp entre parênteses: " + id("Tema Repetitivo", "Tema 1134 (REsp 1.914.902/SP)"));
    ok(id("Tema", "863 / 827") === "tema 863, tema 827" && id("Tema", "482 / 1.108") === "tema 482, tema 1108", "I4a dois temas numa ficha");
    ok(id("RE-AgR / RE", "259.976 / 250.844") === "re 259976, re 250844", "I4b duas classes e dois números andam juntos");
    ok(id("ADI", "2405/RS") === "adi 2405" && id("ADI / ARE", "551/RJ e 938.538 AgR/ES") === "adi 551, are 938538" && id("ARE", "800395 AgR") === "are 800395",
      "I4c a UF colada não vira número: " + id("ADI / ARE", "551/RJ e 938.538 AgR/ES"));
    ok(id("Súmula Vinculante", "29") === "sumula vinculante 29" && id("SV", "29") === "sumula vinculante 29" && id("Tema de Repercussão Geral", "69") === "tema 69",
      "I4d SV e 'Tema de Repercussão Geral' são as classes de sempre");
    ok(id("", "") === "" && id("RE", "") === "", "I4e sem número, sem identidade");
  }

  /* ---- 5 e 6: achar o citado ---- */
  {
    const { api: a } = rodar();
    const t1134 = a.jurGravar({ tribunal: "STJ", classe: "Tema Repetitivo", numero: "Tema 1134 (REsp 1.914.902/SP)", tese: "Diante do art. 130, parágrafo único, do CTN…" });
    const t863 = a.jurGravar({ tribunal: "STF", classe: "Tema", numero: "863 / 827", tese: "multa qualificada" });
    const re = a.jurGravar({ tribunal: "STF", classe: "RE-AgR / RE", numero: "259.976 / 250.844", tese: "imunidade recíproca" });
    const cit = (txt) => a.jurCitacoesNoTexto(txt)[0];
    const ach = (txt) => a.jurAcharCitado(cit(txt));
    ok(ach("Tema 1134 do STJ").julgado === null ? false : ach("Tema 1134 do STJ").julgado.id === t1134.id && ach("Tema 1134 do STJ").via === "eh",
      "I5 'Tema 1134 do STJ' acha o guardado como 'Tema Repetitivo / Tema 1134 (REsp…)'");
    const p = ach("REsp 1.914.902/SP");
    ok(p.julgado && p.julgado.id === t1134.id && p.via === "paradigma", "I5a citar o REsp acha o tema que ele fixou (via paradigma): " + JSON.stringify({ via: p.via }));
    ok(ach("Tema 827 do STF").julgado && ach("Tema 827 do STF").julgado.id === t863.id && ach("Tema 863").julgado.id === t863.id, "I5b qualquer dos dois temas da ficha acha a ficha");
    ok(ach("RE 250.844").julgado && ach("RE 250.844").julgado.id === re.id, "I5c o segundo processo da ficha composta também acha");
    ok(!ach("Tema 1134 do STF").julgado, "I5d tribunal diferente não casa (Tema 1134 do STF não é o do STJ)");
    /* quem É vence o paradigma */
    const resp = a.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "1.914.902", tese: "o acórdão do REsp" });
    const p2 = ach("REsp 1.914.902/SP");
    ok(p2.julgado && p2.julgado.id === resp.id && p2.via === "eh", "I5e guardado o próprio REsp, ele vence o tema que o tem entre parênteses");
    /* outra decisão do mesmo processo: não abre, mas avisa */
    const ag = ach("AgRg no REsp 1.914.902");
    ok(!ag.julgado && !ag.ambiguos && ag.parentes && ag.parentes.length >= 1, "I6 'AgRg no REsp' não abre o REsp guardado, mas o aponta como parente: " + JSON.stringify(ag.parentes && ag.parentes.map((x) => x.classe)));
    ok(!(ach("REsp 9.999.999").parentes), "I6a sem parente, nada a avisar");
    /* a prévia diz como achou */
    a.jurCitPreviewAbrir(cit("REsp 1.914.902/SP"), a.jurAcharCitado(cit("REsp 1.914.902/SP"), [t1134]), { disciplina: "D", topico: "T" });
    ok(a.$("jurCitaCorpo").textContent.indexOf(a.t("jur_cit_via_paradigma", { c: a.$("jurCitaTit").textContent, j: a.jurCitNome(t1134) })) >= 0,
      "I5f a prévia diz que o REsp citado é o processo que fixou o tema guardado");
    a.jurCitPreviewAbrir(cit("AgRg no REsp 1.914.902"), ag, { disciplina: "D", topico: "T" });
    ok(/outra decisão do mesmo processo/.test(a.$("jurCitaCorpo").textContent), "I6b a prévia do não guardado avisa do parente");
  }
  return falhas;
}

module.exports = { testes };
