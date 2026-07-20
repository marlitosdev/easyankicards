# -*- coding: utf-8 -*-
"""
EasyAnkiCards — núcleo de processamento (parser + exportadores).

Formato de entrada:
    Pergunta :: Resposta
    Pergunta :: Resposta :: tag1, tag2
    Texto com {{c1::lacuna}}                      -> cartão Cloze
    Texto com {{c1::lacuna}} :: Extra :: tags     -> Cloze com verso extra

Regras de tolerância (v2):
  * Uma linha SEM delimitador "::" e sem lacuna nova continua o cartão
    anterior (recupera quebras de linha perdidas ao colar de PDF/Word).
  * Uma LINHA EM BRANCO encerra o cartão atual — use-a para separar
    cartões com segurança.
  * Lacuna cloze aberta ({{c1:: sem }}) continua na linha seguinte.
  * Linhas iniciadas com "#" são comentários.

ARQUITETURA (guia rápido de manutenção):
    _agrupar_linhas()   junta linhas quebradas em "cartões lógicos"
                        (regras de continuação: cloze aberto, linha
                        começando com '::', cartão anterior incompleto)
    _split_line()       divide por '::' protegendo lacunas {{c1::...}}
    parse_text()        monta os Card(), reorganiza campos extras e
                        chama _checar_suspeitas() para gerar issues
    export_txt()        TSV com cabeçalho de metadados do Anki 23.10+
    export_apkg()       pacote nativo via genanki; IDs de modelo fixos
                        e ID de baralho derivado do nome (hash) para
                        reimportações ATUALIZAREM em vez de duplicar
    preview_text()      resumo em texto (usado pelo CLI)
    resumo_problemas()  resumo curto para o diálogo de confirmação

Licença: MIT (arquivo LICENSE). Contribuições são bem-vindas.
"""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass, field

__version__ = "6.4.0"

# ---------------------------------------------------------------------------
# Internacionalização das mensagens do parser (pt/en/es).
# A interface chama set_language(); o padrão é português.
# _m(chave) devolve o texto no idioma atual; com kwargs, aplica .format().
# ---------------------------------------------------------------------------

LANG = "pt"

_MSG = {
    "pt": {
        "w_cloze_empty": "Linha {n}: cartão Cloze vazio — ignorado.",
        "w_no_delim": "Linha {n}: sem o delimitador '::' — ignorada. Conteúdo: {c}",
        "w_empty_field": "Linha {n}: frente ou verso vazio — ignorada.",
        "i_front_short": "frente vazia ou só pontuação ('{v}') — campo deslocado?",
        "i_back_short": "verso vazio ou só pontuação — campo deslocado?",
        "i_tags_text": "3º campo parece TEXTO, não tags — provável quebra de linha faltando entre dois cartões",
        "i_extra_fields": "a linha tinha {n} campos '::' — reorganizei em frente/verso/tags, confira o resultado",
        "i_cloze_open": "lacuna {{c...}} aberta sem fechamento",
        "p_basic": "BÁSICO", "p_cloze": "CLOZE", "p_line": "linha",
        "p_verify": "VERIFICAR",
        "p_ignored": "--- Linhas ignoradas ---",
        "p_total": "Total: {t} cartões ({b} básicos, {c} cloze)",
        "p_verify_count": "  |  {n} cartão(ões) marcados com VERIFICAR",
        "r_line": "Cartão da linha {n}: {msg}",
        "r_more": "... e mais {n} problema(s).",
    },
    "en": {
        "w_cloze_empty": "Line {n}: empty cloze card — skipped.",
        "w_no_delim": "Line {n}: missing '::' separator — skipped. Content: {c}",
        "w_empty_field": "Line {n}: empty front or back — skipped.",
        "i_front_short": "front is empty or punctuation only ('{v}') — shifted field?",
        "i_back_short": "back is empty or punctuation only — shifted field?",
        "i_tags_text": "3rd field looks like TEXT, not tags — a line break is probably missing between two cards",
        "i_extra_fields": "the line had {n} '::' fields — reorganized into front/back/tags, please review",
        "i_cloze_open": "cloze deletion {{c...}} opened but never closed",
        "p_basic": "BASIC", "p_cloze": "CLOZE", "p_line": "line",
        "p_verify": "CHECK",
        "p_ignored": "--- Skipped lines ---",
        "p_total": "Total: {t} cards ({b} basic, {c} cloze)",
        "p_verify_count": "  |  {n} card(s) flagged CHECK",
        "r_line": "Card at line {n}: {msg}",
        "r_more": "... and {n} more issue(s).",
    },
}


def set_language(lang):
    """Define o idioma das mensagens do parser ('pt' ou 'en')."""
    global LANG
    if lang in _MSG:
        LANG = lang


def _m(key, **kw):
    s = _MSG[LANG][key]
    return s.format(**kw) if kw else s



CLOZE_RE = re.compile(r"\{\{c\d+::.+?\}\}", re.DOTALL)
CLOZE_START_RE = re.compile(r"\{\{c\d+::")
DELIM = "::"


# ---------------------------------------------------------------------------
# Estruturas de dados
# ---------------------------------------------------------------------------

@dataclass
class Card:
    kind: str                      # "basic" ou "cloze"
    front: str
    back: str = ""
    tags: list = field(default_factory=list)
    line: int = 0                  # linha inicial no texto de origem
    issues: list = field(default_factory=list)   # problemas detectados


@dataclass
class ParseResult:
    cards: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    @property
    def n_basic(self):
        return sum(1 for c in self.cards if c.kind == "basic")

    @property
    def n_cloze(self):
        return sum(1 for c in self.cards if c.kind == "cloze")

    @property
    def n_suspicious(self):
        return sum(1 for c in self.cards if c.issues)

    @property
    def has_problems(self):
        return bool(self.warnings) or self.n_suspicious > 0


# ---------------------------------------------------------------------------
# Auxiliares
# ---------------------------------------------------------------------------

def _split_line(line):
    """Divide por '::' protegendo os '::' internos das lacunas cloze."""
    placeholders = []

    def _mask(m):
        placeholders.append(m.group(0))
        return "\x00{}\x00".format(len(placeholders) - 1)

    masked = CLOZE_RE.sub(_mask, line)
    parts = [p.strip() for p in masked.split(DELIM)]

    def _unmask(text):
        return re.sub(r"\x00(\d+)\x00", lambda m: placeholders[int(m.group(1))], text)

    return [_unmask(p) for p in parts]


def _parse_tags(raw):
    tags = re.split(r"[,\s]+", raw.strip())
    return [t.lstrip("#").replace(" ", "_") for t in tags if t.strip("#").strip()]


def _cloze_aberto(text):
    """True se há '{{' sem o '}}' correspondente (lacuna cortada no meio)."""
    return text.count("{{") > text.count("}}")


def _has_delim(line):
    return len(_split_line(line)) > 1


def _looks_like_tags(raw):
    """True se o texto parece uma lista de tags (curto, sem ':' nem lacunas)."""
    raw = raw.strip()
    return (bool(raw) and "{{" not in raw and ":" not in raw
            and len(raw) <= 60 and len(_parse_tags(raw)) <= 6)


# ---------------------------------------------------------------------------
# Agrupamento de linhas em cartões lógicos
# ---------------------------------------------------------------------------

def _agrupar_linhas(raw_text):
    """
    Junta linhas quebradas no meio do cartão. Devolve lista de
    (numero_da_linha_inicial, texto_completo_do_cartao).
    """
    blocos = []
    atual = None   # [linha_inicial, texto]

    for i, linha in enumerate(raw_text.splitlines(), start=1):
        s = linha.strip()
        if not s:
            atual = None            # linha em branco encerra o cartão
            continue
        if s.startswith("#") and not s.startswith("#separator"):
            continue                # comentário

        if atual is not None and _cloze_aberto(atual[1]):
            atual[1] += " " + s     # lacuna cortada: sempre continua
        elif atual is not None and s.startswith(DELIM):
            atual[1] += " " + s     # linha começando com '::' continua o cartão
        elif (atual is not None and not _has_delim(atual[1])
              and not CLOZE_RE.search(atual[1])):
            atual[1] += " " + s     # cartão anterior incompleto: absorve a linha
        elif _has_delim(s) or CLOZE_START_RE.search(s):
            atual = [i, s]          # linha "completa" inicia novo cartão
            blocos.append(atual)
        elif atual is not None:
            atual[1] += " " + s     # continuação de quebra perdida
        else:
            atual = [i, s]          # linha órfã: vira candidato (gerará aviso)
            blocos.append(atual)

    return [(l, t) for l, t in blocos]


# ---------------------------------------------------------------------------
# Heurísticas de campos suspeitos
# ---------------------------------------------------------------------------

def _checar_suspeitas(card, raw_parts):
    issues = []
    if card.kind == "basic":
        if len(card.front.strip(".!?,;- ")) < 2:
            issues.append(_m("i_front_short", v=card.front))
        if len(card.back.strip(".!?,;- ")) < 2:
            issues.append(_m("i_back_short"))
    if len(raw_parts) == 3:
        raw_tags = raw_parts[2]
        if ("{{" in raw_tags or ":" in raw_tags or len(raw_tags) > 60
                or len(_parse_tags(raw_tags)) > 6):
            issues.append(_m("i_tags_text"))
    if card.kind == "cloze" and _cloze_aberto(card.front):
        issues.append(_m("i_cloze_open"))
    return issues


# ---------------------------------------------------------------------------
# Parser principal
# ---------------------------------------------------------------------------

def parse_text(raw_text, global_tags=None):
    result = ParseResult()
    global_tags = global_tags or []

    for num_linha, texto in _agrupar_linhas(raw_text):
        is_cloze = bool(CLOZE_RE.search(texto))
        parts = _split_line(texto)
        extra_issue = None

        # Campos extras (mais de 3 '::'): reorganiza de forma inteligente —
        # último campo vira tags se parecer tags; campos que são só
        # pontuação (ex.: '.') são descartados; o resto compõe o verso.
        if len(parts) > 3:
            if _looks_like_tags(parts[-1]):
                tags_raw, meio = parts[-1], parts[1:-1]
            else:
                tags_raw, meio = "", parts[1:]
            meio = [p for p in meio if p.strip(".!?,;- ")]
            front = parts[0]
            back = "<br>".join(meio)
            tags = _parse_tags(tags_raw)
            extra_issue = _m("i_extra_fields", n=len(parts))
        else:
            front = parts[0]
            back = parts[1] if len(parts) >= 2 else ""
            # descarta verso que é só pontuação em cartões cloze (ex.: ':: .')
            if is_cloze and back and not back.strip(".!?,;- "):
                back = ""
            tags = _parse_tags(parts[2]) if len(parts) >= 3 else []

        if is_cloze:
            if not front:
                result.warnings.append(_m("w_cloze_empty", n=num_linha))
                continue
            card = Card("cloze", front, back, global_tags + tags, num_linha)
        else:
            if len(parts) < 2:
                result.warnings.append(_m("w_no_delim", n=num_linha, c=repr(texto[:60])))
                continue
            if not front or not back:
                result.warnings.append(_m("w_empty_field", n=num_linha))
                continue
            card = Card("basic", front, back, global_tags + tags, num_linha)

        card.issues = _checar_suspeitas(card, parts)
        if extra_issue:
            card.issues.append(extra_issue)
        result.cards.append(card)

    return result


# ---------------------------------------------------------------------------
# Exportação .txt
# ---------------------------------------------------------------------------

def _txt_field(text):
    return text.replace("\t", " ").replace("\n", "<br>")


def export_txt(result, deck_name, path):
    """
    Gera .txt de importação (Anki 23.10+).

    Usa uma COLUNA de deck (#deck column) em vez de apenas o cabeçalho
    #deck: — conforme o manual do Anki, o cabeçalho só pré-seleciona o
    baralho SE ele já existir, enquanto a coluna de deck CRIA o baralho
    (com toda a hierarquia "A::B::C") caso não exista. Assim a importação
    sempre cai na pasta certa, sem depender de configuração manual.
    O cabeçalho #deck: é mantido como redundância inofensiva.
    """
    lines = [
        "#separator:tab",
        "#html:true",
        "#notetype column:1",
        "#deck column:2",
        "#deck:{}".format(deck_name),
        "#tags column:5",
    ]
    for c in result.cards:
        notetype = "Cloze" if c.kind == "cloze" else "Basic"
        row = [notetype, deck_name, _txt_field(c.front), _txt_field(c.back),
               " ".join(c.tags)]
        lines.append("\t".join(row))

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    return path


# ---------------------------------------------------------------------------
# Exportação .apkg
# ---------------------------------------------------------------------------

_CSS = """
.card {
  font-family: -apple-system, "Segoe UI", Arial, sans-serif;
  font-size: 20px;
  text-align: center;
  color: #1a1a2e;
  background-color: #fdfdfd;
}
.cloze { font-weight: bold; color: #0b6bcb; }
"""

_BASIC_MODEL_ID = 1607392319
_CLOZE_MODEL_ID = 1607392320


def _stable_deck_id(deck_name):
    digest = hashlib.md5(deck_name.encode("utf-8")).hexdigest()
    return int(digest[:10], 16) % (10 ** 10) or 1234567890


def export_apkg(result, deck_name, path):
    import genanki

    basic_model = genanki.Model(
        _BASIC_MODEL_ID, "Gerador Flashcards - Básico",
        fields=[{"name": "Frente"}, {"name": "Verso"}],
        templates=[{
            "name": "Cartão 1",
            "qfmt": "{{Frente}}",
            "afmt": "{{FrontSide}}<hr id='answer'>{{Verso}}",
        }],
        css=_CSS,
    )
    cloze_model = genanki.Model(
        _CLOZE_MODEL_ID, "Gerador Flashcards - Cloze",
        model_type=genanki.Model.CLOZE,
        fields=[{"name": "Texto"}, {"name": "Extra"}],
        templates=[{
            "name": "Cloze",
            "qfmt": "{{cloze:Texto}}",
            "afmt": "{{cloze:Texto}}<br>{{Extra}}",
        }],
        css=_CSS,
    )

    deck = genanki.Deck(_stable_deck_id(deck_name), deck_name)
    for c in result.cards:
        model = cloze_model if c.kind == "cloze" else basic_model
        deck.add_note(genanki.Note(model=model, fields=[c.front, c.back], tags=c.tags))

    genanki.Package(deck).write_to_file(path)
    return path


# ---------------------------------------------------------------------------
# Pré-visualização
# ---------------------------------------------------------------------------

def preview_text(result):
    """Resumo em texto simples dos cartões (usado pelo CLI)."""
    out = []
    for n, c in enumerate(result.cards, start=1):
        tipo = _m("p_cloze") if c.kind == "cloze" else _m("p_basic")
        marca = "  <-- " + _m("p_verify") if c.issues else ""
        out.append("{:>3}. [{}] ({} {}){}".format(n, tipo, _m("p_line"), c.line, marca))
        out.append("     F: {}".format(c.front))
        if c.back:
            out.append("     V: {}".format(c.back))
        if c.tags:
            out.append("     tags: {}".format(", ".join(c.tags)))
        for issue in c.issues:
            out.append("     (!) {}".format(issue))
        out.append("")
    if result.warnings:
        out.append(_m("p_ignored"))
        out.extend("(!) {}".format(w) for w in result.warnings)
        out.append("")
    resumo = _m("p_total", t=len(result.cards), b=result.n_basic, c=result.n_cloze)
    if result.n_suspicious:
        resumo += _m("p_verify_count", n=result.n_suspicious)
    out.append(resumo)
    return "\n".join(out)


def resumo_problemas(result, max_itens=6):
    """Resumo curto dos problemas, usado no diálogo de confirmação."""
    itens = []
    for c in result.cards:
        for issue in c.issues:
            itens.append(_m("r_line", n=c.line, msg=issue))
    itens.extend(result.warnings)
    extra = len(itens) - max_itens
    texto = "\n".join("• " + i for i in itens[:max_itens])
    if extra > 0:
        texto += "\n" + _m("r_more", n=extra)
    return texto


def escape_html_if_needed(text):
    return html.escape(text)
