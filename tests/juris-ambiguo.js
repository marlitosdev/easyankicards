/* =====================================================================
 * "TEMA 981 DO STJ" CASAVA COM DOIS JULGADOS (v18.61.0)
 *
 * O caso real (backup de 17/10): o Tema 981 guardado em 14/10 e o Tema
 * 962 do lote de 16/10, cujo resumo diz "...invertendo o marco temporal
 * do Tema 962 com o do Tema 981". A busca por texto ("o RE que diz Tema
 * 69") pegava também o 962, e a lista de escolha cortava as teses nos 110
 * primeiros caracteres — onde as duas são IGUAIS ("O redirecionamento da
 * execução fiscal, quando fundado na dissolução irregular..."). Parecia
 * contaminação; não era. Agora: quem É o tema vence quem só o cita; e,
 * quando a dúvida é real, cada opção mostra onde as teses se separam e
 * por que casou.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const T981 = "O redirecionamento da execução fiscal, quando fundado na dissolução irregular da pessoa jurídica executada ou na presunção de sua ocorrência, pode ser autorizado contra o sócio ou o terceiro não sócio, com poderes de administração na data em que configurada ou presumida a dissolução irregular.";
  const T962 = "O redirecionamento da execução fiscal, quando fundado na dissolução irregular da pessoa jurídica executada ou na presunção de sua ocorrência, não pode atingir o sócio-gerente que não exercia a administração da sociedade à época da dissolução.";
  {
    const { api } = rodar();
    const a = api.jurGravar({ tribunal: "STJ", classe: "Tema", numero: "981", tese: T981 });
    const b = api.jurGravar({ tribunal: "STJ", classe: "Tema", numero: "962", tese: T962, resumo: "As bancas invertem o marco temporal do Tema 962 com o do Tema 981." });
    const c = api.jurCitacoesNoTexto("responde o sócio ao tempo da dissolução (Tema 981 do STJ)")[0];
    const r = api.jurAcharCitado(c);
    ok(r.julgado && r.julgado.id === a.id && !r.ambiguos, "A1 'Tema 981 do STJ' acha O julgado do Tema 981 — o 962, que só o menciona, não entra: " + JSON.stringify(r.ambiguos && r.ambiguos.map((x) => x.numero)));
    const r2 = api.jurAcharCitado(api.jurCitacoesNoTexto("Tema 962 do STJ")[0]);
    ok(r2.julgado && r2.julgado.id === b.id, "A2 'Tema 962' acha o 962");
    /* sem nenhum julgado que SEJA o tema, a busca pelo texto continua valendo */
    const re = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "574706", tese: "O ICMS não compõe a base de cálculo do PIS e da COFINS.", resumo: "Fixado no Tema 69 da repercussão geral." });
    const r3 = api.jurAcharCitado(api.jurCitacoesNoTexto("Tema 69 do STF")[0]);
    ok(r3.julgado && r3.julgado.id === re.id, "A3 sem guardado que SEJA o Tema 69, o RE que diz 'Tema 69' continua sendo achado");
  }
  {
    /* dúvida de verdade: a lista mostra onde as teses se separam e o porquê */
    const { api } = rodar();
    api.jurGravar({ tribunal: "", classe: "Tema", numero: "981", tese: T981 });
    api.jurGravar({ tribunal: "STJ", classe: "Tema", numero: "981", tese: T962 });
    const c = api.jurCitacoesNoTexto("Tema 981 do STJ")[0];
    const r = api.jurAcharCitado(c);
    ok(!r.julgado && r.ambiguos && r.ambiguos.length === 2, "B0 premissa: dois guardados SÃO o Tema 981");
    api.jurCitPreviewAbrir(c, r, { disciplina: "D", topico: "T" });
    const ops = (api.$("jurCitaCorpo").children || []).filter((x) => /jur-cita-opcao/.test(x.className || ""));
    ok(ops.length === 2 && ops.some((o) => /…[^—]*pode ser autorizado/.test(o.textContent)) && ops.some((o) => /…[^—]*não pode atingir/.test(o.textContent)),
       "B1 cada opção mostra o trecho a partir de onde as teses se separam ('pode ser autorizado' × 'não pode atingir'): " + ops.map((o) => o.textContent).join(" || "));
    ok(ops.every((o) => /\(é o julgado citado\)$/.test(o.textContent)), "B2 e diz por que casou: 'é o julgado citado'");
    ok(api.jurCitPontoDeDiferenca([T981, T962]) > 100 && api.jurCitPontoDeDiferenca(["abc", "xyz"]) === 0 && api.jurCitPontoDeDiferenca(["só um"]) === 0, "B3 o ponto onde as teses se separam");
  }
  {
    /* só menções (nenhum É o tema): o porquê diz 'só menciona' */
    const { api } = rodar();
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1", tese: "Tese A sobre o assunto do Tema 500.", resumo: "cita o Tema 500" });
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "2", tese: "Tese B, outra coisa, ligada ao Tema 500.", resumo: "também Tema 500" });
    const c = api.jurCitacoesNoTexto("Tema 500 do STF")[0];
    const r = api.jurAcharCitado(c);
    api.jurCitPreviewAbrir(c, r, { disciplina: "D", topico: "T" });
    const ops = (api.$("jurCitaCorpo").children || []).filter((x) => /jur-cita-opcao/.test(x.className || ""));
    ok(ops.length === 2 && ops.every((o) => /\(só menciona a citação no texto\)$/.test(o.textContent)), "C1 quem só menciona o tema diz isso: " + ops.map((o) => o.textContent).join(" || "));
  }
  {
    const { api } = rodar();
    ["jur_cit_amb_eh", "jur_cit_amb_cita"].forEach((k) => ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "D1 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
