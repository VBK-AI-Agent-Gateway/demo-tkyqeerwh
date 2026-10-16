# SDD Page（规格驱动开发演示页）

## SPEC
一个单页静态网站，展示 SDD 工作流：hero 区、SPEC/PLAN/TASKS 三卡片、可交互任务清单（勾选更新进度条）、响应式三档断点、无障碍达标（axe 零 serious/critical）。

## PLAN
- 栈：纯静态 HTML + 内嵌 CSS + 原生 JS，无构建、无 npm 依赖。
- 文件：index.html（唯一入口）、evidence/（axe 报告与截图）。
- 部署：GitHub Pages，仓库 demo-test，子目录 sdd-page/。

## TASKS
- T1: 环境与密钥检查
- T2: README（本文件）
- T3: index.html 完整页面
- T4: 本地校验
- T5: evidence 报告
- T6: 拷贝进 demo-test/sdd-page
- T7: push main
- T8: Pages built 验证并交付
