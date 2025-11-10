"""
并行文档处理器
借鉴LangExtract的并行处理策略，大幅提升处理速度
"""

import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from typing import List, Dict, Any, Optional, Callable, Tuple, AsyncGenerator
import logging
import time
from dataclasses import dataclass
import numpy as np
from functools import partial
import multiprocessing as mp
import threading
import queue
import hashlib

logger = logging.getLogger(__name__)

@dataclass
class ProcessingTask:
    """处理任务"""
    id: str
    content: str
    chunk_index: int
    total_chunks: int
    metadata: Dict[str, Any]

@dataclass
class ProcessingResult:
    """处理结果"""
    task_id: str
    chunk_index: int
    success: bool
    data: Any
    error: Optional[str] = None
    processing_time: float = 0.0

class ParallelProcessor:
    """
    并行处理器
    
    借鉴LangExtract的设计：
    1. 智能分块：保持语义完整性
    2. 并行处理：多线程/多进程
    3. 结果合并：智能去重和排序
    4. 错误恢复：失败重试机制
    """
    
    def __init__(self, 
                 max_workers: int = None,
                 chunk_size: int = 2000,
                 overlap: int = 200,
                 processing_mode: str = 'thread'):
        """
        初始化并行处理器
        
        Args:
            max_workers: 最大工作进程/线程数（默认CPU核心数）
            chunk_size: 块大小（字符数）
            overlap: 块之间的重叠（避免边界丢失）
            processing_mode: 'thread' 或 'process'
        """
        self.max_workers = max_workers or mp.cpu_count()
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.processing_mode = processing_mode
        
        # 性能统计
        self.stats = {
            'total_processed': 0,
            'total_time': 0,
            'success_rate': 1.0,
            'avg_chunk_time': 0
        }
    
    def smart_chunk_text(self, text: str) -> List[Tuple[int, str]]:
        """
        智能文本分块
        
        借鉴LangExtract：不在句子中间切分，保持语义完整
        
        Returns:
            [(start_offset, chunk_text), ...]
        """
        chunks = []
        
        # 句子边界检测
        sentence_endings = ['. ', '。', '！', '？', '\n\n']
        
        start = 0
        while start < len(text):
            # 计算块的结束位置
            end = min(start + self.chunk_size, len(text))
            
            # 如果不是最后一块，找到最近的句子结束位置
            if end < len(text):
                # 向前搜索句子结束
                best_end = end
                for ending in sentence_endings:
                    pos = text.rfind(ending, start + self.chunk_size // 2, end)
                    if pos != -1:
                        best_end = pos + len(ending)
                        break
                end = best_end
            
            # 提取块（包含重叠）
            chunk_start = max(0, start - self.overlap if start > 0 else 0)
            chunk = text[chunk_start:end]
            
            chunks.append((chunk_start, chunk))
            
            # 移动到下一块
            start = end - self.overlap
            
            # 避免无限循环
            if start >= len(text) - 10:
                break
        
        logger.info(f"文本分为 {len(chunks)} 块")
        return chunks
    
    async def process_chunk_async(self, 
                                 chunk: ProcessingTask,
                                 processor_func: Callable,
                                 session: aiohttp.ClientSession) -> ProcessingResult:
        """异步处理单个块"""
        start_time = time.time()
        
        try:
            # 调用处理函数
            result = await processor_func(chunk, session)
            
            return ProcessingResult(
                task_id=chunk.id,
                chunk_index=chunk.chunk_index,
                success=True,
                data=result,
                processing_time=time.time() - start_time
            )
            
        except Exception as e:
            logger.error(f"处理块 {chunk.chunk_index} 失败: {e}")
            return ProcessingResult(
                task_id=chunk.id,
                chunk_index=chunk.chunk_index,
                success=False,
                data=None,
                error=str(e),
                processing_time=time.time() - start_time
            )
    
    def process_chunk_sync(self, 
                          chunk: ProcessingTask,
                          processor_func: Callable) -> ProcessingResult:
        """同步处理单个块"""
        start_time = time.time()
        
        try:
            # 调用处理函数
            result = processor_func(chunk)
            
            return ProcessingResult(
                task_id=chunk.id,
                chunk_index=chunk.chunk_index,
                success=True,
                data=result,
                processing_time=time.time() - start_time
            )
            
        except Exception as e:
            logger.error(f"处理块 {chunk.chunk_index} 失败: {e}")
            return ProcessingResult(
                task_id=chunk.id,
                chunk_index=chunk.chunk_index,
                success=False,
                data=None,
                error=str(e),
                processing_time=time.time() - start_time
            )
    
    async def process_async(self, 
                           text: str,
                           processor_func: Callable,
                           doc_id: str = None) -> Dict[str, Any]:
        """
        异步并行处理
        
        适用于IO密集型任务（如API调用）
        """
        # 分块
        chunks_data = self.smart_chunk_text(text)
        
        # 创建任务
        tasks = []
        for i, (offset, chunk_text) in enumerate(chunks_data):
            task = ProcessingTask(
                id=f"{doc_id or 'doc'}_{i}",
                content=chunk_text,
                chunk_index=i,
                total_chunks=len(chunks_data),
                metadata={'offset': offset}
            )
            tasks.append(task)
        
        # 异步处理
        async with aiohttp.ClientSession() as session:
            results = await asyncio.gather(*[
                self.process_chunk_async(task, processor_func, session)
                for task in tasks
            ])
        
        # 合并结果
        return self._merge_results(results)
    
    def process_parallel(self, 
                        text: str,
                        processor_func: Callable,
                        doc_id: str = None) -> Dict[str, Any]:
        """
        并行处理（线程或进程）
        
        借鉴LangExtract：根据任务类型选择并行模式
        """
        start_time = time.time()
        
        # 分块
        chunks_data = self.smart_chunk_text(text)
        
        # 创建任务
        tasks = []
        for i, (offset, chunk_text) in enumerate(chunks_data):
            task = ProcessingTask(
                id=f"{doc_id or 'doc'}_{i}",
                content=chunk_text,
                chunk_index=i,
                total_chunks=len(chunks_data),
                metadata={'offset': offset}
            )
            tasks.append(task)
        
        # 选择执行器
        if self.processing_mode == 'process':
            executor = ProcessPoolExecutor(max_workers=self.max_workers)
        else:
            executor = ThreadPoolExecutor(max_workers=self.max_workers)
        
        try:
            # 并行处理
            process_func = partial(self.process_chunk_sync, processor_func=processor_func)
            results = list(executor.map(process_func, tasks))
            
        finally:
            executor.shutdown(wait=True)
        
        # 合并结果
        merged = self._merge_results(results)
        
        # 更新统计
        total_time = time.time() - start_time
        self.stats['total_processed'] += len(tasks)
        self.stats['total_time'] += total_time
        self.stats['avg_chunk_time'] = total_time / len(tasks) if tasks else 0
        
        logger.info(f"并行处理完成: {len(tasks)} 块, 耗时 {total_time:.2f}秒")
        
        return merged
    
    def _merge_results(self, results: List[ProcessingResult]) -> Dict[str, Any]:
        """
        合并处理结果
        
        借鉴LangExtract的合并策略：
        1. 按块索引排序
        2. 去除重复（基于内容哈希）
        3. 处理重叠区域
        """
        # 按块索引排序
        results.sort(key=lambda x: x.chunk_index)
        
        # 统计
        success_count = sum(1 for r in results if r.success)
        self.stats['success_rate'] = success_count / len(results) if results else 0
        
        # 合并数据
        merged_data = []
        seen_hashes = set()
        
        for result in results:
            if result.success and result.data:
                # 去重（基于内容哈希）
                if isinstance(result.data, list):
                    for item in result.data:
                        item_hash = self._hash_item(item)
                        if item_hash not in seen_hashes:
                            merged_data.append(item)
                            seen_hashes.add(item_hash)
                else:
                    merged_data.append(result.data)
        
        return {
            'data': merged_data,
            'stats': {
                'total_chunks': len(results),
                'successful_chunks': success_count,
                'failed_chunks': len(results) - success_count,
                'success_rate': self.stats['success_rate'],
                'processing_time': sum(r.processing_time for r in results)
            },
            'errors': [r.error for r in results if r.error]
        }
    
    def _hash_item(self, item: Any) -> str:
        """计算项目哈希（用于去重）"""
        if isinstance(item, dict):
            # 对字典的关键字段进行哈希
            key_fields = ['text', 'name', 'id', 'content']
            content = ''
            for field in key_fields:
                if field in item:
                    content += str(item[field])
            if content:
                return hashlib.md5(content.encode()).hexdigest()
        
        return hashlib.md5(str(item).encode()).hexdigest()
    
    def process_batch(self, 
                     documents: List[str],
                     processor_func: Callable,
                     batch_size: int = 10) -> List[Dict[str, Any]]:
        """
        批量处理多个文档
        
        Args:
            documents: 文档列表
            processor_func: 处理函数
            batch_size: 批次大小
        """
        all_results = []
        
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            
            # 并行处理批次
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                batch_results = list(executor.map(
                    lambda doc: self.process_parallel(doc, processor_func, f"doc_{i}"),
                    batch
                ))
            
            all_results.extend(batch_results)
            
            logger.info(f"完成批次 {i//batch_size + 1}/{(len(documents)-1)//batch_size + 1}")
        
        return all_results
    
    def adaptive_chunking(self, text: str, target_tokens: int = 1500) -> List[str]:
        """
        自适应分块
        
        根据模型的token限制动态调整块大小
        """
        # 估算token数（中文约1.5字符/token，英文约4字符/token）
        avg_chars_per_token = 2.5
        target_chars = int(target_tokens * avg_chars_per_token)
        
        # 动态调整chunk_size
        self.chunk_size = min(target_chars, self.chunk_size)
        
        return [chunk[1] for chunk in self.smart_chunk_text(text)]
    
    def get_performance_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        return {
            'total_documents_processed': self.stats['total_processed'],
            'total_processing_time': f"{self.stats['total_time']:.2f}s",
            'average_chunk_time': f"{self.stats['avg_chunk_time']:.3f}s",
            'success_rate': f"{self.stats['success_rate']*100:.1f}%",
            'parallel_speedup': f"{self.max_workers}x",
            'configuration': {
                'max_workers': self.max_workers,
                'chunk_size': self.chunk_size,
                'overlap': self.overlap,
                'mode': self.processing_mode
            }
        }


class StreamingProcessor:
    """
    流式处理器
    
    处理超大文档，边读边处理
    """
    
    def __init__(self, buffer_size: int = 10000):
        self.buffer_size = buffer_size
        self.processor = ParallelProcessor()
    
    async def process_stream(self, 
                            stream,
                            processor_func: Callable) -> AsyncGenerator:
        """流式处理"""
        buffer = ""
        
        async for chunk in stream:
            buffer += chunk
            
            # 当缓冲区足够大时处理
            if len(buffer) >= self.buffer_size:
                # 找到安全的切分点
                cut_point = buffer.rfind('. ', 0, self.buffer_size)
                if cut_point == -1:
                    cut_point = self.buffer_size
                
                # 处理并yield结果
                to_process = buffer[:cut_point]
                result = await self.processor.process_async(
                    to_process,
                    processor_func
                )
                yield result
                
                # 保留剩余部分
                buffer = buffer[cut_point:]
        
        # 处理最后的缓冲区
        if buffer:
            result = await self.processor.process_async(
                buffer,
                processor_func
            )
            yield result