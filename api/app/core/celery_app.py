from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "agent_log_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.vectorize"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=4,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        "app.tasks.vectorize.vectorize_markdown": {"queue": "vectorize"},
    },
)