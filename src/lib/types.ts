// ---- AI Provider ----
export type ProviderId = "glm" | "minimax" | "custom";

export interface Settings {
  provider: ProviderId;
  apiKey: string;
  /** 自定义服务时使用的 Base URL；内置预设忽略此字段 */
  baseUrl: string;
  model: string;
  temperature: number;
}

export interface PublicSettings {
  provider: ProviderId;
  apiKeyMasked: string;
  baseUrl: string;
  model: string;
  temperature: number;
  configured: boolean;
}

// ---- Progress ----
export interface LessonProgress {
  completed: boolean;
  quizScores: number[];
  /** 模拟面试成绩（平均分） */
  interviewScores?: number[];
  wrongQuestionIds: string[];
  visitedAt?: string;
  completedAt?: string;
}

export interface Progress {
  lessons: Record<string, LessonProgress>;
  xp: number;
  streak: number;
  lastStudyDate?: string;
  /** 各语言的闯关门槛状态 */
  gates?: Record<string, Record<string, LessonGate>>;
}

/** 单节课的闯关门槛状态 */
export interface LessonGate {
  lessonId: string;
  /** 测验已达标 */
  quizPassed: boolean;
  /** 面试 / 场景对话已达标 */
  interviewPassed: boolean;
  /** 本课已通关（两项都达标） */
  passed: boolean;
  /** 本课已解锁（首课默认解锁，其余需上一课通关） */
  unlocked: boolean;
  quizScore: number;
  interviewScore: number;
  quizAttempts: number;
  interviewAttempts: number;
}

// ---- Course ----
export type LangId =
  | "python"
  | "java"
  | "javascript"
  | "typescript"
  | "html"
  | "docker"
  | "linux"
  | "japanese";

export interface LessonExample {
  code: string;
  note?: string;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  example?: LessonExample;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  lessons: Lesson[];
}

export interface Course {
  lang: LangId;
  name: string;
  emoji: string;
  tagline: string;
  /** tailwind 渐变类，用于卡片 */
  gradient: string;
  /** code = 编程/运维（示例按代码高亮）；language = 外语（示例按例句排版） */
  kind?: "code" | "language";
  levels: Level[];
}

// ---- AI Tasks ----
export type AiTask =
  | "tutor"
  | "explain"
  | "quiz"
  | "grade"
  | "code-review"
  | "path"
  | "interview-guide"
  | "interview-questions"
  | "interview-grade"
  | "interview-report"
  | "language-scenario"
  | "language-review"
  | "language-score"
  | "language-teach";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** 模型思考过程（reasoning_content / <think>），展示时默认折叠 */
  reasoning?: string;
}

export interface QuizChoiceQuestion {
  id: string;
  type: "choice";
  question: string;
  options: string[];
  /** 正确选项下标 */
  answer: number;
  explanation: string;
}

export interface QuizCodeQuestion {
  id: string;
  type: "code";
  question: string;
  starterCode: string;
  referenceAnswer: string;
  explanation: string;
}

// ---- 模拟面试 ----
export interface InterviewQuestion {
  id: string;
  /** concept 概念题 / scenario 场景题 / coding 编码题 */
  type: "concept" | "scenario" | "coding";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  /** 面试官期待的参考要点 */
  referencePoints: string[];
}

export interface InterviewGradeResult {
  score: number;
  pass: boolean;
  feedback: string;
  idealAnswer: string;
}

export interface InterviewReport {
  total: number;
  level: string;
  summary: string;
  strengths?: string[];
  improvements?: string[];
  recommendation?: string;
}

// ---- 错题本 / 收藏 / 笔记（知识库） ----
export interface WrongQuestionItem {
  id: string;
  lessonId: string;
  lang: string;
  /** 来源：练习测验 / 模拟面试 */
  source: "quiz" | "interview";
  kind: "choice" | "code" | "interview";
  question: string;
  options?: string[];
  /** 选择题正确选项下标 */
  answerIndex?: number;
  explanation?: string;
  /** 面试题参考答案 */
  idealAnswer?: string;
  userAnswer?: string | number;
  addedAt: string;
  resolved: boolean;
}

export interface FavoriteItem {
  id: string;
  lessonId: string;
  lang: string;
  kind: "lesson" | "keypoint" | "quiz-question" | "interview-question";
  title: string;
  content?: string;
  addedAt: string;
}

export interface NoteEntry {
  lessonId: string;
  lang: string;
  content: string;
  updatedAt: string;
}

export interface Notebook {
  wrongQuestions: WrongQuestionItem[];
  favorites: FavoriteItem[];
  notes: Record<string, NoteEntry>;
}

// ---- LeetCode 题库 ----
export interface LeetCodeProblem {
  frontendQuestionId: string;
  title: string;
  titleCn: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acRate: number;
  tags: string[];
}
