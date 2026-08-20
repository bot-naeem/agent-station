#!/usr/bin/env python3
"""
Agent Log Sync Client
同步本地 markdown 日志到远程 Agent Log Platform
"""

import os
import sys
import yaml
import hashlib
import asyncio
import aiohttp
import aiofiles
from pathlib import Path
from datetime import datetime
from typing import Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import frontmatter

CONFIG_PATH = Path.home() / ".config" / "agent-log" / "config.yaml"
DEFAULT_CONFIG = {
    "api_url": "https://codingfamily.online/api/v1",
    "api_key": "",
    "local_dir": "~/.agent-logs",
    "sync_interval": 60,
    "watch": True,
    "batch_size": 10,
    "retry_max": 5,
    "log_level": "INFO",
}


class LogSyncer:
    def __init__(self, config: dict):
        self.config = config
        self.api_url = config["api_url"].rstrip("/")
        self.api_key = config["api_key"]
        self.local_dir = Path(config["local_dir"]).expanduser()
        self.sync_interval = config["sync_interval"]
        self.watch = config["watch"]
        self.batch_size = config["batch_size"]
        self.retry_max = config["retry_max"]
        self.session: Optional[aiohttp.ClientSession] = None
        self.pending_files: set[Path] = set()
        self.syncing = False

    async def start(self):
        """启动同步器"""
        self.local_dir.mkdir(parents=True, exist_ok=True)
        print(f"[{datetime.now()}] 启动同步器，监听目录: {self.local_dir}")

        if self.watch:
            self._start_watcher()

        # 初始全量同步
        await self.full_sync()

        # 定时增量同步
        while True:
            await asyncio.sleep(self.sync_interval)
            if not self.syncing:
                await self.incremental_sync()

    def _start_watcher(self):
        """启动文件监听"""
        class MarkdownHandler(FileSystemEventHandler):
            def __init__(self, syncer):
                self.syncer = syncer

            def on_created(self, event):
                if event.is_directory or not event.src_path.endswith((".md", ".markdown")):
                    return
                self.syncer.pending_files.add(Path(event.src_path))

            def on_modified(self, event):
                if event.is_directory or not event.src_path.endswith((".md", ".markdown")):
                    return
                self.syncer.pending_files.add(Path(event.src_path))

        self.observer = Observer()
        self.observer.schedule(MarkdownHandler(self), str(self.local_dir), recursive=True)
        self.observer.start()

    async def full_sync(self):
        """全量同步所有 markdown 文件"""
        print(f"[{datetime.now()}] 开始全量同步...")
        self.syncing = True
        try:
            files = list(self.local_dir.rglob("*.md")) + list(self.local_dir.rglob("*.markdown"))
            print(f"[{datetime.now()}] 发现 {len(files)} 个文件")
            
            for i in range(0, len(files), self.batch_size):
                batch = files[i:i + self.batch_size]
                await self._sync_batch(batch)
        finally:
            self.syncing = False

    async def incremental_sync(self):
        """增量同步待处理文件"""
        if not self.pending_files:
            return

        print(f"[{datetime.now()}] 增量同步 {len(self.pending_files)} 个文件...")
        self.syncing = True
        try:
            files = list(self.pending_files)
            self.pending_files.clear()
            
            for i in range(0, len(files), self.batch_size):
                batch = files[i:i + self.batch_size]
                await self._sync_batch(batch)
        finally:
            self.syncing = False

    async def _sync_batch(self, files: list[Path]):
        """同步一批文件"""
        if not self.session:
            self.session = aiohttp.ClientSession(
                headers={"X-API-Key": self.api_key},
                timeout=aiohttp.ClientTimeout(total=60),
            )

        for file_path in files:
            await self._sync_file(file_path)

    async def _sync_file(self, file_path: Path):
        """同步单个文件"""
        try:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                content = await f.read()

            # 计算 hash 用于去重
            file_hash = hashlib.sha256(content.encode()).hexdigest()

            # 解析 front matter
            try:
                post = frontmatter.loads(content)
                front_matter = dict(post.metadata)
            except Exception:
                front_matter = {}

            # 确定 agent_type 和 date
            agent_type = front_matter.get("agent_type", "unknown")
            log_date_str = front_matter.get("date") or front_matter.get("started_at")
            if log_date_str:
                try:
                    log_date = datetime.fromisoformat(log_date_str.replace("Z", "+00:00")).date()
                except Exception:
                    log_date = datetime.now().date()
            else:
                log_date = datetime.now().date()

            payload = {
                "content": content,
                "agent_type": agent_type,
                "log_date": log_date.isoformat(),
                "front_matter": front_matter,
            }

            # 发送到服务器
            for attempt in range(self.retry_max):
                try:
                    async with self.session.post(
                        f"{self.api_url}/markdown",
                        json=payload,
                    ) as resp:
                        if resp.status == 201:
                            print(f"[{datetime.now()}] ✓ 同步成功: {file_path.relative_to(self.local_dir)}")
                            return
                        elif resp.status == 400:
                            text = await resp.text()
                            if "already exists" in text:
                                print(f"[{datetime.now()}] - 已存在跳过: {file_path.relative_to(self.local_dir)}")
                                return
                            else:
                                print(f"[{datetime.now()}] ✗ 同步失败: {file_path} - {text}")
                                return
                        else:
                            text = await resp.text()
                            print(f"[{datetime.now()}] ✗ 同步失败 ({resp.status}): {file_path} - {text}")
                except Exception as e:
                    if attempt == self.retry_max - 1:
                        print(f"[{datetime.now()}] ✗ 重试耗尽: {file_path} - {e}")
                    else:
                        await asyncio.sleep(2 ** attempt)

        except Exception as e:
            print(f"[{datetime.now()}] ✗ 读取文件失败: {file_path} - {e}")

    async def stop(self):
        """停止同步器"""
        if hasattr(self, "observer"):
            self.observer.stop()
            self.observer.join()
        if self.session:
            await self.session.close()


def load_config() -> dict:
    """加载配置文件"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            user_config = yaml.safe_load(f) or {}
        return {**DEFAULT_CONFIG, **user_config}
    else:
        # 创建默认配置文件
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            yaml.dump(DEFAULT_CONFIG, f, default_flow_style=False, allow_unicode=True)
        print(f"已创建默认配置文件: {CONFIG_PATH}")
        print("请编辑配置文件填入 api_key 后重新运行")
        sys.exit(1)


def main():
    config = load_config()

    if not config["api_key"]:
        print("错误: 请在配置文件中设置 api_key")
        sys.exit(1)

    syncer = LogSyncer(config)

    try:
        asyncio.run(syncer.start())
    except KeyboardInterrupt:
        print("\n正在停止...")
        asyncio.run(syncer.stop())


if __name__ == "__main__":
    main()