from __future__ import annotations
from typing import Any, Dict, List, Optional

from contextlib import asynccontextmanager
from pathlib import Path
from threading import Event, Thread
from fastapi import APIRouter, Depends, FastAPI, File, Form, Header, Request, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from services.account_service import account_service
from services.chatgpt_service import ChatGPTService
from services.config import config
from services.cpa_service import cpa_config, cpa_import_service, list_remote_files
from services.proxy_service import test_proxy
from services.sub2api_service import (
    list_remote_accounts as sub2api_list_remote_accounts,
    list_remote_groups as sub2api_list_remote_groups,
    sub2api_config,
    sub2api_import_service,
)

from services.image_service import ImageGenerationError
from services.version import get_app_version
from services.user_service import user_service
from services.stats_service import stats_service
from services.image_history_service import image_history_service
from services.plaza_service import plaza_service
from services.conversation_service import conversation_service
import secrets

BASE_DIR = Path(__file__).resolve().parents[1]
WEB_DIST_DIR = BASE_DIR / "web_dist"


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    model: str = "auto"
    n: int = Field(default=1, ge=1, le=4)
    response_format: str = "b64_json"
    history_disabled: bool = True


class AccountCreateRequest(BaseModel):
    tokens: list[str] = Field(default_factory=list)


class AccountDeleteRequest(BaseModel):
    tokens: list[str] = Field(default_factory=list)


class AccountRefreshRequest(BaseModel):
    access_tokens: list[str] = Field(default_factory=list)


class AccountUpdateRequest(BaseModel):
    access_token: str = Field(default="")
    type: str | None = None
    status: str | None = None
    quota: int | None = None


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str | None = None
    prompt: str | None = None
    n: int | None = None
    stream: bool | None = None
    modalities: list[str] | None = None
    messages: list[dict[str, object]] | None = None


class ResponseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str | None = None
    input: object | None = None
    tools: list[dict[str, object]] | None = None
    tool_choice: object | None = None
    stream: bool | None = None


class CPAPoolCreateRequest(BaseModel):
    name: str = ""
    base_url: str = ""
    secret_key: str = ""


class CPAPoolUpdateRequest(BaseModel):
    name: str | None = None
    base_url: str | None = None
    secret_key: str | None = None


class CPAImportRequest(BaseModel):
    names: list[str] = Field(default_factory=list)


class SettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")


class Sub2APIServerCreateRequest(BaseModel):
    name: str = ""
    base_url: str = ""
    email: str = ""
    password: str = ""
    api_key: str = ""
    group_id: str = ""


class Sub2APIServerUpdateRequest(BaseModel):
    name: str | None = None
    base_url: str | None = None
    email: str | None = None
    password: str | None = None
    api_key: str | None = None
    group_id: str | None = None


class Sub2APIImportRequest(BaseModel):
    account_ids: list[str] = Field(default_factory=list)


class ProxyUpdateRequest(BaseModel):
    enabled: bool | None = None
    url: str | None = None


class ProxyTestRequest(BaseModel):
    url: str = ""


class UserCreateRequest(BaseModel):
    name: str
    quota: int = -1


class UserUpdateRequest(BaseModel):
    name: str | None = None
    quota: int | None = None
    status: str | None = None

class SessionCreateRequest(BaseModel):
    key: str


def build_model_item(model_id: str) -> dict[str, object]:
    return {
        "id": model_id,
        "object": "model",
        "created": 0,
        "owned_by": "chatgpt2api",
    }


def sanitize_cpa_pool(pool: dict | None) -> dict | None:
    if not isinstance(pool, dict):
        return None
    return {
        key: value
        for key, value in pool.items()
        if key != "secret_key"
    }


def sanitize_cpa_pools(pools: list[dict]) -> list[dict]:
    return [sanitized for pool in pools if (sanitized := sanitize_cpa_pool(pool)) is not None]


_SUB2API_HIDDEN_FIELDS = {"password", "api_key"}


def sanitize_sub2api_server(server: dict | None) -> dict | None:
    if not isinstance(server, dict):
        return None
    sanitized = {key: value for key, value in server.items() if key not in _SUB2API_HIDDEN_FIELDS}
    sanitized["has_api_key"] = bool(str(server.get("api_key") or "").strip())
    return sanitized


def sanitize_sub2api_servers(servers: list[dict]) -> list[dict]:
    return [sanitized for server in servers if (sanitized := sanitize_sub2api_server(server)) is not None]


def extract_bearer_token(authorization: str | None) -> str:
    scheme, _, value = str(authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        return ""
    return value.strip()


def get_auth_info(authorization: str | None) -> dict | None:
    """内部使用的身份识别逻辑"""
    token = extract_bearer_token(authorization)
    if not token:
        return None

    admin_key = str(config.auth_key or "").strip()
    
    # 1. 检查是否为原始 Admin Key
    if admin_key and token == admin_key:
        return {"role": "admin", "key": token}

    # 2. 检查是否为原始 User Key
    user = user_service.get_user(token)
    if user and user.get("status") == "active":
        return {"role": "user", "key": token, "user": user}

    # 3. 检查是否为 Session ID
    session = user_service.get_session(token)
    if session:
        real_key = session.get("user_key")
        if admin_key and real_key == admin_key:
            return {"role": "admin", "key": real_key}
        user = user_service.get_user(real_key)
        if user and user.get("status") == "active":
            return {"role": "user", "key": real_key, "user": user}

    return None


# FastAPI 依赖项
async def get_active_auth(authorization: str | None = Header(default=None)) -> dict:
    auth_info = get_auth_info(authorization)
    if not auth_info:
        raise HTTPException(status_code=401, detail={"error": "授权无效或 Key 已禁用"})
    return auth_info


async def get_admin_auth(auth: dict = Depends(get_active_auth)) -> dict:
    if auth["role"] != "admin":
        raise HTTPException(status_code=403, detail={"error": "需要管理员权限"})
    return auth


def resolve_image_base_url(request: Request) -> str:
    return config.base_url or f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"


def start_limited_account_watcher(stop_event: Event) -> Thread:
    interval_seconds = config.refresh_account_interval_minute * 60

    def worker() -> None:
        while not stop_event.is_set():
            try:
                limited_tokens = account_service.list_limited_tokens()
                if limited_tokens:
                    print(f"[账户限流检查] 正在检查 {len(limited_tokens)} 个限流账户")
                    account_service.refresh_accounts(limited_tokens)
            except Exception as exc:
                print(f"[账户限流检查] 失败: {exc}")
            stop_event.wait(interval_seconds)

    thread = Thread(target=worker, name="limited-account-watcher", daemon=True)
    thread.start()
    return thread


def resolve_web_asset(requested_path: str) -> Path | None:
    if not WEB_DIST_DIR.exists():
        return None

    clean_path = requested_path.strip("/")
    if not clean_path:
        candidates = [WEB_DIST_DIR / "index.html"]
    else:
        relative_path = Path(clean_path)
        candidates = [
            WEB_DIST_DIR / relative_path,
            WEB_DIST_DIR / relative_path / "index.html",
            WEB_DIST_DIR / f"{clean_path}.html",
        ]

    for candidate in candidates:
        try:
            candidate.relative_to(WEB_DIST_DIR)
        except ValueError:
            continue
        if candidate.is_file():
            return candidate

    return None


def create_app() -> FastAPI:
    chatgpt_service = ChatGPTService(account_service)
    app_version = get_app_version()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        stop_event = Event()
        thread = start_limited_account_watcher(stop_event)
        try:
            yield
        finally:
            stop_event.set()
            thread.join(timeout=1)

    app = FastAPI(title="chatgpt2api", version=app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    router = APIRouter()

    @router.get("/v1/models")
    async def list_models(auth: dict = Depends(get_active_auth)):
        return {
            "object": "list",
            "data": [
                build_model_item("gpt-image-1"),
                build_model_item("gpt-image-2"),
            ],
        }

    @router.post("/auth/login")
    async def login(auth: dict = Depends(get_active_auth)):
        return {"ok": True}

    @router.post("/api/auth/session")
    async def create_session(body: SessionCreateRequest):
        user = user_service.get_user(body.key)
        if not user or user.get("status") != "active":
            # 检查是否为管理员
            admin_key = str(config.auth_key or "").strip()
            if admin_key and body.key == admin_key:
                session_id = user_service.create_session(body.key)
                return {"session_id": session_id, "role": "admin"}
            raise HTTPException(status_code=401, detail={"error": "无效的 Key"})
        
        session_id = user_service.create_session(body.key)
        return {"session_id": session_id, "role": "user"}

    @router.get("/api/auth/session/{session_id}")
    async def get_session(session_id: str):
        session = user_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail={"error": "会话已过期"})
        return session

    @router.get("/version")
    async def get_version():
        return {"version": app_version}

    @router.get("/api/me")
    async def get_me(auth: dict = Depends(get_active_auth)):
        return {
            "role": auth["role"],
            "name": auth.get("user", {}).get("name") if auth["role"] == "user" else "管理员",
            "quota": auth.get("user", {}).get("quota") if auth["role"] == "user" else -1,
            "used": auth.get("user", {}).get("used") if auth["role"] == "user" else 0
        }

    @router.get("/api/settings")
    async def get_settings(admin: dict = Depends(get_admin_auth)):
        return {"config": config.get()}

    @router.post("/api/settings")
    async def save_settings(
            body: SettingsUpdateRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        return {"config": config.update(body.model_dump(mode="python"))}

    @router.get("/api/accounts")
    async def get_accounts(admin: dict = Depends(get_admin_auth)):
        return {"items": account_service.list_accounts()}

    @router.post("/api/accounts")
    async def create_accounts(body: AccountCreateRequest, admin: dict = Depends(get_admin_auth)):
        tokens = [str(token or "").strip() for token in body.tokens if str(token or "").strip()]
        if not tokens:
            raise HTTPException(status_code=400, detail={"error": "令牌不能为空"})
        result = account_service.add_accounts(tokens)
        refresh_result = account_service.refresh_accounts(tokens)
        return {
            **result,
            "refreshed": refresh_result.get("refreshed", 0),
            "errors": refresh_result.get("errors", []),
            "items": refresh_result.get("items", result.get("items", [])),
        }

    @router.post("/api/accounts/upload")
    async def upload_accounts(body: AccountCreateRequest, admin: dict = Depends(get_admin_auth)):
        """专门给注册机使用的轻量级上传接口"""
        tokens = [str(token or "").strip() for token in body.tokens if str(token or "").strip()]
        if not tokens:
            raise HTTPException(status_code=400, detail={"error": "令牌不能为空"})
        
        # 仅执行添加，不立即返回全量数据，减少传输压力
        result = account_service.add_accounts(tokens)
        
        # 后台异步执行刷新（可选，如果注册机不关心账号状态的话可以不刷，
        # 但建议刷一下以获取账号类型和额度）
        # 这里为了响应速度，我们可以直接返回结果
        return {
            "status": "success",
            "added": result.get("added", 0),
            "skipped": result.get("skipped", 0),
            "message": f"成功添加 {result.get('added')} 个，跳过 {result.get('skipped')} 个已存在的账号"
        }

    @router.delete("/api/accounts")
    async def delete_accounts(body: AccountDeleteRequest, admin: dict = Depends(get_admin_auth)):
        tokens = [str(token or "").strip() for token in body.tokens if str(token or "").strip()]
        if not tokens:
            raise HTTPException(status_code=400, detail={"error": "令牌不能为空"})
        return account_service.delete_accounts(tokens)

    @router.post("/api/accounts/refresh")
    async def refresh_accounts(body: AccountRefreshRequest, admin: dict = Depends(get_admin_auth)):
        access_tokens = [str(token or "").strip() for token in body.access_tokens if str(token or "").strip()]
        if not access_tokens:
            access_tokens = account_service.list_tokens()
        if not access_tokens:
            raise HTTPException(status_code=400, detail={"error": "访问令牌不能为空"})
        return account_service.refresh_accounts(access_tokens)

    @router.post("/api/accounts/update")
    async def update_account(body: AccountUpdateRequest, admin: dict = Depends(get_admin_auth)):
        access_token = str(body.access_token or "").strip()
        if not access_token:
            raise HTTPException(status_code=400, detail={"error": "访问令牌不能为空"})

        updates = {
            key: value
            for key, value in {
                "type": body.type,
                "status": body.status,
                "quota": body.quota,
            }.items()
            if value is not None
        }
        if not updates:
            raise HTTPException(status_code=400, detail={"error": "未提供更新项"})

        account = account_service.update_account(access_token, updates)
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "账户不存在"})
        return {"item": account, "items": account_service.list_accounts()}

    @router.post("/v1/images/generations")
    async def generate_images(
            body: ImageGenerationRequest,
            request: Request,
            auth: dict = Depends(get_active_auth)
    ):
        if auth["role"] == "user":
            if not user_service.use_quota(auth["key"]):
                raise HTTPException(status_code=403, detail={"error": "额度已耗尽"})

        base_url = resolve_image_base_url(request)
        try:
            result = await run_in_threadpool(
                chatgpt_service.generate_with_pool, body.prompt, body.model, body.n, body.response_format, base_url
            )
            stats_service.record_success()
            
            # 自动保存到历史 (如果用户已登录)
            if auth["role"] == "user":
                image_data = result.get("data", [])
                for item in image_data:
                    if isinstance(item, dict) and item.get("b64_json"):
                        image_history_service.save_image(
                            auth["key"], 
                            body.prompt, 
                            f"data:image/png;base64,{item.get('b64_json')}", 
                            body.model
                        )
            
            return result
        except ImageGenerationError as exc:
            stats_service.record_fail()
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc

    @router.post("/v1/images/edits")
    async def edit_images(
            request: Request,
            image: list[UploadFile] | None = File(default=None),
            image_list: list[UploadFile] | None = File(default=None, alias="image[]"),
            prompt: str = Form(...),
            model: str = Form(default="gpt-image-1"),
            n: int = Form(default=1),
            response_format: str = Form(default="b64_json"),
            auth: dict = Depends(get_active_auth),
    ):
        if auth["role"] == "user":
            if not user_service.use_quota(auth["key"]):
                raise HTTPException(status_code=403, detail={"error": "额度已耗尽"})

        base_url = resolve_image_base_url(request)

        uploads = (image or []) + (image_list or [])
        if not uploads:
            raise HTTPException(status_code=400, detail={"error": "缺少图片文件"})

        images: list[tuple[bytes, str, str]] = []
        for upload in uploads:
            image_data = await upload.read()
            if not image_data:
                raise HTTPException(status_code=400, detail={"error": "图片文件为空"})

            file_name = upload.filename or "image.png"
            mime_type = upload.content_type or "image/png"
            images.append((image_data, file_name, mime_type))

        try:
            result = await run_in_threadpool(
                chatgpt_service.edit_with_pool, prompt, images, model, n, response_format, base_url
            )
            stats_service.record_success()
            return result
        except ImageGenerationError as exc:
            stats_service.record_fail()
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc

    @router.post("/v1/chat/completions")
    async def create_chat_completion(body: ChatCompletionRequest, auth: dict = Depends(get_active_auth)):
        if auth["role"] == "user":
            if not user_service.use_quota(auth["key"]):
                raise HTTPException(status_code=403, detail={"error": "额度已耗尽"})
        
        try:
            result = await run_in_threadpool(chatgpt_service.create_image_completion, body.model_dump(mode="python"))
            stats_service.record_success()
            return result
        except Exception as exc:
            # 如果是 HTTPException 且 detail 中有 error，可能是业务错误
            if isinstance(exc, HTTPException):
                stats_service.record_fail()
                raise exc
            stats_service.record_fail()
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc

    @router.post("/api/users")
    async def create_user(body: UserCreateRequest, admin: dict = Depends(get_admin_auth)):
        return user_service.create_user(body.name, body.quota)

    @router.get("/api/users")
    async def list_users(admin: dict = Depends(get_admin_auth)):
        return {"items": user_service.list_users()}

    @router.delete("/api/users/{key}")
    async def delete_user(key: str, admin: dict = Depends(get_admin_auth)):
        if user_service.delete_user(key):
            return {"ok": True}
        raise HTTPException(status_code=404, detail={"error": "用户不存在"})

    @router.post("/api/users/{key}")
    async def update_user(key: str, body: UserUpdateRequest, admin: dict = Depends(get_admin_auth)):
        user = user_service.update_user(key, body.model_dump(exclude_none=True))
        if user:
            return {"item": user}
        raise HTTPException(status_code=404, detail={"error": "用户不存在"})

    @router.get("/api/stats")
    async def get_stats(admin: dict = Depends(get_admin_auth)):
        return stats_service.get_stats()

    # ── 图片历史和广场接口 ──────────────────────────────────────────

    @router.get("/api/images/history")
    async def get_image_history(auth: dict = Depends(get_active_auth)):
        return {"items": image_history_service.list_images(auth["key"])}

    @router.delete("/api/images/history/{image_id}")
    async def delete_image_history(image_id: str, auth: dict = Depends(get_active_auth)):
        if image_history_service.delete_image(image_id, auth["key"]):
            return {"ok": True}
        raise HTTPException(status_code=404, detail={"error": "图片不存在"})

    @router.post("/api/plaza/publish/{image_id}")
    async def publish_to_plaza(image_id: str, auth: dict = Depends(get_active_auth)):
        if plaza_service.publish_to_plaza(image_id, auth["key"]):
            return {"ok": True}
        raise HTTPException(status_code=400, detail={"error": "发布失败"})

    @router.delete("/api/plaza/publish/{image_id}")
    async def unpublish_from_plaza(image_id: str, auth: dict = Depends(get_active_auth)):
        if plaza_service.unpublish_from_plaza(image_id, auth["key"]):
            return {"ok": True}
        raise HTTPException(status_code=400, detail={"error": "取消发布失败"})

    @router.get("/api/plaza")
    async def list_plaza():
        return {"items": plaza_service.list_plaza()}

    # 对话管理端点
    @router.get("/api/images/conversations")
    async def get_conversations(auth: dict = Depends(get_active_auth)):
        return {"items": conversation_service.list_conversations(auth["key"])}

    @router.post("/api/images/conversations")
    async def save_conversation(data: Dict[str, Any], auth: dict = Depends(get_active_auth)):
        conv_id = data.get("id")
        if not conv_id:
            raise HTTPException(status_code=400, detail="Missing conversation ID")
        conversation_service.save_conversation(auth["key"], conv_id, data)
        return {"ok": True}

    @router.delete("/api/images/conversations/{conv_id}")
    async def delete_conversation(conv_id: str, auth: dict = Depends(get_active_auth)):
        conversation_service.delete_conversation(auth["key"], conv_id)
        return {"ok": True}

    @router.delete("/api/images/conversations")
    async def clear_conversations(auth: dict = Depends(get_active_auth)):
        conversation_service.clear_conversations(auth["key"])
        return {"ok": True}

    # ── CPA multi-pool endpoints ────────────────────────────────────

    @router.get("/api/cpa/pools")
    async def list_cpa_pools(admin: dict = Depends(get_admin_auth)):
        return {"pools": sanitize_cpa_pools(cpa_config.list_pools())}

    @router.post("/api/cpa/pools")
    async def create_cpa_pool(
            body: CPAPoolCreateRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        if not body.base_url.strip():
            raise HTTPException(status_code=400, detail={"error": "base_url is required"})
        if not body.secret_key.strip():
            raise HTTPException(status_code=400, detail={"error": "secret_key 不能为空"})
        pool = cpa_config.add_pool(
            name=body.name,
            base_url=body.base_url,
            secret_key=body.secret_key,
        )
        return {"pool": sanitize_cpa_pool(pool), "pools": sanitize_cpa_pools(cpa_config.list_pools())}

    @router.post("/api/cpa/pools/{pool_id}")
    async def update_cpa_pool(
            pool_id: str,
            body: CPAPoolUpdateRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        pool = cpa_config.update_pool(pool_id, body.model_dump(exclude_none=True))
        if pool is None:
            raise HTTPException(status_code=404, detail={"error": "pool not found"})
        return {"pool": sanitize_cpa_pool(pool), "pools": sanitize_cpa_pools(cpa_config.list_pools())}

    @router.delete("/api/cpa/pools/{pool_id}")
    async def delete_cpa_pool(
            pool_id: str,
            admin: dict = Depends(get_admin_auth),
    ):
        if not cpa_config.delete_pool(pool_id):
            raise HTTPException(status_code=404, detail={"error": "号池不存在"})
        return {"pools": sanitize_cpa_pools(cpa_config.list_pools())}

    @router.get("/api/cpa/pools/{pool_id}/files")
    async def cpa_pool_files(
            pool_id: str,
            admin: dict = Depends(get_admin_auth),
    ):
        pool = cpa_config.get_pool(pool_id)
        if pool is None:
            raise HTTPException(status_code=404, detail={"error": "pool not found"})
        files = await run_in_threadpool(list_remote_files, pool)
        return {"pool_id": pool_id, "files": files}

    @router.post("/api/cpa/pools/{pool_id}/import")
    async def cpa_pool_import(
            pool_id: str,
            body: CPAImportRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        pool = cpa_config.get_pool(pool_id)
        if pool is None:
            raise HTTPException(status_code=404, detail={"error": "pool not found"})
        try:
            job = cpa_import_service.start_import(pool, body.names)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"import_job": job}

    @router.get("/api/cpa/pools/{pool_id}/import")
    async def cpa_pool_import_progress(pool_id: str, admin: dict = Depends(get_admin_auth)):
        pool = cpa_config.get_pool(pool_id)
        if pool is None:
            raise HTTPException(status_code=404, detail={"error": "pool not found"})
        return {"import_job": pool.get("import_job")}

    # ── Sub2API endpoints ─────────────────────────────────────────────

    @router.get("/api/sub2api/servers")
    async def list_sub2api_servers(admin: dict = Depends(get_admin_auth)):
        return {"servers": sanitize_sub2api_servers(sub2api_config.list_servers())}

    @router.post("/api/sub2api/servers")
    async def create_sub2api_server(
            body: Sub2APIServerCreateRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        if not body.base_url.strip():
            raise HTTPException(status_code=400, detail={"error": "base_url is required"})
        has_login = body.email.strip() and body.password.strip()
        has_api_key = bool(body.api_key.strip())
        if not has_login and not has_api_key:
            raise HTTPException(
                status_code=400,
                detail={"error": "需要 邮箱+密码 或 API Key"},
            )
        server = sub2api_config.add_server(
            name=body.name,
            base_url=body.base_url,
            email=body.email,
            password=body.password,
            api_key=body.api_key,
            group_id=body.group_id,
        )
        return {
            "server": sanitize_sub2api_server(server),
            "servers": sanitize_sub2api_servers(sub2api_config.list_servers()),
        }

    @router.post("/api/sub2api/servers/{server_id}")
    async def update_sub2api_server(
            server_id: str,
            body: Sub2APIServerUpdateRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        server = sub2api_config.update_server(server_id, body.model_dump(exclude_none=True))
        if server is None:
            raise HTTPException(status_code=404, detail={"error": "server not found"})
        return {
            "server": sanitize_sub2api_server(server),
            "servers": sanitize_sub2api_servers(sub2api_config.list_servers()),
        }

    @router.delete("/api/sub2api/servers/{server_id}")
    async def delete_sub2api_server(
            server_id: str,
            admin: dict = Depends(get_admin_auth),
    ):
        if not sub2api_config.delete_server(server_id):
            raise HTTPException(status_code=404, detail={"error": "服务器不存在"})
        return {"servers": sanitize_sub2api_servers(sub2api_config.list_servers())}

    @router.get("/api/sub2api/servers/{server_id}/groups")
    async def sub2api_server_groups(
            server_id: str,
            admin: dict = Depends(get_admin_auth),
    ):
        server = sub2api_config.get_server(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail={"error": "server not found"})
        try:
            groups = await run_in_threadpool(sub2api_list_remote_groups, server)
        except Exception as exc:
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc
        return {"server_id": server_id, "groups": groups}

    @router.get("/api/sub2api/servers/{server_id}/accounts")
    async def sub2api_server_accounts(
            server_id: str,
            admin: dict = Depends(get_admin_auth),
    ):
        server = sub2api_config.get_server(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail={"error": "server not found"})
        try:
            accounts = await run_in_threadpool(sub2api_list_remote_accounts, server)
        except Exception as exc:
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc
        return {"server_id": server_id, "accounts": accounts}

    @router.post("/api/sub2api/servers/{server_id}/import")
    async def sub2api_server_import(
            server_id: str,
            body: Sub2APIImportRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        server = sub2api_config.get_server(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail={"error": "server not found"})
        try:
            job = sub2api_import_service.start_import(server, body.account_ids)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"import_job": job}

    @router.get("/api/sub2api/servers/{server_id}/import")
    async def sub2api_server_import_progress(
            server_id: str,
            admin: dict = Depends(get_admin_auth),
    ):
        server = sub2api_config.get_server(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail={"error": "server not found"})
        return {"import_job": server.get("import_job")}

    # ── Upstream proxy endpoints ─────────────────────────────────────

    @router.get("/api/proxy")
    async def get_proxy(admin: dict = Depends(get_admin_auth)):
        return {
            "proxy": {
                "enabled": bool(config.get_proxy_settings()),
                "url": config.get_proxy_settings()
            }
        }

    @router.post("/api/proxy")
    async def update_proxy(body: ProxyUpdateRequest, admin: dict = Depends(get_admin_auth)):
        current_config = config.get()
        if body.url is not None:
            current_config["proxy"] = body.url
        config.update(current_config)
        return await get_proxy(admin)

    @router.post("/api/proxy/test")
    async def test_proxy_endpoint(
            body: ProxyTestRequest,
            admin: dict = Depends(get_admin_auth),
    ):
        candidate = (body.url or "").strip()
        if not candidate:
            candidate = config.get_proxy_settings()
        if not candidate:
            raise HTTPException(status_code=400, detail={"error": "代理地址不能为空"})
        result = await run_in_threadpool(test_proxy, candidate)
        return {"result": result}

    app.include_router(router)

    # 挂载静态图片目录
    if config.images_dir.exists():
        app.mount("/images", StaticFiles(directory=str(config.images_dir)), name="images")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_web(full_path: str):
        asset = resolve_web_asset(full_path)
        if asset is not None:
            return FileResponse(asset)

        # Static assets (_next/*) must not fallback to HTML — return 404
        if full_path.strip("/").startswith("_next/"):
            raise HTTPException(status_code=404, detail="Not Found")

        fallback = resolve_web_asset("")
        if fallback is None:
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(fallback)

    return app
