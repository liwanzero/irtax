import redis
from rq import Queue

from app.core.config import settings

_redis_conn = redis.from_url(settings.redis_url)
conversion_queue = Queue("conversions", connection=_redis_conn)
