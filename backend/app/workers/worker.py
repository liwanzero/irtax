import redis
from rq import Worker

from app.core.config import settings
from app.workers.queue import conversion_queue


def main() -> None:
    conn = redis.from_url(settings.redis_url)
    worker = Worker([conversion_queue], connection=conn)
    worker.work()


if __name__ == "__main__":
    main()
