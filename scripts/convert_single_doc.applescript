-- 简化版：用 Microsoft Word 转换单个 DOC 文件

on run
	set inputPath to "/Users/shenguoli/Documents/projects/design-institute-platform/docs/specs/Full Length/00 - PROCUREMENT AND CONTRACTING REQUIREMENTS/000101 FL - Project Title Page.DOC"
	set outputPath to "/Users/shenguoli/Documents/projects/design-institute-platform/test_word_auto_converted.docx"

	tell application "Microsoft Word"
		-- 打开文件
		set theDoc to open inputPath

		-- 另存为 DOCX (使用数字 12 代表 DOCX 格式)
		save as theDoc file name outputPath file format 12

		-- 关闭文档
		close theDoc saving no
	end tell

	return "成功"
end run
