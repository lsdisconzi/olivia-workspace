# 05 · Municipal Use Cases — CPSI-Ready Problems

> This file primes the agent with **domain scenarios** common to Brazilian
> municipalities. Each case frames the public problem first, then shows
> how the CPSI would be structured. The agent should **reuse this shape**
> when diagnosing new problems.

## Case template (always follow this shape)

1. **Problema público** (uma frase).
2. **Por que CPSI faz sentido** (3 critérios).
3. **O que NÃO é CPSI** (o que seria licitação tradicional ou ETEC).
4. **Forma típica do desafio** no Termo de Referência.
5. **Métricas de sucesso** candidatas.
6. **Riscos principais** + sugestão de alocação.
7. **Forma de remuneração sugerida**.

---

## 1. Saúde — Fila e faltas em UBS

1. **Problema público:** tempo médio de espera > 90 minutos e alta taxa de *no-show* em consultas agendadas em UBS.
2. **Por que CPSI:** (a) múltiplas tecnologias candidatas (IA preditiva, WhatsApp, chatbots, triagem digital), (b) solução precisa ser validada em ambiente real do município, (c) fornecedores são startups healthtech que não encaixam em edital tradicional.
3. **Não é CPSI:** compra de servidor ou licença de prontuário já maduro → licitação tradicional.
4. **Desafio no TR:** "Reduzir em ≥ 30% o tempo médio de espera e em ≥ 20% a taxa de faltas em 3 UBSs-piloto, em 6 meses, com solução integrável ao e-SUS AB."
5. **Métricas:** tempo médio de espera (min), taxa de faltas (%), NPS do paciente, integração com e-SUS.
6. **Riscos:** integração com e-SUS (compartilhado), LGPD (Estado define DPO, fornecedor implementa), baixa adesão de profissionais (Estado).
7. **Remuneração:** preço fixo nas etapas 1–2 (PoC + protótipo) + desempenho nas etapas 3–4 (piloto).

## 2. Mobilidade — Semaforização adaptativa

1. **Problema público:** congestionamento recorrente em 5 corredores urbanos e tempos semafóricos fixos.
2. **Por que CPSI:** (a) múltiplas abordagens (câmeras + visão computacional, sensores Bluetooth/Wi-Fi, dados de operadoras), (b) depende de calibragem ao tráfego local, (c) mercado com startups e big techs.
3. **Não é CPSI:** troca de semáforos queimados → licitação tradicional.
4. **Desafio no TR:** "Reduzir ≥ 15% do tempo médio de travessia nos 5 corredores selecionados em 4 meses de piloto."
5. **Métricas:** tempo médio de travessia, filas máximas, emissões de CO₂ estimadas.
6. **Riscos:** integração com central de controle (compartilhado), dados de câmeras (LGPD — Estado), infraestrutura elétrica (Estado).
7. **Remuneração:** reembolso + incentivo fixo na instalação + variável atrelado a metas de redução.

## 3. Educação — Evasão escolar e alfabetização

1. **Problema público:** 12% de evasão no 6º ano; defasagem em leitura no 3º ano.
2. **Por que CPSI:** (a) edtechs têm soluções adaptativas novas, (b) efetividade depende de contexto sociocultural local, (c) precisa ser validado com professores reais.
3. **Não é CPSI:** compra de apostilas de editora consolidada → licitação tradicional.
4. **Desafio no TR:** "Aumentar em ≥ 20 pontos o índice de fluência em leitura em 4 escolas-piloto, em um semestre letivo, com solução usada em sala por professores da rede."
5. **Métricas:** índice de fluência, taxa de presença, engajamento por turma.
6. **Riscos:** formação docente (compartilhado), infraestrutura digital (Estado), proteção de dados de menores (LGPD + ECA — Estado define, fornecedor implementa).
7. **Remuneração:** preço fixo + bônus por meta de fluência.

## 4. Saneamento e resíduos — Coleta inteligente

1. **Problema público:** rotas de coleta de lixo superdimensionadas e descarte irregular.
2. **Por que CPSI:** (a) sensores IoT em contêineres + roteamento dinâmico é emergente, (b) depende de topologia urbana, (c) fornecedores combinam hardware + software.
3. **Não é CPSI:** varrição de rua → contrato tradicional de serviço.
4. **Desafio no TR:** "Reduzir ≥ 20% da quilometragem rodada na coleta em 2 rotas-piloto e detectar ≥ 80% dos pontos de descarte irregular em 6 meses."
5. **Métricas:** km rodados, toneladas coletadas por km, pontos críticos detectados.
6. **Riscos:** vandalismo a sensores (compartilhado), calibragem do modelo (fornecedor), custos de conectividade (Estado).
7. **Remuneração:** reembolso nas etapas iniciais + desempenho na operação.

## 5. Fiscalização tributária — Fraude de ISS

1. **Problema público:** sub-declaração de ISS em setores com histórico de evasão.
2. **Por que CPSI:** (a) IA/ML para detecção de anomalias é imatura localmente, (b) requer dados reais da Fazenda Municipal.
3. **Não é CPSI:** software de escrituração fiscal (NFS-e) já consagrado → tradicional.
4. **Desafio no TR:** "Aumentar em ≥ 15% a recuperação de ISS em setores priorizados em 6 meses de piloto, com explicabilidade das decisões do modelo."
5. **Métricas:** R$ recuperados, falsos positivos, explicabilidade auditável.
6. **Riscos:** LGPD + sigilo fiscal (compartilhado), contencioso administrativo (Estado), vieses do modelo (fornecedor).
7. **Remuneração:** preço fixo + **participação nos resultados** (Manual AGU §7.1) — compartilhamento do ganho fiscal.

## 6. Atendimento ao cidadão — Canal digital unificado

1. **Problema público:** cidadão precisa abrir múltiplos canais para SAMU, iluminação pública, ouvidoria.
2. **Por que CPSI:** (a) LLM + IVR + WhatsApp Business API é recente, (b) requer integração com sistemas legados municipais.
3. **Não é CPSI:** plataforma de CRM já madura → tradicional, **exceto** se usada para testar abordagem inovadora específica.
4. **Desafio no TR:** "Atender ≥ 80% das demandas de 3 serviços municipais no primeiro contato, com tempo médio de resposta < 2 minutos, em 5 meses de piloto."
5. **Métricas:** FCR (first-contact resolution), TMR, CSAT, acessibilidade (PCD).
6. **Riscos:** integração com legados (Estado para APIs, fornecedor para conectores), LGPD (compartilhado), regressão de atendimento humano (Estado).
7. **Remuneração:** preço fixo + desempenho (FCR).

---

## Padrão de resposta do agente para "faz sentido CPSI para X?"

```
Conclusão: Sim / Não / Depende — em 1 linha.
Porque:
 - critério 1 (maturidade da solução)
 - critério 2 (alternativas no mercado)
 - critério 3 (risco tecnológico envolvido)
Próximo passo:
 1. esboço de DOD (1 página)
 2. conversa com a Procuradoria
 3. definição de 2–3 métricas objetivas
```
