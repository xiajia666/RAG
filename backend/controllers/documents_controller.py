"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update
from core import config, db
from rag import llm
from rag import vector_store
from security import authentication as auth
from controllers.common import accessible_kb_ids, get_kb_for_user
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import BulkDocumentDelete, DocumentParseRequest
from services import document_service

# 查询当前用户有权访问的全部文档。
@api.get('/api/documents')
def list_all_documents(user=CurrentUser()):
    visible = set(accessible_kb_ids(user))
    return [doc for doc in db.query(
        select(db.Document, db.KnowledgeBase.name.label("knowledge_base_name"))
        .join(db.KnowledgeBase, and_(db.KnowledgeBase.id == db.Document.kb_id,
                                     db.KnowledgeBase.tenant_id == db.Document.tenant_id))
        .where(db.Document.tenant_id == user["tenant_id"]).order_by(db.Document.created_at.desc()),
    ) if doc["kb_id"] in visible]


# 预览文档信息及部分文本分块。
@api.get('/api/documents/{doc_id}/preview')
def preview_document(doc_id: str, user=CurrentUser()):
    doc = db.query_one(
        select(db.Document, db.KnowledgeBase.name.label("knowledge_base_name"))
        .join(db.KnowledgeBase, and_(db.KnowledgeBase.id == db.Document.kb_id,
                                     db.KnowledgeBase.tenant_id == db.Document.tenant_id))
        .where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]),
    )
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user)
    chunks = vector_store.get_document_chunks(user["tenant_id"], doc_id, limit=5)
    return {"document": doc, "chunks": chunks}


# 下载文档的原始文件。
@api.get('/api/documents/{doc_id}/file')
def download_document(doc_id: str, user=CurrentUser()):
    doc = db.query_one(
        select(db.Document.id, db.Document.kb_id, db.Document.filename)
        .where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]),
    )
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user)
    paths = (
        document_service.original_path(user["tenant_id"], doc_id, doc["filename"]),
        os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{doc['filename']}"),
    )
    path = next((candidate for candidate in paths if os.path.isfile(candidate)), None)
    if not path:
        raise HTTPException(404, "原始文件不存在")
    return send_file(path, as_attachment=True, download_name=doc["filename"])


# 批量删除有权管理的文档及原始文件。
@api.post('/api/documents/bulk-delete')
def bulk_delete_documents(req: BulkDocumentDelete, user=CurrentUser()):
    if len(req.document_ids) > 200:
        raise HTTPException(400, "单次最多删除 200 份文档")
    docs = []
    for doc_id in set(req.document_ids):
        doc = db.query_one(
            select(db.Document.id, db.Document.kb_id, db.Document.filename)
            .where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]),
        )
        if doc:
            get_kb_for_user(doc["kb_id"], user, write=True)
            docs.append(doc)
    for doc in docs:
        vector_store.delete_document(user["tenant_id"], doc["id"])
        db.execute(delete(db.Document).where(db.Document.id == doc["id"], db.Document.tenant_id == user["tenant_id"]))
        document_service.remove_original_file(user["tenant_id"], doc["id"], doc["filename"])
    return {"deleted_count": len(docs)}


# 删除指定文档及其原始文件。
@api.delete('/api/documents/{doc_id}')
def delete_document(doc_id: str, user=CurrentUser()):
    doc = db.query_one(select(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]))
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user, write=True)
    vector_store.delete_document(user["tenant_id"], doc_id)
    db.execute(delete(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]))
    document_service.remove_original_file(user["tenant_id"], doc_id, doc["filename"])
    return {"deleted": True}


# 重新解析指定文档（用于对「仅上传不解析」的文档补解析，或更换解析方式）。
@api.post('/api/documents/{doc_id}/parse')
def parse_document(doc_id: str, req: DocumentParseRequest, user=CurrentUser()):
    doc = db.query_one(select(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]))
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user, write=True)
    try:
        return document_service.reparse_document(user["tenant_id"], doc_id, req.parse_method)
    except document_service.DocumentIngestionError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
