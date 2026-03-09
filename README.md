# ⏱ TimeBlock — Guia de Instalação e Deploy

## 📁 Estrutura do Projeto

```
timeblock/
├── src/
│   ├── main.jsx        ← entrada do React
│   ├── App.jsx         ← app completo
│   └── firebase.js     ← ⚠️ VOCÊ PRECISA CONFIGURAR ESTE ARQUIVO
├── index.html
├── vite.config.js
└── package.json
```

---

## 🔥 PASSO 1 — Configurar o Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **"Criar um projeto"** → dê um nome (ex: `timeblock-app`)
3. Desative o Google Analytics (opcional) → **Criar projeto**
4. No menu lateral, clique em **"Firestore Database"**
5. Clique em **"Criar banco de dados"**
6. Escolha **"Iniciar no modo de teste"** → selecione uma região → **Concluir**
7. Volte à tela inicial do projeto → clique no ícone **`</>`** (Web app)
8. Registre o app com um apelido (ex: `timeblock-web`)
9. Copie o objeto `firebaseConfig` que aparecer
10. Cole no arquivo `src/firebase.js` substituindo os campos `"COLE_AQUI"`

---

## 💻 PASSO 2 — Rodar Localmente

```bash
# Na pasta do projeto:
npm install
npm run dev
```

Acesse http://localhost:5173 no navegador.

---

## 🚀 PASSO 3 — Deploy na Vercel

### Opção A — Via GitHub (recomendado)

```bash
# Inicialize o git na pasta do projeto
git init
git add .
git commit -m "primeiro commit"

# Crie um repositório no github.com e execute:
git remote add origin https://github.com/SEU-USUARIO/timeblock.git
git push -u origin main
```

Depois:
1. Acesse https://vercel.com → **"Add New Project"**
2. Conecte sua conta GitHub → selecione o repositório `timeblock`
3. Clique em **Deploy** — pronto! URL gerada automaticamente ✅

### Opção B — Via Vercel CLI

```bash
npm install -g vercel
vercel
```

---

## 📱 Usando no Tablet

- Abra a URL da Vercel no navegador do tablet
- Para adicionar à tela inicial: Safari → compartilhar → **"Adicionar à Tela de Início"**
- Os dados sincronizam em tempo real entre tablet e computador via Firebase

---

## 🔒 Segurança (opcional — para uso pessoal)

Por padrão o Firestore está em "modo de teste" (qualquer um pode ler/escrever).
Para proteger seus dados, adicione esta regra no Firestore → Regras:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

Para uso pessoal sem autenticação, isso já é suficiente.
