-- AlterTable
ALTER TABLE "code_chunks" ADD COLUMN     "embedding" vector(1536);

-- CreateIndex
CREATE INDEX "code_chunks_ast_fingerprint_idx" ON "code_chunks"("ast_fingerprint");
