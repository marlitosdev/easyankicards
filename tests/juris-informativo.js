/* =====================================================================
 * INFORMATIVO → CADA JULGADO NO TÓPICO CERTO (v18.43.0, JM5)
 *
 * O lote já separava os julgados de um texto, mas guardava todos no
 * tópico aberto. Agora cada ficha tem "Guardar em": o app sugere o tópico
 * do edital cujo nome combina com as etiquetas, a tese e o resumo (só
 * quando a combinação é clara e melhor que a do aberto); a pessoa troca.
 * Os julgados CITADOS num resumo continuam no tópico do resumo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const cls = (e) => String((e && e.className) || "");
  const D = "Sistema Tributário";
  const EDITAL = ["# ISS | prova: 2027-06-01 | horas: 10", "@ " + D + " :: 5",
    "+ Limitações ao poder de tributar :: 5", "+ Responsabilidade tributária :: 5", "+ Crédito tributário :: 5"].join("\n");

  /* I1: o motor */
  {
    const { api } = rodar();
    const f = { tags: ["responsabilidade tributária", "sócio"], tese: "O sócio-gerente responde pelo tributo.", resumo: "" };
    ok(api.jurCombina(f, "Responsabilidade tributária") === 1 && api.jurCombina(f, "Crédito tributário") === 0.5 && api.jurCombina(f, "Limitações ao poder de tributar") === 0,
       "I1 combina = fração das palavras do nome do tópico achadas no julgado: " + [api.jurCombina(f, "Responsabilidade tributária"), api.jurCombina(f, "Crédito tributário"), api.jurCombina(f, "Limitações ao poder de tributar")]);
    const cand = [{ chave: "a›lim", disciplina: "A", topico: "Limitações ao poder de tributar" }, { chave: "a›resp", disciplina: "A", topico: "Responsabilidade tributária" }];
    ok(api.jurSugerirTopico(f, cand, "a›lim").chave === "a›resp", "I1a sugere o que mais combina");
    ok(api.jurSugerirTopico(f, cand, "a›resp") === null, "I1b já está no melhor: nada a sugerir");
    ok(api.jurSugerirTopico({ tags: ["imunidade"], tese: "x" }, cand, "a›lim") === null, "I1c combinação fraca (menos da metade): fica onde está");
    ok(api.jurSugerirTopico({ tags: ["tributária"], tese: "" }, [{ chave: "a›x", disciplina: "A", topico: "Crédito tributário" }, { chave: "a›y", disciplina: "A", topico: "Dívida tributária" }], "a›x") === null,
       "I1d empate com o aberto: fica no aberto");
    ok(api.jurSugerirTopico({ tags: ["tributária"], tese: "" }, [{ chave: "a›lim", disciplina: "A", topico: "Limitações ao poder de tributar" }, { chave: "a›div", disciplina: "A", topico: "Dívida ativa tributária municipal" }], "a›lim") === null,
       "I1e combinação fraca (1 de 4 palavras) não basta, mesmo melhor que a do aberto");
    ok(api.jurSugerirTopico({ tags: ["tributária"], tese: "" }, [{ chave: "a›y", disciplina: "A", topico: "Dívida tributária" }, { chave: "a›x", disciplina: "A", topico: "Crédito tributário" }], "a›x") === null,
       "I1f empate com o aberto (que vem DEPOIS na lista): fica no aberto");
    /* o caso real (Súmula 430 com o edital do ISS): a tese cita "obrigação tributária" de passagem; as etiquetas dizem o assunto */
    const s430 = { tags: ["responsabilidade tributária", "sócio-gerente"], tese: "O inadimplemento da obrigação tributária pela sociedade não gera a responsabilidade solidária do sócio-gerente." };
    const c3 = [{ chave: "a›lim", disciplina: "A", topico: "Limitações ao poder de tributar" }, { chave: "a›obr", disciplina: "A", topico: "Obrigação tributária" }, { chave: "a›resp", disciplina: "A", topico: "Responsabilidade tributária" }, { chave: "a›normas", disciplina: "A", topico: "Normas gerais de Direito Tributário" }];
    const sug = api.jurSugerirTopico(s430, c3, "a›lim");
    ok(sug && sug.chave === "a›resp", "I1g palavra das ETIQUETAS pesa mais que a citada de passagem na tese: " + (sug && sug.chave));
    ok(api.jurSugerirTopico({ tags: ["tributário"], tese: "algo tributário" }, c3, "a›lim") === null, "I1h uma palavra comum a muitos tópicos ('tributário') não decide sozinha");
  }

  /* I2-I5: o lote com destinos */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.edCriar("ISS", EDITAL);
    api.jurAbrir(D, "Limitações ao poder de tributar", "incluir");
    api.$("jurColar").value = JSON.stringify({ julgados: [
      { tribunal: "STJ", classe: "Súmula", numero: "430", tese_curta: "O inadimplemento não gera, por si só, a responsabilidade solidária do sócio-gerente.", resumo: "r1", tags: ["responsabilidade tributária", "sócio-gerente"] },
      { tribunal: "STJ", classe: "Súmula", numero: "436", tese_curta: "A entrega de declaração reconhecendo o débito constitui o crédito tributário.", resumo: "r2", tags: ["crédito tributário", "constituição"] },
      { tribunal: "STF", classe: "RE", numero: "601720", tese_curta: "A imunidade recíproca não alcança arrendatária.", resumo: "r3", tags: ["imunidade recíproca"] },
    ] });
    api.jurColar();
    const cards = api.$("jurLoteCards").querySelectorAll(".jur-lote-card");
    const sels = [0, 1, 2].map((i) => api.$("jurLoteCards").querySelectorAll("select").find((s) => s.id === "jurLoteDestino_" + i));
    ok(cards.length === 3 && sels.every(Boolean) && sels[0].children.length === 3, "I2 cada ficha tem 'Guardar em' com os tópicos do edital: " + (sels[0] && sels[0].children.map((o) => o.textContent).join(" | ")));
    ok(/\(aberto agora\)/.test(sels[0].children[0].textContent), "I2a o tópico aberto vem primeiro e marcado");
    const kResp = api.matChave(D, "Responsabilidade tributária"), kCred = api.matChave(D, "Crédito tributário"), kLim = api.matChave(D, "Limitações ao poder de tributar");
    ok(sels[0].value === kResp && sels[1].value === kCred && sels[2].value === kLim, "I3 o app sugeriu o tópico de cada um pelo assunto (o de imunidade fica no aberto): " + sels.map((s) => s.value).join(" | "));
    const tags = cards.map((c) => c.querySelectorAll(".jur-lote-tag").filter((x) => /sugerido/.test(cls(x))).map((x) => x.textContent).join());
    ok(tags[0] === "→ Responsabilidade tributária" && tags[1] === "→ Crédito tributário" && tags[2] === "", "I3a a sugestão é dita na ficha: " + tags.join(" | "));
    ok(api.$("btnJurSalvar").textContent === "Guardar 3 julgado(s): 1 neste tópico, 2 em outros", "I3b o botão diz quantos vão para outros tópicos: " + api.$("btnJurSalvar").textContent);
    /* trocar: o segundo vai para o aberto */
    sels[1].value = kLim; sels[1].onchange();
    await api.jurSalvarLote();
    const de = (k) => api.jurDoTopico(k).map((j) => j.numero).sort().join();
    ok(de(kResp) === "430" && de(kLim) === "436,601720" && de(kCred) === "", "I4 cada um foi guardado no SEU destino (a troca valeu): resp=" + de(kResp) + " lim=" + de(kLim) + " cred=" + de(kCred));
    ok(api.jurLista().find((j) => j.numero === "430").topicos.length === 1, "I4a e só lá (não também no aberto)");
  }

  /* I5: sem edital que tenha o tópico aberto, os destinos são os tópicos da estante */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.matGravar(api.matChave("Tributário", "Responsabilidade tributária"), "Resumo.", { disciplina: "Tributário", topico: "Responsabilidade tributária" });
    api.jurAbrir("Tributário", "Outro assunto", "incluir");
    api.$("jurColar").value = JSON.stringify({ julgados: [
      { tribunal: "STJ", classe: "Súmula", numero: "430", tese_curta: "Responsabilidade do sócio.", resumo: "r", tags: ["responsabilidade tributária"] },
      { tribunal: "STJ", classe: "Súmula", numero: "999", tese_curta: "Outra coisa.", resumo: "r", tags: ["qualquer"] },
    ] });
    api.jurColar();
    const s0 = api.$("jurLoteCards").querySelectorAll("select").find((s) => s.id === "jurLoteDestino_0");
    ok(s0 && s0.value === api.matChave("Tributário", "Responsabilidade tributária"), "I5 sem edital, sugere entre os tópicos da estante");
  }

  /* I6: textos */
  {
    const { api } = rodar();
    ["jur_lote_destino", "jur_lote_destino_aberto", "jur_lote_sugerido", "jur_lote_sugerido_aj", "jur_lote_outros"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "I6 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
