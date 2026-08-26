# BritoTec — site institucional e loja

Abra `index.html` no navegador ou publique a pasta inteira em uma hospedagem estática. O projeto foi feito em HTML5, CSS3 e JavaScript puro, sem processo de instalação.

## O que está incluído

- Página de apresentação futurista e responsiva.
- Três páginas de solicitação de manutenção, com marca, modelo, problema, foto opcional do aparelho, nome, WhatsApp, e-mail e CPF.
- Preenchimento automático dos formulários com os dados salvos no navegador.
- Status de loja aberto/fechado que respeita o fuso de São Paulo e o horário configurado pelo painel.
- Loja de acessórios com fotos, filtros, carrinho validado por estoque, cálculo de frete simulado e cupons `BRITO10` e `MERITI15`.
- Botão **ME AVISE** para itens esgotados e fila de avisos de reposição no painel.
- Portal administrativo em `portal.html`, fora do menu público: ordens de serviço, estoque, produtos, horários, alertas, notas por funcionário e cadastro de equipe pelo proprietário.
- Animações de entrada, elementos flutuantes e transições.
- Base pronta para login real com Google via Firebase; enquanto não configurado, o modo demonstração salva o perfil localmente.

## Ativar Google Login de verdade

1. Crie um projeto em [Firebase](https://firebase.google.com/).
2. Em **Authentication → Sign-in method**, ative **Google**.
3. Registre seu site como aplicativo web e copie a configuração para `js/firebase-config.js`.
4. Em **Authentication → Settings → Authorized domains**, adicione o domínio no qual o site será publicado.

## Painel administrativo

Abra `portal.html` diretamente. O acesso inicial é configurado em `js/admin-config.js`; altere o usuário e a senha antes de demonstrar ou publicar o site. O proprietário pode cadastrar outros funcionários dentro do painel.

## Limites desta versão estática

O painel, fotos, estoque, ordens e avisos funcionam como um protótipo no **mesmo navegador**, usando armazenamento local. Um arquivo HTML estático não consegue proteger senhas, guardar dados de clientes com segurança, sincronizar estoque entre celulares/computadores diferentes nem enviar e-mails ou mensagens automáticas de verdade.

Para publicar a operação real, conecte as ações ao **Firebase Authentication**, **Firestore**, **Storage** e uma função de e-mail/WhatsApp. A estrutura atual já separa as funções no JavaScript para essa próxima integração. Não publique a versão estática com dados reais de clientes antes de configurar essa camada segura.
