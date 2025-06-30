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
3. 変更を加えるたびにコミットを行う
4. ローカルでテストを実行し、Lint が通ることを確認
5. リモートにプッシュし、プルリクエストを作成
6. コードレビュー → 必要に応じて修正
7. マージ後、自動デプロイが成功することを確認

### テストと CI/CD
- プロジェクトルートに `.github/workflows/ci.yml` を配置
- プッシュ／プルリクエスト時に以下を実行:
  - フロントエンド: `npm install && npm test && npm run lint && npm run build`
  - Firebase Functions: `npm install && npm run lint && npm run build`
  - セキュリティスキャン: Trivy による脆弱性検査
- デプロイは Firebase Hosting と Functions へ自動実行
  - main ブランチ: 本番環境
  - develop ブランチ: ステージング環境（オプション）

## 使用ツール
- Git
- Node.js (>=18.x)
- npm
- Next.js
- Firebase CLI
- Firebase Functions
- Firebase Hosting
- Firestore
- Docker
- GitHub CLI
- VSCode（推奨）

## 機能

### 問題作成機能について

問題はkatexを使って表示される．
pdfダウンロードが可能であり，ユーザーはpdfを印刷することができる．

#### ユーザー入力形式
```
{
  difficulty: "初級" | "中級" | "上級"  // 難易度
  description: string;  // 問題の詳細説明
}
```

#### 問題データ構造
```
{
  id: string;           // 問題の一意識別子
  userId: string;       // 作成者ID
  no: number;           // 問題番号
  question: string;     // 問題文
  modelAnswer: string;  // 模範回答
  createdAt: Date;      // 作成日時
  isPublic: false;      // 基本非公開
  subject: string;      // 科目
  difficulty: string;   // 難易度
  topic: string;        // トピック
}
```

#### 制約・制限
- **問題の公開性**: 基本非公開（作成者のみ閲覧可能）
- **LLM生成制限**: 1日あたり10回まで
- **模範回答閲覧**: 回答提出後にのみ閲覧可能
- **問題編集**: 一度作成した問題は編集不可
- **PDF印刷**: 模範回答なしで印刷（回答提出前）

#### LLM生成制限の実装
```typescript
// ユーザーごとの生成回数管理
{
  userId: string;
  date: string;         // YYYY-MM-DD形式
  generationCount: number;  // その日の生成回数
  lastReset: Date;      // 最後にリセットされた日時
}
```

#### 回答提出後の状態管理
```typescript
// 問題の回答状態
{
  problemId: string;
  userId: string;
  submittedAt: Date;    // 回答提出日時
  canViewAnswer: boolean; // 模範回答閲覧可能フラグ
}
```

## その他

エラーが入力された時に，すぐに機能を改変・追加せずに，原因を追求してください．
