# デプロイメント設定

## Firebase設定

### 必要なシークレット（GitHub Actions）

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を設定してください：

#### 本番環境（mainブランチ → `insieme-463312`）
- `FIREBASE_TOKEN`: Firebase CLI のトークン
- `GEMINI_API_KEY`: Google Gemini AI API キー（本番）

#### 開発環境（developブランチ → `insieme-dev-d7459`）
- `GEMINI_API_KEY_DEV`: Google Gemini AI API キー（開発）

### Firebase CLI トークンの取得

```bash
# Firebase CLI にログイン
firebase login:ci

# 表示されたトークンを FIREBASE_TOKEN に設定
```

### プロジェクトIDの設定

`.firebaserc` ファイルの設定：

```json
{
  "projects": {
    "default": "insieme-463312",
    "dev": "insieme-dev-d7459",
    "production": "insieme-463312"
  }
}
```

## デプロイフロー

### 自動デプロイ

- **main ブランチ**: 本番環境（`insieme-463312`）への自動デプロイ
- **develop ブランチ**: 開発環境（`insieme-dev-d7459`）への自動デプロイ

### 手動デプロイ

GitHub Actions の workflow_dispatch を使用して手動実行可能

### ローカルデプロイ

```bash
# 全体をデプロイ
firebase deploy

# Hosting のみ
firebase deploy --only hosting

# Functions のみ
firebase deploy --only functions

# Firestore ルールのみ
firebase deploy --only firestore:rules
```

## 環境変数管理

### Functions の環境変数

```bash
# 環境変数を設定
firebase functions:config:set gemini.api_key="YOUR_API_KEY"

# 設定された環境変数を確認
firebase functions:config:get

# コード内での使用
import * as functions from 'firebase-functions';
const apiKey = functions.config().gemini.api_key;
```

### フロントエンドの環境変数

`.env.local` ファイル（ローカル開発用）：
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

## トラブルシューティング

### デプロイエラーの対処

1. **権限エラー**: Firebase プロジェクトの IAM 設定を確認
2. **ビルドエラー**: ローカルで `npm run build` が成功することを確認
3. **環境変数エラー**: GitHub Secrets の設定を確認

### ログの確認

```bash
# Functions のログを確認
firebase functions:log

# 特定の関数のログ
firebase functions:log --only generateProblems
```