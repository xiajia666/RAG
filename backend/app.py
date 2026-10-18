"""Flask application factory and HTTP error handlers."""
import os
from flask import Flask, abort, jsonify, send_file, send_from_directory
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException as WerkzeugHTTPException
import config
from controllers.runtime import HTTPException, api

import controllers.auth_controller  # noqa: F401
import controllers.tenant_controller  # noqa: F401
import controllers.knowledge_bases_controller  # noqa: F401
import controllers.analytics_controller  # noqa: F401
import controllers.documents_controller  # noqa: F401
import controllers.sessions_controller  # noqa: F401
import controllers.users_controller  # noqa: F401
import controllers.chat_controller  # noqa: F401


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=20 * 1024 * 1024)
    if test_config: app.config.update(test_config)
    @app.errorhandler(HTTPException)
    def handle_http_error(exc): return jsonify({"detail": exc.detail}), exc.status_code
    @app.errorhandler(WerkzeugHTTPException)
    def handle_werkzeug_error(exc): return jsonify({"detail": exc.description}), exc.code
    @app.errorhandler(ValidationError)
    def handle_validation_error(exc): return jsonify({"detail": str(exc)}), 422
    @app.errorhandler(413)
    def handle_too_large(_exc): return jsonify({"detail": "上传文件过大"}), 413
    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        app.logger.exception("Unhandled request error", exc_info=exc)
        return jsonify({"detail": "服务器内部错误"}), 500
    for blueprint in api.blueprints.values(): app.register_blueprint(blueprint)
    if os.path.isdir(config.FRONTEND_DIST):
        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def frontend(path):
            if path.startswith("api/"): abort(404)
            if path and os.path.isfile(os.path.join(config.FRONTEND_DIST, path)):
                return send_from_directory(config.FRONTEND_DIST, path)
            index_path=os.path.join(config.FRONTEND_DIST,"index.html")
            if os.path.isfile(index_path): return send_file(index_path)
            abort(404)
    return app

app=create_app()
