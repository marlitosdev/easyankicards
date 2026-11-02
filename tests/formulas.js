/* =====================================================================
 * FÓRMULAS NO RESUMO (19.65.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  F1 o LaTeX copiado da IA ($…$, $$…$$, \(…\)) vira símbolos: ¬ ∧ ∨ → ↔ ≡ ∀ ∃ ∈ ℝ ⊻ ⊕;
 *  F2 "$$ … $$" sozinha na linha vira um bloco centralizado; \text{…} vira texto;
 *  F3 fração, expoente, índice, raiz, barra e combinação viram HTML (não código);
 *  F4 nada do resto muda: "R$ 100,00", marcas "==…==", itálico e negrito continuam;
 *  F5 o pedido de resumo à IA pede símbolos em vez de LaTeX.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  const txt = (h) => String(h).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  const H = (s) => api.matParaHtml(s);
  const R = String.raw;

  ok(txt(H(R`Identidade ($p \leftrightarrow p$).`)) === "Identidade (p ↔ p).", "F1a bicondicional: " + txt(H(R`Identidade ($p \leftrightarrow p$).`)));
  ok(txt(H(R`Não contradição: $\sim(p \wedge \sim p)$`)) === "Não contradição: ~(p ∧ ~p)", "F1b negação gruda: " + txt(H(R`Não contradição: $\sim(p \wedge \sim p)$`)));
  ok(/∃ x ∈ ℝ \| x \+ 2 = 5/.test(txt(H(R`como $\exists x \in \mathbb{R} \mid x + 2 = 5$`))), "F1c quantificador e conjunto");
  ok(/Símbolo ⊻ \(ou ⊕\)/.test(txt(H(R`Símbolo $\underline{\vee}$ (ou $\oplus$).`))), "F1d disjunção exclusiva");
  ok(/∧ \(também &, ∩\)/.test(txt(H(R`$\wedge$ (também $\&$, $\cap$)`))), "F1e & escapado e interseção: " + txt(H(R`$\wedge$ (também $\&$, $\cap$)`)));
  ok(/\(= e não\)/.test(txt(H(R`"nem" ($= \text{e não}$)`))), "F1f \\text dentro da fórmula");
  ok(txt(H(R`a \(p \rightarrow q\) b`)) === "a p → q b", "F1g \\( \\) também: " + txt(H(R`a \(p \rightarrow q\) b`)));

  const bl = H(R`$$\sim(\text{Todo A é B}) \equiv \text{Algum A não é B}$$`);
  ok(/^<div class="mt-bloco">/.test(bl) && txt(bl) === "~(Todo A é B) ≡ Algum A não é B", "F2 bloco centralizado com texto: " + bl);
  ok(/data-l="0"/.test(api.matParaHtml(R`$$p \vee q$$`, null, { comLinhas: true })), "F2b o bloco guarda a linha (leitura/edição)");

  const est = H(R`$\bar{x} = \frac{\sum_{i=1}^{n} x_i}{n}$ e $\sigma = \sqrt{\frac{\sum (x_i - \mu)^2}{N}}$ e $\binom{n}{k}$ e $2^{n-1}$`);
  ok(/class="mt-barra">x</.test(est) && /class="mt-frac"/.test(est) && /Σ<sub>i=1<\/sub><sup>n<\/sup>/.test(est), "F3a média: barra, fração, somatório com limites: " + est);
  ok(/√<span class="mt-raiz">/.test(est) && /σ/.test(est) && /μ\)<sup>2<\/sup>/.test(est), "F3b desvio: raiz, letras gregas, expoente");
  ok(/mt-binom/.test(est) && /2<sup>n-1<\/sup>/.test(est), "F3c combinação e expoente composto");
  ok(!/\\(frac|sum|sqrt|bar|binom)/.test(est), "F3d nenhum comando cru sobra");

  const misto = H(R`Custa R$ 100,00 e R$50 cada; ==importante $p \wedge q$== aqui _itálico_ e **negrito**; US$ 5 e $ 3.`);
  ok(/R\$ 100,00 e R\$50/.test(misto) && /US\$ 5 e \$ 3\./.test(misto), "F4a dinheiro não vira fórmula: " + misto);
  ok(/<mark[^>]*>importante <span class="mt">p ∧ q<\/span><\/mark>/.test(misto), "F4b fórmula dentro da marca");
  ok(/<i>itálico<\/i>/.test(misto) && /<b>negrito<\/b>/.test(misto), "F4c itálico e negrito continuam");
  ok(!/<sub>/.test(H("o arquivo meu_arquivo_final e a_b")), "F4d '_' fora de fórmula não vira índice");
  ok(txt(H(R`Tabela: $V \rightarrow F = F$`)) === "Tabela: V → F = F", "F4e linha de tabela-verdade");

  api.setLanguage("pt");
  const pr = api.riaPrompt({ topico: "Lógica", disciplina: "RL", prof: "padrao" });
  ok(/não use LaTeX/.test(pr) && /¬/.test(pr) && /↔/.test(pr), "F5 o pedido de resumo pede símbolos em vez de LaTeX");

  /* ---- (19.66.0) I: "*texto*" é itálico, não negrito quebrado ---- */
  const it = H(`* Frases interrogativas (*"Qual é a sua idade?"*) e **negrito** e ==*caiu na prova==`);
  ok(/<i>"Qual é a sua idade\?"<\/i>/.test(it) && /<b>negrito<\/b>/.test(it) && /m-prova/.test(it), "I1 *texto* vira itálico; negrito e marca de prova continuam: " + it);
  ok(!api.matLinhaTorta(`* Frases interrogativas (*"Qual é a sua idade?"*).`), "I2 itálico com asterisco não é 'marcação torta'");
  ok(api.matLinhaTorta("**Titulo:*") && api.matLinhaTorta("*Titulo:**"), "I3 asterisco perdido continua sendo defeito");
  const cl = api.matConsertarLinha(`Paradoxos (*"Esta frase é falsa"* ou **Titulo:*)`);
  ok(/\(\*"Esta frase é falsa"\* ou \*\*Titulo:\*\*\)/.test(cl.nova), "I4 o conserto mexe só no negrito quebrado, não no itálico: " + cl.nova);

  /* ---- (19.66.0) C: converter LaTeX em texto com símbolos (para gravar) ---- */
  const conv = (l) => api.matTexConverterLinha(l);
  ok(conv(R`Identidade ($p \leftrightarrow p$).`).nova === "Identidade (p ↔ p).", "C1 inline vira símbolos");
  ok(conv(R`$$\sim(p \wedge q) \equiv \sim p \vee \sim q$$`).nova === "~(p ∧ q) ≡ ~p ∨ ~q", "C2 bloco vira a linha com símbolos");
  ok(conv(R`$$\text{Linhas} = 2^n$$`).nova === "Linhas = 2ⁿ" && conv(R`alterna de $2^{n-1}$`).nova === "alterna de 2ⁿ⁻¹" && conv(R`$x_i$ e $x_{10}$`).nova === "xᵢ e x₁₀", "C3 expoente e índice curtos viram ² ⁿ ᵢ: " + conv(R`alterna de $2^{n-1}$`).nova);
  ok(conv(R`$\exists x \in \mathbb{R} \mid x + 2 = 5$`).nova === "∃ x ∈ ℝ | x + 2 = 5" && conv(R`$\underline{\vee}$ e $\&$`).nova === "⊻ e &", "C4 conjuntos, ⊻ e &");
  const fr = conv(R`Média $\bar{x} = \frac{\sum x}{n}$ e $p \wedge q$`);
  ok(/\$\\bar\{x\} = \\frac\{\\sum x\}\{n\}\$/.test(fr.nova) && /e p ∧ q/.test(fr.nova) && fr.mant === 1 && fr.conv === 1, "C5 fração fica em LaTeX (desenhada), o resto converte: " + fr.nova);
  ok(conv("Custa R$ 100,00 e $ 3.").nova === "Custa R$ 100,00 e $ 3." && conv("Custa R$ 100,00 e $ 3.").conv === 0, "C6 dinheiro não é fórmula");
  const tt = api.matTexConverterTexto([R`linha $p \vee q$`, "sem fórmula", R`$$\frac{a}{b}$$`].join("\n"));
  ok(tt.itens.length === 1 && tt.itens[0].linha === 0 && tt.mant === 1 && /linha p ∨ q\nsem fórmula\n\$\$\\frac/.test(tt.texto), "C7 o texto inteiro: lista o que muda e conta o que fica");

  /* (19.66.0) H — colar página com fórmula desenhada: conferido no navegador (o ambiente de teste não tem o leitor de HTML) */
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
