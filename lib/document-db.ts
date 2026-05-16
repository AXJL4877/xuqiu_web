export type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentListItem = Pick<
  DocumentRecord,
  "id" | "title" | "createdAt" | "updatedAt"
> & {
  excerpt?: string;
};

export function rowToDocument(row: {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function rowToListItem(row: {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): DocumentListItem {
  const excerpt = row.content
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    excerpt: excerpt || undefined,
  };
}
