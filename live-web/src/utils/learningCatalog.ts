import {
  NODE_CHAPTER,
  NODE_LESSON,
  type LearningCatalogNode,
} from "@/api/learning";

export interface LessonRow {
  id: number;
  indexLabel: string;
  title: string;
  contentKind: number | null;
  metaLine: string;
}

export interface CatalogBlock {
  type: "chapter" | "lesson";
  id: number;
  title: string;
  indexLabel: string;
  contentKind: number | null;
  metaLine: string;
  lessonCount: number;
  expanded: boolean;
  lessons: LessonRow[];
}

function formatLessonRow(lesson: LearningCatalogNode, seq: number): LessonRow {
  const indexLabel = seq < 10 ? `0${seq}` : String(seq);
  const kindLabel = lesson.contentKindLabel || "小节";
  const meta = lesson.metaLabel || "";
  const statusLabel = lesson.statusLabel || "未开始";
  const metaLine = meta
    ? `${kindLabel} | ${meta} · ${statusLabel}`
    : `${kindLabel} · ${statusLabel}`;
  return {
    id: Number(lesson.id),
    indexLabel,
    title: lesson.title || "小节",
    contentKind: lesson.contentKind,
    metaLine,
  };
}

/**
 * 按当前子课（无子课则 parentId=0）拼章节和小节。章节默认展开。
 * 与小程序 pages/course/detail/detail `_buildCatalogBlocks` 一致。
 */
export function buildCatalogBlocks(
  nodes: LearningCatalogNode[],
  parentContextId: number,
  collapsedMap: Record<number, boolean>,
): CatalogBlock[] {
  const list = Array.isArray(nodes) ? nodes : [];
  const children = list.filter((n) => Number(n.parentId) === Number(parentContextId));
  const blocks: CatalogBlock[] = [];
  let lessonSeq = 0;
  children.forEach((n) => {
    if (n.nodeType === NODE_CHAPTER) {
      const chapterId = Number(n.id);
      const lessons = list
        .filter((c) => Number(c.parentId) === chapterId && c.nodeType === NODE_LESSON)
        .map((lesson) => {
          lessonSeq += 1;
          return formatLessonRow(lesson, lessonSeq);
        });
      blocks.push({
        type: "chapter",
        id: chapterId,
        title: n.title || "章节",
        indexLabel: "",
        contentKind: null,
        metaLine: "",
        lessonCount: n.lessonCount != null ? Number(n.lessonCount) : lessons.length,
        expanded: !collapsedMap[chapterId],
        lessons,
      });
      return;
    }
    if (n.nodeType === NODE_LESSON) {
      lessonSeq += 1;
      const row = formatLessonRow(n, lessonSeq);
      blocks.push({
        type: "lesson",
        id: row.id,
        title: row.title,
        indexLabel: row.indexLabel,
        contentKind: row.contentKind,
        metaLine: row.metaLine,
        lessonCount: 0,
        expanded: false,
        lessons: [],
      });
    }
  });
  return blocks;
}
