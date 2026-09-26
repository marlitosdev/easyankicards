/* =====================================================================
 * ELEVAR CARTÕES ANTIGOS AO PADRÃO (16.71.0)
 *
 * O que originou: num baralho real, 759 de 843 cartões tinham resposta com
 * menos de 100 caracteres, só 16% citavam artigo, e o botão de revisar
 * devolvia cartões MAIS CURTOS sem avisar.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada cartão tem uma nota pelo que falta (resposta curta, sem artigo,
 *     sem saiba mais, lacuna sem dica, lacunas demais, pergunta na lacuna,
 *     "(Fonte: …)" no texto); o bom fica fora da lista; os piores vêm antes.
 *  2. O prompt em lote leva âncoras @@ N, o cartão inteiro (com @ e +), o
 *     resumo do tópico como FONTE (sem inventar artigo) e o bloco de preservar.
 *  3. A resposta é conferida ANTES de mexer: sem âncora, menos cartões,
 *     encolheu, perdeu conteúdo ou continua fraco são apontados; o que
 *     encolheu ou perdeu vem DESMARCADO.
 *  4. Trocar substitui o cartão inteiro (@, linha, +) sem tocar nos vizinhos.
 *  5. A rodada pode ser desfeita, mas nunca por cima de quem mexeu depois.
 *  6. A tela: lista, marcar os piores (no máximo o lote), gerar, colar,
 *     conferir, aplicar (com pergunta) e desfazer.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");

  const B = (f, v, extra) => Object.assign({ kind: "basic", front: f, back: v, more: "" }, extra);
  const RICO = "Serviços constantes da lista anexa à LC 116/2003, conforme o art. 1º; o imposto é municipal e incide sobre a prestação de serviços de qualquer natureza, ainda que não seja atividade preponderante do prestador";
  const { api } = rodar();

  /* ---- E1: a nota ---- */
  {
    const fraco = B("Qual o fato gerador do ISS?", "Serviço");
    ok(JSON.stringify(api.ceDefeitos(fraco)) === JSON.stringify(["verso_curto", "sem_artigo", "sem_mais"]) && api.ceNota(fraco) === 15 && api.ceNivel(fraco) === "fraco" && api.ceAbaixo(fraco), `E1 cartao fraco: ${JSON.stringify(api.ceDefeitos(fraco))} nota ${api.ceNota(fraco)}`);
    const bom = B("Qual o fato gerador do ISS?", RICO, { more: "Literalidade — Art. 1º" });
    ok(api.ceDefeitos(bom).length === 0 && api.ceNota(bom) === 100 && !api.ceAbaixo(bom), `E1a cartao completo nao devia ter defeito: ${JSON.stringify(api.ceDefeitos(bom))}`);
    ok(api.ceDefeitos(B("P?", "x".repeat(99), { more: "m", front: "P art. 5?" })).indexOf("verso_curto") >= 0 && api.ceDefeitos(B("P?", "x".repeat(100), { more: "m" })).indexOf("verso_curto") < 0, "E1b o limite da resposta curta e' 100 caracteres");
    const sd = { kind: "cloze", front: "O prazo é de {{c1::30 dias}} (art. 5º).", back: "", more: "+" };
    ok(api.ceDefeitos(sd).indexOf("cloze_sem_dica") >= 0 && api.ceDefeitos(sd).indexOf("verso_curto") < 0, `E1c lacuna sem dica (e sem 'resposta curta', que nao existe em lacuna): ${JSON.stringify(api.ceDefeitos(sd))}`);
    ok(api.ceDefeitos(Object.assign({}, sd, { front: "O prazo é de {{c1::30 dias::30 ou 60?}} (art. 5º)." })).indexOf("cloze_sem_dica") < 0, "E1d lacuna com dica nao devia ser apontada");
    ok(api.ceDefeitos(Object.assign({}, sd, { front: "{{c1::A}} e {{c2::B}} e {{c3::C}} e {{c4::D}} (art. 5º)" })).indexOf("lacunas_demais") >= 0 && api.ceDefeitos(Object.assign({}, sd, { front: "{{c1::A}} e {{c2::B}} e {{c3::C}} (art. 5º)" })).indexOf("lacunas_demais") < 0, "E1e mais de TRES lacunas (tres ainda e' aceito)");
    ok(api.ceDefeitos(Object.assign({}, sd, { front: "Qual o prazo? {{c1::30 dias}}" })).indexOf("cloze_pergunta") < 0, "E1f 'cloze_pergunta' deixou de existir: era impossivel de tirar (a IA nao sabe o que a regra pede)");
    ok(api.ceDefeitos(B("P (Fonte: CTM)", RICO)).indexOf("fonte_no_texto") >= 0 && api.ceDefeitos(B("P", RICO + " (fonte: CTM)")).indexOf("fonte_no_texto") >= 0, "E1g (Fonte: ...) no texto");
    ok(api.ceNota(B("", "")) >= 0 && api.ceNota(null) >= 0, "E1h nota nunca e' negativa nem quebra com cartao vazio");
    ok(api.ceDefeitos(B("P", "x".repeat(150), { more: "m", front: "Conforme o § 2º" })).indexOf("sem_artigo") < 0 && api.ceDefeitos(B("P", "x".repeat(150), { more: "m", front: "Conforme o Art. 12" })).indexOf("sem_artigo") < 0, "E1i § e Art. contam como citacao");
  }

  /* ---- E1j: niveis e requisitos ---- */
  {
    const bom = B("Qual o fato gerador do ISS?", RICO, { more: "Literalidade — Art. 1º" });
    const av = api.ceAvaliar(bom);
    ok(av.nivel === "bom" && av.falhas.length === 0 && av.cumpridos === av.total && av.total >= 3, `E1j cartao completo: ${JSON.stringify(av)}`);
    /* essencial em falta = fraco; so' desejavel em falta = medio (nao entra na fila) */
    const medio = B("Prazo do recurso?", RICO.replace(/art\. 1º|LC 116\/2003/g, "").replace(/conforme o[ ,]*/, ""), { more: "Explicação do prazo" });
    ok(api.ceAvaliar(medio).nivel === "medio" && !api.ceAbaixo(medio) && api.ceAvaliar(medio).falhas.join() === "sem_artigo", `E1k so' falta a base legal = Quase la': ${JSON.stringify(api.ceAvaliar(medio))}`);
    ok(api.ceAvaliar(B("P?", "curta", { more: "m" })).nivel === "fraco" && api.ceAvaliar(B("P?", RICO)).nivel === "fraco", "E1l resposta curta OU sem saiba mais = fraco");
    /* base legal: o que antes ficava eternamente 'sem artigo' */
    ["Súmula 160/STJ", "EC nº 03/1993", "Lei nº 5.172/66", "LC 116/2003", "Emenda Constitucional 132", "Decreto-Lei nº 406", "CF/88", "CTN", "Constituição Federal"].forEach((x) => {
      ok(api.ceDefeitos(B("P?", "x".repeat(120) + " " + x, { more: "m" })).indexOf("sem_artigo") < 0, "E1m " + x + " conta como base legal");
    });
    ok(api.ceDefeitos(B("P?", "x".repeat(120) + " sem nada citado", { more: "m" })).indexOf("sem_artigo") >= 0, "E1n sem citacao continua apontado");
    /* Sim/Nao nao precisa de dica; escolha precisa */
    const yn = { kind: "cloze", front: "É devido o imposto? {{c1::Sim}} (art. 5º)", back: "", more: "+" };
    ok(api.ceDefeitos(yn).indexOf("cloze_sem_dica") < 0 && api.ceChecar("cloze_sem_dica", yn).aplica === false, "E1o lacuna Sim/Nao nao pede dica");
    ok(api.ceDefeitos(Object.assign({}, yn, { front: "O prazo é {{c1::30 dias}} (art. 5º)" })).indexOf("cloze_sem_dica") >= 0, "E1p lacuna de escolha sem dica e' apontada");
    ok(api.ceDefeitos(Object.assign({}, yn, { front: "Serve: {{c1::Sim}} e o prazo {{c2::30 dias::30 ou 60?}} (art. 5º)" })).indexOf("cloze_sem_dica") < 0, "E1q uma dica util basta");
    /* as nomeacoes do app leem o mesmo objeto */
    ok(api.CE_REQ.every((r) => typeof r.essencial === "boolean") && api.ceNivel(bom) === "bom", "E1r requisitos declaram se sao essenciais");
  }

  /* ---- montar uma biblioteca ---- */
  const montar = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const c1 = a.matChave("Trib", "ISS"), c2 = a.matChave("Trib", "IPTU");
    a.matGravarCartoes(c1, [
      "@ Trilha ISS", "Qual o fato gerador do ISS? :: Serviço :: x", "+ Nota antiga",
      "", "O ISS é de {{c1::municipal}} (Fonte: CTM).",
      "", "Qual a alíquota máxima do ISS? :: " + RICO + " :: x", "+ Literalidade — Art. 8º-A"].join("\n"),
      { disciplina: "Trib", topico: "ISS" });
    a.matGravarCartoes(c2, ["Quem paga o IPTU? :: O proprietário :: y"].join("\n"), { disciplina: "Trib", topico: "IPTU" });
    a.matResumosAtual()[c1].texto = "O ISS incide sobre serviços da lista anexa (art. 1º da LC 116).";
    return { a, c1, c2, janela: r.janela };
  };

  /* ---- E2: a lista dos piores ---- */
  {
    const { a } = montar();
    const ab = a.ceLerAbaixo();
    ok(ab.length === 3, `E2 devia haver 3 abaixo do padrao (o completo fica de fora): ${ab.length}`);
    ok(ab[0].nota <= ab[1].nota && ab[1].nota <= ab[2].nota, `E2a os piores primeiro: ${ab.map((x) => x.nota)}`);
    ok(ab.every((x) => x.chave && x.card && x.card.raw && Array.isArray(x.defeitos)), "E2b cada item traz o lugar de onde veio");
    ok(a.ceTagsUnicas([{ card: { ownTags: ["a", "b"] } }, { card: { ownTags: ["A", "c"] } }, { card: { ownTags: ["c", "c"] } }]).join(",") === "b", "E2c etiquetas de uso unico (sem diferenciar maiuscula)");
    ok(ab.every((x) => x.nivel === "fraco" && x.revisado === false), "E2d a fila e' so' de nivel Fraco e ainda nao trabalhado");
  }

  /* ---- E2e: o registro de trabalhados — o que quebrava o ciclo (cartao 'eterno') ---- */
  {
    const { a } = montar();
    const ab = a.ceLerAbaixo();
    const um = ab[0].card;
    a.ceMarcarTentativa([um]);
    ok(a.ceLerAbaixo().length === 3, "E2e uma tentativa sem melhorar ainda deixa o cartao na fila");
    a.ceMarcarTentativa([um]);
    ok(a.ceLerAbaixo().length === 2 && a.ceRevisado(um), "E2f duas tentativas sem melhorar: sai da fila (dificil, nao insistir)");
    a.ceMarcarRevisados([ab[1].card]);
    ok(a.ceLerAbaixo().length === 1, "E2g aceito numa rodada: sai da fila");
    ok(a.ceLerAbaixo({ incluirRevisados: true }).length === 3, "E2h da' para ver tambem os ja trabalhados");
    const c3 = a.matChave("Trib", "Prazo");
    a.matGravarCartoes(c3, "Qual o prazo do recurso? :: O prazo é contado da ciência da decisão pelo interessado e corre em dias corridos, sem suspensão nas férias forenses ou nos feriados locais\n+ Nota — prazo", { disciplina: "Trib", topico: "Prazo" });
    ok(a.ceLerAbaixo({ incluirRevisados: true }).length === 3 && a.ceLerAbaixo({ incluirRevisados: true, incluirMedios: true }).length === 4, "E2i cartao Quase la' so' entra na fila se pedido");
    a.ceRevLimpar();
    ok(a.ceLerAbaixo().length === 3, "E2j limpar o registro traz todos de volta");
    /* a chave e' o TEXTO do cartao: editar o cartao o torna 'novo' */
    a.ceMarcarRevisados([um]);
    ok(a.ceRevisado(um) && !a.ceRevisado(Object.assign({}, um, { back: um.back + " editado" })), "E2k o registro e' por conteudo: cartao mudado volta a ser candidato");
    /* nao cresce sem limite */
    const m = {}; for (let i = 0; i < 6100; i++) m["k" + i] = { ok: 1 };
    a.ceRevGravar(m); a.ceMarcarRevisados([um]);
    ok(Object.keys(a.ceRevLer()).length <= 6000, "E2l o registro tem teto");
  }

  /* ---- E3/E4: fontes e prompt ---- */
  {
    const { a, c1, c2 } = montar();
    const ab = a.ceLerAbaixo();
    const f = a.ceFontes(ab);
    ok((f.match(/### Trib · ISS/g) || []).length === 1 && /art\. 1º da LC 116/.test(f) && !/IPTU/.test(f), `E3 a fonte e' o resumo de cada topico, uma vez so', e so' de quem tem resumo: ${f}`);
    a.matResumosAtual()[c1].texto = "x".repeat(5000);
    ok(a.ceFontes(ab).length < 3200, "E3a o resumo de cada topico e' cortado");
    a.matResumosAtual()[c2].texto = "y".repeat(5000);
    const dois = a.ceFontes(a.ceLerAbaixo());
    ok(dois.length <= a.CE_LIM.fonteTotal + 200, `E3b a fonte total tem teto: ${dois.length}`);
    for (const nome of ["T3", "T4", "T5"]) {
      const cx = a.matChave("Trib", nome);
      a.matGravarCartoes(cx, "Pergunta " + nome + " :: curta", { disciplina: "Trib", topico: nome });
      a.matResumosAtual()[cx].texto = "z".repeat(5000);
    }
    const quatro = a.ceFontes(a.ceLerAbaixo());
    ok(quatro.length <= a.CE_LIM.fonteTotal + 300 && (quatro.match(/^### /gm) || []).length >= 3 && quatro.split(/^### /m).slice(1).every((x) => x.split("\n").slice(1).join("").trim().length > 0), `E3b2 quatro topicos com resumo grande: o teto total da fonte, sem secao vazia: ${quatro.length}`);
    for (const nome of ["T3", "T4", "T5"]) delete a.matResumosAtual()[a.matChave("Trib", nome)];
    a.matResumosAtual()[c1].texto = ""; a.matResumosAtual()[c2].texto = "";
    const p0 = a.ceMontarPrompt(a.ceLerAbaixo());
    ok(/sem resumo salvo/.test(p0.texto), "E3c sem resumo o prompt manda nao inventar artigo");

    a.matResumosAtual()[c1].texto = "Resumo do ISS.";
    const itens = a.ceLerAbaixo();
    const p = a.ceMontarPrompt(itens);
    ok(p.blocos.length === 3 && p.blocos.map((b) => b.id).join() === "1,2,3", "E4 tres blocos numerados");
    ok(new RegExp("@@ 1\\n").test(p.texto) && /@@ 3\n/.test(p.texto), "E4a as ancoras @@ N estao no prompt");
    ok(/@ Trilha ISS\nQual o fato gerador do ISS\? :: Serviço/.test(p.texto) && /\+ Nota antiga/.test(p.texto), "E4b o cartao vai inteiro (com @ e +)");
    ok(/NÃO PERCA CONTEÚDO/.test(p.texto) && /TAMANHO E PROFUNDIDADE/.test(p.texto) && !/\{padrao_|\{fontes\}|\{trechos\}|\{n\}/.test(p.texto), "E4c o bloco de preservar e o de tamanho estao resolvidos");
    ok(/ELEVAR 3 cartões/.test(p.texto) && /Resumo do ISS\./.test(p.texto), "E4d conta e fonte no prompt");
    ok(/NÃO invente/.test(p.texto), "E4e o prompt manda NAO inventar o artigo");
  }

  /* ---- E5: substituir o cartao no texto ---- */
  {
    const bruto = "@ T\nP1 :: R1\n+ um\n+ dois\n\nP2 :: R2\n+ tres";
    const c1 = { raw: "P1 :: R1", line: 2 };
    ok(api.ceSubstituir(bruto, c1, "@ Novo\nP1 :: R1 maior\n+ a\n+ b\n+ c") === "@ Novo\nP1 :: R1 maior\n+ a\n+ b\n+ c\n\nP2 :: R2\n+ tres", "E5 trocou so o bloco do cartao (com @ e +), sem tocar no vizinho");
    ok(api.ceSubstituir(bruto, { raw: "P2 :: R2", line: 1 }, "P2 :: novo").endsWith("P2 :: novo") && api.ceSubstituir(bruto, { raw: "P2 :: R2", line: 1 }, "P2 :: novo").indexOf("+ tres") < 0, "E5a com a linha desatualizada achou pelo texto e levou o + junto");
    ok(api.ceSubstituir(bruto, { raw: "nao existe :: x", line: 3 }, "x") === null, "E5b cartao que nao existe devolve null");
    ok(api.ceSubstituir(bruto, c1, "X :: Y\n\n") === "X :: Y\n\nP2 :: R2\n+ tres".replace("X :: Y\n\n", "X :: Y\n\n"), "E5c espaco no fim do texto novo nao vira linha a mais");
  }

  /* ---- E6: conferir a resposta da IA ---- */
  const BOM1 = "@@ 1\n@ Trilha ISS\nQual o fato gerador do ISS? :: A prestação de serviços constantes da lista anexa à LC 116, conforme o art. 1º, pelo imposto municipal sobre serviços de qualquer natureza :: x\n+ Literalidade — O imposto tem como fato gerador a prestação de serviços constantes da lista anexa (art. 1º)\n+ Nota antiga";
  {
    const { a } = montar();
    const itens = a.ceLerAbaixo().filter((x) => /fato gerador/.test(x.card.front));
    const p = a.ceMontarPrompt(itens);
    const r = a.ceConferir(BOM1, itens, p.blocos);
    ok(r.erros.length === 0 && r.itens.length === 1 && r.itens[0].notaDepois > r.itens[0].nota.nota, `E6 resposta boa: ${JSON.stringify({ e: r.erros, n: r.itens.length })}`);
    ok(r.itens[0].avisos.length === 0, `E6a resposta boa nao devia ter aviso: ${JSON.stringify(r.itens[0].avisos)}`);
    ok(a.ceConferir("sem ancora nenhuma\nX :: Y", itens, p.blocos).erros.length === 1, "E6b resposta sem ancora e' erro");
    /* encolheu */
    const curto = a.ceConferir("@@ 1\nQual o fato gerador do ISS? :: Serviço", itens, p.blocos);
    ok(curto.itens.length === 1 && curto.itens[0].avisos.some((x) => x.id === "encolheu"), `E6c devia avisar que encolheu: ${JSON.stringify(curto.itens[0] && curto.itens[0].avisos)}`);
    /* perdeu conteudo: outro assunto inteiro, tamanho grande */
    const troca = a.ceConferir("@@ 1\nQual o prazo de prescricao do credito tributario e quando ele comeca a correr contra a fazenda publica? :: Cinco anos contados da constituicao definitiva do credito, conforme o art. 174 do CTN, salvo interrupcao :: z\n+ Literalidade — Art. 174 do CTN dispoe sobre a prescricao da acao para a cobranca do credito", itens, p.blocos);
    ok(troca.itens.length === 1 && troca.itens[0].avisos.some((x) => x.id === "perdeu"), `E6d devia avisar que perdeu conteudo: ${JSON.stringify(troca.itens[0] && troca.itens[0].avisos)}`);
    ok(troca.avisos.every((x) => !/perdeu/i.test(x)), "E6e o aviso de perda nao devia aparecer duas vezes");
    /* tirar o "(Fonte: ...)" pedido nao e' perder conteudo */
    const fonte = [{ chave: "k", card: { raw: "x", front: "O ISS é de {{c1::municipal}} (Fonte: CTM).", back: "", more: "", kind: "cloze", tags: [], ownTags: [] } }];
    const pf = a.ceMontarPrompt(fonte);
    const rf = a.ceConferir("@@ 1\nO ISS é de competência {{c1::municipal::municipal ou estadual?}}, conforme o art. 156, III da CF\n+ Literalidade — Compete aos Municípios instituir impostos sobre serviços", fonte, pf.blocos);
    ok(rf.itens.length === 1 && !rf.itens[0].avisos.some((x) => x.id === "perdeu") && rf.avisos.length === 0, `E6j remover (Fonte: ...) contou como perda: ${JSON.stringify(rf.itens[0] && rf.itens[0].avisos)} ${JSON.stringify(rf.avisos)}`);
    /* continua fraco */
    const fraco = a.ceConferir("@@ 1\nQual o fato gerador do ISS? :: Serviço prestado :: x", itens, p.blocos);
    ok(fraco.itens.length === 1 && fraco.itens[0].avisos.some((x) => x.id === "continua"), "E6f devia avisar que continua abaixo do padrao");
    /* ancora desconhecida e ancora que faltou */
    const desc = a.ceConferir(BOM1 + "\n\n@@ 9\nX :: Y", itens, p.blocos);
    ok(desc.avisos.length === 1 && desc.itens.length === 1, `E6g ancora desconhecida vira aviso, sem quebrar: ${JSON.stringify(desc.avisos)}`);
    const dois = a.ceLerAbaixo(); const p2 = a.ceMontarPrompt(dois);
    const falta = a.ceConferir(BOM1, dois, p2.blocos);
    ok(falta.avisos.length === 2, `E6h duas ancoras sem resposta viram dois avisos: ${JSON.stringify(falta.avisos)}`);
    /* encolheu sem perder palavras (original com linha repetida) nao e' problema; encolheu perdendo e' */
    const rep = [{ chave: "k", card: { raw: "x", front: "Qual o prazo do recurso administrativo?", back: "Trinta dias contados da ciencia da decisao pelo interessado, conforme a lei do processo administrativo", more: "+ Nota — trinta dias\n+ Nota — trinta dias\n+ Nota — trinta dias\n+ Nota — trinta dias", kind: "basic", tags: [], ownTags: [] } }];
    const pr = a.ceMontarPrompt(rep);
    const rr = a.ceConferir("@@ 1\nQual o prazo do recurso administrativo? :: Trinta dias contados da ciencia da decisao pelo interessado, conforme a lei do processo administrativo\n+ Nota — trinta dias", rep, pr.blocos);
    ok(rr.itens.length === 1 && !rr.itens[0].avisos.some((x) => x.id === "encolheu") && rr.itens[0].depois.length < rr.itens[0].antes.length * 0.9, "E6k encolher so' por tirar linha repetida (sem perder palavra) nao e' aviso");
    const rr2 = a.ceConferir("@@ 1\nQual o prazo do recurso administrativo? :: Trinta dias", rep, pr.blocos);
    ok(rr2.itens[0].avisos.some((x) => x.id === "encolheu"), "E6l encolher PERDENDO palavras continua sendo aviso");
    /* normalizacao da resposta da IA */
    const N = a.ceNormalizarResposta;
    ok(N("@@ 1\nP :: R\n\n* Esquema — X\n* Esquema — X\n+ Nota") === "@@ 1\nP :: R\n+ Esquema — X\n+ Nota", "E6m '*' vira '+', cola no cartao e linha repetida sai");
    ok(N("@@ 1\nP :: R\n+ A\n@@ 2\nQ :: S\n+ A") === "@@ 1\nP :: R\n+ A\n@@ 2\nQ :: S\n+ A", "E6n a mesma linha em cartoes DIFERENTES nao e' repeticao");
    ok(N("@@ 1\n@ Trilha\nP :: R\n\n\n+ A") === "@@ 1\n@ Trilha\nP :: R\n+ A" && N("") === "" && N(null) === "", "E6o linha em branco entre cartao e + sai; vazio nao quebra");
    /* cartoes a menos */
    const perdeu = a.ceConferir("@@ 1\n", itens, p.blocos);
    ok(perdeu.erros.length >= 1 && perdeu.itens.length === 0, "E6i bloco vazio e' erro");
  }

  /* ---- E7: aplicar e desfazer ---- */
  {
    const { a, c1, c2 } = montar();
    const antes1 = a.matResumosAtual()[c1].cartoes, antes2 = a.matResumosAtual()[c2].cartoes;
    const itens = a.ceLerAbaixo();
    const p = a.ceMontarPrompt(itens);
    /* responde bem so' ao cartao do ISS (fato gerador) e ao do IPTU */
    const idFato = itens.findIndex((x) => /fato gerador/.test(x.card.front)) + 1, idIptu = itens.findIndex((x) => /IPTU/.test(x.card.front)) + 1;
    const resp = BOM1.replace("@@ 1", "@@ " + idFato) + "\n\n@@ " + idIptu + "\nQuem paga o IPTU? :: O proprietário do imóvel, o titular do domínio útil ou o possuidor a qualquer título, conforme o art. 34 do CTN :: y\n+ Literalidade — Art. 34 do CTN: contribuinte do imposto é o proprietário do imóvel, o titular do seu domínio útil, ou o seu possuidor a qualquer título";
    const conf = a.ceConferir(resp, itens, p.blocos);
    const r = a.ceAplicarLote(conf.itens);
    ok(r.trocados === 2 && r.naoAchou === 0, `E7 devia trocar 2: ${JSON.stringify(r)}`);
    const t1 = a.matResumosAtual()[c1].cartoes, t2 = a.matResumosAtual()[c2].cartoes;
    ok(/@ Trilha ISS\nQual o fato gerador do ISS\? :: A prestação/.test(t1) && /Literalidade — O imposto tem como fato gerador/.test(t1) && !/Serviço :: x/.test(t1), `E7a o cartao do ISS nao foi trocado inteiro: ${JSON.stringify(t1)}`);
    ok(/O ISS é de \{\{c1::municipal\}\} \(Fonte: CTM\)\./.test(t1) && /Qual a alíquota máxima do ISS\? ::/.test(t1) && /\+ Literalidade — Art\. 8º-A/.test(t1), "E7b os cartoes vizinhos ficaram como estavam");
    ok(/domínio útil/.test(t2), "E7c o cartao do outro topico tambem foi trocado");
    const rec = a.ceRecibo();
    ok(rec && rec.itens.length === 2, `E7d o recibo devia guardar 2 topicos: ${JSON.stringify(rec && rec.itens.length)}`);
    /* mexeu depois num dos topicos: desfazer nao pode pisar */
    a.matGravarCartoes(c2, a.matResumosAtual()[c2].cartoes + "\nNovo :: cartao", { disciplina: "Trib", topico: "IPTU" });
    const d = a.ceDesfazerLote();
    ok(d.desfeitos === 1 && d.pulados === 1, `E7e desfazer: 1 volta, 1 pulado (mexeram depois): ${JSON.stringify(d)}`);
    ok(a.matResumosAtual()[c1].cartoes === antes1, "E7f o topico intocado voltou exatamente ao que era");
    ok(/Novo :: cartao/.test(a.matResumosAtual()[c2].cartoes) && a.matResumosAtual()[c2].cartoes !== antes2, "E7g o topico mexido depois nao foi pisado");
    ok(a.ceRecibo() !== null, "E7h com topico pulado o recibo fica (nao se perde a chance de tentar de novo)");
    /* rodada limpa: desfaz tudo e apaga o recibo */
    const m = montar();
    const it2 = m.a.ceLerAbaixo(); const p2 = m.a.ceMontarPrompt(it2);
    const c = m.a.ceConferir(BOM1.replace("@@ 1", "@@ " + (it2.findIndex((x) => /fato gerador/.test(x.card.front)) + 1)), it2, p2.blocos);
    const ant = m.a.matResumosAtual()[m.c1].cartoes;
    m.a.ceAplicarLote(c.itens);
    const d2 = m.a.ceDesfazerLote();
    ok(d2.desfeitos === 1 && d2.pulados === 0 && m.a.matResumosAtual()[m.c1].cartoes === ant && m.a.ceRecibo() === null, `E7i rodada limpa desfaz e apaga o recibo: ${JSON.stringify(d2)}`);
    ok(m.a.ceDesfazerLote().desfeitos === 0, "E7j desfazer sem recibo nao faz nada");
    /* duas trocas no MESMO topico: desfazer volta ao original, nao ao meio do caminho */
    const m3 = montar();
    const it4 = m3.a.ceLerAbaixo().filter((x) => x.chave === m3.c1); const p4 = m3.a.ceMontarPrompt(it4);
    const ia = it4.findIndex((x) => /fato gerador/.test(x.card.front)) + 1, ib = it4.findIndex((x) => /municipal/.test(x.card.front)) + 1;
    const resp4 = BOM1.replace("@@ 1", "@@ " + ia) + "\n\n@@ " + ib + "\nO ISS é de competência {{c1::municipal::municipal ou estadual?}}, conforme o art. 156, III da CF :: CF, art. 156, III\n+ Literalidade — Compete aos Municípios instituir impostos sobre serviços de qualquer natureza";
    const c4 = m3.a.ceConferir(resp4, it4, p4.blocos);
    const ant4 = m3.a.matResumosAtual()[m3.c1].cartoes;
    const r4 = m3.a.ceAplicarLote(c4.itens);
    ok(r4.trocados === 2 && m3.a.matResumosAtual()[m3.c1].cartoes !== ant4, `E7l duas trocas no mesmo topico: ${JSON.stringify(r4)}`);
    m3.a.ceDesfazerLote();
    ok(m3.a.matResumosAtual()[m3.c1].cartoes === ant4, "E7m desfazer duas trocas do mesmo topico volta ao ORIGINAL");
    /* cartao que sumiu do texto: nao troca e conta */
    const m2 = montar();
    const it3 = m2.a.ceLerAbaixo(); const p3 = m2.a.ceMontarPrompt(it3);
    const c3 = m2.a.ceConferir(BOM1.replace("@@ 1", "@@ " + (it3.findIndex((x) => /fato gerador/.test(x.card.front)) + 1)), it3, p3.blocos);
    m2.a.matGravarCartoes(m2.c1, "Outra coisa :: totalmente", { disciplina: "Trib", topico: "ISS" });
    const r3 = m2.a.ceAplicarLote(c3.itens);
    ok(r3.trocados === 0 && r3.naoAchou === 1 && m2.a.ceRecibo() === null, `E7k cartao que sumiu: nada trocado e sem recibo: ${JSON.stringify(r3)}`);
  }

  /* ---- E9: os OBJETIVOS (a revisao manual antiga, agora no mesmo fluxo) ---- */
  {
    const NL = String.fromCharCode(10);
    const mo = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
      const ch = a.matChave("Proc", "Recursos");
      a.matGravarCartoes(ch, [
        "Qual o prazo do recurso? :: 10 dias",
        "Explique o efeito do recurso? :: " + "palavra e mais palavra sem numero ".repeat(9),
        "Recurso :: Serviço",
        "Qual o prazo do agravo? :: 15 dias úteis, contados da intimação, conforme o art. 1003 §5º do CPC, e a contagem só corre em dias úteis :: y" + String.fromCharCode(10) + "+ Saiba mais — literalidade do CPC",
        "Qual é o fato gerador do imposto predial? :: A propriedade de imóvel urbano, com a resposta explicada por extenso e com clareza :: x"].join(NL + NL),
        { disciplina: "Proc", topico: "Recursos" });
      return { a, ch };
    };
    const { a, ch } = mo();
    const cards = a.cqLerBiblioteca().map((n) => n.card);
    const por = (re) => cards.find((c) => re.test(c.front));
    const c10 = por(/prazo/), cLongo = por(/Explique/), cForma = por(/^Recurso$/), cBom = por(/predial/);
    const alvo = (o, c) => a.ceServeAoObjetivo(o, c);
    ok(alvo("fatos", { front: "Qual?", back: "5%" }) && alvo("fatos", { front: "Qual a sumula?", back: "vinculante" }), "E9-a1 o risco reconhece percentual de um digito e a palavra sumula (sem numero)");
    ok(alvo("forma", { kind: "basic", front: "Q?", back: "sim" }) && !alvo("forma", { kind: "basic", front: "Qual a regra geral aplicavel?", back: "sim" }), "E9-a2 forma: o cartao curto demais (menos de 25 caracteres) entra");
    const semObj = a.cqHash(a.cqNormal(a.cqRevelado(c10) + " | " + String(c10.back || "")));
    ok(a.ceChaveCartao(c10, "completar") === semObj && a.ceChaveCartao(c10) === semObj, "E9-a3 a chave de 'completar' e' EXATAMENTE a de antes (o registro de trabalhados que ja existe continua valendo)");
    ok(alvo("fatos", c10) && !alvo("fatos", cLongo) && !alvo("fatos", cForma) && !alvo("fatos", cBom), "E9 'conferir fatos' pega so' o cartao com numero/data/artigo");
    ok(!alvo("dividir", { kind: "cloze", front: "Qual? {{c1::Nao}}, " + "palavra ".repeat(28), back: "" }) && alvo("dividir", { kind: "cloze", front: "Qual? {{c1::Nao}}, " + "palavra ".repeat(45), back: "" }), "E9a0 'dividir' usa o limite de lacuna (320): cloze de ~240 nao entra, de ~380 entra");
    ok(alvo("dividir", cLongo) && !alvo("dividir", c10) && !alvo("dividir", cBom), "E9a 'dividir' pega so' o cartao longo (mais de 220 caracteres)");
    ok(alvo("forma", cForma) && !alvo("forma", c10) && !alvo("forma", cBom), "E9b 'forma' pega o curto/sem pergunta");
    ok(alvo("completar", c10) && alvo("completar", cBom) && a.ceServeAoObjetivo("completar", null) === false, "E9c 'completar' serve a qualquer cartao (a fila dele e' pelo nivel)");
    ok(alvo("fatos", { front: "Sumula 331?", back: "x" }) && alvo("fatos", { front: "Quanto? ", back: "R$ 5", more: "" }) && alvo("fatos", { front: "Qual?", back: "em 2021" }) && alvo("fatos", { front: "Qual?", back: "50%" }) && alvo("fatos", { front: "Qual?", back: "§ 2º" }) && !alvo("fatos", { front: "Qual?", back: "sem dado nenhum aqui" }) && alvo("fatos", { front: "Q?", back: "x", more: "art. 5" }), "E9d o risco reconhece sumula, R$, ano, percentual, paragrafo e o saiba mais");
    ok(alvo("forma", { kind: "basic", front: "Pergunta comprida sem interrogacao final", back: "resposta boa e completa" }) && alvo("forma", { kind: "basic", front: "Pergunta comprida com interrogacao?", back: "" }) && !alvo("forma", { kind: "cloze", front: "A {{c1::regra}} vale para todos os casos previstos", back: "" }) && !alvo("forma", { kind: "basic", front: "Pergunta comprida com interrogacao?", back: "resposta boa" }), "E9e forma: sem pergunta, sem resposta (cloze nao conta); pergunta e resposta boas ficam de fora");
    ok(a.ceServeAoObjetivo("inexistente", c10) === true, "E9f objetivo desconhecido nao filtra (cai no de sempre)");
    ok(JSON.stringify(a.CE_OBJETIVOS) === JSON.stringify(["completar", "fatos", "dividir", "forma"]), "E9g os 4 objetivos");

    /* a tela */
    a.ceAbrir();
    const sel = a.$("ceObjetivo");
    ok(a.ceObjetivoAtual() === "completar" && sel.value === "completar" && sel.children.length === 4 && /Completar/.test(sel.children[0].textContent) && /Conferir fatos/.test(sel.children[1].textContent), "E9h abre em 'completar' com as 4 opcoes no seletor");
    ok(sel.getAttribute("aria-description") === a.t("ce_tip_obj"), "E9i o seletor tem a explicacao");
    const pedir = () => { a.$("btnCePrompt").onclick(); return a.$("cePrompt").value; };
    sel.value = "fatos"; sel.onchange();
    ok(a.ceObjetivoAtual() === "fatos" && a.ceNotasAtual().length === 2 && /prazo do recurso/.test(a.ceNotasAtual()[0].card.front) && /agravo/.test(a.ceNotasAtual()[1].card.front) && a.ceSelAtual().size === 2, "E9j trocar para 'fatos' refaz a fila (2 cartoes, o pior primeiro) e ja marca");
    ok(a.ceTrocarObjetivo("nao-existe") === false && a.ceObjetivoAtual() === "fatos", "E9n0 objetivo invalido e' recusado (antes de gerar o prompt)");
    a.ceAbrir({ notas: a.cqLerBiblioteca().filter((n) => /Recurso$/.test(n.card.front)) });
    ok(a.ceNotasAtual().length === 1 && /Rodada/.test(a.$("ceResumo").textContent), "E9j2 com cartoes escolhidos no gerenciador vale a lista deles e o resumo de sempre");
    ok(a.ceTrocarObjetivo("fatos") === true && a.ceNotasAtual().length === 2, "E9j3 trocar o objetivo larga a escolha do gerenciador e volta para a fila do objetivo");
    ok(/2 cartão\(ões\) na fila deste objetivo/.test(a.$("ceResumo").textContent), "E9k o resumo fala da fila do objetivo: " + a.$("ceResumo").textContent);
    const pf = pedir();
    ok(/CONFERIR OS FATOS/.test(pf) && /@@ 1/.test(pf) && /prazo do recurso/.test(pf) && !/ELEVAR/.test(pf) && !/\{[a-z_]+\}/.test(pf), "E9l o prompt de 'fatos' e' o de conferir (com a ancora, o cartao e nenhum {campo} sobrando): " + pf.slice(0, 80));
    ok(/nunca.*perca|NUNCA|Preserve|preserv/i.test(pf) || /NUNCA invente/.test(pf), "E9l2 o prompt de fatos proibe inventar");
    /* no meio da rodada nao troca */
    ok(a.cePassoAtual() === 2 && a.$("ceObjetivo").disabled === true && a.ceTrocarObjetivo("forma") === false && a.ceObjetivoAtual() === "fatos", "E9m no passo 2 o seletor trava e a troca e' recusada");
    sel.value = "forma"; sel.onchange();
    ok(a.ceObjetivoAtual() === "fatos" && sel.value === "fatos", "E9n o seletor volta para o objetivo atual quando a troca e' recusada");
    a.$("btnCeDescartar").onclick && a.$("btnCeDescartar").onclick();
    /* memoria separada */
    a.ceAbrir({ objetivo: "forma" });
    ok(a.ceObjetivoAtual() === "forma" && a.$("ceObjetivo").value === "forma" && a.ceNotasAtual().length === 1 && /^Recurso$/.test(a.ceNotasAtual()[0].card.front), "E9o abrir ja no objetivo 'forma'");
    ok(/ARRUMAR A FORMA/.test(pedir()), "E9p o prompt de 'forma'");
    a.ceAbrir({ objetivo: "dividir" });
    ok(a.ceNotasAtual().length === 1 && /Explique/.test(a.ceNotasAtual()[0].card.front), "E9q objetivo 'dividir': o cartao longo");
    ok(/DIVIDIR/.test(pedir()) && /NENHUMA informação/.test(a.$("cePrompt").value), "E9r o prompt de 'dividir' proibe perder informacao");
    a.ceAbrir({ objetivo: "invalido" });
    ok(a.ceObjetivoAtual() === "completar", "E9s objetivo invalido na abertura cai em 'completar'");
    ok(/ELEVAR/.test(pedir()), "E9t o de sempre continua o de sempre");
    /* a memoria de trabalhados e' por objetivo */
    a.ceAbrir({ objetivo: "dividir" });
    a.ceMarcarRevisados([cLongo]);
    a.ceTrocarObjetivo("dividir");
    ok(a.ceNotasAtual().length === 0 && /Nenhum cartão na fila deste objetivo/.test(a.$("ceMsg").textContent), "E9t2 objetivo sem cartao na fila: a mensagem diz");
    a.ceAbrir({ objetivo: "fatos" });
    a.ceMarcarRevisados([c10]);
    a.ceCalcular();
    ok(a.ceNotasAtual().length === 1 && /agravo/.test(a.ceNotasAtual()[0].card.front) && a.ceStatsAtual().escondidos === 1 && a.ceStatsAtual().fila === 1, "E9u cartao trabalhado em 'fatos' sai da fila de 'fatos'");
    a.cePintar();
    ok(/1 cartão\(ões\) na fila deste objetivo.*trabalhados neste objetivo: 1/.test(a.$("ceResumo").textContent), "E9u1 o resumo conta a fila e os ja trabalhados: " + a.$("ceResumo").textContent);
    ok(a.ceRevisado(c10, a.ceRevLer()) === true, "E9u2 e conta como trabalhado nesse objetivo");
    a.ceAbrir({ objetivo: "completar" });
    ok(a.ceRevisado(c10, a.ceRevLer()) === false, "E9v mas continua candidato em 'completar' (memoria separada)");
    ok(a.ceChaveCartao(c10, "fatos") !== a.ceChaveCartao(c10, "completar") && a.ceChaveCartao(c10, "completar") === a.ceChaveCartao(c10) && a.ceChaveCartao(c10, "fatos") !== a.ceChaveCartao(c10, "forma"), "E9w a chave de memoria leva o objetivo (e a de 'completar' e' a de antes)");
    /* cartoes escolhidos no gerenciador mandam sobre o objetivo */
    const forc = a.cqLerBiblioteca().filter((n) => /Recurso$/.test(n.card.front));
    a.ceAbrir({ notas: forc, objetivo: "fatos" });
    ok(/Rodada/.test(a.$("ceResumo").textContent), "E9x0 com cartoes escolhidos o resumo e' o de sempre, mesmo com objetivo");
    ok(a.ceNotasAtual().length === 1 && /^Recurso$/.test(a.ceNotasAtual()[0].card.front), "E9x os cartoes escolhidos no gerenciador valem sobre a fila do objetivo");
    /* a conferencia: 'continua fraco' so' faz sentido em 'completar' */
    const resp = "@@ 1" + NL + "Qual o prazo do recurso? :: 10 dias";
    a.ceAbrir({ objetivo: "completar" });
    const it = a.ceLerAbaixo().filter((n) => /prazo/.test(n.card.front));
    const bl = a.ceMontarPrompt(it).blocos;
    const cc = a.ceConferir(resp, it, bl);
    a.ceAbrir({ objetivo: "fatos" });
    const cf = a.ceConferir(resp, it, bl);
    ok(cc.itens.length === 1 && cc.itens[0].avisos.some((x) => x.id === "continua"), "E9y em 'completar' o cartao que volta fraco e' avisado");
    ok(cf.itens.length === 1 && !cf.itens[0].avisos.some((x) => x.id === "continua"), "E9z em 'fatos' NAO se cobra nivel (o pedido era conferir, nao completar)");
  }

    /* ---- E10: escopo (fila / bancada / todos), busca e prompt curto ---- */
  {
    const NL = String.fromCharCode(10);
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    a.$("editor").value = "Pergunta da bancada? :: sim";
    const ch = a.matChave("Proc", "Recursos");
    a.matGravarCartoes(ch, [
      "Qual o prazo do recurso? :: 10 dias",
      "Qual o prazo do agravo? :: 15 dias úteis, contados da intimação, conforme o art. 1003 §5º do CPC, e a contagem só corre em dias úteis :: y" + NL + "+ Saiba mais — literalidade do CPC",
      "Qual é o fato gerador do imposto predial? :: A propriedade de imóvel urbano, com a resposta explicada por extenso e com clareza :: x"].join(NL + NL),
      { disciplina: "Proc", topico: "Recursos" });
    const total = a.cqLerBiblioteca().length;
    a.ceAbrir();
    ok(a.ceEscopoAtual() === "fila" && a.$("ceEscopo").value === "fila" && a.$("ceEscopo").children.length === 3 && a.ceBuscaAtual() === "" && a.ceCurtoAtual() === false, "E10 abre com a fila do objetivo, sem busca e sem prompt curto");
    ok(a.$("ceEscopo").getAttribute("aria-description") === a.t("ce_tip_escopo") && a.$("ceBusca").getAttribute("aria-description") === a.t("ce_tip_busca") && a.$("ceCurto").getAttribute("aria-description") === a.t("ce_tip_curto"), "E10a os tres controles novos tem explicacao");
    const fila0 = a.ceNotasAtual().length;
    a.$("ceEscopo").value = "bancada"; a.$("ceEscopo").onchange();
    ok(a.ceEscopoAtual() === "bancada" && a.ceNotasAtual().length === 1 && a.ceNotasAtual().every((n) => a.cqEhBancada(n.chave)) && a.ceSelAtual().size === 1, "E10b 'so a bancada': so' os cartoes do texto da bancada, ja marcados: " + a.ceNotasAtual().length);
    ok(/1 cartão\(ões\) em “Só a bancada”/.test(a.$("ceResumo").textContent), "E10c o resumo diz o escopo: " + a.$("ceResumo").textContent);
    a.$("ceEscopo").value = "todos"; a.$("ceEscopo").onchange();
    const nt = a.ceNotasAtual();
    ok(nt.length === total && nt.some((n) => /predial/.test(n.card.front)) && nt.some((n) => a.cqEhBancada(n.chave)), "E10d 'todos': a biblioteca inteira, ate' o cartao bom (sem filtro de nivel): " + nt.length + "/" + total);
    ok(nt.every((n, i) => i === 0 || nt[i - 1].nota <= n.nota), "E10e 'todos' vem com os piores primeiro");
    ok(a.ceSelAtual().size === 0 && a.$("btnCePrompt").disabled === true, "E10f em 'todos' nada vem marcado: a escolha e' sua (marcar a mao)");
    /* busca */
    a.$("ceBusca").value = "AGRAVO"; a.$("ceBusca").oninput();
    ok(a.ceBuscaAtual() === "AGRAVO" && a.ceNotasAtual().length === 1 && /agravo/.test(a.ceNotasAtual()[0].card.front), "E10g a busca acha o cartao (sem diferenciar maiuscula)");
    a.$("ceBusca").value = "intimacao"; a.$("ceBusca").oninput();
    ok(a.ceNotasAtual().length === 1, "E10h a busca ignora acento e olha a resposta tambem");
    a.$("ceBusca").value = "recursos"; a.$("ceBusca").oninput();
    ok(a.ceNotasAtual().length === 3, "E10i a busca olha tambem o topico/disciplina: " + a.ceNotasAtual().length);
    a.$("ceBusca").value = "zzzz"; a.$("ceBusca").oninput();
    ok(a.ceNotasAtual().length === 0 && /Nenhum cartão/.test(a.$("ceMsg").textContent), "E10j sem resultado: a mensagem diz");
    a.$("ceBusca").value = "  agravo  "; a.$("ceBusca").oninput();
    ok(a.ceBuscaAtual() === "agravo", "E10k a busca tira os espacos das pontas");
    a.$("ceBusca").value = "INTIMAÇÃO"; a.$("ceBusca").oninput();
    ok(a.ceNotasAtual().length === 1, "E10k2 a busca com acento e maiuscula tambem acha (a consulta e' normalizada como o texto)");
    a.$("ceBusca").value = "x".repeat(100); a.$("ceBusca").oninput();
    ok(a.ceBuscaAtual().length === 80, "E10k3 a busca tem limite de 80 caracteres");
    a.$("ceBusca").value = ""; a.$("ceBusca").oninput();
    /* a busca vale tambem na fila do objetivo */
    a.$("ceEscopo").value = "fila"; a.$("ceEscopo").onchange();
    const nFila = a.ceNotasAtual().length;
    a.$("ceBusca").value = "bancada"; a.$("ceBusca").oninput();
    ok(nFila > 1 && a.ceNotasAtual().length === 1 && /1 cartão\(ões\) em “A fila do objetivo”/.test(a.$("ceResumo").textContent), "E10k4 na fila do objetivo a busca tambem filtra e o resumo aparece: " + nFila + " -> " + a.ceNotasAtual().length + " | " + a.$("ceResumo").textContent);
    a.$("ceBusca").value = ""; a.$("ceBusca").oninput();
    a.$("ceEscopo").value = "todos"; a.$("ceEscopo").onchange();
    /* marcar a mao um cartao que NAO estaria na fila */
    a.$("ceBusca").value = "predial"; a.$("ceBusca").oninput();
    const ck = achar(a.$("ceLista"), (e) => e.tag === "input");
    ok(ck.length === 1, "E10l achou o cartao bom pela busca");
    ck[0].checked = true; ck[0].onchange();
    ok(a.ceSelAtual().size === 1 && a.$("btnCePrompt").disabled === false, "E10m marcar a mao um cartao que nao e' da fila");
    a.$("ceCurto").checked = true; a.$("ceCurto").onchange();
    ok(a.ceCurtoAtual() === true && a.ceSelAtual().size === 1, "E10n ligar o prompt curto nao mexe na escolha");
    a.$("btnCePrompt").onclick();
    const pc = a.$("cePrompt").value;
    ok(/COMPLETAR ao padrão/.test(pc) && /@@ 1/.test(pc) && /predial/.test(pc) && !/FONTE:/.test(pc) && !/\{[a-z_]+\}/.test(pc), "E10o o prompt curto leva o objetivo, a ancora e o cartao marcado a mao, sem a fonte: " + pc.slice(0, 90));
    a.ceAbrir({ objetivo: "fatos", escopo: "todos" });
    a.$("ceCurto").checked = true; a.$("ceCurto").onchange();
    a.$("ceBusca").value = "prazo do recurso"; a.$("ceBusca").oninput();
    const ck2 = achar(a.$("ceLista"), (e) => e.tag === "input"); ck2[0].checked = true; ck2[0].onchange();
    a.$("btnCePrompt").onclick();
    ok(/CONFERIR OS FATOS/.test(a.$("cePrompt").value) && !/COMPLETAR ao padrão/.test(a.$("cePrompt").value), "E10o2 o prompt curto acompanha o objetivo escolhido: " + a.$("cePrompt").value.slice(0, 60));
    a.ceAbrir({ escopo: "todos" }); a.$("ceCurto").checked = true; a.$("ceCurto").onchange();
    a.$("ceBusca").value = "predial"; a.$("ceBusca").oninput();
    const ck3 = achar(a.$("ceLista"), (e) => e.tag === "input"); ck3[0].checked = true; ck3[0].onchange();
    a.$("btnCePrompt").onclick();
    ok(pc.length < 900 && /NENHUMA|nenhuma informação/.test(pc), "E10p e e' curto, mas ainda proibe perder informacao: " + pc.length);
    ok(a.ceMudarFiltro("escopo", "fila") === false && a.ceMudarFiltro("busca", "x") === false && a.ceMudarFiltro("curto", false) === false && a.$("ceEscopo").disabled === true && a.$("ceBusca").disabled === true && a.$("ceCurto").disabled === true, "E10q no meio da rodada os tres travam");
    a.$("ceEscopo").value = "fila"; a.$("ceEscopo").onchange();
    ok(a.$("ceEscopo").value === "todos" && a.ceEscopoAtual() === "todos", "E10r o seletor volta ao valor atual se a troca e' recusada");
    a.$("ceBusca").value = "outra"; a.$("ceBusca").oninput();
    ok(a.$("ceBusca").value === "predial", "E10s a busca volta ao valor atual se a troca e' recusada");
    a.$("ceCurto").checked = false; a.$("ceCurto").onchange();
    ok(a.$("ceCurto").checked === true, "E10t o prompt curto volta ao valor atual se a troca e' recusada");
    /* reabrir zera */
    a.ceAbrir();
    ok(a.ceEscopoAtual() === "fila" && a.ceBuscaAtual() === "" && a.ceCurtoAtual() === false && a.$("ceBusca").value === "" && a.$("ceCurto").checked === false && a.$("ceEscopo").value === "fila", "E10u ao reabrir volta ao padrao (fila, sem busca, prompt completo)");
    ok(/ELEVAR/.test((() => { a.$("btnCePrompt").onclick(); return a.$("cePrompt").value; })()) && /FONTE:/.test(a.$("cePrompt").value), "E10v o prompt completo continua o de sempre");
    a.ceAbrir({ escopo: "todos" });
    ok(a.ceEscopoAtual() === "todos" && a.ceNotasAtual().length === total, "E10w abrir ja em 'todos'");
    a.ceAbrir({ escopo: "invalido" });
    ok(a.ceEscopoAtual() === "fila", "E10x escopo invalido cai em 'fila'");
    ok(a.ceMudarFiltro("escopo", "nada") === false && a.ceMudarFiltro("campo-x", "1") === false, "E10y escopo e campo invalidos sao recusados");
    a.ceAbrir({ notas: a.cqLerBiblioteca().filter((n) => /agravo/.test(n.card.front)), escopo: "bancada" });
    ok(a.ceNotasAtual().length === 1 && /agravo/.test(a.ceNotasAtual()[0].card.front), "E10z cartoes escolhidos no gerenciador mandam sobre o escopo");
    a.ceAbrir({ notas: a.cqLerBiblioteca().filter((n) => /agravo|recurso/.test(n.card.front)), escopo: "todos" });
    ok(/Rodada/.test(a.$("ceResumo").textContent), "E10z0 com cartoes escolhidos o resumo e' o de sempre, mesmo em 'todos'");
    a.$("ceBusca").value = "zzzz"; a.$("ceBusca").oninput();
    ok(a.ceNotasAtual().length === 2, "E10z1 a busca nao esconde os cartoes que voce escolheu no gerenciador");
    /* completar + bancada */
    a.ceAbrir({ escopo: "bancada", objetivo: "fatos" });
    ok(a.ceNotasAtual().length === 0, "E10z2 objetivo 'fatos' + bancada: a bancada nao tem cartao de risco");
    a.$("ceBusca").value = "bancada"; a.$("ceBusca").oninput();
    ok(a.ceNotasAtual().length === 0, "E10z3 a busca so' filtra o que ja esta no escopo");
    ok(fila0 >= 1, "E10z4 (fila inicial nao vazia)");
  }

    /* ---- E11: a revisao manual antiga saiu; o "Melhorar cartoes" e' a ferramenta so' (U3, fase C) ---- */
  {
    const NL = String.fromCharCode(10);
    const fs2 = require("fs"), path2 = require("path");
    const html = fs2.readFileSync(path2.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i18n = fs2.readFileSync(path2.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok(html.indexOf('id="btnRevisar"') < 0 && html.indexOf('id="barraRevisao"') < 0 && html.indexOf('id="dlgRevCopiar"') < 0 && html.indexOf('id="dlgColarRev"') < 0, "E11 o botao, a barra e os dialogos da revisao antiga nao existem mais");
    ok(!/"rev_migrou/.test(i18n), "E11a as mensagens do aviso de migracao do botao antigo tambem saíram");
    const r = rodar(); const x = r.api;
    x.matIniciar(); x.edIniciar();
    x.$("editor").value = "Pergunta da bancada? :: sim";
    x.$("btnBancaElevar").onclick();
    ok(x.$("dlgCartElevar").open === true && x.ceEscopoAtual() === "bancada" && x.ceObjetivoAtual() === "completar", "E11b o botao da bancada abre o Melhorar cartoes ja no escopo da bancada (onde a revisao antiga agia)");
    ok(x.$("ceObjetivo").children.length === 4 && x.$("ceEscopo").children.length === 3 && !!x.$("btnCeAtCurtos") && !!x.$("ceCurto"), "E11c e ele tem TUDO: 4 objetivos, 3 escopos, atalhos de marcacao e prompt curto");
    ok(/Melhorar cartões/.test(x.$("dlgCartElevar").textContent) || /Melhorar cartões/.test(x.t("ce_titulo")), "E11d o titulo e' 'Melhorar cartoes'");
    ok(x.t("ce_btn") === "Melhorar cartões" && x.t("ce_titulo") === "Melhorar cartões" && x.t("ger_elevar", { n: 3 }) === "✨ Melhorar cartões (3)", "E11e o nome novo vale no botao da bancada, no do material, no titulo e no gerenciador");
    ok(!/Elevar/.test(x.t("ce_btn_aj")) && !/Elevar/.test(x.t("ger_tip_melhorar")) && !/elevar/i.test(x.t("ger_ajuda")), "E11f os textos de ajuda nao falam mais em 'Elevar'");
    x.$("dlgCartElevar").close();
    x.$("btnCartElevar") && x.$("btnCartElevar").onclick();
    ok(x.$("dlgCartElevar").open === true && x.ceEscopoAtual() === "fila", "E11g o botao do Material abre na fila (a biblioteca inteira), sem escopo da bancada");
    x.$("dlgCartElevar").close();
  }

  /* ---- E12: o que veio da revisao manual — atalhos, previa, ver no texto, prompt editavel, autocorrecao e sem ancora ---- */
  {
    const NL = String.fromCharCode(10);
    const mk = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      a.$("editor").value = "Pergunta da bancada? :: sim";
      const ch = a.matChave("Proc", "Recursos");
      a.matGravarCartoes(ch, [
        "Qual o prazo do recurso? :: 10 dias",
        "Explique o efeito do recurso? :: " + "palavra e mais palavra sem numero ".repeat(9),
        "Recurso :: Serviço",
        "Qual a regra X? :: Resposta A",
        "Qual a regra X? :: Resposta B",
        "Qual é o fato gerador do imposto predial? :: " + RICO + " :: x" + NL + "+ Literalidade — Art. 8º-A"].join(NL + NL),
        { disciplina: "Proc", topico: "Recursos" });
      return { a, ch, r };
    };
    const { a, ch } = mk();
    const frente = (i) => a.ceNotasAtual()[i].card.front;
    const marcados = () => [...a.ceSelAtual()].map((i) => a.ceNotasAtual()[i].card.front).sort();
    /* predicados */
    const C = a.CE_CRIT;
    ok(C.semResp({ kind: "basic", front: "Q?", back: "" }) && !C.semResp({ kind: "basic", front: "Q?", back: "r" }) && !C.semResp({ kind: "cloze", front: "A {{c1::b}}", back: "" }) && !C.semResp({ kind: "mc", front: "Q?", back: "" }), "E12 'sem resposta': so' basico sem verso (cloze e MC nao contam)");
    ok(C.semPerg({ kind: "basic", front: "Sem interrogacao", back: "r" }) && !C.semPerg({ kind: "basic", front: "Com?", back: "r" }) && !C.semPerg({ kind: "cloze", front: "Sem interrogacao", back: "" }), "E12a 'sem pergunta': so' basico cuja frente nao termina em ?");
    ok(C.curtos({ front: "A", back: "B" }) && !C.curtos({ front: "Uma pergunta media aqui?", back: "e uma resposta" }) && C.curtos({ front: "{{c1::x}} y", back: "" }), "E12b 'curtos': menos de 25 caracteres (o marcador de lacuna nao conta)");
    ok(C.todos({}) === true && Object.keys(a.CE_ATALHOS).length === 7 && a.CE_ATALHOS.btnCeAtRepetidos === "repetidos", "E12c os 7 atalhos existem");
    a.ceAbrir();
    /* atalho: curtos */
    ok(a.$("btnCeAtCurtos").getAttribute("aria-description") === a.t("ce_tip_at_curtos") && a.$("btnCeAtRepetidos").getAttribute("aria-description") === a.t("ce_tip_at_repetidos") && Object.keys(a.CE_ATALHOS).every((id) => a.$(id).getAttribute("aria-description")), "E12d todo atalho tem explicacao");
    ok(a.ceNotasAtual().length < 7, "E12e0 antes do atalho a lista e' a FILA do objetivo (so' os fracos)");
    a.$("btnCeAtCurtos").onclick();
    ok(a.ceEscopoAtual() === "todos" && a.$("ceEscopo").value === "todos" && a.ceNotasAtual().length === 7, "E12e marcar por criterio passa a lista para 'Todos' (sem o filtro do objetivo): " + a.ceNotasAtual().length);
    ok(achar(a.$("ceLista"), (e) => e.tag === "input").filter((x) => x.checked).length === a.ceSelAtual().size, "E12e2 a lista na tela mostra as caixas marcadas (foi repintada)");
    ok(marcados().join("|") === "Pergunta da bancada?|Recurso" && /2 marcado\(s\) — 2 cartão\(ões\) “Curtos”/.test(a.$("ceMsg").textContent), "E12f curtos marca so os cartoes curtos (o da bancada e Recurso): " + marcados() + " | " + a.$("ceMsg").textContent);
    a.$("btnCeAtCurtos").onclick();
    ok(a.ceSelAtual().size === 2 && /0 marcado\(s\) — 2 cartão\(ões\)/.test(a.$("ceMsg").textContent), "E12e3 marcar de novo o mesmo criterio nao conta em dobro: " + a.$("ceMsg").textContent);
    ok(a.ceMarcarPor("nao-existe") === null && C.risco({ front: "Q?", back: "x", more: "art. 5" }) && !C.risco({ front: "Q?", back: "sem dado", more: "" }), "E12e4 criterio invalido nao quebra; 'de risco' olha tambem o saiba mais");
    a.$("btnCeAtRisco").onclick();
    ok(marcados().includes("Qual o prazo do recurso?") && marcados().includes("Recurso"), "E12g os atalhos SOMAM a selecao (nao a limpam)");
    a.$("btnCeLimpar").onclick();
    a.$("btnCeAtLongos").onclick();
    ok(marcados().length === 2 && marcados().some((x) => /Explique/.test(x)) && marcados().some((x) => /fato gerador/.test(x)), "E12h longos marca os dois cartoes longos (o basico e o rico): " + marcados());
    a.$("btnCeLimpar").onclick();
    a.$("btnCeAtSemPerg").onclick();
    ok(marcados().join("|") === "Recurso", "E12i 'sem pergunta' marca so' o que nao termina em ?");
    a.$("btnCeLimpar").onclick();
    a.$("btnCeAtRepetidos").onclick();
    ok(marcados().join("|") === "Qual a regra X?|Qual a regra X?", "E12j 'repetidos' marca AS DUAS pontas do grupo: " + marcados());
    a.$("btnCeLimpar").onclick();
    a.$("btnCeAtTodos").onclick();
    ok(a.ceSelAtual().size === a.ceNotasAtual().length && a.ceNotasAtual().length === 7, "E12k 'todos' marca todos os cartoes (7 com o da bancada)");
    a.$("btnCeLimpar").onclick();
    a.$("btnCeAtSemResp").onclick();
    ok(a.ceSelAtual().size === 0 && /Nenhum cartão “Sem resposta”/.test(a.$("ceMsg").textContent), "E12l criterio sem nenhum cartao: diz que nao ha");
    /* limite da rodada */
    {
      const { a: b } = mk();
      b.matGravarCartoes(b.matChave("Proc", "Curtos"), Array.from({ length: 20 }, (x, k) => "A" + k + " :: B").join(NL + NL), { disciplina: "Proc", topico: "Curtos" });
      b.ceAbrir();
      const r = b.ceMarcarPor("curtos");
      ok(b.ceSelAtual().size === 15 && r.achou >= 21 && r.corte >= 6 && /Só cabem 15 por rodada/.test(b.$("ceMsg").textContent), "E12m mais de 15 no criterio: marca 15 e avisa que o resto fica para a proxima: " + b.$("ceMsg").textContent);
    }
    /* cartoes escolhidos no gerenciador: o atalho larga a escolha */
    {
      const { a: g } = mk();
      g.ceAbrir({ notas: g.cqLerBiblioteca().filter((n) => /prazo/.test(n.card.front)) });
      ok(g.ceNotasAtual().length === 1, "E12m3 (preparo) so' o cartao escolhido");
      g.ceMarcarPor("todos");
      ok(g.ceNotasAtual().length === 7 && g.ceEscopoAtual() === "todos", "E12m4 o atalho larga a escolha do gerenciador e passa a lista para 'Todos'");
    }
    /* travado no meio da rodada */
    a.$("btnCeLimpar").onclick();
    a.$("btnCeAtLongos").onclick();
    a.$("btnCePrompt").onclick();
    ok(a.cePassoAtual() === 2 && a.ceMarcarPor("curtos") === null, "E12n no passo 2 os atalhos nao fazem nada");
    ok(achar(a.$("ceLista"), (e) => e.tag === "button" && e.textContent === "ver no texto").length === 0, "E12n2 no passo 2 nao ha 'ver no texto' (a rodada esta em andamento)");
    /* prompt editavel e tamanho */
    ok(!a.$("cePrompt").readOnly && /\d/.test(a.$("cePromptTam").textContent), "E12o o pedido e' editavel e o tamanho aparece: " + a.$("cePromptTam").textContent);
    a.$("cePrompt").value = a.$("cePrompt").value + "x".repeat(5000); a.$("cePrompt").oninput();
    ok(/5[.,]?\d{3}|\d[.,]?\d{3}/.test(a.$("cePromptTam").textContent), "E12p editar atualiza o tamanho");
    ok(a.$("cePrompt").getAttribute("aria-description") === a.t("ce_tip_prompt_edit"), "E12q o campo do pedido tem explicacao");
    a.ceDescartar && a.ceDescartar();
  }
  {
    /* previa e ver no texto */
    const { a } = (() => { const r = rodar(); const x = r.api; x.matIniciar(); x.edIniciar(); x.$("editor").value = "Pergunta da bancada? :: sim"; x.matGravarCartoes(x.matChave("Proc", "R"), "Qual o prazo? :: 10", { disciplina: "Proc", topico: "R" }); return { a: x }; })();
    a.ceAbrir();
    const achar2 = (raiz, teste, acc) => { Array.from(raiz.children || []).forEach((f) => { if (teste(f)) acc.push(f); achar2(f, teste, acc); }); return acc; };
    const itens = achar2(a.$("ceLista"), (f) => /ce-item/.test(f.className || ""), []);
    const bs = achar2(itens[0], (f) => /ce-ver/.test(f.className || ""), []);
    ok(itens.length === 2 && bs.length >= 1 && bs[0].textContent === "ver cartão" && bs[0].title.length > 10, "E12r cada item tem 'ver cartao' com explicacao");
    const prev = achar2(itens[0], (f) => /ce-previa/.test(f.className || ""), [])[0];
    ok(prev && prev.hidden === true, "E12s a previa comeca escondida");
    bs[0].onclick({ preventDefault() {}, stopPropagation() {} });
    ok(prev.hidden === false && prev.children.length > 0 && bs[0].textContent === "ocultar cartão", "E12t clicar mostra o cartao inteiro (renderizado) e o botao vira 'ocultar'");
    bs[0].onclick({ preventDefault() {}, stopPropagation() {} });
    ok(prev.hidden === true && bs[0].textContent === "ver cartão", "E12u clicar de novo esconde");
    /* ver no texto: so' cartao da bancada */
    const daBancada = itens.find((it) => /Pergunta da bancada/.test(it.textContent));
    const outro = itens.find((it) => /Qual o prazo/.test(it.textContent));
    const vt = (it) => achar2(it, (f) => /ce-ver/.test(f.className || "") && f.textContent === "ver no texto", [])[0];
    ok(vt(daBancada) && !vt(outro), "E12v 'ver no texto' so' nos cartoes da bancada");
    vt(daBancada).onclick({ preventDefault() {}, stopPropagation() {} });
    ok(a.$("dlgCartElevar").open === false && a.$("editor").selectionStart === 0 && a.$("editor").selectionEnd === "Pergunta da bancada? :: sim".length, "E12w 'ver no texto' fecha a janela e seleciona a linha do cartao no editor");
  }
  {
    /* autocorrecao e resposta sem ancora */
    const NL = String.fromCharCode(10);
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const ch = a.matChave("Proc", "Recursos");
    a.matGravarCartoes(ch, ["Qual o prazo do recurso? :: 10 dias", "Qual o efeito do recurso? :: Suspende"].join(NL + NL), { disciplina: "Proc", topico: "Recursos" });
    const bom = (q, r2) => q + " :: " + r2 + " com uma explicacao bem mais completa para passar de cem caracteres e ensinar de verdade o assunto ao aluno estudando :: x" + NL + "+ Saiba mais — Art. 1";
    /* autocorrecao: unidade */
    const aj = [];
    const semRep = a.ceCorrigirBloco(bom("Q1?", "R1") + NL + "+ Saiba mais — Art. 1" + NL + "+ Saiba mais — Art. 1", aj);
    ok(aj.indexOf("corrigirMaisRepetido") >= 0 && semRep.split("Saiba mais — Art. 1").length === 2, "E12x a autocorrecao tira linha '+' repetida do bloco: " + JSON.stringify(aj));
    const ac = a.ceAutoCorrigir("@@ 1" + NL + bom("Q1?", "R1") + NL + "+ Saiba mais — Art. 1" + NL + NL + "@@ 2" + NL + bom("Q2?", "R2"));
    ok(/^@@ 1/.test(ac.texto) && /@@ 2/.test(ac.texto) && ac.ajustes.length >= 1 && !/Art\. 1\n\+ Saiba mais — Art\. 1/.test(ac.texto), "E12y as ancoras '@@ N' sao preservadas e o bloco corrigido");
    const semAnc = a.ceAutoCorrigir(bom("Q1?", "R1") + NL + "+ Saiba mais — Art. 1" + NL + "+ Saiba mais — Art. 1");
    ok(semAnc.ajustes.indexOf("corrigirMaisRepetido") >= 0 && semAnc.texto.split("Saiba mais — Art. 1").length === 2, "E12y2 resposta SEM ancoras tambem e' corrigida (o texto inteiro)");
    ok(a.ceAutoCorrigir("").texto === "" && a.ceAutoCorrigir(null).ajustes.length === 0, "E12z texto vazio ou nulo nao quebra");
    const limpo = a.ceAutoCorrigir("@@ 1" + NL + bom("Q1?", "R1"));
    ok(limpo.ajustes.length === 0, "E12z2 texto sem defeito: nenhum ajuste");
    /* fluxo completo: 2 cartoes marcados, resposta COM ancoras e defeito */
    a.ceAbrir(); a.ceMudarFiltro("escopo", "todos"); a.$("btnCeAtTodos").onclick();
    a.$("btnCePrompt").onclick();
    const n = a.ceNotasAtual().length;
    ok(a.cePassoAtual() === 2 && a.ceSelAtual().size === 2 && n === 2, "E12z3 preparo: 2 cartoes marcados, prompt gerado");
    const [c0, c1] = [...a.ceSelAtual()].sort().map((i) => a.ceNotasAtual()[i].card.front);
    a.$("ceColar").value = "@@ 1" + NL + bom(c0, "R1") + NL + "+ Saiba mais — Art. 1" + NL + NL + "@@ 2" + NL + bom(c1, "R2");
    a.ceConferirColagem();
    ok(a.cePassoAtual() === 3 && a.ceConfAtual() && a.ceConfAtual().itens.length === 2 && a.ceConfAtual().autoAjustes.length >= 1 && /ajuste\(s\) automático\(s\)/.test(a.$("ceMsg").textContent), "E12z4 a conferencia aplica os ajustes automaticos e diz quantos: " + a.$("ceMsg").textContent);
    a.$("btnCeDescartar").onclick && a.$("btnCeDescartar").onclick();
    /* sem ancora, mesmo numero de cartoes: pergunta e associa pela ordem */
    const e = rodar(); const b = e.api;
    b.matIniciar(); b.edIniciar(); b.$("editor").value = "";
    b.matGravarCartoes(b.matChave("Proc", "Recursos"), ["Qual o prazo do recurso? :: 10 dias", "Qual o efeito do recurso? :: Suspende"].join(NL + NL), { disciplina: "Proc", topico: "Recursos" });
    const gerar = () => { b.ceAbrir(); b.ceMudarFiltro("escopo", "todos"); b.$("btnCeAtTodos").onclick(); b.$("btnCePrompt").onclick(); };
    gerar();
    const ordem = [...b.ceSelAtual()].sort((x, y) => x - y).map((i) => b.ceNotasAtual()[i].card.front);
    b.$("ceColar").value = bom(ordem[0], "Novo 1") + NL + NL + bom(ordem[1], "Novo 2");
    const p1 = b.ceConferirColagem();
    ok(/2 cartão\(ões\)/.test(b.$("uiModalMsg").textContent) && /NA ORDEM/.test(b.$("uiModalMsg").textContent), "E12z5 sem ancoras e com o mesmo numero de cartoes: pergunta antes de associar pela ordem");
    b._uiFechar(true);
    await p1;
    ok(b.ceConfAtual() && b.ceConfAtual().semAncora === true && b.ceConfAtual().itens.length === 2 && b.ceConfAtual().itens[0].depois.indexOf("Novo 1") >= 0 && /ORDEM/.test(b.$("ceMsg").textContent) && b.cePassoAtual() === 3, "E12z6 aceitando, cada resposta vai para o cartao da MESMA posicao e o antes/depois aparece");
    /* recusar */
    const g = rodar(); const c = g.api;
    c.matIniciar(); c.edIniciar(); c.$("editor").value = "";
    c.matGravarCartoes(c.matChave("Proc", "Recursos"), ["Qual o prazo do recurso? :: 10 dias", "Qual o efeito do recurso? :: Suspende"].join(NL + NL), { disciplina: "Proc", topico: "Recursos" });
    c.ceAbrir(); c.ceMudarFiltro("escopo", "todos"); c.$("btnCeAtTodos").onclick(); c.$("btnCePrompt").onclick();
    c.$("ceColar").value = bom("Qual o prazo do recurso?", "Novo 1") + NL + NL + bom("Qual o efeito do recurso?", "Novo 2");
    const p2 = c.ceConferirColagem();
    c._uiFechar(false);
    await p2;
    ok(c.ceConfAtual() === null && c.cePassoAtual() === 2 && /nada foi associado/.test(c.$("ceMsg").textContent), "E12z7 recusando, nada e' associado e a rodada continua no passo 2");
    /* numero diferente */
    c.$("ceColar").value = bom("Qual o prazo do recurso?", "Novo 1");
    const p3 = c.ceConferirColagem();
    ok(/1 cartão\(ões\)/.test(c.$("uiModalMsg").textContent) && /marcou 2/.test(c.$("uiModalMsg").textContent), "E12z8 sem ancoras e com numero DIFERENTE de cartoes: avisa e nao associa");
    c._uiFechar(true);
    await p3;
    ok(c.ceConfAtual() === null && c.cePassoAtual() === 2, "E12z9 nada foi conferido");
    /* com ancoras nao pergunta */
    c.$("ceColar").value = "@@ 1" + NL + bom("Qual o prazo do recurso?", "Novo 1") + NL + NL + "@@ 2" + NL + bom("Qual o efeito do recurso?", "Novo 2");
    await c.ceConferirColagem();
    ok(c.ceConfAtual() && c.ceConfAtual().semAncora === false && c.ceConfAtual().itens.length === 2, "E12z10 com ancoras o fluxo e' o de sempre (nao pergunta nada)");
  }

  /* CSS dos elementos criados pelo codigo (o teste de estrutura so' ve o que esta no HTML) */
  {
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(["ce-atalhos", "ce-acoes-item", "ce-ver", "ce-previa"].every((c) => html.indexOf("." + c + "{") >= 0), "E12-css as classes dos atalhos, da previa e do 'ver no texto' tem regra de CSS");
  }

  /* ---- E13: migracao do "ja revisado" da revisao manual antiga ---- */
  {
    const NL = String.fromCharCode(10);
    const mk = (antigo) => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar(); a.$("editor").value = "Pergunta   da  BANCADA? :: sim";
      a.matGravarCartoes(a.matChave("Proc", "Recursos"), [
        "Qual o prazo do recurso? :: 10 dias",
        "Qual o efeito do recurso? :: Suspende",
        "Recurso :: Serviço"].join(NL + NL), { disciplina: "Proc", topico: "Recursos" });
      if (antigo !== undefined) a.loja.setItem("eac_revisados", typeof antigo === "string" ? antigo : JSON.stringify(antigo));
      return a;
    };
    const cartao = (a, re) => a.cqLerBiblioteca().find((n) => re.test(n.card.front)).card;
    /* sem registro antigo: nada a migrar, mas marca que ja' olhou */
    {
      const a = mk();
      const r = a.ceMigrarRevisados();
      ok(r && r.antigos === 0 && r.migrados === 0 && !!a.loja.getItem(a.CE_CHAVE_MIG) && a.ceMigrarRevisados() === null, "E13 sem registro antigo: nada migra, a marca fica e a segunda chamada nao faz nada");
    }
    /* com registro antigo */
    {
      const a = mk(["qual o prazo do recurso?", "pergunta da bancada?", "cartao que ja nao existe?"]);
      const c1 = cartao(a, /prazo/), c2 = cartao(a, /efeito/), cb = cartao(a, /BANCADA/);
      ok(a.ceRevisado(c1, a.ceRevLer()) === false, "E13a (antes) o cartao ainda e' candidato");
      a.ceAbrir();
      const m = a.ceRevLer();
      ok(/^\d{4}-\d{2}-\d{2}$/.test(m[a.ceChaveCartao(c1, "completar")].q), "E13b2 a marca migrada guarda a data da migracao");
      ok(a.CE_OBJETIVOS.every((o) => a.ceRevisado(c1, m) === true && !!m[a.ceChaveCartao(c1, o)] && m[a.ceChaveCartao(c1, o)].mig === 1 && m[a.ceChaveCartao(c1, o)].ok === 1), "E13b o cartao do registro antigo entra como TRABALHADO nos 4 objetivos (com a marca de migrado)");
      ok(m[a.ceChaveCartao(cb, "completar")] && m[a.ceChaveCartao(cb, "fatos")], "E13c a frente e' comparada normalizada (caixa e espacos): o cartao da bancada tambem migra");
      ok(!m[a.ceChaveCartao(c2, "completar")] && !m[a.ceChaveCartao(c2, "forma")] && a.ceRevisado(c2, m) === false, "E13d cartao que NAO estava no registro antigo continua candidato");
      ok(a.ceNotasAtual().every((n) => !/prazo|BANCADA/.test(n.card.front)) && a.ceNotasAtual().some((n) => /efeito/.test(n.card.front)), "E13e a fila do Elevar ja abre sem os migrados: " + a.ceNotasAtual().map((n) => n.card.front));
      ok(/2 cartão\(ões\) que você já tinha revisado/.test(a.$("ceMsg").textContent), "E13f a janela avisa quantos foram marcados (2; o terceiro do registro nao existe mais): " + a.$("ceMsg").textContent);
      const info = JSON.parse(a.loja.getItem(a.CE_CHAVE_MIG));
      ok(info.antigos === 3 && info.migrados === 2 && /^\d{4}-\d{2}-\d{2}$/.test(info.q), "E13g fica gravado quando, quantos havia e quantos migraram: " + JSON.stringify(info));
      ok(a.loja.getItem("eac_revisados").indexOf("cartao que ja nao existe") > 0, "E13h o registro antigo NAO e' apagado (continua no backup)");
      /* reabrir nao repete nem avisa de novo */
      const antes = JSON.stringify(a.ceRevLer());
      a.ceAbrir();
      ok(JSON.stringify(a.ceRevLer()) === antes && !/já tinha revisado/.test(a.$("ceMsg").textContent), "E13i reabrir: nada muda e o aviso nao repete");
      /* mesmo alterando o registro antigo depois, nao migra de novo */
      a.loja.setItem("eac_revisados", JSON.stringify(["qual o efeito do recurso?"]));
      a.ceAbrir();
      ok(a.ceRevisado(c2, a.ceRevLer()) === false, "E13j depois de migrado, mudancas no registro antigo nao valem (migracao unica)");
    }
    /* registro antigo so' com cartoes que nao existem mais: nao avisa nada */
    {
      const a = mk(["cartao que sumiu?", "outro que sumiu?"]);
      a.ceAbrir();
      ok(JSON.parse(a.loja.getItem(a.CE_CHAVE_MIG)).migrados === 0 && !/já tinha revisado/.test(a.$("ceMsg").textContent), "E13r nenhum cartao do registro antigo existe mais: migra 0 e nao mostra aviso");
    }
    /* nao pisa em marca existente */
    {
      const a = mk(["qual o prazo do recurso?"]);
      const c1 = cartao(a, /prazo/);
      a.ceMarcarTentativa([c1]);
      const antes = a.ceRevLer()[a.ceChaveCartao(c1, "completar")];
      ok(antes && antes.t === 1, "E13k (preparo) o Elevar ja tinha 1 tentativa nesse cartao");
      a.ceAbrir();
      const dep = a.ceRevLer();
      ok(dep[a.ceChaveCartao(c1, "completar")].t === 1 && !dep[a.ceChaveCartao(c1, "completar")].ok && dep[a.ceChaveCartao(c1, "fatos")] && dep[a.ceChaveCartao(c1, "fatos")].mig === 1, "E13l a marca que o Elevar ja tinha NAO e' sobrescrita (so' preenche o que falta)");
    }
    /* registro antigo invalido */
    {
      const a = mk("isto nao e json");
      ok(a.ceMigrarRevisados().antigos === 0 && !!a.loja.getItem(a.CE_CHAVE_MIG), "E13m registro antigo ilegivel: nao quebra e nao migra nada");
      const b = mk({ nao: "array" });
      ok(b.ceMigrarRevisados().migrados === 0, "E13n registro que nao e' lista: ignorado");
      const c = mk([123, null, "qual o prazo do recurso?"]);
      ok(c.ceMigrarRevisados().migrados === 1, "E13o itens estranhos na lista nao atrapalham");
    }
    /* a classificacao tambem dispara a migracao (ex.: pelo gerenciador) */
    {
      const a = mk(["qual o prazo do recurso?"]);
      const cl = a.ceClassificar(a.cqLerBiblioteca());
      ok(cl.find((n) => /prazo/.test(n.card.front)).revisado === true && cl.find((n) => /efeito/.test(n.card.front)).revisado === false, "E13p classificar a biblioteca (por qualquer tela) ja migra: o cartao antigo aparece como revisado");
    }
    ok(a13frente("  Qual   O Prazo? ") === "qual o prazo?" && a13frente(null) === "", "E13q a frente antiga e' normalizada como a revisao manual fazia (caixa, espacos)");
    function a13frente(x) { return mk().ceFrenteAntiga(x === null ? null : { front: x }); }
  }

  /* ---- E8: a tela, em 3 passos ---- */
  {
    const { a, c1, janela } = montar();
    a.ceAbrir();
    const vis = (id) => a.$(id).hidden === false;
    ok(a.$("dlgCartElevar").open === true, "E8 a janela nao abriu");
    ok(a.cePassoAtual() === 1 && a.ceSelAtual().size === 3, `E8-pre abre no passo 1 com a rodada ja escolhida: passo ${a.cePassoAtual()} / ${a.ceSelAtual().size}`);
    ok(/Rodada 1 · 3 fracos · 0 quase lá · 1 completos \(de 4\)/.test(a.$("ceResumo").textContent), `E8a resumo: ${a.$("ceResumo").textContent}`);
    const itens = achar(a.$("ceLista"), (e) => cls(e, "ce-item"));
    ok(itens.length === 3, `E8b devia listar 3: ${itens.length}`);
    ok(/resposta curta/.test(itens[0].textContent) && /sem base legal/.test(itens[0].textContent), `E8c a lista mostra o que falta: ${itens[0].textContent}`);
    const selos = achar(a.$("ceLista"), (e) => cls(e, "ce-nivel"));
    ok(selos.length === 3 && selos.every((x) => cls(x, "ce-nivel-fraco") && x.textContent === "Fraco"), "E8c2 cada cartao mostra o selo do nivel (palavra + cor, nunca so' a cor)");
    /* o rodape do passo 1: so' o que faz sentido agora */
    ok(vis("btnCePrompt") && a.$("btnCePrompt").disabled === false && /Copiar prompt \(3 cartões\)/.test(a.$("btnCePrompt").textContent), `E8d passo 1 tem UM botao principal: ${a.$("btnCePrompt").textContent}`);
    ok(!vis("btnCeColarClip") && !vis("btnCeConferir") && !vis("btnCeAplicar") && !vis("btnCeNova") && !vis("btnCeDescartar"), "E8d2 no passo 1 nao aparecem botoes dos passos seguintes");
    a.$("btnCeLimpar").onclick();
    ok(a.ceSelAtual().size === 0 && a.$("btnCePrompt").disabled === true, "E8f limpar desmarca e desliga o botao");
    a.$("btnCeMarcar").onclick();
    ok(a.ceSelAtual().size === 3, "E8e 'marcar os piores' marca os 3");
    a.$("btnCeLimpar").onclick();
    /* marcar so' o do ISS (fato gerador) */
    const ab = a.ceNotasAtual();
    const ix = ab.findIndex((x) => /fato gerador/.test(x.card.front));
    const ck = achar(a.$("ceLista"), (e) => e.tag === "input")[ix];
    ck.checked = true; ck.onchange();
    ok(a.ceSelAtual().size === 1 && /1 marcado/.test(a.$("ceSel").textContent) && /1 marcado\(s\) de 3/.test(a.$("ceEscolhaTit").textContent), "E8g marcar um cartao pela caixa");
    /* PASSO 1 -> 2 */
    const p1 = a.$("btnCePrompt").onclick();
    ok(a.cePassoAtual() === 2 && a.$("cePromptCx").hidden === false && a.$("ceColarCx").hidden === false && /@@ 1\n@ Trilha ISS/.test(a.$("cePrompt").value), "E8h o prompt aparece com a ancora e o cartao");
    await p1;
    ok(/Passo 1 feito/.test(a.$("ceMsg").textContent) && janela.__area === a.$("cePrompt").value, `E8h2 o prompt foi COPIADO e a mensagem diz o que fazer: ${a.$("ceMsg").textContent}`);
    ok(a.$("btnCePrompt").dataset.feito === "Prompt copiado" && /Copiar o prompt de novo/.test(a.$("btnCePrompt").textContent), "E8h3 o botao mostrou que foi apertado (✓) e agora oferece copiar de novo");
    ok(vis("btnCeColarClip") && vis("btnCeConferir") && vis("btnCeNova") && vis("btnCeDescartar") && !vis("btnCeAplicar"), "E8h4 passo 2: colar, conferir, trocar selecao e descartar");
    ok(a.$("ceEscolha").open === false && /passo-atual/.test(a.$("cePasso2").className) && /passo-feito/.test(a.$("cePasso1").className), "E8h5 a lista recolhe e o indicador de passos avanca");
    /* a escolha fica TRAVADA: nenhum clique desfaz a rodada em andamento */
    const cks2 = achar(a.$("ceLista"), (e) => e.tag === "input");
    ok(cks2.every((x) => x.disabled === true) && a.$("btnCeMarcar").disabled === true && a.$("btnCeLimpar").disabled === true, "E8h6 caixas e 'marcar os piores' travados no meio da rodada");
    const ped = a.cePedidoAtual();
    a.$("btnCeMarcar").onclick(); a.$("btnCeLimpar").onclick();
    ok(a.ceSelAtual().size === 1 && a.cePedidoAtual() === ped, "E8h7 clicar em marcar/limpar no meio da rodada nao muda nada");
    /* clique repetido no botao principal: so' copia de novo, NAO refaz a rodada nem apaga o que foi colado */
    a.$("ceColar").value = "texto ja colado";
    await a.$("btnCePrompt").onclick(); await a.$("btnCePrompt").onclick();
    ok(a.cePedidoAtual() === ped && a.cePassoAtual() === 2 && a.$("ceColar").value === "texto ja colado", "E8h8 clicar de novo no botao do prompt so' copia de novo (nao perde a colagem)");
    /* conferir sem colar */
    a.$("ceColar").value = "";
    a.$("btnCeConferir").onclick();
    await conduzir(a, Promise.resolve());
    ok(a.$("ceComparar").hidden === true && a.cePassoAtual() === 2, "E8i conferir sem colar nada nao abre comparacao");
    /* PASSO 2 -> 3, pelo botao de colar da area de transferencia */
    janela.__area = BOM1;
    await a.$("btnCeColarClip").onclick();
    ok(a.$("ceColar").value === BOM1 && a.cePassoAtual() === 3, `E8i2 'colar e conferir' le a area de transferencia e ja confere: passo ${a.cePassoAtual()}`);
    const cmp = achar(a.$("ceComparar"), (e) => cls(e, "ce-cmp"));
    ok(cmp.length === 1 && vis("btnCeAplicar") && /Aplicar os 1 aceitos/.test(a.$("btnCeAplicar").textContent), `E8j comparacao: ${cmp.length} / ${a.$("btnCeAplicar").textContent}`);
    ok(achar(cmp[0], (e) => e.tag === "pre").length === 2 && /Fraco/.test(cmp[0].textContent) && /Completo/.test(cmp[0].textContent) && /Requisitos: \d → \d de \d/.test(cmp[0].textContent) && /ganhou:/.test(cmp[0].textContent), `E8k mostra antes/depois, niveis e o que ganhou: ${cmp[0].textContent.slice(0, 160)}`);
    ok(/Passo 2 feito: 1 cartão/.test(a.$("ceMsg").textContent), "E8k2 a mensagem do passo 2");
    /* recusar a pergunta */
    const antes = a.matResumosAtual()[c1].cartoes;
    const pn = a.$("btnCeAplicar").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
    await pn;
    ok(a.matResumosAtual()[c1].cartoes === antes && a.cePassoAtual() === 3, "E8l dizer NAO nao devia mexer em nada (e a rodada continua)");
    await conduzir(a, a.$("btnCeAplicar").onclick());
    ok(/A prestação de serviços constantes/.test(a.matResumosAtual()[c1].cartoes), "E8m aplicar troca o cartao");
    ok(/Rodada 2 · 2 fracos/.test(a.$("ceResumo").textContent) && /Rodada 1 aplicada: 1 trocado\(s\)/.test(a.$("ceMsg").textContent) && /Rodada 2 pronta: 2 cartões/.test(a.$("ceMsg").textContent), `E8n a tela atualiza e ja deixa a proxima rodada pronta: ${a.$("ceResumo").textContent} | ${a.$("ceMsg").textContent}`);
    ok(a.cePassoAtual() === 1 && a.ceSelAtual().size === 2 && a.$("ceColar").value === "" && a.$("cePrompt").value === "", "E8n2 depois de aplicar volta ao passo 1 com a rodada seguinte escolhida e as caixas limpas");
    ok(vis("btnCeDesfazer") && a.$("ceComparar").hidden === true, "E8o depois de aplicar aparece 'desfazer' e a comparacao some");
    await conduzir(a, a.$("btnCeDesfazer").onclick());
    ok(a.matResumosAtual()[c1].cartoes === antes && /3 fracos/.test(a.$("ceResumo").textContent) && a.$("btnCeDesfazer").hidden === true, "E8p desfazer volta ao texto e o cartao volta a fila (nao fica marcado como trabalhado)");
  }
  {
    /* o que encolheu vem DESMARCADO, e desfazer pergunta antes */
    const { a, c1 } = montar();
    a.ceAbrir();
    a.$("btnCeLimpar").onclick();
    const ab = a.ceNotasAtual();
    const ix = ab.findIndex((x) => /fato gerador/.test(x.card.front));
    const ck = achar(a.$("ceLista"), (e) => e.tag === "input")[ix];
    ck.checked = true; ck.onchange();
    await a.$("btnCePrompt").onclick();
    a.$("ceColar").value = "@@ 1\nQual o fato gerador do ISS? :: Serviço";
    a.$("btnCeConferir").onclick();
    const caixa = achar(a.$("ceComparar"), (e) => e.tag === "input")[0];
    ok(caixa && caixa.checked === false && /Aplicar os 0 aceitos/.test(a.$("btnCeAplicar").textContent) && achar(a.$("ceComparar"), (e) => /MENOR/.test(e.textContent || "")).length >= 1,
       `E8q resposta que encolheu devia vir desmarcada e avisada: ${caixa && caixa.checked} / ${a.$("btnCeAplicar").textContent}`);
    ok(achar(a.$("ceComparar"), (e) => cls(e, "ce-aviso") && /ainda tem requisito essencial/.test(e.textContent)).length === 1, "E8q2 e avisa que continua fraco");
    /* aplicar uma boa, depois recusar o desfazer */
    a.$("ceColar").value = BOM1;
    a.$("btnCeConferir").onclick();
    await conduzir(a, a.$("btnCeAplicar").onclick());
    const depois = a.matResumosAtual()[c1].cartoes;
    const pd = a.$("btnCeDesfazer").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
    await pd;
    ok(a.matResumosAtual()[c1].cartoes === depois, "E8r dizer NAO em 'desfazer' nao devia mexer em nada");
  }
  {
    /* PROTECAO CONTRA PERDA: descartar e trocar a selecao perguntam; NAO nao muda nada; SIM registra a tentativa */
    const { a, c1 } = montar();
    const vis = (id) => a.$(id).hidden === false;
    a.ceAbrir();
    await a.$("btnCePrompt").onclick();
    a.$("ceColar").value = "colado";
    const ped = a.cePedidoAtual();
    const pn = a.$("btnCeNova").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
    await pn;
    ok(a.cePassoAtual() === 2 && a.cePedidoAtual() === ped && a.$("ceColar").value === "colado", "E8s 'trocar a selecao' pergunta e o NAO preserva prompt e colagem");
    await conduzir(a, a.$("btnCeNova").onclick());
    ok(a.cePassoAtual() === 1 && a.cePedidoAtual() === null && a.$("ceColar").value === "" && a.$("ceEscolha").open === true && achar(a.$("ceLista"), (e) => e.tag === "input").every((x) => x.disabled === false), "E8t trocar a selecao volta ao passo 1 com as caixas liberadas");
    /* descartar duas vezes o mesmo lote = dificil: sai da fila, e a rodada termina */
    await a.$("btnCePrompt").onclick();
    const pd = a.$("btnCeDescartar").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
    await pd;
    ok(a.cePassoAtual() === 2 && Object.keys(a.ceRevLer()).length === 0, "E8u descartar tambem pergunta; NAO nao registra nada");
    await conduzir(a, a.$("btnCeDescartar").onclick());
    ok(a.cePassoAtual() === 1 && Object.values(a.ceRevLer()).every((x) => x.t === 1) && Object.keys(a.ceRevLer()).length === 3 && /Rodada descartada/.test(a.$("ceMsg").textContent), `E8v descartar conta 1 tentativa por cartao: ${JSON.stringify(a.ceRevLer())}`);
    ok(a.ceNotasAtual().length === 3, "E8w com 1 tentativa os cartoes continuam na fila");
    await a.$("btnCePrompt").onclick();
    await conduzir(a, a.$("btnCeDescartar").onclick());
    ok(a.ceNotasAtual().length === 0 && /0 fracos/.test(a.$("ceResumo").textContent) && /3 fracos já trabalhados/.test(a.$("ceResumo").textContent) && vis("btnCeMostrarRev") && a.$("btnCePrompt").disabled === true, `E8x 2 tentativas sem melhorar: a fila ACABA em vez de repetir os mesmos cartoes: ${a.$("ceResumo").textContent}`);
    /* trazer de volta */
    const pr = a.$("btnCeMostrarRev").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(true); }
    await pr;
    ok(a.ceNotasAtual().length === 3 && !vis("btnCeMostrarRev"), "E8y 'trazer de volta os ja trabalhados' limpa o registro");
    /* fechar no meio da rodada pergunta */
    await a.$("btnCePrompt").onclick();
    const pf = a.$("btnCeFechar").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
    await pf;
    ok(a.$("dlgCartElevar").open === true, "E8z fechar no meio da rodada pergunta (e o NAO mantem aberto)");
  }
  {
    /* uma rodada que devolve so' parte: os que nao voltaram contam tentativa, o aceito sai da fila */
    const { a, c1 } = montar();
    a.ceAbrir();
    await a.$("btnCePrompt").onclick();
    const its = a.cePedidoAtual().itens;
    const idFato = its.findIndex((x) => /fato gerador/.test(x.card.front)) + 1;
    a.$("ceColar").value = BOM1.replace("@@ 1", "@@ " + idFato);
    a.$("btnCeConferir").onclick();
    await conduzir(a, a.$("btnCeAplicar").onclick());
    const rev = a.ceRevLer();
    const valores = Object.values(rev);
    ok(valores.filter((x) => x.ok).length >= 1 && valores.filter((x) => x.t === 1).length === 2, `E8z2 o aceito sai da fila e os 2 que a IA nao devolveu contam tentativa: ${JSON.stringify(rev)}`);
  }
  {
    /* o lote tem teto */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const ch = a.matChave("D", "T");
    a.matGravarCartoes(ch, Array.from({ length: 20 }, (_, i) => `Pergunta numero ${i}? :: Resp ${i}`).join("\n"), { disciplina: "D", topico: "T" });
    a.ceAbrir();
    ok(a.ceSelAtual().size === a.CE_LIM.lote, "E9-pre a rodada ja abre com os piores escolhidos");
    a.$("btnCeLimpar").onclick(); a.$("btnCeMarcar").onclick();
    ok(a.ceSelAtual().size === a.CE_LIM.lote && a.CE_LIM.lote === 15, `E9 marcar os piores respeita o lote: ${a.ceSelAtual().size}`);
    const cks = achar(a.$("ceLista"), (e) => e.tag === "input");
    cks[15].checked = true; cks[15].onchange();
    ok(a.ceSelAtual().size === 15 && cks[15].checked === false && /no máximo 15|máximo 15/.test(a.$("ceMsg").textContent), `E9a o 16o cartao e' recusado com aviso: ${a.ceSelAtual().size} / ${a.$("ceMsg").textContent}`);
    ok(achar(a.$("ceLista"), (e) => cls(e, "ce-item")).length === 20 && a.$("btnCeMais").hidden === true, "E9b 20 cartoes cabem na lista (limite de exibicao 40)");
    a.ceAbrir();
    ok(a.cePassoAtual() === 1 && a.ceSelAtual().size === a.CE_LIM.lote, "E9c reabrir volta ao passo 1 com uma rodada nova escolhida");
  }
  {
    /* biblioteca sem cartoes / sem nada abaixo */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    a.ceAbrir();
    ok(/Ainda não há cartões/.test(a.$("ceResumo").textContent), `E10 biblioteca vazia: ${a.$("ceResumo").textContent}`);
    const ch = a.matChave("D", "T");
    a.matGravarCartoes(ch, "P? :: " + RICO + "\n+ Literalidade — Art. 1º", { disciplina: "D", topico: "T" });
    a.ceAbrir();
    ok(/0 fracos · 0 quase lá · 1 completos/.test(a.$("ceResumo").textContent) && achar(a.$("ceLista"), (e) => /Nada fraco na fila/.test(e.textContent || "")).length === 1 && a.$("btnCePrompt").disabled === true, `E10a so' cartao bom: ${a.$("ceResumo").textContent}`);
  }

  /* ---- E12: reforcos (mutacoes sobreviventes) ---- */
  {
    ok(api.ceAvaliar(B("P (Fonte: CTM)", RICO, { more: "m" })).nivel === "fraco", "E12a so' a (Fonte: ...) no texto ja deixa o cartao Fraco (e' essencial)");
    ok(api.ceDefeitos({ kind: "cloze", front: "A {{c1::30 dias::30 ou 60?}} e {{c2::5 anos}} (art. 5º)", back: "", more: "+" }).indexOf("cloze_sem_dica") < 0, "E12b duas lacunas de escolha, so' uma com dica: basta uma dica");
    ok(api.ceNota(B("P (Fonte: x)", "c")) === 0, "E12c a nota para em 0 mesmo faltando tudo");
    const c = B("Q?", RICO, { more: "m" });
    api.ceRevLimpar(); api.ceMarcarRevisados([c]); api.ceMarcarTentativa([c]);
    ok(api.ceRevisado(c), "E12d tentativa nao desfaz um cartao ja aceito");
    api.ceRevLimpar();
    /* conferir: 'medio' depois da melhoria NAO e' 'continua fraco' */
    const it = [{ chave: "k", card: { raw: "x", front: "Qual o prazo?", back: "30", more: "", kind: "basic", tags: [], ownTags: [] } }];
    const p = api.ceMontarPrompt(it);
    const semArt = "Qual o prazo do recurso administrativo? :: O prazo é contado da ciência da decisão pelo interessado e corre em dias corridos, sem suspensão nas férias forenses ou nos feriados locais :: x\n+ Nota — prazo de trinta dias";
    const r = api.ceConferir("@@ 1\n" + semArt, it, p.blocos);
    ok(r.itens[0].nivelDepois === "medio" && !r.itens[0].avisos.some((x) => x.id === "continua"), "E12e ficar 'Quase la' (so' sem base legal) nao e' aviso de 'continua fraco'");
    /* a resposta com * e linha em branco e' arrumada ao conferir */
    const r2 = api.ceConferir("@@ 1\nQual o prazo do recurso administrativo? :: O prazo é contado da ciência da decisão pelo interessado e corre em dias corridos, sem suspensão nas férias forenses ou nos feriados locais :: x\n\n* Esquema — prazo de trinta dias, conforme o art. 5º", it, p.blocos);
    ok(r2.itens.length === 1 && /\n\+ Esquema — prazo/.test(r2.itens[0].depois) && !/\*/.test(r2.itens[0].depois) && r2.itens[0].nivelDepois === "bom", "E12f conferir normaliza: * vira + e cola no cartao (senao o cartao voltava sem 'saiba mais')");
    /* encolheu perdendo POUCAS palavras (entre 70% e 95%): aviso e vem desmarcado */
    const orig = [{ chave: "k", card: { raw: "x", front: "Qual o prazo do recurso administrativo?", back: "Prazo contado da ciência da decisão pelo interessado, dirigido à autoridade competente, julgado na instância superior com fundamentação escrita, conforme o art. 5º", more: "+ Nota — prazo de trinta dias", kind: "basic", tags: [], ownTags: [] } }];
    const po = api.ceMontarPrompt(orig);
    const ro = api.ceConferir("@@ 1\nQual o prazo do recurso administrativo? :: Prazo contado da ciência da decisão pelo interessado, dirigido à autoridade competente, conforme o art. 5º\n+ Nota — prazo de trinta dias", orig, po.blocos);
    const io = ro.itens[0];
    ok(io && io.avisos.some((x) => x.id === "encolheu") && !io.avisos.some((x) => x.id === "perdeu"), `E12g encolheu perdendo poucas palavras: ${JSON.stringify(io && io.avisos)} cob ${io && io.cobertura}`);
  }
  {
    /* a tela: chamadas diretas, sem o clique */
    const { a } = montar();
    a.ceAbrir();
    a.ceGerarPrompt();
    const ped = a.cePedidoAtual();
    a.ceGerarPrompt();
    ok(a.cePedidoAtual() === ped && a.cePassoAtual() === 2, "E12h pedir o prompt de novo no meio da rodada nao refaz o pedido");
    const cks = achar(a.$("ceLista"), (e) => e.tag === "input");
    cks[0].checked = false; cks[0].onchange();
    ok(a.ceSelAtual().size === 3 && cks[0].checked === true, "E12i mexer numa caixa no meio da rodada nao muda a escolha");
    a.ceAbrir();
    ok(a.cePassoAtual() === 1 && a.cePedidoAtual() === null, "E12j reabrir a janela comeca de novo, no passo 1");
  }

  /* ---- E13: cada botao da janela tem explicacao e retorno visual ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const ini = html.indexOf('<dialog id="dlgCartElevar"');
    const dlgHtml = html.slice(ini, html.indexOf("</dialog>", ini));
    const ids = [...dlgHtml.matchAll(/<button[^>]*\bid="(\w+)"/g)].map((m) => m[1]);
    const { a } = montar();
    const faltam = ids.filter((id) => !a.CE_DICAS[id]);
    ok(ids.length >= 12 && faltam.length === 0, "E13a todo botao do Elevar tem explicacao (falta: " + faltam.join(",") + ")");
    ok(Object.keys(a.CE_DICAS).every((id) => dlgHtml.indexOf('id="' + id + '"') >= 0), "E13b nenhuma explicacao aponta para botao que nao existe");
    const semIdioma = Object.values(a.CE_DICAS).filter((k) => i18n.split('"' + k + '": ').length - 1 < 2 || a.t(k).length < 15);
    ok(semIdioma.length === 0, "E13c explicacoes em portugues e ingles, com texto de verdade: " + semIdioma.join(","));
    a.ceAbrir();
    const mal = Object.keys(a.CE_DICAS).filter((id) => { const e = a.$(id); return !(e._dicaLigada === true && e._ouv.mouseenter.length === 1 && e.getAttribute("aria-description") === a.t(a.CE_DICAS[id])); });
    ok(mal.length === 0, "E13d cada botao recebeu o balao e o texto para leitor de tela: " + mal.join(","));
    a.$("dlgCartElevar").close(); a.ceAbrir();
    ok(Object.keys(a.CE_DICAS).every((id) => a.$(id)._ouv.mouseenter.length === 1), "E13e reabrir nao liga o balao duas vezes");
    a.segurarAdiados();
    a.$("btnCeLimpar").onclick();
    ok(cls(a.$("btnCeLimpar"), "btn-feito"), "E13f 'limpar marcacao' mostra o retorno");
    a.$("btnCeMarcar").onclick();
    ok(cls(a.$("btnCeMarcar"), "btn-feito"), "E13g 'marcar os piores' tambem");
    a.$("btnCeMais").onclick();
    ok(cls(a.$("btnCeMais"), "btn-feito"), "E13h 'mostrar mais' tambem");
    await a.$("btnCePrompt").onclick();
    ok(a.$("btnCePrompt").dataset.feito === "Prompt copiado" && a.$("btnCePrompt").textContent === "Prompt copiado", "E13i o retorno do 'copiar' diz o que aconteceu, sem repetir o ✓ (ele vem do CSS): " + a.$("btnCePrompt").textContent);
    a.$("btnCeCopiar").onclick();
    ok(cls(a.$("btnCeCopiar"), "btn-feito"), "E13j 'copiar' da caixa do prompt tambem");
    a.soltarAdiados();
    ok(!cls(a.$("btnCeLimpar"), "btn-feito") && !cls(a.$("btnCeCopiar"), "btn-feito") && /Copiar o prompt de novo/.test(a.$("btnCePrompt").textContent), "E13k o retorno some e o texto do botao volta");
  }

  /* ---- E11: o modulo esta no app ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="cartao-elevar\.js"><\/script>/.test(html) && /id="btnCartElevar"/.test(html) && /id="dlgCartElevar"/.test(html), "E11 falta o script, o botao ou a janela no index.html");
    ok(/"cartao-elevar\.js"/.test(sw), "E11a o modulo nao esta no cache offline");
    ok(/\.ce-rodape\{position:sticky;bottom:0/.test(html) && /class="ce-msg" id="ceMsg"/.test(html) && /id="cePasso1"[\s\S]*id="cePasso2"[\s\S]*id="cePasso3"/.test(html), "E11b o rodape fica fixo, a mensagem fica no alto e ha 3 passos");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`cartao-elevar: ok (${f.quantas} verificacoes)`);
  });
}
