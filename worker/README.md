# Groq + GitHub Pages: como ativar com segurança

**O site continua hospedado no GitHub Pages.** O Cloudflare Worker é um backend separado. A chave privada fica apenas no **Secret** `GROQ_API_KEY` do Worker; não deve ser copiada para o GitHub.

## O que já foi feito
- O Worker `amv-groq-chat` foi criado pelo usuário, e `/health` e uma pergunta real à Groq foram testados com sucesso.
- O endereço público do Worker já foi configurado na branch de desenvolvimento em `assets/assistant-config.js`.
- A interface do chatbot e as seis páginas já estão preparadas nessa branch.
- `worker/wrangler.jsonc` configura duas proteções **aproximadas por localidade da Cloudflare**: 10 solicitações/minuto por IP e até 20/minuto compartilhadas. As solicitações de verificação de saúde não gastam essas cotas.
- O código do Worker neste repositório **nega acesso à Groq se os bindings não estiverem ativos**. Isso impede o uso ilimitado caso o deploy seja feito incorretamente.

## Falta ativar os bindings do Worker (Cloudflare)

Como o usuário começou colando o código manualmente no editor da Cloudflare, os bindings de rate limiting **ainda não existem** na versão publicada. A maneira simples de ativá-los sem terminal é conectar o Worker já existente ao GitHub:

1. Abra https://dash.cloudflare.com/ → **Workers & Pages** → **amv-groq-chat**.
2. Clique em **Settings → Builds → Connect**, autorize o GitHub e selecione o repositório `Vizzahck/AMVCONECTAR2.0`.
3. Em **Production branch**, selecione `feat/assistente-groq-cloudflare` (até que a revisão seja mesclada na `main`).
4. Configure **Root directory** = `worker`, **Build command** = vazio, **Deploy command** = `npx wrangler deploy`.
5. Salve. Se nenhum deploy iniciar, faça um novo commit na branch pelo GitHub para dispará-lo. O código e os bindings serão publicados juntos.
6. Confirme que o Secret `GROQ_API_KEY` continua configurado em **Settings → Variables and Secrets**. Não cole a chave no repositório.
7. Teste `GET https://amv-groq-chat.luisdavisilva16.workers.dev/health` (200) e uma pergunta POST `/chat` com `Content-Type: application/json`, `Origin: https://vizzahck.github.io` e Body `{"message":"O que é a AMV?"}`. A resposta 200 deve conter `answer`.
8. Só depois de testar e confirmar o binding, faça o merge do Pull Request #1 para publicar o chat no GitHub Pages.

Se a interface de Builds não permitir a seleção da pasta raiz, alternativa pelo computador: instale Node.js, clone a branch, abra o terminal dentro de `worker/` e execute `npx wrangler login` e `npx wrangler deploy`.

A URL pública do Worker não é secreta. O repositório **não pode** conter a chave real da Groq.

## Limitações das proteções

O Rate Limiting API é aproximado e conta requisições separadamente por ponto de presença da Cloudflare, não é um limite global rígido. IPs compartilhados podem afetar mais de um visitante. Um cliente fora do navegador pode falsificar o cabeçalho `Origin`; CORS não é autenticação. Monitore também as cotas da Groq. Para necessidades maiores, considere desafios anti-bot e limitação estrita com Durable Objects.

## Arquivos

- `worker/src/index.js`: Worker para `POST /chat` com acesso à Groq, segurança e mensagens de erro.
- `worker/wrangler.jsonc`: configuração para produção e rate limit bindings.
- `assets/assistant-ai.js` e `assets/assistant-ai.css`: interface com perguntas livres e sugestões do FAQ.
- `assets/assistant-config.js`: URL pública do Worker, sem chave.
- `assets/site.js`: mantém Formspree, navegação, menu e tema originais.

**Importante:** o código alterado neste repositório não substitui automaticamente o que foi colado manualmente na Cloudflare. A conexão Git e um deploy com Wrangler são necessários para ativar as proteções.