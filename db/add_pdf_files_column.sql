-- 为 history_records 表添加 pdf_files 列
-- 在 Neon SQL Editor 中执行此脚本

ALTER TABLE history_records ADD COLUMN IF NOT EXISTS pdf_files JSONB;
