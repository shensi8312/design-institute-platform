import React from 'react';

const Test: React.FC = () => {
  return (
    <div style={{ padding: 50, textAlign: 'center' }}>
      <h1>测试页面</h1>
      <p>如果你能看到这个页面，说明React正在工作！</p>
      <button onClick={() => alert('点击成功！')}>
        点击测试
      </button>
    </div>
  );
};

export default Test;