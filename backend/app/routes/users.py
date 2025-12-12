from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/")
async def read_users():
    return [{"id": 1, "name": "Engineer A"}, {"id": 2, "name": "Expert B"}]
