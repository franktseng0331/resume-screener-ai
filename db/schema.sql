-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'member')),
  position VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL
);

-- 职位表
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL
);

-- 筛查历史记录表
CREATE TABLE IF NOT EXISTS history_records (
  id VARCHAR(255) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  position_name VARCHAR(255) NOT NULL,
  job_description TEXT NOT NULL,
  special_requirements TEXT,
  results JSONB NOT NULL,
  assigned_to VARCHAR(255),
  created_by VARCHAR(255),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_created_by ON history_records(created_by);
CREATE INDEX IF NOT EXISTS idx_history_assigned_to ON history_records(assigned_to);
