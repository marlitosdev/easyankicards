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
