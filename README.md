# Editora do Vítor

Um app para Windows onde a criança escreve e ilustra os próprios livros e mangás. Ela escreve a história com as próprias palavras, e a IA desenha o personagem, divide cada página em quadrinhos e coloca os balões de fala. No final, o livro pode ser salvo em PDF.

A IA usa a cota grátis da Cloudflare, que dá para umas 40 páginas de mangá por dia. Quando a cota acaba, ela volta no dia seguinte, sem cobrar nada.

## Como instalar

1. Abra a página [Releases](../../releases/latest) e baixe o arquivo **Editora.do.Vitor.Setup.1.0.0.exe**.
2. Abra o arquivo baixado. Se o Windows mostrar o aviso "O Windows protegeu o computador", clique em **Mais informações** e depois em **Executar assim mesmo**. O aviso aparece porque o app não tem assinatura digital paga, e não porque tem algum problema.
3. Siga o instalador. Ele cria um atalho na área de trabalho.

## Como configurar a IA (uma vez só, feito por um adulto)

Cada pessoa usa a própria conta da Cloudflare. A conta é grátis e não pede cartão de crédito.

1. Entre em [dash.cloudflare.com](https://dash.cloudflare.com) e crie uma conta (ou faça login).
2. Copie o **ID da conta**. Ele aparece no endereço da página, logo depois de `dash.cloudflare.com/`. É um código de 32 letras e números.
3. Crie o **token**: clique no ícone do seu perfil, vá em **Tokens de API**, clique em **Criar token**, escolha o modelo **IA para trabalhadores (Workers AI)**, confirme e copie o código que aparecer.
4. No app, abra a **Área dos pais**, cole o ID da conta e o token, aperte **Testar** e depois **Salvar**.
5. Se quiser, crie uma **senha dos pais** na mesma tela, para a criança não mexer no token sem querer.

O token fica guardado só no seu computador e não é enviado para ninguém além da Cloudflare.

## Onde ficam os livros

Tudo fica salvo no próprio computador: os textos, os desenhos e uma cópia de segurança por dia (as últimas 14). O botão **Abrir pasta dos livros**, na Área dos pais, mostra onde estão.

## Para quem quer mexer no código

É preciso ter o [Node.js](https://nodejs.org) instalado.

```bash
npm install
npm start       # abre o app
npm run dist    # gera o instalador na pasta dist
```
