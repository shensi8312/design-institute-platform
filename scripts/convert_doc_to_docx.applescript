-- AppleScript: 用 Microsoft Word 批量转换 DOC 到 DOCX
-- 完整保留所有样式、编号、格式

on run argv
	-- 获取输入输出文件路径
	set inputFile to item 1 of argv
	set outputFile to item 2 of argv

	tell application "Microsoft Word"
		-- 打开 DOC 文件（不显示窗口）
		set docFile to open file inputFile

		-- 另存为 DOCX 格式 (12 = DOCX)
		save as docFile file name outputFile file format format XML document

		-- 关闭文档，不保存
		close docFile saving no

	end tell

	return "转换成功: " & outputFile
end run
