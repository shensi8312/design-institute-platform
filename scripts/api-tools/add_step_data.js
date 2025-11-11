const fs = require('fs');
const path = require('path');

const jsonPath = 'uploads/assembly_output/pid_47_parts_assembly.json';
const assembly = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const solidworksDir = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks';

const partsWithStep = [];

for (const part of assembly.parts) {
  const stepFile = path.join(solidworksDir, `${part.part_number}.STEP`);

  try {
    const stepData = fs.readFileSync(stepFile, 'utf-8');
    partsWithStep.push({
      ...part,
      step_data: stepData
    });
    console.log(`✅ ${part.part_number} - STEP data added (${(stepData.length/1024).toFixed(1)}KB)`);
  } catch (err) {
    console.log(`⚠️  ${part.part_number} - STEP file not found`);
  }
}

const output = {
  ...assembly,
  parts: partsWithStep
};

fs.writeFileSync('uploads/assembly_output/pid_with_step.json', JSON.stringify(output, null, 2));
console.log(`\n✅ Created: uploads/assembly_output/pid_with_step.json with ${partsWithStep.length} parts`);
