/* =====================================================================
 * VÍNCULOS ENTRE EDITAIS (v8.74)
 *
 * O erro que este recurso pode causar é o pior do app: dizer que voce ja
 * estudou algo que voce nao estudou faz voce PULAR um assunto, e o erro so
 * aparece na prova. Todos os testes daqui existem por causa disso.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

function carregar() {
  const loja = {};
  const localStorage = {
    getItem: (k) => (loja[k] === undefined ? null : loja[k]),
    setItem: (k, v) => { loja[k] = String(v); },
    removeItem: (k) => { delete loja[k]; },
  };
  const src = fs.readFileSync(path.join(RAIZ, "docs", "vinculos.js"), "utf8");
  return new Function("localStorage", "guardar", "t", src + `
    return { vkCarregar, vkSalvar, vkNormal, vkChave, vkEstudados, vkIdenticos,
             vkPrompt, vkLerResposta, vkAplicar, vkDesfazer, vkHistorico, vkPodar,
             get vinculos(){ return vinculos; } };`)(
    localStorage, (k, v) => { loja[k] = v; return true; },
    (k, p) => k + " " + JSON.stringify(p || {}));
}

const DIARIO = [
  { d: "2026-08-10", disc: "Direito Financeiro", n: "Restos a pagar", a: "feito", cc: "TCE-PE" },
  { d: "2026-07-01", disc: "Direito Administrativo", n: "Improbidade administrativa", a: "feito", cc: "TCE-PE" },
  { d: "2026-02-10", disc: "Controle Externo", n: "Controle interno e externo", a: "feito", cc: "TCE-PE" },
  { d: "2026-08-12", disc: "Direito Civil", n: "Responsabilidade Civil", a: "revisado", cc: "TCE-PE" },
  { d: "2026-05-01", disc: "Direito Financeiro", n: "Restos a pagar", a: "feito", cc: "TCE-PE" },
];
const PEND = [
  { disciplina: "Financas Publicas", nome: "Restos a pagar" },
  { disciplina: "Direito Administrativo", nome: "Lei n 8.429/1992" },
  { disciplina: "Controle Interno", nome: "Controle interno e externo" },
  { disciplina: "Direito Administrativo", nome: "Responsabilidade Civil" },
  { disciplina: "Portugues", nome: "Crase" },
];

function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  /* ---- K1: o que ja foi estudado, sem repetir ---- */
  {
    const api = carregar(); api.vkCarregar();
    const e = api.vkEstudados(DIARIO);
    ok(e.length === 4, `K1 esperava 4 assuntos distintos, veio ${e.length}`);
    const rp = e.find((x) => x.topico === "Restos a pagar");
    ok(rp && rp.data === "2026-08-10",
       `K1b devia valer o registro MAIS RECENTE, veio ${rp && rp.data}`);
    ok(api.vkEstudados([]).length === 0, "K1c diario vazio devia dar lista vazia");
  }

  /* ---- K2: nome identico e CANDIDATO, nunca fato ----
   * "Controle interno e externo" num TCE e numa prefeitura cobram normas
   * diferentes. O app apresenta; quem decide e a pessoa. */
  {
    const api = carregar(); api.vkCarregar();
    const cand = api.vkIdenticos(api.vkEstudados(DIARIO), PEND);
    ok(cand.length === 3,
       `K2 esperava 3 nomes identicos, veio ${cand.length}: `
       + cand.map((c) => c.para.topico).join(", "));
    ok(api.vinculos.length === 0,
       "K2b a triagem de identicos criou vinculo sozinha — nada pode ser aplicado sem decisao");

    /* a disciplina e o que mais desmente a igualdade do nome, entao a
     * triagem tem de dizer quando ela difere */
    const resp = cand.find((c) => c.para.topico === "Responsabilidade Civil");
    ok(resp && resp.mesmaDisciplina === false,
       "K2c 'Responsabilidade Civil' em Civil x Administrativo devia vir marcado como disciplina diferente");
    const rp = cand.find((c) => c.para.topico === "Restos a pagar");
    ok(rp && rp.mesmaDisciplina === false,
       "K2d Direito Financeiro x Financas Publicas devia constar como disciplina diferente");
  }

  /* ---- K3: aplicar e idempotente ----
   * Este botao vai ser apertado de novo todo mes. */
  {
    const api = carregar(); api.vkCarregar();
    const cand = api.vkIdenticos(api.vkEstudados(DIARIO), PEND);
    const r1 = api.vkAplicar(cand.slice(0, 2), "e2");
    ok(r1.novos === 2, `K3 esperava 2 vinculos novos, veio ${r1.novos}`);
    const r2 = api.vkAplicar(cand.slice(0, 2), "e2");
    ok(r2.novos === 0 && r2.repetidos === 2,
       `K3b reaplicar duplicou: ${r2.novos} novos, ${r2.repetidos} repetidos`);

    /* e a triagem nao pode reoferecer o que ja esta vinculado */
    const cand2 = api.vkIdenticos(api.vkEstudados(DIARIO), PEND);
    ok(cand2.length === cand.length - 2,
       `K3c a triagem reofereceu par ja vinculado (${cand2.length})`);
  }

  /* ---- K4: a marca de historico e as faixas de tempo ---- */
  {
    const api = carregar(); api.vkCarregar();
    const est = api.vkEstudados(DIARIO);
    const cand = api.vkIdenticos(est, PEND);
    api.vkAplicar(cand, "e2");
    const H = (d, t, e) => api.vkHistorico(d, t, e, DIARIO, "2026-08-16");

    /* sem vinculo e sem estudo: nunca herda marca por semelhanca de nome */
    ok(H("Portugues", "Crase", null).marca === "sem_historico",
       "K4 topico sem vinculo devia ser 'sem historico'");

    /* estudado AQUI manda sobre qualquer vinculo */
    ok(H("Financas Publicas", "Restos a pagar", "feito").marca === "estudado_aqui",
       "K4b marcado aqui devia valer sobre o historico de outro concurso");
    ok(H("Financas Publicas", "Restos a pagar", "revisado").marca === "revisado_aqui",
       "K4c revisado aqui devia valer sobre tudo");

    /* 6 dias -> pular */
    const a = H("Financas Publicas", "Restos a pagar", null);
    ok(a.marca === "ja_visto", `K4d 6 dias devia ser 'ja_visto', veio ${a.marca}`);
    ok(a.dias === 6, `K4e a conta de dias errou: ${a.dias}`);
    ok(a.concurso === "TCE-PE", "K4f a marca nao diz de qual concurso veio");

    /* 46 dias -> revisar em vez de reestudar */
    const b = H("Controle Interno", "Controle interno e externo", null);
    ok(b.marca === "visto_ha_muito",
       `K4g fevereiro (187 dias) devia ser 'visto_ha_muito', veio ${b.marca}`);

    /* 4 dias, revisado -> ja_visto e sabe que foi revisao */
    const c = H("Direito Administrativo", "Responsabilidade Civil", null);
    ok(c.marca === "ja_visto" && c.acao === "revisado",
       `K4h esperava ja_visto/revisado, veio ${c.marca}/${c.acao}`);
  }

  /* ---- K5: desfazer devolve ao estado anterior, sem tocar no diario ---- */
  {
    const api = carregar(); api.vkCarregar();
    const est = api.vkEstudados(DIARIO);
    const cand = api.vkIdenticos(est, PEND);
    api.vkAplicar(cand, "e2");
    const antes = api.vkHistorico("Financas Publicas", "Restos a pagar", null, DIARIO, "2026-08-16");
    ok(antes.marca === "ja_visto", "K5-pre o cenario precisa de um vinculo ativo");

    const par = cand.find((c) => c.para.topico === "Restos a pagar");
    api.vkDesfazer(par.de.chave, par.para.chave);
    const dep = api.vkHistorico("Financas Publicas", "Restos a pagar", null, DIARIO, "2026-08-16");
    ok(dep.marca === "sem_historico",
       `K5 desfazer devia devolver a 'sem historico', veio ${dep.marca}`);
    ok(DIARIO.length === 5, "K5b desfazer o vinculo mexeu no diario");
  }

  /* ---- K6: a resposta da IA ---- */
  {
    const api = carregar(); api.vkCarregar();
    const est = api.vkEstudados(DIARIO);
    const resp = [
      "Aqui estao os pares que encontrei:",
      "~ Direito Administrativo > Improbidade administrativa :: Direito Administrativo > Lei n 8.429/1992 :: ALTA :: mesma lei",
      "~ Direito Financeiro > Restos a pagar :: Financas Publicas > Restos a pagar :: MEDIA :: entes diferentes",
      "~ Nao existe > Nada :: Portugues > Crase :: ALTA :: invencao",
      "obrigado!",
    ].join("\n");
    const r = api.vkLerResposta(resp, est, PEND);
    ok(r.pares.length === 2, `K6 esperava 2 pares validos, veio ${r.pares.length}`);
    ok(r.pares[0].conf === "ALTA" && r.pares[1].conf === "MEDIA",
       "K6b a confianca nao foi lida certo");
    /* linha inventada pela IA nao pode virar vinculo: ela aponta para um
     * assunto que nao esta na lista do que eu estudei */
    ok(r.ignoradas.some((x) => x.motivo === "nao_achou"),
       "K6c par inventado pela IA foi aceito");
    ok(r.ignoradas.length === 3,
       `K6d esperava 3 linhas ignoradas (2 de conversa + 1 invencao), veio ${r.ignoradas.length}`);
  }

  /* ---- K7: vinculo orfao nao pode continuar contando ---- */
  {
    const api = carregar(); api.vkCarregar();
    const cand = api.vkIdenticos(api.vkEstudados(DIARIO), PEND);
    api.vkAplicar(cand, "e2");
    const n = api.vkPodar(["e1"]);
    ok(n === cand.length, `K7 a poda devia remover ${cand.length} vinculos orfaos, removeu ${n}`);
    ok(api.vkHistorico("Financas Publicas", "Restos a pagar", null, DIARIO, "2026-08-16")
       .marca === "sem_historico",
       "K7b vinculo de edital apagado continua marcando historico");
  }

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "vinculos", 60000).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\nvinculos: ${f.length} FALHA(S)\n`
    : "\nvinculos: triagem, faixas de tempo, idempotencia e poda ok (24 verificacoes)\n");
  process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
