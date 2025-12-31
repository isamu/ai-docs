# マルチモーダル対応の実装

## 概要

このドキュメントでは、ドキュメント・動画・画像など、マルチモーダルな入力を処理するClaude風システムの実装を解説します。

Claudeは画像・PDFを直接処理できますが、OSSでこれを実装する場合は別のアプローチが必要です。

---

## 📄 ドキュメント処理

### 推奨ツール

| ツール | 用途 | 特徴 |
|-------|------|------|
| **pdf-parse** | PDF解析 | Node.js向け、シンプルなAPI |
| **mammoth** | Word文書対応 | DOCX to HTML/Markdown |
| **node-html-parser** | HTML処理 | 軽量、高速 |

### pdf-parseによる実装

pdf-parse（[npm](https://www.npmjs.com/package/pdf-parse)）はNode.js向けのPDF処理ライブラリです。

#### インストール

```bash
npm install pdf-parse mammoth
```

#### 基本的な使い方

```typescript
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs/promises';

interface DocumentData {
    title: string;
    text: string;
    tables: TableData[];
    images: ImageData[];
    metadata: {
        pages: number;
        createdAt?: Date;
    };
}

interface TableData {
    page: number;
    data: Record<string, any>;
    caption?: string;
}

interface ImageData {
    page: number;
    path: string;
    caption?: string;
    bbox?: number[];
}

async function extractDocument(pdfPath: string): Promise<DocumentData> {
    // PDFから構造化データを抽出
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(dataBuffer);

    // 構造化されたデータを取得
    const structuredData: DocumentData = {
        title: extractTitle(pdfData.text),
        text: pdfData.text,
        tables: await extractTables(pdfData),
        images: await extractImages(pdfData),
        metadata: {
            pages: pdfData.numpages,
            createdAt: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined
        }
    };

    return structuredData;
}

function extractTitle(text: string): string {
    // テキストから最初の行をタイトルとして抽出
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines[0] || 'Untitled';
}

async function extractTables(pdfData: any): Promise<TableData[]> {
    // テーブルを抽出
    const tables: TableData[] = [];

    // PDF内のテーブル構造を検出（簡易実装）
    // 実際の実装では、より高度なテーブル検出ロジックが必要

    return tables;
}

async function extractImages(pdfData: any): Promise<ImageData[]> {
    // 画像を抽出
    const images: ImageData[] = [];

    // PDF内の画像を抽出（簡易実装）
    // 実際の実装では、pdf-parse以外のライブラリが必要

    return images;
}

// Word文書の処理

async function processWordDocument(docxPath: string): Promise<{ text: string; html: string }> {
    // 任意の形式のドキュメントを処理
    const buffer = await fs.readFile(docxPath);

    // テキストとHTMLの両方を抽出
    const textResult = await mammoth.extractRawText({ buffer });
    const htmlResult = await mammoth.convertToHtml({ buffer });

    return {
        text: textResult.value,
        html: htmlResult.value
    };
}

interface CategorizedContent {
    title: string[];
    text: string[];
    tables: string[];
    lists: string[];
}

async function processAnyDocument(filePath: string): Promise<CategorizedContent> {
    // 任意の形式のドキュメントを処理
    const ext = filePath.toLowerCase().split('.').pop();

    let content: string;

    if (ext === 'pdf') {
        const pdfData = await extractDocument(filePath);
        content = pdfData.text;
    } else if (ext === 'docx') {
        const { text } = await processWordDocument(filePath);
        content = text;
    } else {
        // プレーンテキスト
        content = await fs.readFile(filePath, 'utf-8');
    }

    // 要素を種類別に分類
    const categorized: CategorizedContent = {
        title: [],
        text: [],
        tables: [],
        lists: []
    };

    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#') || (trimmed.length > 0 && trimmed.length < 100 && lines.indexOf(line) === 0)) {
            categorized.title.push(trimmed);
        } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
            categorized.lists.push(trimmed);
        } else if (trimmed.includes('|') && trimmed.split('|').length > 2) {
            categorized.tables.push(trimmed);
        } else if (trimmed.length > 0) {
            categorized.text.push(trimmed);
        }
    }

    return categorized;
}
```

### 階層型ドキュメント取得

大きなドキュメントは階層的に処理します。

```typescript
import crypto from 'crypto';

interface Section {
    title: string;
    content: string;
    page: number;
}

interface Chunk {
    content: string;
    docId: string;
    sectionId: string;
    metadata: {
        sectionTitle: string;
        page: number;
    };
}

class HierarchicalDocumentRetriever {
    private docSummaries: Map<string, string> = new Map();  // ドキュメント全体の要約
    private sectionSummaries: Map<string, string> = new Map();  // セクションごとの要約
    private chunks: Map<string, Chunk> = new Map();  // 詳細チャンク

    async indexDocument(docPath: string): Promise<void> {
        // ドキュメントを階層的にインデックス

        // 1. ドキュメント全体を抽出
        const fullText = await extractDocument(docPath);

        // 2. セクション分割
        const sections = this.splitIntoSections(fullText);

        // 3. 各レベルで要約生成
        const docId = this.hashString(docPath);

        // ドキュメント全体の要約
        this.docSummaries.set(
            docId,
            await this.summarize(fullText.text, 500)
        );

        // セクションごとの要約
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sectionId = `${docId}_section_${i}`;

            this.sectionSummaries.set(
                sectionId,
                await this.summarize(section.content, 200)
            );

            // チャンクに分割
            const chunks = this.splitIntoChunks(section.content, 1000);

            for (let j = 0; j < chunks.length; j++) {
                const chunk = chunks[j];
                const chunkId = `${sectionId}_chunk_${j}`;

                this.chunks.set(chunkId, {
                    content: chunk,
                    docId: docId,
                    sectionId: sectionId,
                    metadata: {
                        sectionTitle: section.title,
                        page: section.page
                    }
                });
            }
        }
    }

    async retrieve(query: string, detailLevel: string = "auto"): Promise<string> {
        // クエリに応じて適切な詳細度で取得

        if (detailLevel === "overview") {
            // ドキュメントレベルの要約のみ
            const relevantDocs = this.findRelevantDocs(query);
            return relevantDocs
                .map(docId => this.docSummaries.get(docId))
                .filter((summary): summary is string => summary !== undefined)
                .join("\n\n");
        }

        if (detailLevel === "section") {
            // セクションレベル
            const relevantSections = this.findRelevantSections(query);
            return relevantSections
                .map(secId => this.sectionSummaries.get(secId))
                .filter((summary): summary is string => summary !== undefined)
                .join("\n\n");
        }

        if (detailLevel === "detailed") {
            // チャンクレベル
            const relevantChunks = this.findRelevantChunks(query);
            return relevantChunks
                .map(chunkId => this.chunks.get(chunkId)?.content)
                .filter((content): content is string => content !== undefined)
                .join("\n\n");
        }

        // auto
        // クエリの複雑さで判断
        if (this.isSimpleQuery(query)) {
            return await this.retrieve(query, "overview");
        } else if (this.needsDetails(query)) {
            return await this.retrieve(query, "detailed");
        } else {
            return await this.retrieve(query, "section");
        }
    }

    private splitIntoSections(doc: DocumentData): Section[] {
        // セクションに分割
        // Markdown見出しベースで分割
        const text = doc.text;
        const sections: Section[] = [];

        let currentSection: Section = { title: "", content: "", page: 0 };

        for (const line of text.split("\n")) {
            if (line.startsWith("# ")) {
                // 新しいセクション
                if (currentSection.content) {
                    sections.push(currentSection);
                }

                currentSection = {
                    title: line.substring(2).trim(),
                    content: "",
                    page: 0  // ページ番号は別途取得
                };
            } else {
                currentSection.content += line + "\n";
            }
        }

        if (currentSection.content) {
            sections.push(currentSection);
        }

        return sections;
    }

    private splitIntoChunks(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        const words = text.split(/\s+/);

        let currentChunk = "";
        for (const word of words) {
            if (currentChunk.length + word.length + 1 > chunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = word;
            } else {
                currentChunk += (currentChunk ? " " : "") + word;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private hashString(str: string): string {
        return crypto.createHash('md5').update(str).digest('hex');
    }

    private async summarize(text: string, maxLength: number): Promise<string> {
        // 要約生成（実装は省略）
        return text.substring(0, maxLength);
    }

    private findRelevantDocs(query: string): string[] {
        // 関連ドキュメントを検索（実装は省略）
        return Array.from(this.docSummaries.keys());
    }

    private findRelevantSections(query: string): string[] {
        // 関連セクションを検索（実装は省略）
        return Array.from(this.sectionSummaries.keys());
    }

    private findRelevantChunks(query: string): string[] {
        // 関連チャンクを検索（実装は省略）
        return Array.from(this.chunks.keys());
    }

    private isSimpleQuery(query: string): boolean {
        // クエリが簡単かどうかを判定（実装は省略）
        return query.split(/\s+/).length < 5;
    }

    private needsDetails(query: string): boolean {
        // 詳細が必要かどうかを判定（実装は省略）
        return query.toLowerCase().includes("詳しく") || query.toLowerCase().includes("detail");
    }
}
```

---

## 🎥 動画処理

### 推奨ツール

| ツール | 用途 | 特徴 |
|-------|------|------|
| **fluent-ffmpeg** | 動画処理 | フレーム抽出、メタデータ取得 |
| **@ffmpeg-installer/ffmpeg** | FFmpegバイナリ | 自動インストール |
| **@anthropic-ai/sdk** | 画像理解 | Claude Vision API |

### fluent-ffmpegによる実装

#### インストール

```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg @anthropic-ai/sdk
```

#### 基本的な使い方

```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

// FFmpegのパスを設定
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface VideoAnalysisResult {
    query: string;
    response: string;
    numFrames: number;
}

interface TimelineEvent {
    timestamp: number;
    description: string;
    frameIndex: number;
}

class VideoProcessor {
    private anthropic: Anthropic;

    constructor(apiKey?: string) {
        // モデルロード
        this.anthropic = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY
        });
    }

    async extractFrames(
        videoPath: string,
        numFrames: number = 8
    ): Promise<string[]> {
        // 均等にフレームを抽出
        const outputDir = path.join('./frames', path.basename(videoPath, path.extname(videoPath)));
        await fs.mkdir(outputDir, { recursive: true });

        const duration = await this.getVideoDuration(videoPath);
        const interval = duration / numFrames;

        const framePaths: string[] = [];

        for (let i = 0; i < numFrames; i++) {
            const timestamp = i * interval;
            const outputPath = path.join(outputDir, `frame_${i}.png`);

            await new Promise<void>((resolve, reject) => {
                ffmpeg(videoPath)
                    .screenshots({
                        timestamps: [timestamp],
                        filename: `frame_${i}.png`,
                        folder: outputDir
                    })
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err));
            });

            framePaths.push(outputPath);
        }

        return framePaths;
    }

    private async getVideoDuration(videoPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata.format.duration || 0);
                }
            });
        });
    }

    async understandVideo(
        videoPath: string,
        query: string
    ): Promise<VideoAnalysisResult> {
        // 動画の内容を理解
        // フレーム抽出
        const framePaths = await this.extractFrames(videoPath, 8);

        // Claudeで画像を分析
        const frameContents = await Promise.all(
            framePaths.map(async (framePath) => {
                const imageData = await fs.readFile(framePath);
                return {
                    type: 'image' as const,
                    source: {
                        type: 'base64' as const,
                        media_type: 'image/png' as const,
                        data: imageData.toString('base64')
                    }
                };
            })
        );

        // 質問
        const prompt = `These are frames from a video. ${query}`;

        // 推論
        const message = await this.anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 512,
            messages: [{
                role: 'user',
                content: [
                    ...frameContents,
                    { type: 'text', text: prompt }
                ]
            }]
        });

        const response = message.content[0].type === 'text' ? message.content[0].text : '';

        return {
            query: query,
            response: response,
            numFrames: framePaths.length
        };
    }

    async extractTimeline(videoPath: string): Promise<TimelineEvent[]> {
        // タイムラインを抽出（シーン変化検出）
        const framePaths = await this.extractFrames(videoPath, 32);
        const duration = await this.getVideoDuration(videoPath);

        const timeline: TimelineEvent[] = [];

        // 各フレームで内容を要約
        for (let i = 0; i < framePaths.length; i++) {
            const timestamp = (i / framePaths.length) * duration;
            const description = await this.describeFrame(framePaths[i]);

            timeline.push({
                timestamp: timestamp,
                description: description,
                frameIndex: i
            });
        }

        return timeline;
    }

    async describeFrame(framePath: string): Promise<string> {
        // 1フレームの内容を説明
        const imageData = await fs.readFile(framePath);

        const message = await this.anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/png',
                            data: imageData.toString('base64')
                        }
                    },
                    {
                        type: 'text',
                        text: 'Describe what you see in this image briefly.'
                    }
                ]
            }]
        });

        return message.content[0].type === 'text' ? message.content[0].text : '';
    }
}
```

### タイムコード付き回答

```typescript
interface TimestampedAnswer {
    answer: string;
    timestamps: Array<{
        time: number;
        description: string;
    }>;
    sources: string[];
}

interface ScoredMoment extends TimelineEvent {
    relevance: number;
}

class VideoQA {
    private processor: VideoProcessor;
    private timelineCache: Map<string, TimelineEvent[]> = new Map();

    constructor(videoProcessor: VideoProcessor) {
        this.processor = videoProcessor;
    }

    async answerWithTimestamp(
        videoPath: string,
        question: string
    ): Promise<TimestampedAnswer> {
        // タイムスタンプ付きで回答

        // タイムライン取得（キャッシュ）
        if (!this.timelineCache.has(videoPath)) {
            const timeline = await this.processor.extractTimeline(videoPath);
            this.timelineCache.set(videoPath, timeline);
        }

        const timeline = this.timelineCache.get(videoPath)!;

        // 質問に関連するタイムスタンプを特定
        const relevantMoments = await this.findRelevantMoments(
            question,
            timeline
        );

        // 詳細な回答を生成
        const detailedAnswer = await this.processor.understandVideo(
            videoPath,
            question
        );

        return {
            answer: detailedAnswer.response,
            timestamps: relevantMoments.map(moment => ({
                time: moment.timestamp,
                description: moment.description
            })),
            sources: relevantMoments.map(m =>
                `Video at ${this.formatTimestamp(m.timestamp)}: ${m.description}`
            )
        };
    }

    async findRelevantMoments(
        query: string,
        timeline: TimelineEvent[]
    ): Promise<ScoredMoment[]> {
        // 質問に関連するタイムラインを特定
        // ベクトル類似度で検索
        const queryEmbedding = await this.embed(query);

        const scoredMoments: ScoredMoment[] = [];

        for (const moment of timeline) {
            const momentEmbedding = await this.embed(moment.description);
            const similarity = this.cosineSimilarity(queryEmbedding, momentEmbedding);

            scoredMoments.push({
                ...moment,
                relevance: similarity
            });
        }

        // 上位3件を返す
        scoredMoments.sort((a, b) => b.relevance - a.relevance);
        return scoredMoments.slice(0, 3);
    }

    private formatTimestamp(seconds: number): string {
        // タイムスタンプをフォーマット
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    private async embed(text: string): Promise<number[]> {
        // テキストを埋め込みベクトルに変換（実装は省略）
        // 実際には埋め込みAPIを使用
        return [];
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        // コサイン類似度を計算
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
```

---

## 🖼️ 画像処理

Claudeは画像を直接処理できます。Node.jsでもClaude Vision APIを使用します。

### @anthropic-ai/sdkによる実装

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';

class ImageUnderstanding {
    private anthropic: Anthropic;

    constructor(apiKey?: string) {
        this.anthropic = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY
        });
    }

    async analyzeImage(
        imagePath: string,
        query: string = "Describe this image in detail."
    ): Promise<string> {
        // 画像を分析
        const imageData = await fs.readFile(imagePath);
        const imageBase64 = imageData.toString('base64');

        // 画像のMIMEタイプを判定
        const ext = imagePath.toLowerCase().split('.').pop();
        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';

        if (ext === 'png') {
            mediaType = 'image/png';
        } else if (ext === 'gif') {
            mediaType = 'image/gif';
        } else if (ext === 'webp') {
            mediaType = 'image/webp';
        }

        // 推論
        const message = await this.anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 512,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: imageBase64
                        }
                    },
                    {
                        type: 'text',
                        text: query
                    }
                ]
            }]
        });

        return message.content[0].type === 'text' ? message.content[0].text : '';
    }

    async extractTextFromImage(imagePath: string): Promise<string> {
        // 画像からテキストを抽出（OCR）
        return await this.analyzeImage(
            imagePath,
            "Extract all text visible in this image."
        );
    }

    async answerVisualQuestion(
        imagePath: string,
        question: string
    ): Promise<string> {
        // 画像に関する質問に回答
        return await this.analyzeImage(imagePath, question);
    }
}
```

---

## 🔗 マルチモーダルRAG

異なるモダリティを統合します。

```typescript
import { ChromaClient } from 'chromadb';
import { glob } from 'glob';
import path from 'path';

interface SearchResult {
    content: string;
    source: string;
    type: 'document' | 'video' | 'image';
    timestamp?: number;
    reference?: string;
}

interface SourceWithExcerpt {
    type: string;
    reference: string;
    excerpt: string;
}

interface AnswerWithSources {
    answer: string;
    sources: SourceWithExcerpt[];
}

class MultimodalRAG {
    private videoProcessor: VideoProcessor;
    private imageProcessor: ImageUnderstanding;
    private vectorStore: ChromaClient;

    constructor() {
        this.videoProcessor = new VideoProcessor();
        this.imageProcessor = new ImageUnderstanding();
        this.vectorStore = new ChromaClient();
    }

    async indexMultimodalContent(contentDir: string): Promise<void> {
        // マルチモーダルコンテンツをインデックス
        const allFiles = await glob('**/*', { cwd: contentDir, absolute: true });

        for (const filePath of allFiles) {
            const ext = path.extname(filePath).toLowerCase();

            if (['.pdf', '.docx', '.md'].includes(ext)) {
                await this.indexDocument(filePath);
            } else if (['.mp4', '.avi', '.mov'].includes(ext)) {
                await this.indexVideo(filePath);
            } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
                await this.indexImage(filePath);
            }
        }
    }

    async indexDocument(docPath: string): Promise<void> {
        // ドキュメントをインデックス
        const data = await extractDocument(docPath);

        // テキストをチャンク化
        const chunks = this.chunkText(data.text);

        // ベクトル化して保存
        const collection = await this.vectorStore.getOrCreateCollection({ name: 'multimodal' });

        for (let i = 0; i < chunks.length; i++) {
            await collection.add({
                ids: [`${docPath}_chunk_${i}`],
                documents: [chunks[i]],
                metadatas: [{
                    source: docPath,
                    type: 'document',
                    chunkIndex: i
                }]
            });
        }
    }

    async indexVideo(videoPath: string): Promise<void> {
        // 動画をインデックス
        // タイムライン抽出
        const timeline = await this.videoProcessor.extractTimeline(videoPath);

        // 各タイムスタンプをインデックス
        const collection = await this.vectorStore.getOrCreateCollection({ name: 'multimodal' });

        for (const moment of timeline) {
            await collection.add({
                ids: [`${videoPath}_t_${moment.timestamp}`],
                documents: [moment.description],
                metadatas: [{
                    source: videoPath,
                    type: 'video',
                    timestamp: moment.timestamp
                }]
            });
        }
    }

    async indexImage(imagePath: string): Promise<void> {
        // 画像をインデックス
        // 画像の説明を生成
        const description = await this.imageProcessor.analyzeImage(imagePath);

        const collection = await this.vectorStore.getOrCreateCollection({ name: 'multimodal' });

        await collection.add({
            ids: [imagePath],
            documents: [description],
            metadatas: [{
                source: imagePath,
                type: 'image'
            }]
        });
    }

    async retrieve(query: string, k: number = 5): Promise<SearchResult[]> {
        // クエリに関連するコンテンツを取得
        const collection = await this.vectorStore.getOrCreateCollection({ name: 'multimodal' });
        const results = await collection.query({
            queryTexts: [query],
            nResults: k
        });

        const enrichedResults: SearchResult[] = [];

        if (!results.documents || !results.metadatas) {
            return enrichedResults;
        }

        for (let i = 0; i < results.documents[0].length; i++) {
            const text = results.documents[0][i];
            const metadata = results.metadatas[0][i] as any;

            if (metadata.type === 'document') {
                // ドキュメントチャンク
                enrichedResults.push({
                    content: text || '',
                    source: metadata.source,
                    type: 'document'
                });
            } else if (metadata.type === 'video') {
                // 動画の該当箇所
                enrichedResults.push({
                    content: text || '',
                    source: metadata.source,
                    type: 'video',
                    timestamp: metadata.timestamp,
                    reference: `${metadata.source} at ${this.formatTime(metadata.timestamp)}`
                });
            } else if (metadata.type === 'image') {
                // 画像
                enrichedResults.push({
                    content: text || '',
                    source: metadata.source,
                    type: 'image',
                    reference: `Image: ${metadata.source}`
                });
            }
        }

        return enrichedResults;
    }

    async answerWithSources(query: string): Promise<AnswerWithSources> {
        // ソース付きで回答
        // 関連コンテンツを取得
        const sources = await this.retrieve(query, 5);

        // コンテキストを構築
        const context = this.buildContext(sources);

        // LLMで回答生成
        const answer = await this.generateAnswer(query, context);

        return {
            answer: answer,
            sources: sources.map(s => ({
                type: s.type,
                reference: s.reference || s.source,
                excerpt: s.content.substring(0, 200)
            }))
        };
    }

    private buildContext(sources: SearchResult[]): string {
        // ソースからコンテキストを構築
        const contextParts: string[] = [];

        for (const source of sources) {
            if (source.type === 'document') {
                contextParts.push(`
<document_excerpt source="${source.source}">
${source.content}
</document_excerpt>
`);
            } else if (source.type === 'video') {
                contextParts.push(`
<video_moment source="${source.source}" timestamp="${source.timestamp}">
${source.content}
</video_moment>
`);
            } else if (source.type === 'image') {
                contextParts.push(`
<image_description source="${source.source}">
${source.content}
</image_description>
`);
            }
        }

        return contextParts.join('\n');
    }

    private chunkText(text: string, chunkSize: number = 1000): string[] {
        const chunks: string[] = [];
        const words = text.split(/\s+/);

        let currentChunk = '';
        for (const word of words) {
            if (currentChunk.length + word.length + 1 > chunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = word;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + word;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    private async generateAnswer(query: string, context: string): Promise<string> {
        // LLMで回答生成（実装は省略）
        return `Answer to: ${query}\nContext: ${context.substring(0, 100)}...`;
    }
}
```

---

## 💰 コスト最適化

マルチモーダル処理はコストがかかるため、最適化が重要です。

### キャッシング戦略

```typescript
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class MultimodalCache {
    private cacheDir: string;

    constructor(cacheDir: string = "./cache") {
        this.cacheDir = cacheDir;
        this.initCache();
    }

    private async initCache(): Promise<void> {
        await fs.mkdir(this.cacheDir, { recursive: true });
    }

    async getCacheKey(filePath: string, operation: string): Promise<string> {
        // キャッシュキーを生成
        const fileBuffer = await fs.readFile(filePath);
        const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        return `${operation}_${fileHash}`;
    }

    async getOrCompute<T>(
        filePath: string,
        operation: string,
        computeFn: (path: string) => Promise<T>
    ): Promise<T> {
        // キャッシュがあれば返す、なければ計算
        const cacheKey = await this.getCacheKey(filePath, operation);
        const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

        try {
            // キャッシュヒット
            const cacheData = await fs.readFile(cachePath, 'utf-8');
            return JSON.parse(cacheData);
        } catch (error) {
            // キャッシュミス、計算実行
            const result = await computeFn(filePath);

            // キャッシュに保存
            await fs.writeFile(cachePath, JSON.stringify(result, null, 2));

            return result;
        }
    }
}

// 使用例

const cache = new MultimodalCache();
const videoProcessor = new VideoProcessor();

// 動画処理（キャッシュ利用）
const timeline = await cache.getOrCompute(
    videoPath,
    "extract_timeline",
    (path) => videoProcessor.extractTimeline(path)
);
```

### 段階的処理

```typescript
interface DetailedAnalysis {
    frameIndex: number;
    analysis: string;
}

async function processVideoEfficiently(
    videoPath: string,
    query: string,
    videoProcessor: VideoProcessor
): Promise<string> {
    // 段階的に処理してコストを削減

    // ステップ1: タイムラインのみ（低コスト）
    const timeline = await videoProcessor.extractTimeline(videoPath);

    // ステップ2: 関連部分を特定
    const relevantMoments = await findRelevantMoments(query, timeline);

    if (relevantMoments.length === 0) {
        return "動画に関連する情報が見つかりませんでした";
    }

    // ステップ3: 関連部分のみ詳細処理（高コスト）
    const detailedAnalyses: DetailedAnalysis[] = [];

    // 上位3件のみ
    for (const moment of relevantMoments.slice(0, 3)) {
        const framePath = `./frames/${path.basename(videoPath)}/frame_${moment.frameIndex}.png`;
        const analysis = await videoProcessor.describeFrame(framePath);

        detailedAnalyses.push({
            frameIndex: moment.frameIndex,
            analysis: analysis
        });
    }

    return synthesizeAnswer(query, detailedAnalyses);
}

async function findRelevantMoments(
    query: string,
    timeline: TimelineEvent[]
): Promise<TimelineEvent[]> {
    // 関連するモーメントを検索（簡易実装）
    // 実際にはベクトル検索などを使用
    return timeline.filter(moment =>
        moment.description.toLowerCase().includes(query.toLowerCase())
    );
}

function synthesizeAnswer(query: string, analyses: DetailedAnalysis[]): string {
    // 分析結果から回答を合成
    const analysisTexts = analyses.map(a => a.analysis).join('\n\n');
    return `Query: ${query}\n\nAnalysis:\n${analysisTexts}`;
}
```

---

## 📚 参考資料

### 公式リソース

- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse)
- [mammoth npm](https://www.npmjs.com/package/mammoth)
- [fluent-ffmpeg npm](https://www.npmjs.com/package/fluent-ffmpeg)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [ChromaDB npm](https://www.npmjs.com/package/chromadb)

### 関連ドキュメント

- [04-implementation-guide.md](./04-implementation-guide.md) - 基本実装
- [06-practical-examples.md](./06-practical-examples.md) - 実践例

---

**次**: [06-practical-examples.md](./06-practical-examples.md) - 動作するコード例
