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
| フロントエンド | Next.js + Tailwind CSS | 静的Webアプリケーション |
| ホスティング | Firebase Hosting | 静的サイト配信 |
| バックエンド | Firebase Functions (Node.js) | サーバーレスAPI |
| LLM | **Gemma**（GCP Vertex AI） | 問題生成・添削 |
| データベース | Cloud Firestore | NoSQLデータベース |
| 認証 | Firebase Authentication | ユーザー認証 |
| インフラ | **Firebase (Google Cloud)** | サーバーレスプラットフォーム |

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
make setup-firebase      # Firebaseの自動セットアップ
make test               # 全テストの実行
make dev-frontend       # フロントエンド開発サーバー起動
make dev-functions      # Firebase Functions開発サーバー起動
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

# Firebaseプロジェクトの自動セットアップ
make setup-firebase PROJECT_ID=your-project-id

# Firebase CI token取得（GitHub Actions用）
make get-firebase-token
```

### 📝 GitHub Secrets

以下のSecretsをGitHubリポジトリに設定してください：

| Secret名 | 取得方法 |
|----------|----------|
| `FIREBASE_PROJECT_ID` | FirebaseプロジェクトID |
| `FIREBASE_TOKEN` | `firebase login:ci`で取得 |

### 🔄 デプロイの流れ

- **開発**: `develop` ブランチにプッシュでCIが実行
- **本番デプロイ**: `main` ブランチにマージでCI + デプロイが実行
- **手動デプロイ**: GitHub Actionsから手動実行可能

## 開発

### 🏃‍♂️ 開発サーバー起動

```bash
# フロントエンド（ポート3001）
make dev-frontend

# Firebase Functions エミュレータ
make dev-functions

# 全体のエミュレータ起動（推奨）
firebase emulators:start
```

### 🧪 テスト実行

```bash
# 全テスト
make test

# 個別実行
make test-frontend
make test-functions
```

### 🗄️ Firebase管理

```bash
# Firebaseプロジェクト状況確認
firebase projects:list

# Firestore データ確認
firebase firestore:indexes

# Firebase Functions確認
firebase functions:list

# デプロイ状況確認
firebase deploy --dry-run
```

## トラブルシューティング

### Firebaseセットアップでのエラー

#### Firebase CLI認証エラー

```bash
# Firebase再ログイン
firebase login --reauth

# 現在のユーザー確認
firebase login:list
```

#### プロジェクト権限エラー

```bash
# プロジェクトのオーナー権限があることを確認
firebase projects:list

# Firebase Hostingが有効になっていることを確認
# https://console.firebase.google.com/project/your-project/hosting
```

#### 環境変数エラー

- `.env.local`ファイルが正しく設定されていることを確認
- Firebase Console > Project Settings で正しい値を取得

#### ビルドエラー

```bash
# 依存関係の再インストール
cd frontend && npm ci
cd ../functions && npm ci

# キャッシュクリア
npm cache clean --force

# ビルドテスト
npm run build
```

#### デプロイエラー

```bash
# Firebase CLIバージョン確認
firebase --version

# プロジェクト設定確認
firebase use

# デプロイ前テスト
firebase deploy --dry-run
```
