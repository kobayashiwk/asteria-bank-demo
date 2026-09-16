# Asteria Bank

銀行サービスを題材に、プルリクエスト単位のコードレビューを実演するための小規模なNode.jsアプリケーションです。

## 必要環境

- Windows 10/11
- Node.js 22.5以降
- Git

Dockerや外部データベース、`npm install`は不要です。データはNode.js内蔵SQLiteで管理します。

## 起動

PowerShellで次を実行します。

```powershell
npm run reset
npm start
```

ブラウザーで `http://localhost:3000` を開いてください。停止は `Ctrl+C` です。

## テスト

```powershell
npm test
```

## レビュー演習

各トピックは独立したブランチです。`main`との差分をプルリクエストとしてレビューしてください。

```powershell
git branch --list
git switch <branch-name>
npm run reset
npm start
```

各ブランチは`main`から直接作成されており、相互依存はありません。実行後に別のブランチへ切り替える場合は、先にサーバーを停止してください。

## デモ用ログイン

画面上部の利用者切り替えで、一般利用者または運用担当者として操作できます。これはローカルデモ用の簡易セッションです。

## データの初期化

`npm run reset`はローカルDBを初期状態へ戻します。デモを繰り返す際に実行してください。

## 利用上の注意

このアプリケーションはローカルでのレビュー実演専用です。公開環境や業務用途には使用しないでください。
