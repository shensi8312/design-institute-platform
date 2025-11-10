#!/bin/bash

echo "测试API识别一致性 - 运行5次"
echo "================================"

for i in {1..5}
do
    echo -e "\n第 $i 次测试:"
    ruby plugins/sketchup/test_sketch_to_3d.rb 2>/dev/null | grep "成功识别楼层数"
    sleep 1
done

echo -e "\n================================"
echo "测试完成"