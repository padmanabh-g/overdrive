# Overdrive Tokyo 日本語版

東京のライブデータで動く街を、実際にプレイできる 3D ゲームにするプロトタイプです。

プレイヤーは夜の渋谷を走る配達員として、雨、混雑、鉄道状況、イベント後の crowd surge に反応しながら目的地を目指します。

このゲームでは、街はただの背景ではありません。天気、人流、AI ナレーションがゲームシステムとしてプレイヤーに圧力をかけます。

## コンセプトと技術構成

- **東京・日本らしさ:** 渋谷、東京駅、六本木、東京タワー、京都風 district を用意。
- **ライブデータ:** Open-Meteo で東京の現在天気を取得。
- **AI 活用:** ai& を City Director として使い、街の状態を短いナレーションに変換。
- **Agent / Sandbox 構造:** Daytona Probe route を用意し、群衆密度を sandbox 側の計算に差し替えられる設計。
- **Qoder を使った開発:** Qoder の agentic coding workflow を使い、短時間で 3D city、district preset、data adapter、sub mode を分担しながら実装。
- **クラウド対応:** Vite client、Fastify local server、Vercel Functions で同じ route logic を共有。
- **実際に遊べる:** 配達、タイマー、群衆、surge、district 切り替えがある 3D デモ。

## デモストーリー

プレイヤーは夜の渋谷を走る配達員です。

最初は普通の配達ですが、雨で路面が光り、群衆密度が上がり、途中でライブ帰りの人の波が直接ルートをふさぎます。プレイヤーは街の圧力を読みながら、迂回して荷物を届けます。

オプションの sub mode:

```text
?sub=crowd-combat
```

Crowd Escape Combat では、敵を倒すのではなく shockwave で群衆や blocker を押し返し、一時的に道を開けます。

## 機能

- Vite + TypeScript + three.js による 3D ブラウザゲーム。
- wet asphalt、fog、ACES tone mapping、bloom、SSAO、neon signs、road reflections、rain streaks。
- 雨のときに傘が出る instanced crowd。
- courier player、third-person camera、collision、timer、objective、win/lose loop。
- mid-run の crowd surge event。
- Open-Meteo による東京の live weather。
- ai& City Director adapter。
- Daytona Probe adapter。
- URL で district 切り替え。
- Crowd Escape Combat visual submode。

## District

URL で街を切り替えられます。

```text
/?district=shibuya
/?district=tokyo
/?district=roppongi
/?district=tokyo-tower
/?district=kyoto
```

Crowd Escape Combat と組み合わせる例:

```text
/?district=tokyo-tower&sub=crowd-combat
/?district=kyoto&sub=crowd-combat
```

## スポンサー活用

このプロジェクトでは、ライブデータ、AI ナレーション、sandbox probe、agentic coding workflow をそれぞれゲームの実装に接続しています。

### Open-Meteo

`/api/weather` で東京の現在天気を取得し、雨、HUD、街の状態に反映します。

### ai&

`/api/city-director` で、雨・混雑・surge などの条件を ai& に送り、街の反応を短い文章で生成します。

必要な環境変数:

```text
AI_AND_BASE_URL
AI_AND_API_KEY
AI_AND_MODEL
```

### Daytona

`/api/probe` は群衆密度を計算する Probe route です。現在は credentials がない場合でも fixture でデモが止まらないようにしています。`DAYTONA_API_KEY` がある場合に sandbox 実装へ差し替えられる構造です。

### Qoder

Qoder は開発プロセスで使用しました。短い制限時間の中で、city rendering、district preset、README、sub mode などを整理しながら実装するための agentic coding workflow として活用しています。

## 起動方法

依存を入れます。

```bash
npm install
```

client だけ起動:

```bash
npm run dev:client
```

開く URL:

```text
http://localhost:5173/
```

Bun がある場合の full stack:

```bash
bun dev
```

## 環境変数

```bash
cp .env.example .env.local
```

`.env.local` にだけ実際の値を入れます。key は commit しません。

```text
AI_AND_BASE_URL=
AI_AND_API_KEY=
AI_AND_MODEL=
DAYTONA_API_KEY=
```

## 確認コマンド

```bash
npm run typecheck
npm run build
```

## 3分デモ台本

1. Shibuya district でアプリを開く。
2. HUD の live Tokyo conditions、目的地、crowd pressure を見せる。
3. 配達を開始し、雨のネオン街を移動する。
4. Open-Meteo のライブ天気が雨や傘表現につながっていることを説明する。
5. crowd surge が発生し、直接ルートがふさがる場面を見せる。
6. `?district=tokyo-tower` または `?district=kyoto` で日本らしい別 district を見せる。
7. `?sub=crowd-combat` で `F` または `Space` を押し、shockwave で道を開ける演出を見せる。
8. 最後に「東京は静的な背景ではなく、ゲームシステムそのものです」と締める。

## 一言ピッチ

Overdrive Tokyo は、東京の天気、人流、AI ナレーションをゲームプレイに変換する、プレイ可能なリアルタイム・デジタルツインです。
