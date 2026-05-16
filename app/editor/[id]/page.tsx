import { DocumentEditorView } from "@/components/editor/document-editor-view";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentEditorView documentId={id} />;
}
