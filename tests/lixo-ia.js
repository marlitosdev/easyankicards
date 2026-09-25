/* =====================================================================
 * SOBRAS DA IA (16.75.0)
 *
 * O que originou: no baralho real do NotebookLM, o botão "Corrigir erros"
 * converteu o **negrito** em <b>, mas deixou no cartão as citações "[1, 2]",
 * o "Exato!" de quem confirma a pergunta, uma lista com "*" e "1." dentro de
 * UMA linha "+" de 1514 caracteres, e 112 cartões de lacuna com
 * "(Fonte: arquivo.pdf, pág. 3)" dentro da frase que se estuda.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Citação [n], [n, m], [n-m] sai; "[MC]", "[...]" e números longos ficam.
 *  2. "Exato!" e companhia saem só onde são interjeição (começo, depois de
 *     "— " ou " :: "); "CERTO — ..." e "Certo ou errado: ...?" ficam.
 *  3. Lista com "*" (ou "1." "2.") numa linha "+" vira uma linha "+" por item;
 *     "2 * 3" e "Art. 1." ficam.
 *  4. "(Fonte: X)" sai do cartão e NADA se perde: vira "+ Fonte — X" depois
 *     das explicações do próprio cartão; lacunas ficam intactas.
 *  5. Idempotente, preserva CRLF, não mexe em texto limpo, não muda o número
 *     de cartões, e o detector só acende quando há o que corrigir.
 *  6. Entra na cadeia segura do "Corrigir erros" e nos detectores.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  const C = (s) => api.corrigirLixoIA(s);

  /* ---- L1: citacoes ---- */
  {
    ok(C("Q :: R [1, 2]") === "Q :: R" && C("Q :: R [3]") === "Q :: R" && C("Q :: R [3-5]") === "Q :: R" && C("Q :: R [1; 2]") === "Q :: R", `L1 citacoes: ${C("Q :: R [1, 2]")}`);
    ok(C("Q :: R [1, 2] e mais [7].") === "Q :: R e mais.", `L1a varias no mesmo texto: ${C("Q :: R [1, 2] e mais [7].")}`);
    ok(C("[MC] Pergunta? :: a | b * :: x") === "[MC] Pergunta? :: a | b * :: x", "L1b [MC] fica");
    ok(C("Q {{c1::[...]}} :: R") === "Q {{c1::[...]}} :: R" && C("Q :: ano [2024] de 1234 [1234]") === "Q :: ano [2024] de 1234 [1234]", "L1c [...] e numero de 4 digitos ficam");
  }

  /* ---- L2: interjeicoes ---- */
  {
    ok(C("+ Quantitativo — Exato! O artigo institui 16 tributos.") === "+ Quantitativo — O artigo institui 16 tributos.", `L2 depois de '— ': ${C("+ Quantitativo — Exato! O artigo institui 16 tributos.")}`);
    ok(C("+ Correto! O prazo é de 30 dias.") === "+ O prazo é de 30 dias.", "L2a no comeco da linha +");
    ok(C("Pergunta? :: Perfeito! A resposta.") === "Pergunta? :: A resposta.", "L2b no comeco da resposta");
    ok(C("Pergunta? :: Isso mesmo! A resposta.") === "Pergunta? :: A resposta." && C("Pergunta? :: Com certeza! Sim.") === "Pergunta? :: Sim.", "L2c outras formulas");
    const limpos = ["Pergunta? :: CERTO — porque o art. 5 diz isso.", "Certo ou errado: o prazo é de 30 dias? :: ERRADO — são 60.", "A resposta é exato! mas no meio da frase :: x", "A banca disse Exato! sobre isso :: x", "Exato :: sem exclamacao", "P :: Exato. Sem exclamacao"];
    limpos.forEach((s, i) => ok(C(s) === s, `L2d${i} nao devia mexer em: ${s} -> ${C(s)}`));
  }

  /* ---- L3: listas numa linha + ---- */
  {
    ok(C("+ Distribuição: * A * B * C") === "+ Distribuição:\n+ A\n+ B\n+ C", `L3 bullets: ${JSON.stringify(C("+ Distribuição: * A * B * C"))}`);
    ok(C("+ * A * B") === "+ A\n+ B", `L3a bullet logo no inicio: ${JSON.stringify(C("+ * A * B"))}`);
    ok(C("+ Lista: 1. Um 2. Dois 3. Três") === "+ Lista:\n+ Um\n+ Dois\n+ Três", `L3b numerada: ${JSON.stringify(C("+ Lista: 1. Um 2. Dois 3. Três"))}`);
    ok(C("+ Conta: 2 * 3 é 6") === "+ Conta: 2 * 3 é 6" && C("+ Art. 1. Da lei") === "+ Art. 1. Da lei" && C("+ Só 1. Um item") === "+ Só 1. Um item", "L3c '2 * 3', 'Art. 1.' e um item numerado so' ficam");
    ok(C("Pergunta * com asterisco :: resposta * outra") === "Pergunta * com asterisco :: resposta * outra", "L3d linha de cartao (nao +) nao e' separada");
    ok(C("+ Um\n+ Dois\n+ Tres") === "+ Um\n+ Dois\n+ Tres", "L3e linhas + normais ficam");
  }

  /* ---- L4: a fonte vira uma linha + ---- */
  {
    ok(C("P {{c1::x}} (Fonte: aula.pdf, pág. 3) :: obs") === "P {{c1::x}} :: obs\n+ Fonte — aula.pdf, pág. 3", `L4 fonte no cartao: ${JSON.stringify(C("P {{c1::x}} (Fonte: aula.pdf, pág. 3) :: obs"))}`);
    ok(C("P1 :: R1 (Fonte: A)\n+ Explica\n\nP2 :: R2") === "P1 :: R1\n+ Explica\n+ Fonte — A\n\nP2 :: R2", `L4a a fonte entra DEPOIS das explicacoes do cartao: ${JSON.stringify(C("P1 :: R1 (Fonte: A)\n+ Explica\n\nP2 :: R2"))}`);
    ok(C("P (Fonte: A) :: R (Fonte: B)") === "P :: R\n+ Fonte — A\n+ Fonte — B", `L4b duas fontes no mesmo cartao: ${JSON.stringify(C("P (Fonte: A) :: R (Fonte: B)"))}`);
    ok(C("P1 (Fonte: A) :: R1\nP2 (Fonte: B) :: R2") === "P1 :: R1\n+ Fonte — A\nP2 :: R2\n+ Fonte — B", `L4c cada cartao com a sua fonte: ${JSON.stringify(C("P1 (Fonte: A) :: R1\nP2 (Fonte: B) :: R2"))}`);
    ok(C("+ Origem — (Fonte: A)") === "+ Origem — (Fonte: A)", "L4d '(Fonte:' dentro de uma linha + nao e' mexido");
    ok(C("# comentario (Fonte: A)\n@ Titulo (Fonte: B)") === "# comentario (Fonte: A)\n@ Titulo (Fonte: B)", "L4e comentario e titulo nao sao mexidos");
    ok(C("P (fonte : A  B ) :: R") === "P :: R\n+ Fonte — A B", `L4f maiuscula, espacos: ${JSON.stringify(C("P (fonte : A  B ) :: R"))}`);
  }

  /* ---- L5: propriedades ---- */
  {
    const sujo = "@ T\nP {{c1::x}} (Fonte: a.pdf) :: obs [1]\n+ Exato! Isso: * A * B\n\nQ :: R";
    const uma = C(sujo);
    ok(C(uma) === uma, `L5 idempotente: ${JSON.stringify(uma)}`);
    ok(C(sujo.replace(/\n/g, "\r\n")) === uma.replace(/\n/g, "\r\n"), "L5a preserva CRLF");
    const limpo = "@ T\nP :: R\n+ Ok\n\nQ {{c1::x}} :: y\n";
    ok(C(limpo) === limpo && C("") === "" && C("\n\n") === "\n\n", "L5b texto limpo (e vazio) fica IDENTICO, inclusive linhas em branco no fim");
    ok(api.parseText(uma).cards.length === api.parseText(sujo).cards.length, "L5c o numero de cartoes nao muda");
    ok(!api.temLixoIA(uma) && api.temLixoIA(sujo) && !api.temLixoIA(limpo), "L5d o detector acende so' quando ha sobra, e apaga depois de corrigir");
    ["Q :: R [1]", "+ Exato! x", "P (Fonte: A) :: R", "+ x * y", "+ Lista 1. a 2. b"].forEach((s, i) => ok(api.temLixoIA(s) && C(s) !== s, `L5e${i} detector e corretor concordam em: ${s}`));
    ["Q :: R", "+ 2 * 3", "+ Origem (Fonte: A)", "CERTO — sim"].forEach((s, i) => ok(!api.temLixoIA(s), `L5f${i} detector nao acende em: ${s}`));
  }

  /* ---- L6: o cartao real (o de 1514 caracteres do NotebookLM) ---- */
  {
    const real = "@ CTM de Caruaru — Quantidade total do art. 236\nQuantos tributos municipais no total são criados pelo artigo 236 do CTM de Caruaru? :: competencia, ctm_caruaru, tributos_municipais\n"
      + "+ Quantitativo global — 16 tributos. Exato! O <b>artigo 236 do Código Tributário Municipal (CTM) de Caruaru</b> institui <b>16 tributos no total</b> [1, 2]. A distribuição do quantitativo global de 16 tributos estrutura-se em [1, 2]: * <b>3 Impostos</b> [1, 2]: * <b>ISS</b> — Imposto Sobre Serviços de Qualquer Natureza [3, 4] * <b>IPTU</b> — Imposto sobre a Propriedade Predial e Territorial Urbana [3, 4] * <b>11 Taxas</b> [1]: * <b>9 Taxas em razão do Poder de Polícia</b> [1, 6]: 1. Taxa de Fiscalização para Localização e Funcionamento (TLF) [6] 2. Taxa de Fiscalização Sanitária [6] 3. Taxa de Licenciamento Ambiental (TLA) [1, 6] * <b>2 Contribuições</b> [1]";
    const r = C(real);
    const l = r.split("\n");
    ok(!/\[\d/.test(r) && !/Exato!/.test(r) && !/\s\*\s/.test(r), `L6 sobrou lixo no cartao real: ${r.slice(0, 200)}`);
    ok(l[0] === "@ CTM de Caruaru — Quantidade total do art. 236" && /^Quantos tributos municipais/.test(l[1]), "L6a o titulo e a pergunta ficam como estavam");
    ok(l[2] === "+ Quantitativo global — 16 tributos. O <b>artigo 236 do Código Tributário Municipal (CTM) de Caruaru</b> institui <b>16 tributos no total</b>. A distribuição do quantitativo global de 16 tributos estrutura-se em:", `L6b a primeira linha + ficou limpa: ${l[2]}`);
    ok(l.length >= 12 && l.slice(2).every((x) => /^\+ \S/.test(x)), `L6c virou uma linha + por item: ${l.length} linhas`);
    ok((r.match(/<b>/g) || []).length === (real.match(/<b>/g) || []).length, "L6d nenhum negrito se perdeu");
    ok(!/^\+ \d{1,2}\.\s/m.test(r) && l.indexOf("+ Taxa de Fiscalização Sanitária") >= 0 && l.indexOf("+ Taxa de Licenciamento Ambiental (TLA)") >= 0, "L6d2 a numeracao \"1.\" saiu do inicio das linhas, mas o texto de cada item ficou");
    ["ISS", "IPTU", "Taxa de Licenciamento Ambiental (TLA)", "Taxa de Fiscalização Sanitária"].forEach((w) => ok(r.indexOf(w) >= 0, `L6e o conteudo '${w}' se perdeu`));
    ok(api.parseText(r).cards.length === 1 && /Taxa de Fiscalização Sanitária/.test(api.parseText(r).cards[0].more), "L6f continua sendo UM cartao, com a explicacao inteira no saiba mais");
  }

  /* ---- L9: "*" abaixo do cartao e' explicacao VALIDA (o app aceita * e +): nao e' sobra da IA ---- */
  {
    ok(C("Q :: A :: t\n\n* Esquema — X") === "Q :: A :: t\n\n* Esquema — X" && C("Q :: A\n* Esquema — X") === "Q :: A\n* Esquema — X", "L9 o corretor de sobras nao mexe na explicacao escrita com *");
    ok(!api.temLixoIA("Q :: A\n\n* Esquema — X") && !api.temLixoIA("Q :: A\n* Esquema — X"), "L9a e o detector nao acende (senao um baralho inteiro com * viraria erro)");
  }

  /* ---- L11: o botao "Corrigir erros" NAO pode ficar bloqueado por causa de "+" repetido ----
   * A trava "nao perder saiba mais" cancelava a correcao inteira quando ela tirava "+" repetido/redundante
   * (o proprio pedido). A previa voltava igual, o botao "nao finalizava" e nada era corrigido. */
  {
    const txt = [
      "@ Impostos", "Quais os 3 impostos do artigo 236? :: ISS, IPTU e ITBI, conforme o artigo 236 do CTM de Caruaru. :: ctm",
      "+ Espécies — ISS, IPTU e ITBI.", "+ Também cobrado — Estão instituídos 3 impostos municipais.", "+ Quantidade — 3 impostos.",
      "+ Também cobrado — Estão instituídos 3 impostos.", "+ Quantidade — 3 impostos.", "",
      "Outra pergunta? :: Outra resposta longa o suficiente. :: ctm", "+ Nota — a", "+ Nota — a", ""].join("\n");
    const fn = api.correcaoDeTudo(txt);
    ok(fn && fn.reduzSaibaMais === true, "L11 a correcao composta que tira '+' de proposito avisa a trava");
    ok(api.resumoTexto(fn(txt)).saibaMais < api.resumoTexto(txt).saibaMais, "L11a (o teste so' vale se a correcao de fato reduz os '+')");
    ok(api.corrigirComSeguranca(fn, txt, true) === fn(txt), "L11b a PREVIA do botao mostra a correcao (nao devolve o texto igual)");
    ok(api.corrigirComSeguranca(fn, txt, false) === fn(txt), "L11c aplicar de verdade tambem passa pela trava");
    /* as OUTRAS travas continuam valendo */
    const perdeCartao = (t0) => t0.split("\n\n")[0];
    ok(api.corrigirComSeguranca(perdeCartao, txt, true) === txt, "L11d a trava de CARTOES continua bloqueando");
    const perdeMais = (t0) => t0.split("\n").filter((l) => !/^\+/.test(l)).join("\n");
    ok(api.corrigirComSeguranca(perdeMais, txt, true) === txt, "L11e uma correcao qualquer que apague '+' sem avisar continua bloqueada");
    const perdeTag = (t0) => t0.replace(/ :: ctm/g, "");
    ok(api.corrigirComSeguranca(perdeTag, txt, true) === txt, "L11f a trava de ETIQUETAS continua bloqueando");
    const comReduz = Object.assign((t0) => t0.split("\n").filter((l) => !/^\+ Nota/.test(l)).join("\n"), { reduzSaibaMais: true });
    ok(api.corrigirComSeguranca(comReduz, txt, true) !== txt, "L11g quem avisa que reduz '+' passa");
    const cartaoSome = Object.assign((t0) => t0.split("\n\n")[0], { reduzSaibaMais: true });
    ok(api.corrigirComSeguranca(cartaoSome, txt, true) === txt, "L11h avisar que reduz '+' NAO libera perder cartao");
    /* reforcos: cada peca da composta, e a trava de aplicar */
    ok(api.corrigirComSeguranca(perdeMais, txt, false) === txt, "L11k aplicar de verdade: '+' apagado sem aviso continua bloqueado");
    const so1 = "Pergunta? :: Resposta longa o bastante para o cartao. :: t\n+ Nota — a\n+ Nota — a\n";
    const fSo1 = api.correcaoDeTudo(so1);
    ok(fSo1 && fSo1.name === "corrigirMaisRepetido" && fSo1.reduzSaibaMais === true, "L11l so' 'linha repetida' na composta: tambem libera (e' limpeza)");
    const so2 = "Alfa beta :: Gama delta epsilon zeta eta teta iota kappa lambda mi ni ksi omicron pi ro sigma. :: t\n+ Espécie — Gama delta epsilon.\n+ Também cobrado — Gama delta epsilon zeta eta.\n";
    const fSo2 = api.correcaoDeTudo(so2);
    ok(fSo2 && fSo2.name === "corrigirLixoIA" && fSo2.reduzSaibaMais === true && api.resumoTexto(fSo2(so2)).saibaMais < api.resumoTexto(so2).saibaMais, "L11m so' 'Tambem cobrado redundante' na composta: libera por causa do corretor de lixo da IA");
    const so3 = "Pergunta ,sem espaco  duplo :: Resposta longa o bastante para o cartao ,ok. :: t\n";
    const fSo3 = api.correcaoDeTudo(so3);
    ok(fSo3 && fSo3.name === "corrigirEspacos" && !fSo3.reduzSaibaMais, "L11n correcao que nao tira '+' NAO ganha a liberacao");
    const sem = "Pergunta um? :: Resposta um\n\nPergunta dois? :: Resposta dois";
    const soma = Object.assign((t0) => t0.split("\n\n")[0], { reduzSaibaMais: true });
    ok(api.resumoTexto(soma(sem)).cartoes < api.resumoTexto(sem).cartoes && api.corrigirComSeguranca(soma, sem, true) === sem, "L11o (sem etiquetas) avisar que reduz '+' NAO libera perder cartao");
    /* a tela de ponta a ponta: o botao abre com a correcao e aplica */
    api.$("editor").value = txt;
    api.preview();
    ok(api.$("btnNormalizar").disabled === false, "L11i o botao esta ativo");
    api.$("btnNormalizar").onclick();
    api.$("btnNormAplicar").onclick();
    const v = api.$("editor").value;
    ok(v !== txt && (v.match(/^\+/gm) || []).length === 4 && !/Nota — a\n\+ Nota — a/.test(v), "L11j apertar 'Corrigir erros' e aplicar realmente limpa o texto: " + (v.match(/^\+/gm) || []).length + " linhas +");
  }

  /* ---- L10: "Também cobrado" que so repete o cartao ---- */
  {
    /* reforcos: numero novo e' fato novo; palavra de ligacao nao conta; o detector acende */
    ok(C("Prazo do recurso? :: O prazo é de 60 dias contados da ciência.\n+ Também cobrado — O prazo é de 30 dias contados da ciência.") === "Prazo do recurso? :: O prazo é de 60 dias contados da ciência.\n+ Também cobrado — O prazo é de 30 dias contados da ciência.", "L10x outro NUMERO, outro fato: fica, mesmo repetindo as palavras");
    ok(C("Alfa beta :: gama para com por\n+ Também cobrado — tributos para com por") === "Alfa beta :: gama para com por\n+ Também cobrado — tributos para com por", "L10y palavras de ligacao repetidas nao bastam para dizer que e' a mesma coisa");
    ok(api.temLixoIA("Q :: Estão instituídos 3 impostos municipais.\n+ Também cobrado — Estão instituídos 3 impostos municipais.") && !api.temLixoIA("Q :: A resposta\n+ Também cobrado — outra coisa totalmente diferente"), "L10z o detector acende para o redundante e nao para o novo");
    const base = "Quantos impostos estão no art. 236? :: Estão instituídos 3 impostos municipais. :: t\n";
    ok(C(base + "+ Quantidade — 3 impostos.\n+ Também cobrado — Estão instituídos 3 impostos municipais.") === base + "+ Quantidade — 3 impostos.", `L10 repete a propria resposta: sai: ${JSON.stringify(C(base + "+ Quantidade — 3 impostos.\n+ Também cobrado — Estão instituídos 3 impostos municipais."))}`);
    ok(C(base + "+ Também cobrado — São instituídos 16 tributos no total, entre impostos, taxas e contribuições.") === base + "+ Também cobrado — São instituídos 16 tributos no total, entre impostos, taxas e contribuições.", "L10a informacao NOVA fica");
    const dup = base + "+ Também cobrado — São instituídos 16 tributos no total.\n+ Também cobrado — Estão instituídos 16 tributos ao todo.\n+ Também cobrado — São 16 tributos no total instituídos.";
    ok((C(dup).match(/Também cobrado/g) || []).length === 1, `L10b as versoes do MESMO fato novo ficam uma vez so': ${JSON.stringify(C(dup))}`);
    ok(C(base + "+ Nota — a\n+ Nota — a") === base + "+ Nota — a", "L10c linha + identica repetida no mesmo cartao sai");
    ok(C("Alfa :: Beta gama\n+ Também cobrado — Beta gama\n\nDelta :: Épsilon zeta\n+ Também cobrado — Beta gama") === "Alfa :: Beta gama\n\nDelta :: Épsilon zeta\n+ Também cobrado — Beta gama", "L10d cada cartao e' comparado so' com o PROPRIO texto");
    ok(C("+ Também cobrado — X sozinho") === "+ Também cobrado — X sozinho", "L10e sem cartao acima nao ha o que comparar");
    /* o cartao real do relatorio: 9 linhas + com 4 'Tambem cobrado' que repetem o que ja esta dito */
    const real = "@ Impostos de Caruaru — Espécies\nQuais são os 3 impostos municipais previstos no artigo 236 do CTM de Caruaru? :: O Imposto Sobre Serviços de Qualquer Natureza (ISS), o Imposto sobre a Propriedade Predial e Territorial Urbana (IPTU) e o Imposto sobre a Transmissão Inter Vivos de Bens Imóveis (ITBI). :: ctm_caruaru, impostos\n+ Espécies — ISS, IPTU e ITBI.\n+ Também cobrado — Estão instituídos 3 impostos municipais.\n+ Quantidade — 3 impostos.\n+ Também cobrado — São instituídos no total 16 tributos.\n+ Total — 16 tributos.\n+ Também cobrado — Estão instituídos 3 impostos.\n+ Quantidade — 3 impostos municipais.\n+ Também cobrado — Estão instituídos 16 tributos ao todo.\n+ Totalidade — 16 tributos.";
    const rr = C(real).split("\n");
    ok(rr.filter((x) => /Também cobrado/.test(x)).length === 1 && /16 tributos/.test(rr.join(" ")) && rr.length <= 8, `L10f o cartao real caiu de 9 linhas + para ${rr.length - 2}: ${JSON.stringify(rr.slice(2))}`);
    ok(/Espécies — ISS, IPTU e ITBI\./.test(rr.join("\n")) && /Quantidade — 3 impostos\./.test(rr.join("\n")) && /Total — 16 tributos\./.test(rr.join("\n")), "L10g as linhas com 'Termo — explicacao' propria ficam");
  }

  /* ---- L7: na cadeia de "Corrigir erros" ---- */
  {
    const sujo = "P {{c1::x}} (Fonte: a.pdf) :: obs [1]\n+ Exato! Isso: * A * B";
    const f = api.correcaoDeTudo(sujo);
    ok(typeof f === "function" && /corrigirLixoIA/.test(f.name), `L7 entra na cadeia do Corrigir erros: ${f && f.name}`);
    const novo = f(sujo);
    ok(!api.temLixoIA(novo) && /\+ Fonte — a\.pdf/.test(novo), "L7a a correcao aplicada limpa tudo e guarda a fonte");
    ok(api.detectoresAtivos(sujo).indexOf("lixo_ia") >= 0 && api.detectoresAtivos(novo).indexOf("lixo_ia") < 0, "L7b o painel de detectores mostra lixo_ia e apaga depois");
    ok(api.correcaoDeTudo("P :: R\n+ Ok") === null, "L7c texto limpo: nada a corrigir (o botao continua 'Nada a corrigir')");
  }

  /* ---- L8: textos ---- */
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok((src.match(/"crit_lixo_ia"/g) || []).length === 2 && (src.match(/"fix_lixo_ia"/g) || []).length === 2 && (src.match(/"fixg_lixo_ia"/g) || []).length === 2, "L8 os textos existem em PT e EN");
    const app = fs.readFileSync(path.join(__dirname, "..", "docs", "app.js"), "utf8");
    ok(/\[temLixoIA, corrigirLixoIA\]/.test(app) && /\[temLixoIA, "crit_lixo_ia", "fix_lixo_ia", corrigirLixoIA/.test(app), "L8a esta na cadeia segura e na lista de correcoes da tela");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`lixo-ia: ok (${f.quantas} verificacoes)`);
  });
}
