# imagesqueeze

ブラウザ完結の画像圧縮ツール。JPG / PNG / WebP をアップロードせずにその場で圧縮。
全処理がクライアント側（Canvas）で走るため、ファイルはデバイスの外に出ません。

## ローカルで動かす

Node.js 18 以上が必要です。

```bash
npm install
npm run dev
```

表示された `http://localhost:5173` をブラウザで開けば動きます。

## 本番ビルド

```bash
npm run build      # dist/ に静的ファイルが出力される
npm run preview    # ビルド結果をローカル確認
```

## Vercel へデプロイ（最短ルート）

1. このフォルダを GitHub リポジトリに push
2. https://vercel.com にログイン → 「Add New Project」→ リポジトリを選択
3. Framework Preset は自動で「Vite」が選ばれる。そのまま Deploy
4. 数十秒で公開 URL が発行される

CLI 派なら：

```bash
npm i -g vercel
vercel        # 初回はプロジェクト設定を対話で聞かれる
vercel --prod # 本番反映
```

## 公開後にやること（収益化・集客）

### 1. ドメインとメタ情報
- `index.html` の `YOUR-DOMAIN.com` を実ドメインに全置換
- `public/robots.txt` と `public/sitemap.xml` の URL も同様に置換
- `<title>` / `meta description` の英語は、狙う検索語に合わせて調整
  （例: 日本語で集客するなら「画像 圧縮 オンライン 無料」等を含める）

### 2. Google AdSense
- サイト公開後に https://adsense.google.com で審査申請
- 承認されたら発行されるスニペットを:
  - `index.html` の `<head>` コメント部分
  - `src/ImageSqueeze.jsx` の「Ad slot」`<div>` の中
  にそれぞれ差し込む
- 注意: コンテンツが極端に薄いと審査に落ちやすい。使い方説明や
  簡単な解説文（FAQ・記事）を1〜2本足すと通りやすい

### 3. アクセス計測
- Google Search Console にサイト登録 → sitemap.xml を送信
- 検索流入のクエリを見て、タイトル/説明文を継続チューニング

## 技術メモ
- 依存は React と Vite のみ。ビルド成果物は静的なので、Vercel 以外
  （Netlify / Cloudflare Pages / GitHub Pages）にもそのまま置ける
- 圧縮は `createImageBitmap` → `<canvas>` → `canvas.toBlob()` の素朴な実装。
  さらに縮めたい場合は WebAssembly 版（例: `@jsquash/mozjpeg`）に差し替え可能
