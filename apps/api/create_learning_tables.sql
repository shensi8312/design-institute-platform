-- ========================================
-- 知识库学习系统数据表创建脚本
-- ========================================

-- 1. 历史案例表
CREATE TABLE IF NOT EXISTS historical_cases (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- 输入数据文件路径
    pid_file_path TEXT,
    bom_file_path TEXT,
    step_file_path TEXT,

    -- 解析后的数据 (JSONB格式)
    pid_data JSONB,
    bom_data JSONB NOT NULL,
    assembly_data JSONB,

    -- 学习结果
    extracted_rules_count INTEGER DEFAULT 0,
    learned_rules JSONB,

    -- 元数据
    uploaded_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_historical_cases_project_name ON historical_cases(project_name);
CREATE INDEX IF NOT EXISTS idx_historical_cases_uploaded_by ON historical_cases(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_historical_cases_created_at ON historical_cases(created_at);

COMMENT ON TABLE historical_cases IS '历史BOM案例表 - 用于学习配套规则';
COMMENT ON COLUMN historical_cases.bom_data IS 'BOM清单数据(必填)';


-- 2. 标准规范库表
CREATE TABLE IF NOT EXISTS standards_library (
    standard_id VARCHAR(50) PRIMARY KEY,
    standard_name VARCHAR(255) NOT NULL,
    standard_category VARCHAR(50) NOT NULL,

    -- 标准内容 (结构化数据)
    standard_data JSONB NOT NULL,

    -- 原始文档
    document_path TEXT,
    document_pages TEXT[],

    -- 版本信息
    version VARCHAR(50),
    issued_date DATE,
    effective_date DATE,
    discontinued_date DATE,
    replaced_by VARCHAR(50),

    -- 元数据
    uploaded_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_standards_library_category ON standards_library(standard_category);
CREATE INDEX IF NOT EXISTS idx_standards_library_effective_date ON standards_library(effective_date);

COMMENT ON TABLE standards_library IS '标准规范库表 - 存储国家标准、行业标准等';
COMMENT ON COLUMN standards_library.standard_id IS '标准编号，如GB/T 9119-2010';


-- 3. 扩展design_rules表（如果表存在则添加字段）
DO $$
BEGIN
    -- 检查表是否存在
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'design_rules') THEN
        -- 添加新字段
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS rule_id VARCHAR(100);
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS rule_type VARCHAR(50);
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS condition_data JSONB;
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS action_data JSONB;
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS source VARCHAR(100);
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 1.0;
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS sample_count INTEGER DEFAULT 0;
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS reference TEXT;
        ALTER TABLE design_rules ADD COLUMN IF NOT EXISTS learned_from_projects TEXT[];

        -- 添加唯一约束（如果不存在）
        ALTER TABLE design_rules DROP CONSTRAINT IF EXISTS design_rules_rule_id_key;
        ALTER TABLE design_rules ADD CONSTRAINT design_rules_rule_id_key UNIQUE (rule_id);

        -- 添加索引
        CREATE INDEX IF NOT EXISTS idx_design_rules_rule_type ON design_rules(rule_type);
        CREATE INDEX IF NOT EXISTS idx_design_rules_confidence ON design_rules(confidence);
        CREATE INDEX IF NOT EXISTS idx_design_rules_source ON design_rules(source);

        RAISE NOTICE '✓ design_rules表已扩展';
    ELSE
        RAISE NOTICE '⚠ design_rules表不存在，跳过扩展';
    END IF;
END $$;


-- 4. 配套模式统计表 (缓存共现模式)
CREATE TABLE IF NOT EXISTS matching_patterns (
    id SERIAL PRIMARY KEY,
    pattern_key VARCHAR(200) NOT NULL UNIQUE,
    main_part_type VARCHAR(100) NOT NULL,
    main_part_dn INTEGER,
    matching_part_type VARCHAR(100) NOT NULL,
    matching_part_spec VARCHAR(100),
    avg_quantity INTEGER,
    occurrence_count INTEGER DEFAULT 1,
    total_cases INTEGER DEFAULT 1,
    confidence FLOAT,
    sample_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_matching_patterns_main_type ON matching_patterns(main_part_type);
CREATE INDEX IF NOT EXISTS idx_matching_patterns_matching_type ON matching_patterns(matching_part_type);
CREATE INDEX IF NOT EXISTS idx_matching_patterns_confidence ON matching_patterns(confidence);

COMMENT ON TABLE matching_patterns IS '配套模式缓存表 - 存储统计分析结果';
COMMENT ON COLUMN matching_patterns.pattern_key IS '模式唯一标识，如valve_DN50_needs_flanges';
COMMENT ON COLUMN matching_patterns.confidence IS '置信度 = occurrence_count / total_cases';


-- ========================================
-- 验证表创建
-- ========================================
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('historical_cases', 'standards_library', 'matching_patterns');

    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✓ 知识库学习表创建完成！';
    RAISE NOTICE '================================================';
    RAISE NOTICE '已创建/验证 % 个新表', table_count;
    RAISE NOTICE '';
    RAISE NOTICE '新表列表:';
    RAISE NOTICE '  1. historical_cases - 历史BOM案例';
    RAISE NOTICE '  2. standards_library - 标准规范库';
    RAISE NOTICE '  3. matching_patterns - 配套模式缓存';
    RAISE NOTICE '  4. design_rules - 已扩展支持配套规则';
    RAISE NOTICE '';
    RAISE NOTICE '下一步: 上传历史BOM文件测试学习功能';
    RAISE NOTICE '================================================';
END $$;
