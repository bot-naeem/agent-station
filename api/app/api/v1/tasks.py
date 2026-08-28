"""Tasks API — 智能体六态任务管理"""
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_agent_or_admin, resolve_agent_names_to_ids
from app.core.database import get_db
from app.models.admin_user import AdminUser
from app.models.agent import Agent
from app.models.task import Task, TASK_STATUSES, ACTIVE_STATUSES, TERMINAL_STATUSES, is_valid_status, is_terminal_status
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskCloseRequest
from app.schemas.common import PaginatedResponse

router = APIRouter()

# list_tasks 组排序：进行中 → 阻塞 → 待办 → 挂起 → 终态
STATUS_ORDER = {s: i for i, s in enumerate(["进行中", "阻塞", "待办", "挂起", "完成", "废弃"])}


def _is_admin(x) -> bool:
    return isinstance(x, AdminUser)


def _own_name(x) -> str:
    return getattr(x, "display_name", None) or getattr(x, "name", "")


async def _scope_agent_ids(
    db: AsyncSession,
    current: Any,
    agent_name: Optional[str],
) -> Optional[list]:
    """返回可见的 agent_id 列表；None 表示不限制（admin 全量）"""
    if _is_admin(current):
        if agent_name:
            ids = await resolve_agent_names_to_ids(db, [agent_name])
            return ids or []
        return None  # admin 不传名字 = 全部
    # 普通 Agent：只能看自己（即使传了别人的名字也忽略）
    return [current.id]


async def _find_task(
    db: AsyncSession,
    *,
    task_id: Optional[UUID],
    title: Optional[str],
    owner_id,
) -> Task | None:
    """按 id 或 title 定位任务（title 在指定范围内精确匹配）。owner_id=None 表示 admin 全量视角"""
    if task_id:
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"任务不存在: id={task_id}")
        if owner_id is not None and task.agent_id != owner_id:
            raise HTTPException(status_code=403, detail=f"无权操作任务「{task.title}」")
        return task

    if title:
        query = select(Task).where(func.lower(Task.title) == title.strip().lower())
        if owner_id is not None:
            query = query.where(Task.agent_id == owner_id)
        result = await db.execute(query)
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"任务不存在: title={title}")
        return task

    raise HTTPException(status_code=400, detail="必须提供 id 或 title 之一来定位任务")


@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current = Depends(get_current_agent_or_admin),
):
    """创建任务。重名报错，绝不覆盖。身份自动绑定 API Key。Admin 可指定 agent_id 分派任务。"""
    if not is_valid_status(payload.status):
        raise HTTPException(
            status_code=422,
            detail=f"无效状态 '{payload.status}'，可选：{'/'.join(TASK_STATUSES)}",
        )

    is_admin = _is_admin(current)
    # Admin 可指定 agent_id 分派任务；普通 Agent 自动绑定自己
    if is_admin and payload.agent_id:
        # 校验目标 agent 存在且 is_active=true
        from app.models.agent import Agent
        result = await db.execute(select(Agent).where(Agent.id == payload.agent_id, Agent.is_active == True))
        target_agent = result.scalar_one_or_none()
        if not target_agent:
            raise HTTPException(status_code=404, detail=f"目标 Agent 不存在或已禁用: {payload.agent_id}")
        agent_id = payload.agent_id
    else:
        agent_id = None if is_admin else current.id

    # 同 Agent 内重名校验
    dup_query = select(Task).where(func.lower(Task.title) == payload.title.strip().lower())
    if agent_id is not None:
        dup_query = dup_query.where(Task.agent_id == agent_id)
    dup = (await db.execute(dup_query)).scalar_one_or_none()
    if dup:
        raise HTTPException(
            status_code=409,
            detail=f"已存在同名任务「{dup.title}」（{dup.status}），如需修改请用 update_task",
        )

    task = Task(
        agent_id=agent_id,
        title=payload.title.strip(),
        status=payload.status,
        detail=payload.detail,
        tags=payload.tags,
        project=payload.project,
        status_history=[{"from": None, "to": payload.status, "at": datetime.now(timezone.utc).isoformat()}] if payload.status != "待办" else [],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/tasks", response_model=PaginatedResponse[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None, description="单值 / 逗号分隔多值 / 'all'=含终态；缺省=仅活跃四态"),
    agent_name: Optional[str] = Query(None, description="跨查指定 Agent（需权限）"),
    project: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None, description="只看此时间后有动静的，ISO 格式"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current = Depends(get_current_agent_or_admin),
):
    """列任务。缺省只回活跃态；数组 + total；组排序：进行中→阻塞→待办→挂起，组内按 updated_at 倒序"""
    visible_ids = await _scope_agent_ids(db, current, agent_name)

    query = select(Task)
    count_query = select(func.count(Task.id))

    def apply(q):
        if visible_ids is not None:
            if not visible_ids:
                q = q.where(False)
            else:
                q = q.where(Task.agent_id.in_(visible_ids))
        if status:
            s = status.strip()
            if s.lower() == "all":
                pass  # 全部
            elif "," in s:
                states = [x.strip() for x in s.split(",") if x.strip()]
                bad = [x for x in states if not is_valid_status(x)]
                if bad:
                    raise HTTPException(status_code=422, detail=f"无效状态: {'/'.join(bad)}，可选：{'/'.join(TASK_STATUSES)} 或 all")
                q = q.where(Task.status.in_(states))
            else:
                if not is_valid_status(s):
                    raise HTTPException(status_code=422, detail=f"无效状态 '{s}'，可选：{'/'.join(TASK_STATUSES)} 或 all")
                q = q.where(Task.status == s)
        else:
            q = q.where(Task.status.in_(ACTIVE_STATUSES))  # 缺省只回活跃态
        if project:
            q = q.where(Task.project == project)
        if tag:
            q = q.where(Task.tags.contains([tag]))
        if updated_since:
            try:
                dt = datetime.fromisoformat(updated_since.replace("Z", "+00:00"))
                q = q.where(Task.updated_at >= dt)
            except ValueError:
                raise HTTPException(status_code=422, detail=f"updated_since 格式错误: '{updated_since}'，需要 ISO 时间")
        return q

    query = apply(query)
    count_query = apply(count_query)

    total = await db.scalar(count_query)

    rows = (await db.execute(query)).scalars().all()
    # 组排序：进行中→阻塞→待办→挂起→终态，组内 updated_at 倒序
    items = sorted(rows, key=lambda t: (STATUS_ORDER.get(t.status, 99), -t.updated_at.timestamp()))

    paged = items[offset:offset + limit]
    return PaginatedResponse(items=paged, total=total or 0, page=(offset // limit) + 1, page_size=limit, total_pages=((total or 0) + limit - 1) // limit)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current = Depends(get_current_agent_or_admin),
):
    """按 id 拿单条完整详情（含 status_history）"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: id={task_id}")
    visible_ids = await _scope_agent_ids(db, current, None)
    if visible_ids is not None and task.agent_id not in visible_ids:
        raise HTTPException(status_code=403, detail=f"无权查看任务「{task.title}」")
    return task


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current = Depends(get_current_agent_or_admin),
):
    """部分更新任务。status 变更自动写 status_history。改 title 撞已有同名报错。"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: id={task_id}")

    if not _is_admin(current) and task.agent_id != current.id:
        raise HTTPException(status_code=403, detail=f"无权修改任务「{task.title}」，只能改自己的")

    update_data = payload.model_dump(exclude_unset=True)

    # 改 title 时查重名
    if "title" in update_data and update_data["title"]:
        new_title = update_data["title"].strip()
        if new_title.lower() != task.title.lower():
            dup_query = select(Task).where(
                func.lower(Task.title) == new_title.lower(),
                Task.id != task.id,
            )
            if task.agent_id is not None:
                dup_query = dup_query.where(Task.agent_id == task.agent_id)
            dup = (await db.execute(dup_query)).scalar_one_or_none()
            if dup:
                raise HTTPException(status_code=409, detail=f"改名冲突：「{new_title}」已被任务占用（{dup.status}）")
        task.title = new_title

    # status 变更写 history
    if "status" in update_data and update_data["status"]:
        new_status = update_data["status"]
        if not is_valid_status(new_status):
            raise HTTPException(status_code=422, detail=f"无效状态 '{new_status}'，可选：{'/'.join(TASK_STATUSES)}")
        if is_terminal_status(task.status) and new_status != task.status:
            raise HTTPException(
                status_code=409,
                detail=f"任务「{task.title}」已是终态「{task.status}」，不能改为「{new_status}」。请用 delete_task 删除或保持现状",
            )
        old = task.status
        task.status = new_status
        task.append_history(old, new_status)

    if "detail" in update_data:
        task.detail = update_data["detail"]
    if "tags" in update_data and update_data["tags"] is not None:
        task.tags = update_data["tags"]
    if "project" in update_data:
        task.project = update_data["project"]
    if "result" in update_data:
        task.result = update_data["result"]

    await db.commit()
    await db.refresh(task)
    return task


@router.post("/tasks/close", response_model=TaskResponse)
async def close_task(
    payload: TaskCloseRequest,
    db: AsyncSession = Depends(get_db),
    current = Depends(get_current_agent_or_admin),
):
    """归档语义收尾：置终态(完成/废弃) + 存结论。默认视图消失但 status=all 仍可查。JSON body 定位。"""
    status = payload.status or "完成"
    if status not in TERMINAL_STATUSES:
        raise HTTPException(status_code=422, detail=f"close_task 只接受终态：{'/'.join(TERMINAL_STATUSES)}")

    task = await _find_task(db, task_id=payload.id, title=payload.title, owner_id=None if _is_admin(current) else current.id)

    if is_terminal_status(task.status):
        raise HTTPException(status_code=409, detail=f"任务「{task.title}」已是终态「{task.status}」，无需重复归档")

    old = task.status
    task.status = status
    task.append_history(old, status)
    if payload.result:
        task.result = payload.result
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: UUID,
    confirm: bool = Query(False, description="必须显式传 confirm=true"),
    db: AsyncSession = Depends(get_db),
    current = Depends(get_current_agent_or_admin),
):
    """硬删除（慎用）。日常收尾请走 POST /tasks/close。"""
    if not confirm:
        raise HTTPException(status_code=400, detail="危险操作：删除请显式传 confirm=true。日常收尾建议用 close_task 归档")
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: id={task_id}")
    if not _is_admin(current) and task.agent_id != current.id:
        raise HTTPException(status_code=403, detail=f"无权删除任务「{task.title}」")
    await db.delete(task)
    await db.commit()
    return {"deleted": True, "id": str(task_id), "title": task.title}
