const data = require('./uploads/assembly_output/pid_real_assembly.json');
data.object.children.forEach((obj, i) => {
  console.log(`零件${i} (${obj.name}):`);
  console.log(`  位置: [${obj.matrix[12]}, ${obj.matrix[13]}, ${obj.matrix[14]}]`);
});
