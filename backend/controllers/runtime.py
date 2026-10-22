"""Flask route registration and request argument adaptation."""
import inspect
import re

from flask import Blueprint, request
from pydantic import ValidationError

from security import authentication as auth


class HTTPException(Exception):
    """Framework-neutral API error preserving the existing response contract."""
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class CurrentUser:
    pass


class AdminUser:
    pass


class RouteRegistry:
    """Build actual Flask Blueprints and adapt existing typed controller arguments."""
    def __init__(self):
        self.blueprints = {}

    def _route(self, methods, path):
        parts = path.split('/', 3)
        domain = parts[2] if len(parts) > 2 else 'api'
        domain = {'kbs':'knowledge_bases','dashboard':'analytics','analytics':'analytics',
                  'tenant':'tenant','settings':'tenant','models':'tenant'}.get(domain, domain)
        blueprint = self.blueprints.setdefault(domain, Blueprint(f'{domain}_api', __name__))
        flask_path = re.sub(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", r'<\1>', path)

        def decorator(view):
            signature = inspect.signature(view)
            def endpoint(**path_args):
                kwargs = dict(path_args)
                for name, parameter in signature.parameters.items():
                    if isinstance(parameter.default, CurrentUser):
                        kwargs[name] = auth.get_current_user()
                    elif isinstance(parameter.default, AdminUser):
                        kwargs[name] = auth.require_admin(auth.get_current_user())
                for name, parameter in signature.parameters.items():
                    if name in kwargs:
                        continue
                    if name == 'request':
                        kwargs[name] = request
                    elif name == 'file':
                        uploaded = request.files.get(name)
                        if uploaded is None:
                            raise HTTPException(400, '未选择上传文件')
                        kwargs[name] = uploaded
                    elif isinstance(parameter.annotation, type) and hasattr(parameter.annotation, 'model_fields'):
                        try:
                            kwargs[name] = parameter.annotation.model_validate(request.get_json(silent=False) or {})
                        except ValidationError as exc:
                            raise HTTPException(422, str(exc)) from exc
                    elif isinstance(parameter.annotation, type) and hasattr(parameter.annotation, '__fields__'):
                        try:
                            kwargs[name] = parameter.annotation(**(request.get_json(silent=False) or {}))
                        except ValidationError as exc:
                            raise HTTPException(422, str(exc)) from exc
                return view(**kwargs)
            endpoint.__name__ = view.__name__
            blueprint.add_url_rule(flask_path, endpoint=view.__name__, view_func=endpoint, methods=methods)
            return view
        return decorator

    def get(self, path): return self._route(['GET'], path)
    def post(self, path): return self._route(['POST'], path)
    def put(self, path): return self._route(['PUT'], path)
    def patch(self, path): return self._route(['PATCH'], path)
    def delete(self, path): return self._route(['DELETE'], path)


api = RouteRegistry()
