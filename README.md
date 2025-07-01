# Insieme

**LLMによるワークシート型問題作成&学習システム**

## 概要

InsiemeはGoogle Gemini AIを活用した教育支援アプリケーションです。ユーザーが指定したトピックに基づいて、自動的に学習問題を生成し、ワークシート形式で提供します。

## 主要機能

### 🎯 コア機能
- **ワークシート生成**: LLMによる自動問題作成（複数問題をセット化）
- **問題形式**: 選択問題・記述問題・論述問題の自動判定と組み合わせ
- **ユーザー認証**: Firebase Authentication（Google SSO対応）
- **回答・採点**: ワークシート単位での一括回答提出と自動採点
- **学習履歴**: 作成したワークシートと提出状況の管理

### 📊 ワークシート管理
- **状態追跡**: 作成中 → 未回答 → 提出済み → エラー状態の管理
- **縦列表示**: ダッシュボードでのワークシート一覧表示
- **メタデータ**: 難易度・トピック・作成日時・問題数の表示
- **フィルタリング**: 状態別・期間別での絞り込み

### 🔐 アクセス制御
- **プライベート**: 作成者のみがアクセス可能
- **模範解答保護**: 回答提出後のみ閲覧可能
- **編集制限**: 作成後のワークシート編集は不可

### 📱 ユーザーインターフェース
- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ対応
- **リアルタイム更新**: Firestoreによるリアルタイムデータ同期
- **直感的操作**: 使いやすいフォームとナビゲーション

## 技術スタック

| 要素 | 技術 | 用途 | 詳細 |
|------|------|------|------|
| **フロントエンド** | Next.js 15 + TypeScript | React Webアプリケーション | 静的エクスポート、App Router |
| **スタイリング** | Tailwind CSS | レスポンシブUI | ユーティリティファーストCSS |
| **ホスティング** | Firebase Hosting | 静的サイト配信 | CDN、カスタムドメイン対応 |
| **バックエンド** | Firebase Functions (Node.js 18) | サーバーレスAPI | HTTP関数、CORS対応 |
| **AI/LLM** | **Google Gemini 2.0 Flash** | 問題生成 | プロンプトエンジニアリング |
| **データベース** | Cloud Firestore | NoSQLデータベース | リアルタイム同期、セキュリティルール |
| **認証** | Firebase Authentication | ユーザー認証 | Google OAuth、JWT |
| **CI/CD** | GitHub Actions | 自動デプロイ | 環境分離、テスト自動化 |
| **開発ツール** | ESLint + TypeScript | コード品質 | 型安全性、リンティング |

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

## 環境・デプロイ設定

### 🌍 環境構成

| 環境 | ブランチ | Firebase プロジェクト | 用途 |
|------|---------|---------------------|------|
| **開発** | `develop` | `insieme-dev-d7459` | 開発・テスト環境 |
| **本番** | `main` | `insieme-463312` | 本番サービス |

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

### 📝 GitHub Secrets設定

GitHub リポジトリの **Settings > Secrets and variables > Actions** で以下を設定：

#### 必須シークレット
| Secret名 | 説明 | 取得方法 |
|----------|------|----------|
| `FIREBASE_TOKEN` | Firebase CLI認証トークン | `firebase login:ci` |
| `FIREBASE_PROJECT_ID` | 本番用FirebaseプロジェクトID | `insieme-463312` |
| `FIREBASE_PROJECT_ID_DEV` | 開発用FirebaseプロジェクトID | `insieme-dev-d7459` |
| `GEMINI_API_KEY` | 本番用 Gemini API キー | Google AI Studio |
| `GEMINI_API_KEY_DEV` | 開発用 Gemini API キー | Google AI Studio |

#### Firebase CLI トークン取得

```bash
# Firebase CLI にログイン
firebase login:ci

# 表示されたトークンを FIREBASE_TOKEN に設定
```

### 🔄 CI/CDパイプライン

#### 自動デプロイフロー
- **develop ブランチ**: 開発環境（`insieme-dev-d7459`）へ自動デプロイ
- **main ブランチ**: 本番環境（`insieme-463312`）へ自動デプロイ
- **Pull Request**: CI テスト（ビルド・リント・型チェック）実行

#### パイプライン構成
1. **CI段階**: 
   - フロントエンド: ビルド・リント・型チェック・テスト
   - Functions: ビルド・リント・TypeScript コンパイル
   - セキュリティ: Trivy脆弱性スキャン

2. **CD段階**:
   - 環境変数設定（Firebase Functions config）
   - 本番/開発環境への並列デプロイ
   - Hosting + Functions 同時デプロイ

### 🚀 手動デプロイ

#### GitHub Actions UI使用
- Actions タブから `workflow_dispatch` で手動実行可能

#### ローカルデプロイ

```bash
# プロジェクト切り替え
firebase use production  # 本番環境
firebase use dev        # 開発環境

# 全体をデプロイ
firebase deploy

# 個別デプロイ
firebase deploy --only hosting    # フロントエンドのみ
firebase deploy --only functions  # Functions のみ
firebase deploy --only firestore:rules  # Firestore ルールのみ
```

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

## 環境変数管理

### 🔧 Firebase Functions環境変数

```bash
# 本番環境に設定
firebase functions:config:set gemini.api_key="YOUR_PRODUCTION_API_KEY" --project $FIREBASE_PROJECT_ID

# 開発環境に設定
firebase functions:config:set gemini.api_key="YOUR_DEV_API_KEY" --project $FIREBASE_PROJECT_ID_DEV

# 設定確認（プロジェクトIDを実際の値に置き換えて実行）
firebase functions:config:get --project insieme-463312
firebase functions:config:get --project insieme-dev-d7459

# Functions内での使用方法
# import * as functions from 'firebase-functions';
# const apiKey = functions.config().gemini.api_key;
```

### 🌐 フロントエンド環境変数

ローカル開発用の `.env.local` ファイル:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## データ構造

### 📄 Worksheet（ワークシート）

```typescript
interface Worksheet {
  id: string;                    // 一意識別子
  title: string;                 // ワークシートタイトル
  description?: string;          // 説明文
  subject: string;               // 科目
  topic: string;                 // トピック
  difficulty: string;            // 難易度 (easy/medium/hard)
  createdAt: string;             // 作成日時 (ISO string)
  createdBy: string;             // 作成者UID
  problems: Problem[];           // 含まれる問題リスト
  status?: WorksheetStatus;      // ワークシート状態
}

type WorksheetStatus = 'creating' | 'error' | 'ready' | 'submitted';
```

### ❓ Problem（問題）

```typescript
interface Problem {
  id: string;                    // 問題ID
  question: string;              // 問題文
  options?: string[] | null;     // 選択肢（選択問題の場合）
  correctAnswer: string;         // 正解
  explanation: string;           // 解説
  type?: string;                 // 問題形式
}
```

### 📝 WorksheetSubmission（提出）

```typescript
interface WorksheetSubmission {
  id: string;                    // 提出ID
  worksheetId: string;           // ワークシートID
  userId: string;                // 提出者UID
  answers: ProblemAnswer[];      // 回答リスト
  submittedAt: string;           // 提出日時
  score?: number;                // 得点
  totalProblems: number;         // 総問題数
}

interface ProblemAnswer {
  problemId: string;             // 問題ID
  answer: string;                // ユーザーの回答
  isCorrect?: boolean;           // 正誤判定
}
```

## セキュリティ・制限

### 🔐 Firestore セキュリティルール

- **ワークシート**: 作成者のみ読み取り可能
- **提出データ**: 提出者のみアクセス可能
- **Functions**: 全ユーザーがワークシート作成可能
- **認証**: Firebase Authentication必須

### 📊 利用制限

- **LLM生成制限**: 実装予定（1日あたり制限）
- **ワークシート編集**: 作成後は編集不可
- **模範解答**: 提出後のみ閲覧可能
- **データプライバシー**: 全て作成者のプライベートデータ

## トラブルシューティング

### 🔥 Firebase関連エラー

#### 認証エラー

```bash
# Firebase再ログイン
firebase login --reauth

# 現在のユーザー確認
firebase login:list

# プロジェクト権限確認
firebase projects:list
```

#### デプロイエラー

```bash
# 権限確認
firebase projects:list

# プロジェクト切り替え
firebase use insieme-463312  # または insieme-dev-d7459

# デプロイ前テスト
firebase deploy --dry-run

# 個別デプロイでエラー箇所特定
firebase deploy --only hosting
firebase deploy --only functions
```

### 🏗️ ビルドエラー

```bash
# 依存関係クリーンインストール
cd frontend && rm -rf node_modules package-lock.json && npm install
cd ../functions && rm -rf node_modules package-lock.json && npm install

# TypeScript型チェック
npm run type-check

# ビルドテスト
npm run build
```

### 🔧 開発環境エラー

```bash
# Next.js キャッシュクリア
cd frontend && rm -rf .next

# Firebase エミュレータリセット
firebase emulators:start --import=./backup --export-on-exit=./backup

# 環境変数確認
cat .env.local
```

### 📱 Functions関連エラー

```bash
# Functions ログ確認
firebase functions:log --project insieme-463312

# 特定関数のログ
firebase functions:log --only generateProblems

# ローカル Functions テスト
cd functions && npm run serve
```

### 🌐 GitHub Actions エラー

1. **Secrets確認**: GitHub リポジトリの Secrets 設定を確認
2. **権限確認**: Firebase プロジェクトの IAM 権限確認
3. **トークン更新**: `firebase login:ci` で新しいトークン取得
4. **ログ確認**: GitHub Actions の詳細ログを確認
