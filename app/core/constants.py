"""
Application-wide constants.

Domain-agnostic values shared across modules (pagination defaults, etc.).
"""

# List-query defaults (used by app.core.query.Pagination / Sorting)
DEFAULT_PAGE_LIMIT: int = 50
MAX_PAGE_LIMIT: int = 200
DEFAULT_SORT_BY: str = "created_at"
DEFAULT_SORT_ORDER: str = "desc"
