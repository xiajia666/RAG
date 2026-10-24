"""Copy legacy MySQL/SQLite chunks into Elasticsearch before switching deployments.

Run from backend/ after configuring both the existing SQL database and Elasticsearch:
    python -m ops.migrate_chunks_to_es

Pass --drop-mysql-chunks only after verifying the migrated documents in Elasticsearch.
"""
import argparse

import numpy as np
from sqlalchemy import text

from core import config, db
from rag import embeddings, vector_store


def migrate(batch_size=500):
    total = 0
    last_id = ""
    while True:
        with db.engine.connect() as connection:
            rows = connection.execute(text(
                "SELECT c.id, c.tenant_id, c.doc_id, c.kb_id, c.chunk_index, c.content, "
                "c.embedding, c.created_at, d.filename "
                "FROM chunks c JOIN documents d ON d.id = c.doc_id "
                "AND d.tenant_id = c.tenant_id "
                "WHERE c.id > :last_id ORDER BY c.id LIMIT :batch_size"
            ), {"last_id": last_id, "batch_size": batch_size}).mappings().all()
        if not rows:
            break

        missing_vectors = [row for row in rows if not row["embedding"]]
        generated = iter(embeddings.embed_texts([row["content"] for row in missing_vectors])) if missing_vectors else iter(())
        records = []
        for row in rows:
            if row["embedding"]:
                vector = np.frombuffer(row["embedding"], dtype=np.float32).tolist()
            else:
                vector = next(generated).tolist()
            created_at = row["created_at"]
            if hasattr(created_at, "strftime"):
                created_at = created_at.strftime("%Y-%m-%d %H:%M:%S")
            records.append({
                "id": row["id"],
                "tenant_id": row["tenant_id"],
                "doc_id": row["doc_id"],
                "kb_id": row["kb_id"],
                "filename": row["filename"],
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "embedding": vector,
                "created_at": str(created_at),
            })
        total += vector_store._index_chunks(records, refresh=False)
        last_id = rows[-1]["id"]
        print(f"已迁移 {total} 个切片")

    if total:
        vector_store._get_client().indices.refresh(index=config.ELASTICSEARCH_INDEX)
    return total


def main():
    parser = argparse.ArgumentParser(description="将历史 chunks 表迁移到 Elasticsearch")
    parser.add_argument("--drop-mysql-chunks", action="store_true", help="迁移成功后删除原数据库 chunks 表")
    args = parser.parse_args()
    count = migrate()
    print(f"迁移完成，共写入 {count} 个切片到 {config.ELASTICSEARCH_INDEX}")
    if args.drop_mysql_chunks:
        with db.engine.begin() as connection:
            connection.execute(text("DROP TABLE chunks"))
        print("已删除原数据库 chunks 表")


if __name__ == "__main__":
    main()
