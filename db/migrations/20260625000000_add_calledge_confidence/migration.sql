-- AlterTable: 调用边解析置信度（1.0 确定 / 0.5 全局唯一 / 0.4 歧义）
ALTER TABLE "call_edges" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1;
