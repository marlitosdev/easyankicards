/* =====================================================================
 * TEXTO NUMA LINHA SÓ: AVISAR, SEPARAR E MOSTRAR PARA CONFERIR (v18.64.0)
 *
 * O pedido: "não ficou claro que seria separado automaticamente. Avise que
 * identificou o problema e que vai fazer a separação para conferência; crie
 * uma interface amigável para quem lê um texto longo". O QUE PRECISA SER
 * VERDADE:
 *  1. o motor devolve cada artigo como peça; "pular" desfaz só aquela quebra
 *     e nenhuma palavra muda;
 *  2. os pontos a conferir: número repetido (informativo), salto na
 *     numeração, citação (anterior termina com ":"), texto longo;
 *  3. a tela avisa o problema e que já separou; abre nos pontos a conferir;
 *     "ir ao art.", "próximo a conferir", páginas de 40, letra maior;
 *  4. "juntar ao anterior" e "está certo" (desfazíveis) mudam a contagem e o
 *     texto entregue; "voltar" não mexe em nada.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const espera = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 2)); };

  /* um código numa linha só: art. 4º grudado (salto 3 → 5), uma citação depois de ":" e o 6º repetido */
  const TXT = "LEI COMPLEMENTAR Nº 15, DE 2009 Institui o Código Tributário de Caruaru. "
    + "Art. 1º Este Código regula os tributos. Art. 2º O imposto incide sobre serviços. § 1º Vale para todos. "
    + "Art. 3º A taxa é devida, art 4º O preço público é outro. "
    + "Art. 5º A Lei nº 9 passa a vigorar com a seguinte redação: Art. 6º O prazo é de dez dias. "
    + "Art. 6º O prazo é de trinta dias. (Redação dada pela LC 95/2022) Art. 7º Fim.";

  /* ---- 1 e 2: o motor ---- */
  {
    const { api } = rodar();
    const s = api.leiSepararColagem(TXT);
    ok(s.aplicavel && s.partes.map((p) => p.num).join(",") === "1,2,3,5,6,6,7", "M1 as peças: " + s.partes.map((p) => p.num).join(","));
    ok(/^LEI COMPLEMENTAR/.test(s.preambulo) && /^Art\. 1º Este Código/.test(s.partes[0].texto) && /\n§ 1º Vale/.test(s.partes[1].texto), "M1a preâmbulo à parte; cada peça começa no 'Art.'; § com linha própria");
    ok(s.texto.replace(/\s+/g, " ").trim() === TXT.replace(/\s+/g, " ").trim(), "M1b nenhuma palavra muda");
    ok(s.partes.map((p) => p.texto).join("\n").replace(/\s+/g, " ") === s.texto.slice(s.texto.indexOf("Art. 1º")).replace(/\s+/g, " "), "M1c as peças, juntas, são o texto separado");
    const iCit = s.partes.findIndex((p) => /dez dias/.test(p.texto));
    const j = api.leiSepararColagem(TXT, { pular: new Set([s.partes[iCit].ini]) });
    ok(j.aplicavel && j.partes.length === 6 && /seguinte redação: Art\. 6º O prazo é de dez dias\./.test(j.texto) && j.juntados === 1, "M1d 'pular' desfaz só aquela quebra: a citação volta para dentro do art. 5º");
    ok(j.texto.replace(/\s+/g, " ").trim() === TXT.replace(/\s+/g, " ").trim(), "M1e juntar também não muda palavra");
    ok(!j.partes.some((p) => (p.dentro || []).some((d) => d.ini === s.partes[iCit].ini)), "M1f o que a pessoa juntou não volta como 'Art. dentro do texto'");
    const su = api.leiSepSuspeitas(s.partes);
    const k = (i) => su[i].map((m) => m.k).join(",");
    ok(k(0) === "" && k(1) === "" && k(2) === "", "M2 nada a conferir nos primeiros: " + [k(0), k(1), k(2)].join("|"));
    ok(k(3) === "salto" && su[3][0].de === "3" && su[3][0].faltam === 1, "M2a do 3 para o 5: salto, falta 1 (o 4º grudado no 3º): " + JSON.stringify(su[3]));
    ok(k(4) === "repetido,citacao", "M2b o 6º depois de 'seguinte redação:' = repetido e citação: " + k(4));
    ok(k(5) === "repetido", "M2c o outro 6º = só repetido (informativo): " + k(5));
    /* o caso do CTM: "Art. 50. Respondem…:" e logo outro "Art. 50." = redação antiga e nova, não citação */
    const par = api.leiSepSuspeitas([{ num: "49", texto: "Art. 49. X." }, { num: "50", texto: "Art. 50. Respondem pelo imposto:" }, { num: "50", texto: "Art. 50. Respondem pelo imposto as pessoas…" }]);
    ok(par[2].map((m) => m.k).join() === "repetido", "M2c2 mesmo número depois de ':' é o par antiga/nova — só 'repetido': " + par[2].map((m) => m.k).join());
    const longo = api.leiSepSuspeitas([{ num: "1", texto: "a".repeat(100) }, { num: "2", texto: "b".repeat(25000) }, { num: "3", texto: "c".repeat(120) }]);
    ok(longo[1].map((m) => m.k).join() === "longo" && !longo[0].length && !longo[2].length, "M2d texto enorme (> 20 mil, os Anexos no último artigo) = longo");
    /* no CTM, artigos de 3 a 10 mil caracteres eram artigos grandes de verdade: sem alerta */
    const medio = api.leiSepSuspeitas([{ num: "1", texto: "a".repeat(100) }, { num: "2", texto: "b".repeat(8000) }, { num: "3", texto: "c".repeat(100) }]);
    ok(!medio[1].length, "M2d2 8 mil caracteres (artigo grande com incisos) não é 'longo'");
    /* o art. 491 do CTM: "Art. 478", "Art. 479"… no meio do texto, fora da ordem */
    const dentro = api.leiSepSuspeitas([{ num: "490", rotulo: "Art. 490", texto: "Art. 490. X." }, { num: "491", rotulo: "Art. 491", texto: "Art. 491. Multa de 10%. Art. 478 Fica instituída a taxa. Art. 479-A Outra, conforme o art. 5º." }]);
    ok(dentro[1].map((m) => m.k).join() === "dentro" && dentro[1][0].n === 2 && /Art\. 478, Art\. 479-A/.test(dentro[1][0].lista), "M2d3 cabeçalhos 'Art. N' no meio do texto (minúsculo 'art.' não conta): " + JSON.stringify(dentro[1]));
    ok(api.leiSepSuspeitas([{ num: "3", texto: "x" }, { num: "3-A", texto: "y" }, { num: "4", texto: "z" }]).every((m) => !m.length), "M2e 3 → 3-A → 4 não é salto");
    /* incisos "I." e alíneas "a)" do CTM ganham linha (depois de ":" ou ";"), sem tocar em "inciso I." no meio da frase */
    const inc = api.leiSepararColagem("Art. 9º É vedado ao Município: I. exigir tributo; II. cobrar tributos: a) em relação a fatos; b) no mesmo exercício, nos termos do inciso I. Art. 10. Fim.");
    const li = inc.texto.split("\n");
    ok(li.some((x) => /^I\. exigir/.test(x)) && li.some((x) => /^II\. cobrar/.test(x)) && li.some((x) => /^a\) em relação/.test(x)) && li.some((x) => /^b\) no mesmo/.test(x)) && li.some((x) => /nos termos do inciso I\. $|nos termos do inciso I\.$/.test(x)),
       "M2f incisos 'I.' e alíneas 'a)' com linha própria: " + JSON.stringify(li));
  }

  /* ---- 2b: o artigo grudado depois de um título (o caso do CTN achatado) ---- */
  {
    const { api } = rodar();
    const t = "Art. 1º Esta Lei regula o sistema, sem prejuízo da legislação supletiva. LIVRO PRIMEIRO SISTEMA TRIBUTÁRIO TÍTULO I Disposição Geral Art. 2º O sistema tributário é regido pela Constituição. "
      + "TÍTULO II Competência Tributária Art. 3º Tributo é prestação pecuniária. Art. 5º Os tributos são impostos, taxas e contribuições, conforme o art. 4º desta Lei.";
    const s = api.leiSepararColagem(t);
    ok(s.partes.map((p) => p.num).join(",") === "1,2,3,5", "R1 'Disposição Geral Art. 2º' e 'Competência Tributária Art. 3º' são achados: " + s.partes.map((p) => p.num).join(","));
    ok(s.partes[1].resgatado === true && s.partes[2].resgatado === true && !s.partes[0].resgatado && !s.partes[3].resgatado, "R1a os achados no meio vêm marcados");
    ok(s.texto.replace(/\s+/g, " ").trim() === t.replace(/\s+/g, " ").trim(), "R1b nenhuma palavra muda");
    const su = api.leiSepSuspeitas(s.partes);
    ok(su[1].map((m) => m.k).join() === "resgatado" && su[3].map((m) => m.k).join() === "salto", "R1c 'resgatado' é informativo; o art. 4º (só citado em minúscula) continua faltando = salto");
    /* não resgata: remissão em minúscula, número fora da ordem */
    const t2 = "Art. 1º Um, conforme o art. 2º desta Lei. Art. 3º Tres, e o Art. 9º do decreto. Art. 5º Cinco.";
    const s2 = api.leiSepararColagem(t2);
    ok(s2.partes.map((p) => p.num).join(",") === "1,3,5", "R2 'art. 2º' minúsculo e 'Art. 9º' fora da ordem não viram artigo: " + s2.partes.map((p) => p.num).join(","));
  }

  /* ---- 2c: os casos do PDF do CTM de Caruaru — sufixo do número e rodapé da página ---- */
  {
    const { api } = rodar();
    const t = "Art. 433. Taxa. Art. 433-A. Outra taxa. Art. 433-B. Mais uma. Art. 434. Fim. "
      + "Art. 355. Licença. Art. 356 - A licença será cassada. Art. 357. Ambulante. "
      + "Art. 366 – A. Novo. Art. 367. Fim.";
    const s = api.leiSepararColagem(t);
    const nums = s.partes.map((p) => p.num);
    ok(nums.slice(0, 4).join(",") === "433,433-A,433-B,434", "C1 433-A e 433-B têm o sufixo (antes: '433' três vezes): " + nums.join(","));
    ok(!api.leiSepSuspeitas(s.partes).slice(0, 4).some((m) => m.some((x) => x.k === "repetido")), "C1a sem falso 'repetido'");
    const t2 = "Art. 355. Licença. Art. 356 - A licença será cassada. Art. 357. Ambulante. Art. 366 – A. Novo. Art. 367. Fim.";
    const s2 = api.leiSepararColagem(t2);
    ok(s2.partes.map((p) => p.num + "=" + p.rotulo).join("|") === "355=Art. 355|356=Art. 356|357=Art. 357|366-A=Art. 366 – A|367=Art. 367",
       "C2 'Art. 356 - A licença' é o 356 (o A é palavra); 'Art. 366 – A.' é o 366-A: " + s2.partes.map((p) => p.num + "=" + p.rotulo).join("|"));
    /* rodapé da página antes do artigo: "…CEP 55.004-901 39 Art. 144-A. Salvo…" */
    const t3 = "Art. 144. Texto do artigo. Prefeitura de Caruaru - CEP 55.004-901 39 Art. 144-A. Salvo quando autorizado. Art. 145. Fim.";
    const s3 = api.leiSepararColagem(t3);
    ok(s3.partes.map((p) => p.num).join(",") === "144,144-A,145" && s3.partes[1].resgatado === true, "C3 o 144-A depois do rodapé (número da página) é achado: " + s3.partes.map((p) => p.num).join(","));
    /* a 2ª passada também não toma "A licença" por sufixo */
    const s4 = api.leiSepararColagem("Art. 355. Licença. Rodapé 12 Art. 356 - A licença será cassada. Art. 357. Fim.");
    ok(s4.partes.map((p) => p.num + "=" + p.rotulo).join("|") === "355=Art. 355|356=Art. 356|357=Art. 357", "C4 achado depois do rodapé: 'Art. 356 - A licença' é o 356: " + s4.partes.map((p) => p.num + "=" + p.rotulo).join("|"));
    /* "separar aqui" numa posição que não é começo de cabeçalho não faz nada */
    const t5 = "Art. 1º Um texto qualquer com palavras. Art. 2º Dois. Art. 3º Tres.";
    const s5 = api.leiSepararColagem(t5, { forcar: new Set([t5.indexOf("texto")]) });
    ok(s5.partes.length === 3, "C5 'forcar' fora de um cabeçalho é ignorado");
  }

  /* ---- 2d: o rodapé de página repetido (296 vezes no PDF do CTM) vai para linha própria ---- */
  {
    const { api } = rodar();
    const ROD = "Prefeitura de Caruaru - Praça Sen. Teotônio Vilela, S/N°, Centro, Caruaru/Pernambuco - CEP 55.004-901";
    const enche = (n) => " Texto do artigo que continua por muitas palavras para encher a página da lei municipal.".repeat(n);
    /* como no PDF: a página acaba no meio de uma frase qualquer (o que vem antes do rodapé varia) */
    let t = "", pag = 1, semRod = "";
    for (let a = 1; a <= 30; a++) {
      const art = "Art. " + a + "º" + enche(9) + " (Redação dada pela Lei Complementar nº 018, de 09 de outubro de 2009) e o prazo " + a + ". ";
      t += art;
      semRod += art;
      if (a % 3 === 0) t += " " + ROD + " " + (pag++) + " ";
    }
    const r = api.leiSepRodape(t);
    ok(r && r.frase === ROD && r.n === 10, "D1 acha o rodapé (com algarismos dentro: CEP) e não a 'Redação dada…' (sem número de página atrás): " + JSON.stringify(r && [r.frase, r.n]));
    ok(r.texto.replace(/\s+/g, " ").trim() === t.replace(/\s+/g, " ").trim(), "D1a só quebras de linha");
    const ls = r.texto.split("\n");
    ok(ls.filter((x) => x === ROD).length === 10 && ls.indexOf("1") > 0 && ls.indexOf("10") > 0, "D1b o rodapé e o número da página, cada um na sua linha");
    const s = api.leiSepararColagem(t);
    ok(s.rodape && s.rodape.n === 10 && s.partes.length === 30 && !s.partes.some((p) => p.texto.indexOf(ROD + " ") >= 0), "D2 a separação usa o rodapé já em linha própria");
    /* sem número de página em sequência, nada */
    ok(api.leiSepRodape(semRod) === null, "D3 'Redação dada pela…' repetida 30 vezes, sem número de página atrás, não é rodapé");
    ok(api.leiSepRodape("Art. 1º Curto. Art. 2º Curto.") === null, "D3a texto curto: nem procura");
  }

  /* ---- 3 e 4: a tela, na criação da lei ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = TXT;
    ok(api.leiGravar() === "pendente", "T0 salvar o texto numa linha só fica pendente");
    await espera();
    const c = api.leiSepCtxAtual();
    ok(api.$("dlgLeiSep").open === true && !!c, "T1 abre a conferência (não uma pergunta de sim/não)");
    const aviso = api.$("leiSepAviso").textContent;
    ok(/Encontrei um problema/.test(aviso) && /NUMA LINHA SÓ/.test(aviso) && /7 artigos/.test(aviso) && /Já separei/.test(aviso) && /Nenhuma palavra/.test(aviso), "T1a o aviso diz o problema, que já separou e que nada muda: " + aviso);
    ok(c.filtro === "conf" && api.$("btnLeiSepFConf").getAttribute("aria-pressed") === "true", "T2 começa nos pontos a conferir");
    const itens = () => (api.$("leiSepLista").children || []).filter((x) => /lei-sep-item/.test(x.className || ""));
    ok(itens().length === 2 && itens().every((x) => /conf/.test(x.className)), "T2a só os 2 pontos (salto e citação) — o repetido sozinho não entra: " + itens().map((x) => x.id).join());
    ok(/7 artigos · 2 ponto\(s\) para conferir · 0 juntado/.test(api.$("leiSepResumo").textContent), "T2b resumo: " + api.$("leiSepResumo").textContent);
    ok(/depois do art\. 3/.test(itens()[0].textContent) && /Faltam 1 artigo\(s\) entre o art\. 3 e este/.test(itens()[0].textContent), "T2c o salto explica o que olhar");
    /* juntar a citação ao anterior */
    api.$("btnLeiSepJuntar_4").onclick();
    ok(c.pular.size === 1 && /6 artigos · 1 ponto\(s\) para conferir · 1 juntado/.test(api.$("leiSepResumo").textContent) && api.$("btnLeiSepContinuar").textContent === "Continuar com 6 artigos",
       "T3 juntar ao anterior: menos um artigo, menos um ponto: " + api.$("leiSepResumo").textContent);
    ok(/junto/.test(api.$("leiSepItem_4").className) && /juntado ao Art\. 5º/.test(api.$("leiSepItem_4").textContent), "T3a o item mostra que foi juntado");
    api.$("btnLeiSepJuntar_4").onclick();
    ok(c.pular.size === 0, "T3b de novo = desfazer");
    api.$("btnLeiSepJuntar_4").onclick();
    /* o salto: está certo */
    api.$("btnLeiSepOk_3").onclick();
    ok(api.leiSepPendentes().length === 0 && api.$("btnLeiSepProx").disabled === true && /feito/.test(api.$("leiSepItem_3").className), "T4 'está certo' resolve o ponto");
    /* ir ao art. 6 e ver todos */
    ok(api.leiSepIrNumero("art. 6") === true && c.filtro === "todos" && c.alvo === 4 && /alvo/.test(api.$("leiSepItem_4").className), "T5 'ir ao art. 6' troca para todos e destaca o primeiro 6º");
    ok(api.leiSepIrNumero("99") === false && /não está entre/.test(api.$("leiSepMsg").textContent), "T5a número que não existe avisa");
    const pre = (api.$("leiSepLista").children || []).filter((x) => /Antes do art\. 1º/.test(x.textContent || ""));
    ok(pre.length === 1, "T5b na lista completa, o preâmbulo aparece antes do art. 1º");
    api.$("btnLeiSepMaior").onclick();
    ok(c.fonte === 19, "T5c letra maior");
    /* continuar: o texto separado (com a junção) vai para o editor e segue para os repetidos */
    api.$("btnLeiSepContinuar").onclick();
    await espera();
    const tx = api.$("leiTexto").value;
    ok(api.$("dlgLeiSep").open !== true && /seguinte redação: Art\. 6º O prazo é de dez dias\./.test(tx) && api.leiArtigos(tx).length === 6, "T6 continuar entrega o texto separado com a junção: " + api.leiArtigos(tx).length);
    /* juntada a citação, sobra um art. 6º só: sem repetido, a lei nasce direto */
    ok(api.$("dlgLeiDup").open !== true && api.leisLista().length === 1 && api.leiArtigos(api.leisLista()[0].texto).length === 6, "T6a sem repetido depois da junção, a lei nasce com 6 artigos");
  }

  /* "separar aqui": a redação nova do art. 366 ficou dentro da antiga (o caso do CTM) */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("D", "T");
    const T366 = "Art. 365. É proibido vender armas. Art. 366 – A concessão de licença será anual. Prefeitura de Caruaru - CEP 55.004-901 126 Art. 366. A concessão de licença será semestral. (Redação dada pela LC 18/2009) Art. 367. Fim.";
    api.$("leiTexto").value = T366;
    api.leiGravar();
    await espera();
    const c = api.leiSepCtxAtual();
    ok(c.sep.partes.map((p) => p.num).join(",") === "365,366,367" && api.leiSepPendentes().length === 1, "S0 premissa: o 2º art. 366 ficou dentro do 1º: " + c.sep.partes.map((p) => p.num).join(","));
    const b = api.$("btnLeiSepSeparar_1_0");
    ok(!!b && /separar em “Art\. 366”/.test(b.textContent), "S1 o artigo oferece 'separar em “Art. 366”'");
    b.onclick();
    ok(c.sep.partes.map((p) => p.num).join(",") === "365,366,366,367" && c.forcar.size === 1 && api.leiSepPendentes().length === 0, "S2 separado: agora são dois 366 e nada a conferir");
    ok(/separado por você/.test(api.$("leiSepItem_2").textContent) && /1 separado\(s\) por você/.test(api.$("leiSepResumo").textContent), "S2a o novo artigo diz que foi a pessoa que separou");
    api.$("btnLeiSepJuntar_2").onclick();
    ok(c.sep.partes.length === 3 && c.forcar.size === 0, "S3 'desfazer' no artigo separado volta ao que era");
    api.$("btnLeiSepSeparar_1_0").onclick();
    api.$("btnLeiSepContinuar").onclick();
    await espera();
    ok(api.$("dlgLeiDup").open === true && /\nArt\. 366\. A concessão de licença será semestral/.test(api.$("leiTexto").value), "S4 continuar leva a separação e segue para escolher entre os dois 366");
  }

  /* na tela: o artigo resgatado não é pendência; o aviso conta o rodapé */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("D", "T");
    api.$("leiTexto").value = "Art. 1º Esta Lei regula o sistema. TÍTULO I Disposição Geral Art. 2º O sistema é regido. TÍTULO II Competência Art. 3º Tributo é prestação. Art. 5º Fim, conforme o art. 4º.";
    api.leiGravar();
    await espera();
    ok(api.leiSepPendentes().length === 1, "V1 os dois resgatados ficam só informativos; pendente é o salto do 3 para o 5: " + api.leiSepPendentes().length);
    api.$("btnLeiSepVoltar").onclick();
    await espera();
    const ROD = "Prefeitura de Caruaru - Praça Sen. Teotônio Vilela, S/N°, Centro, Caruaru/Pernambuco - CEP 55.004-901";
    let t = "", pag = 1;
    for (let a = 1; a <= 30; a++) { t += "Art. " + a + "º" + " Texto do artigo que continua por muitas palavras para encher a página da lei.".repeat(9) + " e o prazo " + a + ". "; if (a % 3 === 0) t += ROD + " " + (pag++) + " "; }
    api.$("leiTexto").value = t;
    api.leiGravar();
    await espera();
    ok(/rodapé de página repetido 10 vezes/.test(api.$("leiSepAviso").textContent) && /Prefeitura de Caruaru/.test(api.$("leiSepAviso").textContent), "V2 o aviso conta que achou o rodapé e o pôs em linha própria: " + api.$("leiSepAviso").textContent);
    api.$("btnLeiSepVoltar").onclick();
    await espera();
  }

  /* voltar não mexe em nada; Esc também */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("D", "T");
    api.$("leiTexto").value = TXT;
    api.leiGravar();
    await espera();
    api.$("btnLeiSepVoltar").onclick();
    await espera();
    ok(api.$("leiTexto").value === TXT && api.leisLista().length === 0 && !api.leiSepCtxAtual(), "T7 voltar: texto intacto, nada criado");
  }

  /* lei grande: páginas de 40 e "próximo a conferir" anda pelos pontos */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("D", "T");
    let g = "";
    for (let i = 1; i <= 100; i++) if (i !== 30 && i !== 70) g += "Art. " + i + "º Texto do artigo " + i + ". ";
    api.$("leiTexto").value = g;
    api.leiGravar();
    await espera();
    const c = api.leiSepCtxAtual();
    ok(api.leiSepPendentes().length === 2, "P1 dois saltos (29→31 e 69→71)");
    api.$("btnLeiSepFTodos").onclick();
    const itens = () => (api.$("leiSepLista").children || []).filter((x) => /lei-sep-item/.test(x.className || ""));
    ok(itens().length === 40 && api.$("leiSepPag").hidden === false && /página 1 de 3/.test(api.$("leiSepPagTxt").textContent), "P2 40 por página: " + api.$("leiSepPagTxt").textContent);
    api.$("btnLeiSepPagProx").onclick();
    ok(c.pagina === 1 && itens()[0].id === "leiSepItem_40", "P3 página seguinte");
    api.leiSepProximo();
    ok(c.alvo === 29 && c.pagina === 0, "P4 'próximo a conferir' vai ao art. 31 (índice 29), na página certa");
    api.leiSepProximo();
    ok(c.alvo === 68 && c.pagina === 1, "P4a e depois ao art. 71");
    api.leiSepProximo();
    ok(c.alvo === 29, "P4b e volta ao primeiro");
    api.$("btnLeiSepContinuar").onclick();
    await espera();
    ok(api.leisLista().length === 1 && api.leiArtigos(api.leisLista()[0].texto).length === 98, "P5 sem repetidos, a lei nasce com os 98 artigos");
  }

  /* atualização: o mesmo aviso, dizendo que é antes da comparação */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2000", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres." });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "LC 1/2001";
    api.$("leiUpdTexto").value = "Art. 1º Um. Art. 2º Dois mudado. Art. 3º Tres.";
    api.leiAtualizarComparar();
    await espera();
    ok(api.$("dlgLeiSep").open === true && /texto novo/.test(api.$("leiSepAviso").textContent) && /antes da comparação/.test(api.$("leiSepAviso").textContent), "U1 na atualização o aviso fala do texto novo e da comparação");
    ok(api.leiSepCtxAtual().filtro === "todos", "U1a sem pontos a conferir, abre em todos os artigos");
    api.$("btnLeiSepContinuar").onclick();
    await espera();
    ok(api.$("leiUpdPasso2").hidden === false, "U2 continuar segue para a comparação");
  }

  /* textos nos dois idiomas */
  {
    const { api } = rodar();
    ["lei_sep_titulo", "lei_sep_aviso", "lei_sep_aviso_upd", "lei_sep_resumo", "lei_sep_f_conf", "lei_sep_f_todos", "lei_sep_prox", "lei_sep_ir_rot", "lei_sep_ir", "lei_sep_menor", "lei_sep_maior",
      "lei_sep_pag", "lei_sep_pag_ant", "lei_sep_pag_prox", "lei_sep_nada", "lei_sep_preambulo", "lei_sep_c_repetido", "lei_sep_c_salto", "lei_sep_c_citacao", "lei_sep_c_longo",
      "lei_sep_m_repetido", "lei_sep_m_salto", "lei_sep_m_citacao", "lei_sep_m_longo", "lei_sep_certo", "lei_sep_conferido", "lei_sep_juntar", "lei_sep_juntado", "lei_sep_desfazer",
      "lei_sep_ver_ant", "lei_sep_ver_tudo", "lei_sep_ver_menos", "lei_sep_nao_achou", "lei_sep_continuar", "lei_sep_voltar"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
    ok(api.t("lei_sep_conf") === "lei_sep_conf", "I2 a pergunta antiga saiu");
  }
  return falhas;
}

module.exports = { testes };
