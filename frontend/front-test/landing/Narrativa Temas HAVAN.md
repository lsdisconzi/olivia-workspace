# Narrativa dos Temas HAVAN — para a equipe

*Companha a proposta visual `Proposta Temas HAVAN.html`. Texto de apoio para validação interna do time de marketing da HAVAN.*

---

## Por que mudamos a paleta

A proposta anterior colocava o vermelho no centro — como cor de ação principal. Ao revisar a identidade da HAVAN (documento *Identidade da Marca & Linguagem de Design Digital*), ficou claro que o vermelho, na linguagem digital da marca, é **reserva**: aparece quase só em descontos e urgência, como gatilho de atenção. O protagonismo cromático pertence ao **azul** (navegação, confiança, estabilidade), com **amarelo** aparecendo de forma seletiva para energia e **verde** carregando o sentido de crescimento e prosperidade.

Por isso, esta nova proposta reorganiza a hierarquia:

- **Azul** → navegação, cabeçalho, botões e links (confiança, estabilidade, reconhecimento)
- **Amarelo** → acento de energia e sinalização (detalhe de apoio, não cor de fundo)
- **Verde** → selos, confirmações e áreas de crescimento
- **Vermelho** → reduzido a um pequeno detalhe de apoio, coerente com o papel que a própria HAVAN lhe dá

Assim, o tema passa a "honrar a bandeira" de forma mais fiel: verde e amarelo presentes, azul como estrutura, e não um vermelho dominante que a marca não usa dessa forma no dia a dia digital.

---

## As duas variações

### A · HAVAN Azul / Amarelo / Verde (cores plenas)
Alinhamento direto com o DNA digital da HAVAN. Azul de alto reconhecimento na navegação, amarelo como acento luminoso, verde para confirmações. É a escolha de **maior contraste e presença** — ideal para quem quer a marca "ligada" o tempo todo.

- Azul `#0b5cab` · Amarelo `#f4b400` · Verde `#1f7a4d`

### B · HAVAN Pastel (mesmas três cores, tom suave)
A mesma harmonia, porém arejada. Menos peso visual, mais respiro — pensada para **escrita longa e leitura contínua** no ambiente de trabalho. O azul pastel `#7fa8d6`, o amarelo `#f7d98a` e o verde `#8fc3a6` mantêm a identidade sem cansar o olho em jornadas longas.

- Azul `#7fa8d6` · Amarelo `#f7d98a` · Verde `#8fc3a6`

Ambas reaproveitam os *tokens* de design do Olivia (fontes Fraunces e Plus Jakarta Sans, raio de canto e estrutura de cartões). Por isso, cada uma entra em `base.css` como um bloco `[data-theme]` **sem quebrar nenhum layout existente**.

---

## Como isso se conecta ao Olivia — "um ecossistema, muitas portas"

Olivia não é um aplicativo único: é um **ambiente operacional de IA** onde cada organização constrói seus próprios fluxos de trabalho sobre uma base comum. Um dos princípios fundamentais é justamente esse:

> **Um ecossistema, muitas portas.** Diferentes departamentos compartilham o mesmo ambiente, cada um com suas ferramentas e permissões — derrubando silos.

A proposta de tema é um exemplo concreto desse princípio:

1. **A base é compartilhada.** Toda a estrutura de interface (grid, cartões, tipografia, raios) vem do Olivia. Não reinventamos o ambiente — reaproveitamos o que já funciona.

2. **A porta é da HAVAN.** A paleta, os acentos e as frases ("Tudo para sua família", "Acreditar no Brasil é investir em quem transforma") são da marca HAVAN. Cada departamento vê o Olivia "vestido" com a identidade que faz sentido para o seu trabalho.

3. **Ninguém fica de fora.** Assim como a HAVAN busca apelo de massa ("bons produtos para todos"), o Olivia mantém a mesma base para todos — e deixa a superfície visual ser adaptada por quem usa.

4. **Extensível por design.** O tema entra como um módulo de variáveis, não como uma reforma. É o mesmo espírito dos plugins do Olivia: o núcleo cuida de identidade, memória e governança; o específico de cada organização entra quando necessário.

Em resumo: o Olivia oferece a **porta** (o ambiente, a consistência, a governança); a HAVAN escolhe a **decoração da sua porta** (azul, amarelo, verde). O resultado é um time que reconhece o próprio ambiente de trabalho — e continua dentro do mesmo ecossistema que liga todos os departamentos.

---

## Próximo passo

Escolher entre a Opção A (cores plenas) e a Opção B (pastel). A partir daí, o bloco de variáveis é implementado em `frontend/css/base.css` e ligado no seletor de `index.html` — sem tocar no restante do layout. Também é possível combinar (por exemplo, azul pleno da A com cantos suaves da B).

> *Nota:* esta narrativa é um artefato de apoio à decisão de tema, ancorada na identidade HAVAN documentada e nos princípios do ecossistema Olivia. Conteúdo ilustrativo para validação interna.
