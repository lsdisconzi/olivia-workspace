#!/usr/bin/env python3
"""Extract the 13 hero morph scenes from _lsd/morphs/index-br.html into
standalone self-animating SVGs (scenes/br/scene-*.svg).

- Scene markup is pulled straight from the HTML (byte-exact `<g>` content).
- CSS custom properties are replaced with their hex values.
- Only the keyframes a scene actually uses are embedded.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', 'index-br.html'))
OUT = os.path.normpath(os.path.join(HERE, '..', 'scenes', 'br'))

# Keyframes exactly as defined in index-br.html <style> (lines 48-84)
KEYFRAMES = {
    'sway': '''@keyframes sway {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(1.2deg); }
}''',
    'sway-r': '''@keyframes sway-r {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-1deg); }
}''',
    'fruit-glow': '''@keyframes fruit-glow {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}''',
    'subtle-pulse': '''@keyframes subtle-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.6; }
}''',
    'scale-balance': '''@keyframes scale-balance {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(2deg); }
  75% { transform: rotate(-2deg); }
}''',
    'leaf-rustle': '''@keyframes leaf-rustle {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(3deg) scale(1.02); }
}''',
    'pulse-beat': '''@keyframes pulse-beat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}''',
}

# Document-order scene ids with pt-BR labels (from scene comments / meta)
SCENES = [
    ('branch',   'Ramo de oliveira — Origem'),
    ('pencil',   'Lápis — Educação'),
    ('scale',    'Balança — Direito'),
    ('tree',     'Oliveira completa — Ecossistema'),
    ('network',  'Rede — Inteligência'),
    ('book',     'Livro — Ontologia'),
    ('heart',    'Coração — Terceiro Setor'),
    ('dna',      'DNA — Ciências da Vida'),
    ('pulse',    'Pulso — Saúde'),
    ('capitol',  'Capitólio — Governo'),
    ('chart',    'Gráfico — Financeiro'),
    ('school',   'Escola — Educação'),
    ('headset',  'Headset — Suporte'),
]

# CSS var -> hex. Order matters: longest / most specific first.
VAR_MAP = [
    ('var(--eco-verde-3)', '#2d785a'),
    ('var(--eco-verde)',   '#1c4532'),
    ('var(--eco-terra-light)', '#d4733e'),
    ('var(--eco-terra)',   '#c4622d'),
    ('var(--eco-tinta)',   '#1a1814'),
    ('var(--eco-claro)',   '#9a9088'),
]

ANIM_RE = re.compile(r'animation:\s*([a-zA-Z0-9-]+)')
DIV_RE = re.compile(
    r'<div class="morph-scene[^"]*" id="scene-(%s)">\s*<svg[^>]*>(.*?)</svg>'
    % '|'.join(re.escape(s) for s, _ in SCENES),
    re.S,
)


def sub_colors(text):
    for var, hexval in VAR_MAP:
        text = text.replace(var, hexval)
    return text


def main():
    doc = open(SRC, encoding='utf-8').read()
    os.makedirs(OUT, exist_ok=True)
    count = 0
    for index, (sid, label) in enumerate(SCENES, start=1):
        m = DIV_RE.search(doc)
        if not m or m.group(1) != sid:
            print(f'ERROR: scene-{sid} not found in {SRC}')
            sys.exit(1)
        inner = m.group(2).strip()

        anims = set(ANIM_RE.findall(inner))
        kf_block = '\n'.join(KEYFRAMES[k] for k in KEYFRAMES if k in anims)
        if not kf_block:
            print(f'WARN: scene-{sid} uses no known keyframes')

        body = sub_colors(inner)
        # Re-indent inner markup by 2 spaces for readability
        body = '\n'.join('  ' + line if line.strip() else line for line in body.splitlines())

        out = (
            f'<!-- Scene {index}/13 — scene-{sid} ({label}) — '
            f'extracted from _lsd/morphs/index-br.html -->\n'
            f'<svg viewBox="0 0 280 260" xmlns="http://www.w3.org/2000/svg">\n'
            f'  <style>\n{kf_block}\n  </style>\n{body}\n'
            f'</svg>\n'
        )
        path = os.path.join(OUT, f'scene-{sid}.svg')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(out)
        print(f'  ✓ scene-{sid}  ({len(anims)} keyframes: {", ".join(sorted(anims)) or "none"})')
        count += 1
        doc = doc[m.end():]  # continue searching after this match (id order)
    print(f'Done — {count} scenes written to {OUT}')


if __name__ == '__main__':
    main()
