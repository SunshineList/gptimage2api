from __future__ import annotations

from typing import Iterable

from fastapi import HTTPException

from services.account_service import AccountService
from services.image_service import ImageGenerationError, edit_image_result, generate_image_result, is_token_invalid_error
from services.utils import (
    build_chat_image_completion,
    extract_chat_image,
    extract_chat_prompt,
    extract_image_from_message_content,
    extract_response_prompt,
    has_response_image_generation_tool,
    is_image_chat_request,
    parse_image_count,
)


def _extract_response_image(input_value: object) -> tuple[bytes, str] | None:
    if isinstance(input_value, dict):
        return extract_image_from_message_content(input_value.get("content"))
    if not isinstance(input_value, list):
        return None
    for item in reversed(input_value):
        if isinstance(item, dict):
            if str(item.get("type") or "").strip() == "input_image":
                import base64 as b64
                image_url = str(item.get("image_url") or "")
                if image_url.startswith("data:"):
                    header, _, data = image_url.partition(",")
                    mime = header.split(";")[0].removeprefix("data:")
                    return b64.b64decode(data), mime or "image/png"
            content = item.get("content")
            if content:
                result = extract_image_from_message_content(content)
                if result:
                    return result
    return None


class ChatGPTService:
    def __init__(self, account_service: AccountService):
        self.account_service = account_service

    def generate_with_pool(self, prompt: str, model: str, n: int, response_format: str = "b64_json", base_url: str = None):
        created = None
        image_items: list[dict[str, object]] = []

        for index in range(1, n + 1):
            while True:
                try:
                    request_token = self.account_service.get_available_access_token()
                except RuntimeError as exc:
                    print(f"[图片生成] 停止 索引={index}/{n} 错误={exc}")
                    break

                print(f"[图片生成] 开始 池化令牌={request_token[:12]}... 模型={model} 索引={index}/{n}")
                try:
                    result = generate_image_result(request_token, prompt, model, response_format, base_url)
                    account = self.account_service.mark_image_result(request_token, success=True)
                    if created is None:
                        created = result.get("created")
                    data = result.get("data")
                    if isinstance(data, list):
                        image_items.extend(item for item in data if isinstance(item, dict))
                    print(
                        f"[图片生成] 成功 池化令牌={request_token[:12]}... "
                        f"额度={account.get('quota') if account else '未知'} 状态={account.get('status') if account else '未知'}"
                    )
                    break
                except ImageGenerationError as exc:
                    account = self.account_service.mark_image_result(request_token, success=False)
                    message = str(exc)
                    print(
                        f"[图片生成] 失败 池化令牌={request_token[:12]}... "
                        f"错误={message} 额度={account.get('quota') if account else '未知'} 状态={account.get('status') if account else '未知'}"
                    )
                    if is_token_invalid_error(message):
                        self.account_service.remove_token(request_token)
                        print(f"[图片生成] 移除无效令牌={request_token[:12]}...")
                        continue
                    break

        if not image_items:
            raise ImageGenerationError("图片生成失败")

        return {
            "created": created,
            "data": image_items,
        }

    def edit_with_pool(
        self,
        prompt: str,
        images: Iterable[tuple[bytes, str, str]],
        model: str,
        n: int,
        response_format: str = "b64_json",
        base_url: str = None,
    ):
        created = None
        image_items: list[dict[str, object]] = []
        normalized_images = list(images)
        if not normalized_images:
            raise ImageGenerationError("需要图片文件")

        for index in range(1, n + 1):
            while True:
                try:
                    request_token = self.account_service.get_available_access_token()
                except RuntimeError as exc:
                    print(f"[图片编辑] 停止 索引={index}/{n} 错误={exc}")
                    break

                print(
                    f"[图片编辑] 开始 池化令牌={request_token[:12]}... "
                    f"模型={model} 索引={index}/{n} 图片数={len(normalized_images)}"
                )
                try:
                    result = edit_image_result(request_token, prompt, normalized_images, model, response_format, base_url)
                    account = self.account_service.mark_image_result(request_token, success=True)
                    if created is None:
                        created = result.get("created")
                    data = result.get("data")
                    if isinstance(data, list):
                        image_items.extend(item for item in data if isinstance(item, dict))
                    print(
                        f"[图片编辑] 成功 池化令牌={request_token[:12]}... "
                        f"额度={account.get('quota') if account else '未知'} 状态={account.get('status') if account else '未知'}"
                    )
                    break
                except ImageGenerationError as exc:
                    account = self.account_service.mark_image_result(request_token, success=False)
                    message = str(exc)
                    print(
                        f"[图片编辑] 失败 池化令牌={request_token[:12]}... "
                        f"错误={message} 额度={account.get('quota') if account else '未知'} 状态={account.get('status') if account else '未知'}"
                    )
                    if is_token_invalid_error(message):
                        self.account_service.remove_token(request_token)
                        print(f"[图片编辑] 移除无效令牌={request_token[:12]}...")
                        continue
                    break

        if not image_items:
            raise ImageGenerationError("图片编辑失败")

        return {
            "created": created,
            "data": image_items,
        }

    def create_image_completion(self, body: dict[str, object]) -> dict[str, object]:
        if not is_image_chat_request(body):
            raise HTTPException(
                status_code=400,
                detail={"error": "该接口仅支持图片生成请求"},
            )

        if bool(body.get("stream")):
            raise HTTPException(status_code=400, detail={"error": "图片生成不支持流式输出"})

        model = str(body.get("model") or "gpt-image-1").strip() or "gpt-image-1"
        n = parse_image_count(body.get("n"))
        prompt = extract_chat_prompt(body)
        if not prompt:
            raise HTTPException(status_code=400, detail={"error": "提示词不能为空"})

        image_info = extract_chat_image(body)
        try:
            if image_info:
                image_data, mime_type = image_info
                image_result = self.edit_with_pool(prompt, [(image_data, "image.png", mime_type)], model, n)
            else:
                image_result = self.generate_with_pool(prompt, model, n)
        except ImageGenerationError as exc:
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc

        return build_chat_image_completion(model, prompt, image_result)

    def create_response(self, body: dict[str, object]) -> dict[str, object]:
        if bool(body.get("stream")):
            raise HTTPException(status_code=400, detail={"error": "不支持流式输出"})

        if not has_response_image_generation_tool(body):
            raise HTTPException(
                status_code=400,
                detail={"error": "该接口仅支持 image_generation 工具请求"},
            )

        prompt = extract_response_prompt(body.get("input"))
        if not prompt:
            raise HTTPException(status_code=400, detail={"error": "输入文本不能为空"})

        image_info = _extract_response_image(body.get("input"))
        model = str(body.get("model") or "gpt-5").strip() or "gpt-5"
        try:
            if image_info:
                image_data, mime_type = image_info
                image_result = self.edit_with_pool(prompt, [(image_data, "image.png", mime_type)], "gpt-image-1", 1)
            else:
                image_result = self.generate_with_pool(prompt, "gpt-image-1", 1)
        except ImageGenerationError as exc:
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc

        image_items = image_result.get("data") if isinstance(image_result.get("data"), list) else []
        output = []
        for item in image_items:
            if not isinstance(item, dict):
                continue
            b64_json = str(item.get("b64_json") or "").strip()
            if not b64_json:
                continue
            output.append(
                {
                    "id": f"ig_{len(output) + 1}",
                    "type": "image_generation_call",
                    "status": "completed",
                    "result": b64_json,
                    "revised_prompt": str(item.get("revised_prompt") or prompt).strip(),
                }
            )

        if not output:
            raise HTTPException(status_code=502, detail={"error": "图片生成失败"})

        created = int(image_result.get("created") or 0)
        return {
            "id": f"resp_{created}",
            "object": "response",
            "created_at": created,
            "status": "completed",
            "error": None,
            "incomplete_details": None,
            "model": model,
            "output": output,
            "parallel_tool_calls": False,
        }
