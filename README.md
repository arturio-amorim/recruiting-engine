# recruiting-engine

Action Engine de triagem da **Norte Talentos**.

A rubrica da vaga, o ATS e o aviso no Slack moram no engine. Características protegidas ficam de fora do score.

| Capability | Resultado |
|---|---|
| `recruiting.screen-candidate` | Score com evidência por critério |
| `recruiting.record-screening` | Registro persistido |
| `recruiting.notify-review` | Slack só se a revisão humana for necessária |

Candidatos de demonstração: `CAND-91` (revisão recomendada) e `CAND-08` (sem aviso).

```sh
npm install
npm run check
npm run direct
```

MIT
