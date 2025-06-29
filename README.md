# Insieme

LLMによる問題作成&添削アプリ

## 機能

|機能|画面|内容|
|-|-|-|
|ログイン|ログイン画面|ログイン/アカウント登録をする．GoogleによるSSO|
|問題作成|トップページ|LLMにより問題を作成する|
|問題閲覧|問題ページ|問題を閲覧|
|問題印刷|問題ページ|問題を印刷|
|問題添削|問題ページ|pdfで上げられた問題を添削して，点数をつけて，フィードバックを行う|

## 画面

|画面|表示内容|
|-|-|
|ログイン画面|ログインフォーム|
|トップページ|問題作成フォーム/作成した問題一覧|
|問題ページ|問題内容/印刷ボタン/提出フォーム|

## 技術スタック

| 要素 | 技術 | 用途 |
|------|------|------|
| フロントエンド | Next.js + Tailwind CSS | Webアプリケーション |
| フロントエンドホスティング | Firebase Hosting | 静的サイト配信 |
| バックエンド | FastAPI | REST API |
| バックエンドホスティング | Cloud Run | コンテナベースAPI |
| LLM | **Gemma**（GCP Vertex AI） | 問題生成・添削 |
| データベース | Cloud SQL (PostgreSQL) | データ永続化 |
| 認証 | Firebase Auth | ユーザー認証 |
| インフラ | **Google Cloud Platform（GCP）** | クラウドプラットフォーム |

## セットアップ

### 🚀 クイックスタート

```bash
# 開発環境の自動セットアップ
make setup-dev

# または手動で実行（実行権限が必要な場合）
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

> **Note**: Makefileが自動的にスクリプトに実行権限を付与するため、通常は`chmod`は不要です。

### 📋 利用可能なMakeコマンド

```bash
make help                 # 利用可能なコマンドを表示
make setup-dev           # 開発環境のセットアップ
make setup-gcp           # GCPリソースの自動セットアップ
make setup-firebase      # Firebaseの自動セットアップ
make test               # 全テストの実行
make dev-frontend       # フロントエンド開発サーバー起動
make dev-backend        # バックエンド開発サーバー起動
make clean              # クリーンアップ
```

## CI/CD セットアップ

### 🛠️ 事前準備

以下のツールのインストールが必要です：

```bash
# macOS
brew install google-cloud-sdk
npm install -g firebase-tools

# 他のOS
# Google Cloud SDK: https://cloud.google.com/sdk/docs/install
# Firebase CLI: npm install -g firebase-tools
```

### 🔧 自動セットアップ（推奨）

```bash
# 前提条件チェック
make validate-env

# GCPリソースの自動作成（正しい課金アカウントIDを使用）
make setup-gcp PROJECT_ID=your-project-id BILLING_ACCOUNT_ID=01A29F-753545-C10850

# Firebaseホスティングの自動セットアップ
make setup-firebase PROJECT_ID=your-project-id

# JWT秘密鍵の生成
make generate-secrets

# Firebase CI token取得（GitHub Actions用）
make get-firebase-token
```

### 📝 GitHub Secrets

以下のSecretsをGitHubリポジトリに設定してください：

| Secret名 | 取得方法 |
|----------|----------|
| `GCP_PROJECT_ID` | GCPプロジェクトID |
| `GCP_SA_KEY` | `./scripts/setup-gcp.sh`実行後に生成される`gcp-service-account-key.json`の内容 |
| `DATABASE_URL` | Cloud SQLの接続文字列（セットアップ完了後に表示） |
| `SECRET_KEY` | `make generate-secrets`で生成 |
| `API_URL` | `make get-api-url PROJECT_ID=your-project-id`でデプロイ後に取得 |
| `FIREBASE_TOKEN` | `make get-firebase-token`で取得 |

### 🔄 デプロイの流れ

- **開発**: `develop` ブランチにプッシュでCIが実行
- **本番デプロイ**: `main` ブランチにマージでCI + デプロイが実行
- **手動デプロイ**: GitHub Actionsから手動実行可能

## 開発

### 🏃‍♂️ 開発サーバー起動

```bash
# フロントエンド（ポート3000）
make dev-frontend

# バックエンド（ポート8000）
make dev-backend
```

### 🧪 テスト実行

```bash
# 全テスト
make test

# 個別実行
make test-frontend
make test-backend
```

### 🗄️ データベース管理

```bash
# データベースのパスワード変更
make change-db-password PROJECT_ID=your-project-id

# データベース状況確認
make check-db-status PROJECT_ID=your-project-id

# データベース接続方法表示
make connect-db PROJECT_ID=your-project-id

# デプロイ後のAPI URL取得
make get-api-url PROJECT_ID=your-project-id

# デプロイ状況確認
make check-deployment-status PROJECT_ID=your-project-id
```

## トラブルシューティング

### GCPセットアップでのエラー

#### 権限エラー (PERMISSION_DENIED)

```bash
# プロジェクトのオーナー権限があることを確認
gcloud projects get-iam-policy PROJECT_ID

# 必要に応じて権限を追加
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:your-email@gmail.com" \
  --role="roles/owner"
```

#### Vertex AI APIエラー

- Vertex AIが利用できない地域の場合は自動的にスキップされます
- 必要に応じて後でGCPコンソールから手動で有効化してください

#### 課金アカウントエラー

```bash
# 利用可能な課金アカウントを確認
make check-billing

# 特定の課金アカウントをデバッグ
make debug-billing BILLING_ACCOUNT_ID=your-billing-id PROJECT_ID=your-project-id

# 課金アカウントを手動で作成（必要な場合）
# https://console.cloud.google.com/billing
```

**よくある課金アカウントエラー:**

- 課金アカウントIDの形式が間違っている（正しい形式: `XXXXXX-XXXXXX-XXXXXX`）
- Billing Account User 権限がない
- 課金アカウントが無効・停止状態

#### サービスアカウントエラー

**Service account does not exist エラー:**

- サービスアカウント作成後にIAMロール割り当てまで少し時間がかかる場合があります
- スクリプトを再実行してください（既存のリソースはスキップされます）

**権限不足エラー:**

```bash
# 必要な権限を確認
gcloud projects get-iam-policy PROJECT_ID

# プロジェクトのオーナー権限を確認
gcloud projects get-iam-policy PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:user:your-email@gmail.com"
```
