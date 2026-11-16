/* =====================================================================
 * A VIGIA DA BANCADA (19.147.0)
 *
 * O que originou: em 13/11 a bancada e o tópico-alvo se esvaziaram entre 22:23 e 22:45 e o registro não tinha nada.
 *
 * O QUE PRECISA SER VERDADE:
 *  V1. Limpar, Apagar tudo, trocar de lote e Sair deixam evento BANCADA (ou o APAGAR de sempre) e o selo diz "vazia".
 *  V2. Recarregar com o selo dizendo "havia cartões" e a bancada vazia: evento, cópia nas Versões, faixa de recuperar.
 *  V3. Sem cópia guardada: a faixa avisa, sem o botão de trazer de volta, e "Foi de propósito" não fala de cópia.
 *  V4. O tópico que sumiu sem "Sair" volta; o que saiu por "Sair" não volta.
 *  V5. Recarregar normal (texto presente, ou limpo a pedido) não avisa nada.
 *  V6. A cópia nunca é trocada por bancada vazia ou pelo texto de exemplo, e não é regravada a cada tecla.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const TXT = "Pergunta um? :: Resposta um\n\nPergunta dois? :: Resposta dois\n\n# comentário :: não conta\nPergunta três? :: Resposta três";
  const regs = (a, re) => (a.registroAtual() || []).filter((e) => e.tipo === "BANCADA" && re.test(e.msg));
  /* "recarregar": a mesma loja, um app novo */
  const recarregar = (loja) => rodar({ lojaInicial: loja }).api;
  const copiaLoja = (a) => { const o = {}; Object.keys(a.loja).forEach((k) => { const v = a.loja.getItem(k); if (v !== null) o[k] = v; }); return o; };
  const lojaDe = (a) => {
    const o = {};
    for (let i = 0; i < (a.loja.length || 0); i++) { const k = a.loja.key(i); o[k] = a.loja.getItem(k); }
    return Object.keys(o).length ? o : copiaLoja(a);
  };

  /* V0: contar cartões ignora comentário */
  {
    const a = rodar().api;
    ok(a.bancVigiaContar(TXT) === 3, "V0 conta 3 cartões (o comentário com :: não conta): " + a.bancVigiaContar(TXT));
  }

  /* V1 + V2: com cópia, recarregar vazia sem ninguém limpar */
  {
    const a = rodar().api;
    let agora = 1000000;
    a.bancVigiaRelogioDefinir(() => agora);
    a.$("editor").value = TXT;
    a.autoSalvar();
    const selo = JSON.parse(a.lojaLer(a.BANC_SELO_CH));
    ok(selo.n === 3 && selo.c === TXT.length, "V1a o selo guarda cartões e caracteres: " + JSON.stringify(selo));
    const cp = JSON.parse(a.lojaLer(a.BANC_COPIA_CH) || "null");
    ok(cp && cp.txt === TXT && cp.n === 3, "V1b a cópia guarda o texto");
    /* a bancada some "por fora": nenhum caminho do app tocou nela */
    const loja = lojaDe(a);
    delete loja.eac_texto;
    const b = recarregar(loja);
    ok(regs(b, /abriu vazia sem ninguém/).length === 1, "V2a o caso vai para o registro");
    ok(b.$("barraRecuperar").hidden === false && /3 cartões/.test(b.$("recuperarTxt").textContent), "V2b a faixa aparece dizendo quantos cartões havia: " + b.$("recuperarTxt").textContent);
    ok(b.$("btnRecuperar").hidden === false && /Versões do texto/.test(b.$("recuperarCorpo").textContent), "V2c com cópia: o botão de trazer de volta e o corpo apontam as Versões: " + b.$("recuperarCorpo").textContent);
    const hist = JSON.parse(b.lojaLer("eac_hist") || "[]");
    ok(hist.some((v) => v.txt === TXT && /vigia/.test(v.m)), "V2d a cópia entrou nas Versões do texto");
    /* abrir de novo: o aviso não se repete */
    const c = recarregar(lojaDe(b));
    ok(c.$("barraRecuperar").hidden === true && regs(c, /abriu vazia/).length === regs(b, /abriu vazia/).length, "V2e o aviso sai uma vez só");
  }

  /* V3: sem cópia */
  {
    const a = rodar().api;
    a.$("editor").value = TXT;
    a.autoSalvar();
    const loja = lojaDe(a);
    delete loja.eac_texto;
    delete loja.eac_banc_copia;
    const b = recarregar(loja);
    ok(b.$("barraRecuperar").hidden === false && b.$("btnRecuperar").hidden === true && /não havia cópia/.test(b.$("recuperarCorpo").textContent), "V3a sem cópia: avisa sem o botão de trazer de volta");
    ok(regs(b, /abriu vazia/).some((e) => /sem cópia/.test(String(e.extra))), "V3b o registro diz que não havia cópia");
  }

  /* V1 (os caminhos a pedido) + V5 (recarregar depois deles não avisa) */
  {
    const a = rodar().api;
    a.$("editor").value = TXT;
    a.autoSalvar();
    a.bancAlvoDefinir("Direito Tributário", "ISS V1");
    ok(JSON.parse(a.lojaLer(a.BANC_SELO_CH)).alvo === "Direito Tributário › ISS V1", "V1c o selo sabe o tópico");
    ok(a.bancAlvoLimpar() === true, "V1d limpar a bancada");
    ok(regs(a, /bancada esvaziada: Limpar/).some((e) => /3 cartões/.test(String(e.extra))), "V1e Limpar deixa evento com quantos cartões saíram");
    ok(JSON.parse(a.lojaLer(a.BANC_SELO_CH)).c === 0, "V1f o selo passa a dizer vazia");
    const b = recarregar(lojaDe(a));
    ok(b.$("barraRecuperar").hidden === true && !regs(b, /abriu vazia/).length, "V5a recarregar depois de Limpar não avisa");
    ok(b.bancAlvoAtual() && b.bancAlvoAtual().topico === "ISS V1", "V5b o tópico continua");
    b.bancAlvoSair();
    ok(regs(b, /saiu do tópico/).some((e) => /ISS V1/.test(String(e.extra))), "V1g Sair deixa evento");
    const c = recarregar(lojaDe(b));
    ok(!c.bancAlvoAtual() && !regs(c, /sumiu sem Sair/).length, "V4a o tópico que saiu por Sair não volta");
  }

  /* V4: o tópico some sem Sair */
  {
    const a = rodar().api;
    a.$("editor").value = TXT;
    a.autoSalvar();
    a.bancAlvoDefinir("Direito Tributário", "ISS V4");
    const loja = lojaDe(a);
    delete loja.eac_banca_alvo;
    const b = recarregar(loja);
    ok(b.bancAlvoAtual() && b.bancAlvoAtual().topico === "ISS V4", "V4b o tópico que sumiu sem Sair volta");
    ok(regs(b, /sumiu sem Sair/).length === 1 && JSON.parse(b.lojaLer(b.BANC_ALVO_CHAVE)).topico === "ISS V4", "V4c fica no registro e gravado de novo");
    ok(b.$("barraRecuperar").hidden === true, "V4d só o tópico sumiu: a bancada tem texto, a faixa não aparece");
  }

  /* V1: Apagar tudo */
  {
    const a = rodar().api;
    a.$("editor").value = TXT;
    a.autoSalvar();
    const p = a.$("btnApagarTudo").onclick();
    for (let i = 0; i < 12; i++) { await Promise.resolve(); try { a._uiFechar(true); } catch (e) {} }
    await p;
    ok(a.$("editor").value === "" && JSON.parse(a.lojaLer(a.BANC_SELO_CH)).c === 0, "V1h Apagar tudo deixa o selo vazio");
    const b = recarregar(lojaDe(a));
    ok(b.$("barraRecuperar").hidden === true && !regs(b, /abriu vazia/).length, "V5c recarregar depois de Apagar tudo não avisa");
  }

  /* V5: recarregar normal */
  {
    const a = rodar().api;
    a.$("editor").value = TXT;
    a.autoSalvar();
    const b = recarregar(lojaDe(a));
    ok(b.$("editor").value === TXT && b.$("barraRecuperar").hidden === true && !regs(b, /abriu vazia|sumiu/).length, "V5d recarregar com o texto presente não avisa nada");
  }

  /* V6: a cópia */
  {
    const a = rodar().api;
    let agora = 5000000;
    a.bancVigiaRelogioDefinir(() => agora);
    a.bancVigiaGravou(TXT);
    const t0 = JSON.parse(a.lojaLer(a.BANC_COPIA_CH)).t;
    agora += 5000;
    a.bancVigiaGravou(TXT + " x");
    ok(JSON.parse(a.lojaLer(a.BANC_COPIA_CH)).t === t0, "V6a mesma contagem em menos de 20 s: a cópia não é regravada");
    a.bancVigiaGravou(TXT + "\nPergunta quatro? :: Resposta");
    ok(JSON.parse(a.lojaLer(a.BANC_COPIA_CH)).n === 4, "V6b mudou o número de cartões: a cópia acompanha");
    a.bancVigiaGravou("");
    a.bancVigiaGravou(a.t("example"));
    ok(JSON.parse(a.lojaLer(a.BANC_COPIA_CH)).n === 4 && JSON.parse(a.lojaLer(a.BANC_SELO_CH)).c === 0, "V6c vazia ou exemplo: o selo diz vazia e a cópia fica");
    agora += 30000;
    a.bancVigiaGravou(TXT + "\nPergunta quatro? :: Resposta alterada");
    ok(/alterada/.test(JSON.parse(a.lojaLer(a.BANC_COPIA_CH)).txt), "V6d depois de 20 s: a cópia é atualizada");
  }

  /* o lote da lei também avisa; o selo e a cópia não vão para o backup; a outra aba vê o tópico */
  {
    const raiz = path.join(__dirname, "..", "docs");
    const cl = fs.readFileSync(path.join(raiz, "cartoes-lei.js"), "utf8");
    ok(/bancVigiaLimpou\("lote "/.test(cl), "V1i trocar de lote da lei registra o esvaziamento");
    const bk = fs.readFileSync(path.join(raiz, "backup.js"), "utf8");
    ok(!/eac_banc_selo|eac_banc_copia/.test(bk), "V6e selo e cópia ficam fora do backup");
    const ab = fs.readFileSync(path.join(raiz, "abas.js"), "utf8");
    ok(/eac_banca_alvo: "tópico da bancada"/.test(ab), "V6f outra aba mudar o tópico deixa esta desatualizada");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
