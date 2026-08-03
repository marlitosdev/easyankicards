# -*- coding: utf-8 -*-
"""
EasyAnkiCards — CLI (automação e testes rápidos).

Uso:
    python cli.py entrada.txt --deck "Meu Baralho" --tags concurso
    python cli.py entrada.txt --formato apkg --lang en
"""

import argparse
import sys

import core


def main():
    ap = argparse.ArgumentParser(description="EasyAnkiCards — gera flashcards Anki a partir de texto.")
    ap.add_argument("--versao", action="version",
                    version="EasyAnkiCards v" + core.__version__)
    ap.add_argument("arquivo", help="Arquivo de texto com 'Frente :: Verso' por linha")
    ap.add_argument("--deck", default="Meu Baralho", help="Nome do baralho (use :: para subpastas)")
    ap.add_argument("--tags", nargs="*", default=[], help="Tags globais")
    ap.add_argument("--formato", choices=["txt", "apkg", "ambos"], default="ambos")
    ap.add_argument("--lang", choices=["pt", "en"], default="pt",
                    help="Idioma das mensagens")
    ap.add_argument("--saida", default=None, help="Prefixo dos arquivos de saída")
    args = ap.parse_args()

    core.set_language(args.lang)

    with open(args.arquivo, encoding="utf-8") as f:
        raw = f.read()

    result = core.parse_text(raw, global_tags=args.tags)
    print(core.preview_text(result))

    if not result.cards:
        sys.exit(1)

    prefixo = args.saida or args.deck.split("::")[-1].strip().replace(" ", "_")
    if args.formato in ("txt", "ambos"):
        print(core.export_txt(result, args.deck, prefixo + ".txt"))
    if args.formato in ("apkg", "ambos"):
        print(core.export_apkg(result, args.deck, prefixo + ".apkg"))


if __name__ == "__main__":
    main()
