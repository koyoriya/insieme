# 指示書

## プロジェクト概要

README.mdを参照してください．わからないところがあったら聞いてください．

## git
### Git ブランチ戦略
- `main` ブランチ: 常にリリース可能な状態を維持
- 機能追加は `feature/<チケット番号>-<説明>` ブランチを作成
- バグ修正は `fix/<チケット番号>-<説明>` ブランチを作成
- hotfix が必要な場合は `hotfix/<説明>` ブランチを作成し、完了後 main にマージ

### コミットメッセージ規約
- フォーマット: `<タイプ>(<範囲>): <説明>`
- タイプ: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- 例: `feat(parser): 初期設定ファイルの読み込み処理を実装`

### プルリクエスト
- タイトル: `[<チケット番号>] <概要>`
- レビュアーを指名し、最低1名の承認を取得すること
- マージは手動で行う。プルリクエスト作成のみ自動化

### 開発ワークフロー
1. GitHub Issues にチケットを起票
2. 適切なブランチを作成して実装
3. ローカルでテストを実行し、Lint が通ることを確認
4. リモートにプッシュし、プルリクエストを作成
5. コードレビュー → 必要に応じて修正
6. マージ後、自動デプロイが成功することを確認

### テストと CI/CD
- プロジェクトルートに `.github/workflows/ci.yml` を配置
- プッシュ／プルリクエスト時に以下を実行:
  - `npm install && npm test`
  - `npm run lint`
  - ビルド: `npm run build`
- デプロイは GCP Cloud Run へ自動実行

## 使用ツール
- Git
- Node.js (>=16.x)
- pnpm
- Next.js
- Contentlayer
- Docker
- GitHub CLI
- GCP Cloud SDK (gcloud)
- Cloudflare CLI (wrangler)
- VSCode（推奨）


## その他

エラーが入力された時に，すぐに機能を改変・追加せずに，原因を追求してください．
