-- CreateTable
CREATE TABLE "InquirySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idea" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "notebook" JSONB NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'collecting',
    "status" TEXT NOT NULL DEFAULT 'collecting',
    "sessionMeta" JSONB NOT NULL,
    "assumptions" JSONB,
    "pendingQuestion" JSONB,
    "pendingForQuestionId" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InquirySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InquirySession_userId_updatedAt_idx" ON "InquirySession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "InquirySession_userId_status_idx" ON "InquirySession"("userId", "status");

-- AddForeignKey
ALTER TABLE "InquirySession" ADD CONSTRAINT "InquirySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquirySession" ADD CONSTRAINT "InquirySession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
