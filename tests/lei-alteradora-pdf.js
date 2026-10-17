/* =====================================================================
 * LEIS QUE ALTERAM O CTM DE CARUARU, COLADAS DO PDF (v18.65.0)
 *
 * Os PDFs reais (LC 95/2022, LC 112/2023, LC 145/2024), colados numa linha
 * só, mostraram três defeitos do leitor de "lei que altera" — e o pior deles
 * contaminaria a lei:
 *  1. "§ 2º REVOGADO Art. 4º A Lei Complementar…" — o art. 4º da própria LC
 *     95 não era visto (sem pontuação antes); a contagem dos artigos
 *     próprios parava, e os arts. 5º a 28º (cada um uma ordem "O art. 279 …
 *     passa a vigorar…") viravam ALTERAÇÕES dos arts. 5 a 28 do CTM;
 *  2. "Art. 356. A - São responsáveis…" (LC 145) é o art. 356-A: o hífen
 *     depois da letra não era aceito, e 356-A…356-S viravam todos "356";
 *  3. a aspa que fecha o texto citado vinha como “ (LC 112) e ficava no
 *     texto; e o "- " de "356. A -" sobrava no começo do caput.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const ALVO = { id: "ctm", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009",
    texto: ["Art. 5º Texto do art. 5.", "Art. 6º Texto do art. 6.", "Art. 91. O pagamento parcelado poderá ser concedido, competindo:", "I - à Secretaria de Finanças;", "II - à Procuradoria Geral do Município.",
      "Art. 96. Durante o parcelamento, serão devidos:", "I. juros de 1% ao mês;", "II. atualização monetária nos mesmos índices.",
      "Art. 279. Multa por infração.", "§ 1º A multa é de 10 UFMs.", "Art. 356. A licença será cassada."].join("\n") };

  /* ---- 1: LC 95/2022 ---- */
  {
    const { api } = rodar();
    const LC95 = "LEI COMPLEMENTAR Nº 95, DE 28 DE SETEMBRO DE 2022. Altera Lei Complementar nº 015, 05 de janeiro de 2009. "
      + "Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações: \"Art. 96. [ ... ] II - a atualização monetária será calculada com base no IPCA; (NR) "
      + "Art. 2º Revoga-se o § 2º do art. 248. Art. 3º A Lei Complementar nº 015 passa a vigorar com as seguintes alterações: Art. 274. [...] § 1º Multa nova. (NR) § 2º REVOGADO "
      + "Art. 4º A Lei Complementar nº 015 de 05 de janeiro 2009 passa a vigorar acrescido dos seguintes artigos: Art. 276-B A Secretaria da Fazenda poderá aplicar regime especial. (AC) "
      + "Art. 5º O art. 279, §1º da Lei Complementar nº 015, de 05 de janeiro de 2009, passa a vigorar com a seguinte redação: Art. 279 [...] § 1º A multa é de 25 UFMs. (NR) "
      + "Art. 6º O art. 295 da Lei Complementar nº 015 passa a vigorar acrescido do inciso III: Art. 295 [...] III - novo inciso. (AC) "
      + "Art. 7º Esta Lei Complementar entra em vigor na data de sua publicação.";
    const par = api.leiLerAlteradora(LC95, ALVO);
    const nums = par.blocos.map((b) => b.num);
    ok(nums.indexOf("5") < 0 && nums.indexOf("6") < 0 && nums.indexOf("7") < 0, "A1 os arts. 5º, 6º e 7º da PRÓPRIA LC 95 não viram alterações dos arts. 5, 6 e 7 do CTM: " + nums.join(","));
    ok(nums.join(",") === "96,274,276-B,279,295" && par.proprios === 7, "A1a os alvos certos e os 7 artigos próprios: " + nums.join(",") + " / " + par.proprios);
    const itens = api.leiItensDaAlteradora(ALVO, par);
    const i279 = itens.find((x) => x.num === "279");
    ok(i279 && i279.tipo === "mudou" && /25 UFMs/.test(i279.novo) && !/10 UFMs/.test(i279.novo), "A1b o art. 279 do CTM recebe o § 1º novo");
    ok(!itens.some((x) => x.num === "5" || x.num === "6"), "A1c os arts. 5 e 6 do CTM ficam intactos");
  }
  /* ---- 1b: o art. 4º da própria lei realmente perdido (grudado depois de palavra minúscula): a ORDEM salva o 5º,
   * e a contagem segue do 5º (o 6º, que não é ordem, continua próprio) ---- */
  {
    const { api } = rodar();
    const t = "Art. 1º A Lei Complementar nº 015 passa a vigorar com as seguintes alterações: “Art. 96. [...] II - índice novo; (NR)” "
      + "Art. 2º Revoga-se o art. 248. Art. 3º A Lei Complementar nº 015 passa a vigorar com as alterações: “Art. 274. [...] § 1º Multa. (NR)” texto revogado Art. 4º acrescido. "
      + "Art. 5º O art. 279, §1º da Lei Complementar nº 015 passa a vigorar com a seguinte redação: “Art. 279 [...] § 1º A multa é de 25 UFMs. (NR)” "
      + "Art. 6º Ficam convalidados os atos praticados até hoje. Art. 7º Esta Lei Complementar entra em vigor na data de sua publicação.";
    const par = api.leiLerAlteradora(t, ALVO);
    const nums = par.blocos.map((b) => b.num);
    ok(nums.join(",") === "96,274,279", "A2 com o 4º perdido, os arts. 5º e 6º da própria lei não viram alterações do CTM: " + nums.join(","));
  }
  /* ---- 1c: artigo CITADO cujo texto fala em "passa a vigorar" continua sendo alteração (número longe na sequência) ---- */
  {
    const { api } = rodar();
    const t = "Art. 1º A Lei nº 1 passa a vigorar com as seguintes alterações: “Art. 50. A Lei nº 9 passa a vigorar com prazo maior. (NR)” Art. 2º Esta Lei entra em vigor na data de sua publicação.";
    const par = api.leiLerAlteradora(t, { nome: "Lei 1/2000", texto: "Art. 50. A Lei nº 9 vale." });
    ok(par.blocos.map((b) => b.num).join(",") === "50", "A3 'Art. 50. A Lei nº 9 passa a vigorar…' citado continua sendo alteração: " + par.blocos.map((b) => b.num).join(","));
  }

  /* ---- 2: LC 145/2024 — "Art. 356. A - São…" ---- */
  {
    const { api } = rodar();
    const LC145 = "LEI COMPLEMENTAR Nº 145, DE 23 DE DEZEMBRO DE 2024 Altera a Lei Complementar nº 15. Art. 1º A Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações: "
      + "“ Art. 356. (Revogado) Art. 356. A - São responsáveis pelo pagamento da Taxa: (AC) I - as pessoas que promovam eventos; (AC) "
      + "Art. 356. B - São solidariamente obrigados pelo pagamento da Taxa: (AC) I - o proprietário do imóvel. (AC) Art. 2º Esta Lei entra em vigor na data de sua publicação.";
    const par = api.leiLerAlteradora(LC145, ALVO);
    ok(par.blocos.map((b) => b.num).join(",") === "356,356-A,356-B", "B1 'Art. 356. A -' é o 356-A (antes: três '356'): " + par.blocos.map((b) => b.num).join(","));
    const itens = api.leiItensDaAlteradora(ALVO, par);
    const a = itens.find((x) => x.num === "356-A");
    ok(itens.find((x) => x.num === "356").tipo === "revogado" && a && a.tipo === "novo", "B1a 356 revogado, 356-A novo");
    ok(a && /^Art\. 356-A\. São responsáveis/.test(a.novo), "B2 o caput do 356-A sem o '- ' que separava a letra: " + (a && a.novo.slice(0, 50)));
  }

  /* ---- 3: LC 112/2023 — a aspa que fecha vem como “ ---- */
  {
    const { api } = rodar();
    const LC112 = "LEI COMPLEMENTAR Nº 112, DE 09 DE JUNHO DE 2023 Altera dispositivos da Lei Complementar nº 015. Art. 1º A Lei Complementar nº 015, de 05 de janeiro de 2009, passa a vigorar com as seguintes alterações: "
      + "“Art. 91 [...] II. à Procuradoria-Geral do Município, quando o crédito estiver inscrito em Dívida Ativa.” (NR) Art. 2º Esta Lei entra em vigor na data de sua publicação.";
    const LC112b = LC112.replace("Dívida Ativa.” (NR)", "Dívida Ativa.“ (NR)");
    const par = api.leiLerAlteradora(LC112b, ALVO);
    const it = api.leiItensDaAlteradora(ALVO, par).find((x) => x.num === "91");
    ok(it && it.tipo === "mudou" && /Procuradoria-Geral do Município, quando o crédito estiver inscrito em Dívida Ativa\./.test(it.novo) && !/[“”]/.test(it.novo), "C1 a aspa de fechar (escrita como “) não fica no texto: " + (it && it.novo));
  }

  /* ---- 4: um artigo de lei comum não vira 'próprio' só por começar com "O" ---- */
  {
    const { api } = rodar();
    const t = "Art. 1º A Lei nº 1 passa a vigorar com as seguintes alterações: “Art. 3º O prazo é de dez dias. (NR)” Art. 2º Esta Lei entra em vigor na data de sua publicação.";
    const par = api.leiLerAlteradora(t, { nome: "Lei 1/2000", texto: "Art. 3º O prazo é de cinco dias." });
    ok(par.blocos.map((b) => b.num).join(",") === "3", "D1 o art. 3º citado (o número não é o próximo da própria lei) continua sendo alteração: " + par.blocos.map((b) => b.num).join(","));
  }
  return falhas;
}

module.exports = { testes };
