/* TEMPO ALÉM DO PREVISTO.
 *
 * O caso que originou isto estava na tela do usuário: um tópico com
 * "1h15 de 30min · 100%". As três informações juntas são falsas —
 * 1h15 de 30min são 250%, e o "100%" faz parecer plano cumprido na
 * medida quando o tópico custou duas vezes e meia o reservado.
 *
 * Não é detalhe estético. O plano inteiro é uma conta de horas: se cada
 * tópico consome 2,5× o previsto, as 40h da semana rendem 16h de
 * matéria, e a pessoa chega na prova com um terço do edital que a tela
 * jurava estar coberto. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const linha = (api, item) => api.edLinhaAgendaTeste(item);
  const textoDe = (el) => (el && el.textContent) || "";
  const acharClasse = (el, cls, saida) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) saida.push(f);
      acharClasse(f, cls, saida);
    });
    return saida;
  };

  /* ---- T1: o número não trava em 100% ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Direito Financeiro", top = "Lei 4.320";
    const ch = api.matChave(disc, top);
    /* 75 minutos registrados num tópico que o plano reservou 30 */
    api.diarioPor([{ c: ch, disc, n: top, a: "feito", m: 75 }]);

    const li = linha(api, { disciplina: disc, nome: top, chave: ch,
      minutos: 30, faixa: "alta", disciplinaPeso: 5, peso: 5 });
    const txt = textoDe(li);

    ok(!/100%/.test(txt),
       "T1 a linha ainda diz 100% para 1h15 de 30min: " + txt.slice(0, 140));
    ok(/45min|45 min/.test(txt),
       "T1b a linha nao diz QUANTO passou do previsto: " + txt.slice(0, 140));
    ok(/1h15/.test(txt) && /30min/.test(txt),
       "T1c a linha perdeu os dois numeros originais: " + txt.slice(0, 140));

    /* A BARRA CONTINUA TRAVADA — uma barra nao sabe passar da propria
     * caixa, e 250% de largura vazaria por cima da linha vizinha. */
    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length === 1, "T1d nao achei a barra do topico");
    if (fills.length) {
      ok(fills[0].style.width === "100%",
         "T1e a barra passou da caixa: " + fills[0].style.width);
      /* mas ela nao pode ficar VERDE: verde e "cumpri o plano", e nao foi
       * isso que aconteceu */
      ok(!/cheio/.test(fills[0].className || ""),
         "T1f a barra pintou de 'cumprido' um topico que estourou o previsto");
      ok(/excedeu/.test(fills[0].className || ""),
         "T1g a barra nao se distingue de um topico cumprido na medida: "
         + fills[0].className);
    }
  }

  /* ---- T2: cumprir na medida continua sendo cumprir ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "Exato");
    api.diarioPor([{ c: ch, disc: "D", n: "Exato", a: "feito", m: 30 }]);
    const li = linha(api, { disciplina: "D", nome: "Exato", chave: ch, minutos: 30 });
    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length && /cheio/.test(fills[0].className || ""),
       "T2 30min de 30min devia continuar aparecendo como cumprido: "
       + (fills[0] || {}).className);
    ok(/100%/.test(textoDe(li)),
       "T2b cumprir na medida perdeu o 100%: " + textoDe(li).slice(0, 120));

    /* PASSAR UM POUCO NÃO É NOTÍCIA. 34min de 30min sao 113%: alarmar
     * ali encheria a agenda de aviso amarelo e o aviso perderia sentido
     * justamente onde ele importa. */
    api.diarioPor([{ c: ch, disc: "D", n: "Exato", a: "feito", m: 34 }]);
    const li2 = linha(api, { disciplina: "D", nome: "Exato", chave: ch, minutos: 30 });
    const f2 = acharClasse(li2, "it-fill", []);
    ok(f2.length && !/excedeu/.test(f2[0].className || ""),
       "T2c 34min de 30min ja disparou o alerta — a folga sumiu");
  }

  /* ---- T3: metade do caminho continua sendo metade ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "Meio");
    api.diarioPor([{ c: ch, disc: "D", n: "Meio", a: "feito", m: 15 }]);
    const li = linha(api, { disciplina: "D", nome: "Meio", chave: ch, minutos: 30 });
    ok(/50%/.test(textoDe(li)),
       "T3 meio caminho deixou de mostrar 50%: " + textoDe(li).slice(0, 120));
    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length && /parcial/.test(fills[0].className || ""),
       "T3b a barra parcial mudou de estado sem motivo");
  }

  /* ---- T4: o fator de realidade da disciplina ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Direito Financeiro";
    const itens = ["Receita", "Despesa", "Restos", "Créditos"].map((nome) => ({
      disciplina: disc, nome, chave: api.matChave(disc, nome), minutos: 30,
    }));
    /* três tópicos medidos, todos custando o dobro */
    api.diarioPor(itens.slice(0, 3).map((x) => ({
      c: x.chave, disc, n: x.nome, a: "feito", m: 60 })));

    const f = api.edFatorReal(disc, itens);
    ok(!!f, "T4 o fator de realidade nao foi calculado");
    ok(f && Math.abs(f.fator - 2) < 0.01,
       "T4b o fator devia ser 2, veio " + (f && f.fator));
    ok(f && f.topicos === 3,
       "T4c contou " + (f && f.topicos) + " topicos medidos, deviam ser 3");
    /* o tópico ainda NÃO estudado não entra na conta: incluí-lo como
     * "zero minutos" faria o fator despencar e mentir para o outro lado */
    ok(f && f.previsto === 90,
       "T4d o previsto somou o topico que ninguem estudou: " + (f && f.previsto));

    /* MENOS DE TRÊS TÓPICOS É ANEDOTA, NÃO MEDIDA.
     * Uma sessao longa num topico dificil viraria "esta disciplina custa
     * o triplo", e o numero seria pior que nenhum numero. */
    const { api: api2 } = rodar();
    api2.matIniciar(); api2.edIniciar();
    const it2 = ["A", "B", "C"].map((nome) => ({
      disciplina: "X", nome, chave: api2.matChave("X", nome), minutos: 30 }));
    api2.diarioPor([{ c: it2[0].chave, disc: "X", n: "A", a: "feito", m: 180 }]);
    ok(api2.edFatorReal("X", it2) === null,
       "T4e um topico so bastou para o app declarar um fator");

    /* disciplina sem nada estudado nao tem fator nenhum */
    ok(api.edFatorReal("Estatística", itens) === null,
       "T4f inventou um fator para disciplina sem tempo registrado");
  }

  /* ---- T5: revisão tem conta própria ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Direito Financeiro", top = "Lei 4.320";
    const ch = api.matChave(disc, top);

    /* O CASO REAL: o tópico foi estudado há oito dias (1h15 de estudo
     * original), a revisão venceu, e a linha mostrava "1h15 de 30min ·
     * 45min além" — numa revisão que sequer tinha começado.
     *
     * Os dois números eram verdadeiros e não falavam da mesma coisa:
     * 1h15 é tudo o que já foi gasto no tópico desde sempre; 30min é o
     * orçamento SÓ DA REVISÃO, que é metade do de um tópico novo. */
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 75, d: "2026-08-18" },
    ]);
    const li = linha(api, { disciplina: disc, nome: top, chave: ch,
      minutos: 30, ehRevisao: true });
    const txt = textoDe(li);

    ok(!/45min além|45 min além/.test(txt),
       "T5 a revisao ainda se diz cumprida com o tempo do estudo original: "
       + txt.slice(0, 140));
    /* o tempo total NÃO some — ele é informação boa, desde que nomeada */
    ok(/1h15/.test(txt),
       "T5b o tempo ja investido no topico sumiu da linha: " + txt.slice(0, 140));
    ok(/1h15 no tópico/.test(txt),
       "T5c o tempo total aparece sem dizer que e o total: " + txt.slice(0, 140));
    ok(/18/.test(txt),
       "T5d nao diz de quando e o estudo anterior: " + txt.slice(0, 140));
    /* E A RESPOSTA PARA "QUANTO DE REVISÃO EU JÁ CUMPRI?" É ZERO — dita
     * em voz alta. Esconder o zero deixaria a pergunta sem resposta
     * justamente quando ela mais importa. */
    /* "0 de 30min de revisão" repetia o "30min" da direita: a revisão que não começou não tem barra nem número */
    ok(!/de 30min/.test(txt) && acharClasse(li, "it-barra", []).every((b) => b.hidden === true),
       "T5d2 a revisao que nao comecou nao mostra barra nem '0 de 30min': "
       + txt.slice(0, 160));
    ok(/1ª revisão/.test(txt),
       "T5d3 o selo diz QUAL revisao e' esta: "
       + txt.slice(0, 160));

    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length && !/excedeu|cheio/.test(fills[0].className || ""),
       "T5e a barra da revisao aparece cumprida sem a revisao ter comecado: "
       + (fills[0] || {}).className);

    /* AGORA A REVISÃO ACONTECE: 20 minutos depois da conclusão. */
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 75, d: "2026-08-18" },
      { c: ch, disc, n: top, a: "revisado", m: 20, d: "2026-08-26" },
    ]);
    const li2 = linha(api, { disciplina: disc, nome: top, chave: ch,
      minutos: 30, ehRevisao: true });
    const t2 = textoDe(li2);
    ok(/20min/.test(t2),
       "T5f a revisao cumprida nao aparece: " + t2.slice(0, 140));
    ok(/de 30min/.test(t2),
       "T5g a revisao nao e medida contra o orcamento dela: " + t2.slice(0, 140));
    ok(/1h35/.test(t2),
       "T5h o total do topico devia somar 1h35 (1h15 + 20min): "
       + t2.slice(0, 160));
    ok(/67%|66%/.test(t2),
       "T5i 20 de 30 minutos sao dois tercos da revisao: " + t2.slice(0, 140));

    /* e um tópico NOVO continua medindo tudo, como sempre mediu */
    const ch2 = api.matChave("D", "Novo");
    api.diarioPor([{ c: ch2, disc: "D", n: "Novo", a: "feito", m: 45,
                     d: "2026-08-26" }]);
    const li3 = linha(api, { disciplina: "D", nome: "Novo", chave: ch2,
      minutos: 60 });
    ok(/45min de 1h/.test(textoDe(li3)),
       "T5j topico novo mudou de conta sem motivo: "
       + textoDe(li3).slice(0, 120));
    ok(!/no tópico/.test(textoDe(li3)),
       "T5k topico que nao e revisao ganhou a linha do total");
  }

  /* ---- T6: o caso relatado — a 2ª revisão nascia "35min de 30min · 5min além" com o tempo da 1ª ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Sistema Tributário Brasileiro", top = "Limitações ao poder de tributar";
    const ch = api.matChave(disc, top);
    const hoje = api.hojeISO();
    const diasAtras = (n) => { const d = new Date(hoje + "T00:00:00"); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    const dEst = diasAtras(29), dRev = diasAtras(21);
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 65, d: dEst, f: ["leitura"] },
      { c: ch, disc, n: top, a: "revisado", m: 35, d: dRev, f: ["questoes"] },
    ]);
    const dm = (d) => d.slice(8, 10) + "/" + d.slice(5, 7);
    /* a 2ª revisão venceu: a marca é a da 1ª (n = 1), de 21 dias atrás */
    const item = { disciplina: disc, nome: top, chave: ch, minutos: 30, ehRevisao: true, feito: true, revisado: true, nRev: 1, quando: dRev,
      porque: { tipo: "rev_vencida", dias: 21, nRev: 1, fatia: 42 } };
    const li = linha(api, item);
    const txt = textoDe(li);
    ok(api.minutosDeRevisao(ch, dRev) === 0 && api.minutosDeRevisao(ch) === 35, "T6 a revisao DA VEZ conta so' o que veio depois da ultima conclusao (0); somar tudo dava 35");
    ok(!/35min de 30min|além/.test(txt) && acharClasse(li, "it-barra", []).every((b) => b.hidden === true), "T6a a 2ª revisao nao nasce cumprida com o tempo da 1ª: " + txt.slice(0, 200));
    ok(/2ª revisão/.test(txt), "T6b o selo diz '2ª revisão': " + txt.slice(0, 120));
    ok(!/última sessão há/.test(txt) && /vale 42% da prova/.test(txt), "T6c a linha do porque nao repete a revisao (o selo e o historico ja' dizem): " + txt.slice(0, 200));
    const txtP = textoDe(api.edLinhaPainelTeste(item));
    ok(/2ª revisão/.test(txtP) && !/última sessão há/.test(txtP), "T6c2 no painel da disciplina (linha sem o link da disciplina) tambem: " + txtP.slice(0, 200));
    const hist = acharClasse(li, "ed-item-ultima", [])[0];
    ok(hist && hist.textContent === "Estudado em " + dm(dEst) + " · 1ª revisão em " + dm(dRev) + " com questões (há 21 dias) · 1h40 no tópico",
       "T6d UMA linha de historico, datas no mesmo formato: " + (hist && hist.textContent));
    ok(!/ao todo|Da última vez|revisado com revisão/.test(txt), "T6e as tres linhas antigas sairam");
    /* a forma "revisão" (padrão do registro de revisão) não aparece: "com revisão" não diz nada */
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 65, d: dEst, f: ["leitura"] },
      { c: ch, disc, n: top, a: "revisado", m: 35, d: dRev, f: ["revisao"] },
    ]);
    const h2 = acharClasse(linha(api, item), "ed-item-ultima", [])[0];
    ok(h2 && h2.textContent === "Estudado em " + dm(dEst) + " · 1ª revisão em " + dm(dRev) + " (há 21 dias) · 1h40 no tópico", "T6f sem 'com revisão': " + (h2 && h2.textContent));
    /* revisão começada aos poucos (por ramos): o tempo DEPOIS da conclusão conta, e a barra aparece */
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 65, d: dEst, f: ["leitura"] },
      { c: ch, disc, n: top, a: "revisado", m: 35, d: dRev, f: ["questoes"] },
      { c: ch, disc, n: top, a: "revisado", m: 10, d: hoje, f: ["questoes"], rp: [{ id: "imunidades" }] },
    ]);
    const li3 = linha(api, item);
    ok(/10min de 30min/.test(textoDe(li3)) && acharClasse(li3, "it-barra", []).some((b) => b.hidden !== true), "T6g revisao em andamento: so' os 10min dela, com barra: " + textoDe(li3).slice(0, 200));
    /* o puro */
    const h = api.edHistoricoDoTopico([
      { c: ch, a: "feito", d: "2026-09-02", m: 30, f: ["leitura"] }, { c: ch, a: "feito", d: "2026-09-13", m: 60, f: ["leitura"] }, { c: ch, a: "pendente", d: "2026-10-05" },
      { c: "outro", a: "revisado", d: "2026-10-01" }, { c: ch, a: "revisado", d: "2026-09-21", m: 35, f: ["questoes", "revisao"] }], ch, "2026-10-12");
    ok(h && h.estudoD === "2026-09-13" && h.revD === "2026-09-21" && h.ultD === "2026-09-21" && h.dias === 21 && h.formas.join() === "questoes,revisao", "T6h historico: o estudo MAIS RECENTE, a revisao e a ultima sessao (desmarcar depois e outro topico ficam fora): " + JSON.stringify(h));
    ok(api.edHistoricoDoTopico([], ch, "2026-10-12") === null, "T6i sem registro: nada");
    ok(api.edHistoricoTexto({ estudoD: "2026-10-01", revD: "", ultD: "2026-10-05", dias: 7, formas: ["questoes"] }, 0, 0) === "Estudado em 01/10 · última sessão em 05/10 com questões (há 7 dias)", "T6i2 sessao depois do estudo, sem concluir: a data e a forma vao para 'ultima sessao', nao para o estudo: " + api.edHistoricoTexto({ estudoD: "2026-10-01", revD: "", ultD: "2026-10-05", dias: 7, formas: ["questoes"] }, 0, 0));
    ok(api.edHistoricoTexto({ estudoD: "2026-10-01", revD: "", ultD: "2026-10-01", dias: 11, formas: ["leitura"] }, 0, 0) === "Estudado em 01/10 com leitura (há 11 dias)", "T6j so' estudo: " + api.edHistoricoTexto({ estudoD: "2026-10-01", revD: "", ultD: "2026-10-01", dias: 11, formas: ["leitura"] }, 0, 0));
    ok(api.edHistoricoTexto({ estudoD: "", revD: "", ultD: "2026-10-05", dias: 7, formas: [] }, 0, 0) === "última sessão em 05/10 (há 7 dias)", "T6k sessao sem conclusao (parcial)");
    ok(api.edHistoricoTexto({ estudoD: "2026-10-01", revD: "2026-09-01", ultD: "2026-10-01", dias: 2, formas: [] }, 1, 0) === "Estudado em 01/10 (há 2 dias)", "T6l revisao ANTERIOR ao estudo mais recente nao aparece como a ultima revisao");
    /* o porquê longo continua no registro (e no Raio-X) */
    ok(/2ª revisão: última sessão há 21 dias/.test(api.edPorque(item)) && !/revisão/.test(api.edPorque(item, true, { curto: true })), "T6m o porque longo continua (registro); o curto e' o da agenda");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
