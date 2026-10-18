"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update
import auth, config, db, llm, vector_store
from controllers.common import *
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from schemas import *
from services import document_service

@api.get('/api/documents')
def list_all_documents(user=CurrentUser()):
    visible = set(accessible_kb_ids(user))
    return [doc for doc in db.query(
        select(db.Document, db.KnowledgeBase.name.label("knowledge_base_name"))
        .join(db.KnowledgeBase, and_(db.KnowledgeBase.id == db.Document.kb_id,
                                     db.KnowledgeBase.tenant_id == db.Document.tenant_id))
        .where(db.Document.tenant_id == user["tenant_id"]).order_by(db.Document.created_at.desc()),
    ) if doc["kb_id"] in visible]


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
    chunks = db.query(
        select(db.Chunk.chunk_index, db.Chunk.content, db.Chunk.created_at)
        .where(db.Chunk.doc_id == doc_id, db.Chunk.tenant_id == user["tenant_id"])
        .order_by(db.Chunk.chunk_index).limit(5),
    )
    return {"document": doc, "chunks": chunks}


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
        db.execute(delete(db.Document).where(db.Document.id == doc["id"], db.Document.tenant_id == user["tenant_id"]))
        document_service.remove_original_file(user["tenant_id"], doc["id"], doc["filename"])
    return {"deleted_count": len(docs)}


@api.delete('/api/documents/{doc_id}')
def delete_document(doc_id: str, user=CurrentUser()):
    doc = db.query_one(select(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]))
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user, write=True)
    db.execute(delete(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == user["tenant_id"]))
    document_service.remove_original_file(user["tenant_id"], doc_id, doc["filename"])
    return {"deleted": True}

