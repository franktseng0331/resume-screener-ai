-- 为 positions 表添加 job_description 列
-- 在 Neon SQL Editor 中执行此脚本

ALTER TABLE positions ADD COLUMN IF NOT EXISTS job_description TEXT;
