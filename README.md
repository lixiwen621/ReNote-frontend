# ReNote Frontend

Vue 3 + Vite；样式 **Tailwind CSS v4** + **daisyUI 5**；路由 **Vue Router**；状态 **Pinia**。

## 开发

```sh
npm install
npm run dev
```

- 默认进入 **`/login`**，登录成功进入 **`/`**（复习任务联调页）。
- 复制 `.env.development.example` 为 `.env.development`。建议 **`VITE_API_BASE_URL` 留空**，由 Vite 将 `/api` **代理到** `http://localhost:8083`，避免浏览器跨域（CORS）问题。

## 登录与鉴权（前端）

- 登录：`POST /api/auth/login`（见 `.specify/specs/auth-login/contracts/auth-api.md`）。
- 成功后将 `accessToken` 存入 `localStorage`，后续请求自动带 `Authorization: Bearer <token>`。
- 业务接口由后端根据 Token 识别用户；创建/完成复习任务时的 `userId` 取自登录用户信息。

## 构建

```sh
npm run build
```

## 技术栈

- [Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/)
- [Vue Router](https://router.vuejs.org/) + [Pinia](https://pinia.vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)（`@tailwindcss/vite`）
- [daisyUI](https://daisyui.com/)

## IDE

推荐 [VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（勿与 Vetur 同时启用）。
