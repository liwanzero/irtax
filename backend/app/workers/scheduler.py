from datetime import datetime, timezone

import redis
from rq_scheduler import Scheduler

from app.core.config import settings
from app.workers.tasks import cleanup_expired_files


def main() -> None:
    conn = redis.from_url(settings.redis_url)
    scheduler = Scheduler(queue_name="conversions", connection=conn)

    # Avoid re-scheduling duplicates every time this process restarts.
    for job in scheduler.get_jobs():
        scheduler.cancel(job)

    scheduler.schedule(
        scheduled_time=datetime.now(timezone.utc),
        func=cleanup_expired_files,
        interval=3600,
        repeat=None,
    )

    scheduler.run()


if __name__ == "__main__":
    main()
