"""测试集生成（ragas）HTTP 接口。"""
from sqlalchemy import select

from core import db
from core.schemas import TestsetGenerateRequest
from controllers.common import get_kb_for_user
from controllers.runtime import CurrentUser, HTTPException, api
from services import evaluation_service


@api.post('/api/evaluation/generate-testset')
def generate_testset(req: TestsetGenerateRequest, user=CurrentUser()):
    if not req.document_ids:
        raise HTTPException(400, "请先选择文档")
    if len(req.document_ids) > 50:
        raise HTTPException(400, "单次最多选择 50 份文档")

    docs = []
    seen = set()
    for doc_id in req.document_ids:
        if doc_id in seen:
            continue
        seen.add(doc_id)
        doc = db.query_one(
            select(db.Document.id, db.Document.kb_id, db.Document.filename).where(
                db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]
            )
        )
        if not doc:
            raise HTTPException(404, f"文档不存在：{doc_id}")
        get_kb_for_user(doc["kb_id"], user)
        docs.append(doc)

    try:
        return evaluation_service.generate_document_testset(
            tenant_id=user["tenant_id"],
            documents=docs,
            test_size=req.test_size,
            distributions=req.distributions,
        )
    except evaluation_service.TestsetGenerationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
